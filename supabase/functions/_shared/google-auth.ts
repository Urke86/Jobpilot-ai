import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.58.0';
import {
  decryptAccessToken,
  decryptRefreshToken,
  encryptTokenPair,
} from './google-crypto.ts';
import { fetchWithTimeout, GOOGLE_TIMEOUT_MS } from './fetch-timeout.ts';
import { corsHeaders, corsHeadersFor } from './cors.ts';

export { corsHeaders, corsHeadersFor };
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
] as const;

export function jsonResponse(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
  });
}

export function getGoogleClientConfig() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim();
  const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth is not configured.');
  }
  return { clientId, clientSecret, redirectUri };
}

export async function requireUserClient(req: Request): Promise<{
  userId: string;
  supabase: SupabaseClient;
  accessToken: string;
}> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const headers = {
    ...corsHeadersFor(req),
    'Content-Type': 'application/json',
  };
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Response(JSON.stringify({ error: 'Incomplete environment.' }), {
      status: 500,
      headers,
    });
  }
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers,
    });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers,
    });
  }
  return {
    userId: user.id,
    supabase,
    accessToken: authHeader.slice('Bearer '.length),
  };
}

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function oauthStateHmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('GOOGLE_OAUTH_STATE_SECRET')?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      'GOOGLE_OAUTH_STATE_SECRET must be configured (min 32 chars).',
    );
  }
  // Keep prior key material derivation for in-flight state compatibility.
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.slice(0, 32)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signOAuthState(userId: string): Promise<string> {
  const key = await oauthStateHmacKey();
  const payload = JSON.stringify({
    uid: userId,
    n: crypto.randomUUID(),
    exp: Date.now() + 10 * 60 * 1000,
  });
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
  );
  const sigB64 = btoa(String.fromCharCode(...sig));
  const payB64 = btoa(payload);
  return `${payB64}.${sigB64}`;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifyOAuthState(state: string): Promise<string | null> {
  try {
    const key = await oauthStateHmacKey();
    const [payB64, sigB64] = state.split('.');
    if (!payB64 || !sigB64) return null;
    const payload = atob(payB64);
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      b64ToBytes(sigB64),
      new TextEncoder().encode(payload),
    );
    if (!ok) return null;
    const parsed = JSON.parse(payload) as { uid?: string; exp?: number };
    if (!parsed.uid || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}> {
  const { clientId, clientSecret, redirectUri } = getGoogleClientConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetchWithTimeout(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
    GOOGLE_TIMEOUT_MS,
  );
  if (!res.ok) {
    console.error('google_token_exchange_failed', res.status);
    throw new Error('Google token exchange failed.');
  }
  return await res.json();
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  scope?: string;
}> {
  const { clientId, clientSecret } = getGoogleClientConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetchWithTimeout(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
    GOOGLE_TIMEOUT_MS,
  );
  if (!res.ok) {
    console.error('google_refresh_failed', res.status);
    throw new Error('Google token refresh failed. Reconnect Google.');
  }
  return await res.json();
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetchWithTimeout(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    GOOGLE_TIMEOUT_MS,
  );
  if (!res.ok) return null;
  const json = await res.json();
  return typeof json.email === 'string' ? json.email : null;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetchWithTimeout(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      GOOGLE_TIMEOUT_MS,
    );
  } catch (err) {
    console.error(
      'google_revoke_failed',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}

export async function getValidGoogleAccessToken(
  admin: SupabaseClient,
  userId: string,
): Promise<{ accessToken: string; integrationId: string; email: string | null }> {
  const { data: row, error } = await admin
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();
  if (error || !row) {
    throw new Error('Google is not connected.');
  }
  if (!row.access_token_cipher || !row.token_iv) {
    throw new Error('Google tokens missing. Reconnect Google.');
  }

  let access = await decryptAccessToken(row.access_token_cipher, row.token_iv);
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt && Date.now() > expiresAt - 60_000) {
    const refresh = await decryptRefreshToken(row.refresh_token_cipher);
    if (!refresh) throw new Error('Google session expired. Reconnect Google.');
    const refreshed = await refreshGoogleAccessToken(refresh);
    const packed = await encryptTokenPair(
      refreshed.access_token,
      refresh,
    );
    const newExpires = new Date(
      Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    ).toISOString();
    await admin
      .from('user_integrations')
      .update({
        access_token_cipher: packed.access_token_cipher,
        refresh_token_cipher: packed.refresh_token_cipher,
        token_iv: packed.token_iv,
        expires_at: newExpires,
      })
      .eq('id', row.id);
    access = refreshed.access_token;
  }

  return {
    accessToken: access,
    integrationId: row.id,
    email: row.provider_account_email,
  };
}

export { encryptTokenPair };
