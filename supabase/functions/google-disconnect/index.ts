import {
  adminClient,
  corsHeadersFor,
  jsonResponse,
  requireUserClient,
  revokeGoogleToken,
} from '../_shared/google-auth.ts';
import { decryptAccessToken, decryptRefreshToken } from '../_shared/google-crypto.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }
  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, req);
    }

    let userId: string;
    let supabase;
    try {
      ({ userId, supabase } = await requireUserClient(req));
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }

    // Cipher columns are not selectable by authenticated clients — use service role.
    const admin = adminClient();
    const { data: row } = await admin
      .from('user_integrations')
      .select('access_token_cipher, refresh_token_cipher, token_iv')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();

    if (row?.access_token_cipher && row?.token_iv) {
      try {
        const access = await decryptAccessToken(
          row.access_token_cipher,
          row.token_iv,
        );
        await revokeGoogleToken(access);
      } catch {
        console.error('disconnect_revoke_access_failed');
      }
    }
    if (row?.refresh_token_cipher) {
      try {
        const refresh = await decryptRefreshToken(row.refresh_token_cipher);
        if (refresh) await revokeGoogleToken(refresh);
      } catch {
        console.error('disconnect_revoke_refresh_failed');
      }
    }

    const { error } = await admin
      .from('user_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'google');

    if (error) {
      console.error('disconnect_error', error.message);
      return jsonResponse({ error: 'Failed to disconnect Google.' }, 500, req);
    }

    await supabase.from('activities').insert({
      user_id: userId,
      entity_type: 'user_integration',
      activity_type: 'gmail_disconnected',
      title: 'Google disconnected',
      description: 'Gmail/Calendar integration removed. Tokens revoked/deleted.',
      metadata: { provider: 'google' },
    });

    return jsonResponse({ status: 'disconnected' }, 200, req);
  } catch (error) {
    console.error('disconnect_unhandled', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unexpected server error.' }, 500, req);
  }
});
