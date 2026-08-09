import {
  adminClient,
  corsHeadersFor,
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
    return new Response('ok', { headers: corsHeadersFor(req) });
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

    const admin = adminClient();
    const { data: existing } = await admin
      .from('user_integrations')
      .select('refresh_token_cipher, metadata')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();

    // S2: Google often omits refresh_token on reconnect — preserve prior cipher.
    const refreshToStore =
      typeof tokens.refresh_token === 'string' && tokens.refresh_token.length > 0
        ? tokens.refresh_token
        : null;

    const packed = await encryptTokenPair(
      tokens.access_token,
      refreshToStore,
    );

    let refreshCipher = packed.refresh_token_cipher;
    if (!refreshToStore && existing?.refresh_token_cipher) {
      refreshCipher = existing.refresh_token_cipher;
    }
    if (!refreshCipher) {
      console.error('oauth_missing_refresh_token');
      return appRedirect(
        '/settings?tab=integrations&google=error&reason=missing_refresh',
      );
    }

    const expiresAt = new Date(
      Date.now() + (tokens.expires_in ?? 3600) * 1000,
    ).toISOString();

    const scopes = (tokens.scope || GOOGLE_SCOPES.join(' '))
      .split(/\s+/)
      .filter(Boolean);

    const prevMeta =
      existing?.metadata && typeof existing.metadata === 'object'
        ? (existing.metadata as Record<string, unknown>)
        : {};

    const { error } = await admin.from('user_integrations').upsert(
      {
        user_id: userId,
        provider: 'google',
        provider_account_email: email,
        access_token_cipher: packed.access_token_cipher,
        refresh_token_cipher: refreshCipher,
        token_iv: packed.token_iv,
        scopes,
        expires_at: expiresAt,
        metadata: {
          ...prevMeta,
          connected_at:
            typeof prevMeta.connected_at === 'string'
              ? prevMeta.connected_at
              : new Date().toISOString(),
          reconnected_at: new Date().toISOString(),
          gmail_readonly: scopes.some((s) => s.includes('gmail.readonly')),
          calendar_events: scopes.some((s) => s.includes('calendar.events')),
          refresh_preserved: !refreshToStore && Boolean(existing?.refresh_token_cipher),
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
