import {
  adminClient,
  corsHeaders,
  encryptTokenPair,
  exchangeGoogleCode,
  fetchGoogleUserEmail,
  GOOGLE_SCOPES,
  verifyOAuthState,
} from '../_shared/google-auth.ts';

function appRedirect(pathQuery: string): Response {
  const base =
    Deno.env.get('JOBPILOT_APP_URL')?.trim() ||
    'http://localhost:5173';
  const url = `${base.replace(/\/$/, '')}${pathQuery}`;
  return Response.redirect(url, 302);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(req.url);
    const err = url.searchParams.get('error');
    if (err) {
      return appRedirect(
        `/settings?tab=integrations&google=error&reason=${encodeURIComponent(err)}`,
      );
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) {
      return appRedirect('/settings?tab=integrations&google=error&reason=missing_code');
    }

    const userId = await verifyOAuthState(state);
    if (!userId) {
      return appRedirect('/settings?tab=integrations&google=error&reason=invalid_state');
    }

    const tokens = await exchangeGoogleCode(code);
    const email = await fetchGoogleUserEmail(tokens.access_token);
    const packed = await encryptTokenPair(
      tokens.access_token,
      tokens.refresh_token ?? null,
    );
    const expiresAt = new Date(
      Date.now() + (tokens.expires_in ?? 3600) * 1000,
    ).toISOString();

    const scopes = (tokens.scope || GOOGLE_SCOPES.join(' '))
      .split(/\s+/)
      .filter(Boolean);

    const admin = adminClient();
    const { error } = await admin.from('user_integrations').upsert(
      {
        user_id: userId,
        provider: 'google',
        provider_account_email: email,
        access_token_cipher: packed.access_token_cipher,
        refresh_token_cipher: packed.refresh_token_cipher,
        token_iv: packed.token_iv,
        scopes,
        expires_at: expiresAt,
        metadata: {
          connected_at: new Date().toISOString(),
          gmail_readonly: scopes.some((s) => s.includes('gmail.readonly')),
          calendar_events: scopes.some((s) => s.includes('calendar.events')),
        },
      },
      { onConflict: 'user_id,provider' },
    );

    if (error) {
      console.error('integration_upsert_error', error.message);
      return appRedirect('/settings?tab=integrations&google=error&reason=persist_failed');
    }

    await admin.from('activities').insert({
      user_id: userId,
      entity_type: 'user_integration',
      activity_type: 'gmail_connected',
      title: 'Google connected',
      description: email
        ? `Connected Gmail/Calendar for ${email}.`
        : 'Connected Gmail/Calendar.',
      metadata: { provider: 'google' },
    });

    return appRedirect('/settings?tab=integrations&google=connected');
  } catch (error) {
    console.error(
      'oauth_callback_error',
      error instanceof Error ? error.message : error,
    );
    return appRedirect('/settings?tab=integrations&google=error&reason=callback_failed');
  }
});
