import {
  corsHeaders,
  getGoogleClientConfig,
  GOOGLE_SCOPES,
  jsonResponse,
  requireUserClient,
  signOAuthState,
} from '../_shared/google-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    let userId: string;
    try {
      ({ userId } = await requireUserClient(req));
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }

    let clientId: string;
    let redirectUri: string;
    try {
      ({ clientId, redirectUri } = getGoogleClientConfig());
    } catch {
      return jsonResponse(
        {
          error:
            'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.',
        },
        503,
      );
    }

    const state = await signOAuthState(userId);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });

    return jsonResponse({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      scopes: GOOGLE_SCOPES,
    });
  } catch (error) {
    console.error('oauth_start_error', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unexpected server error.' }, 500);
  }
});
