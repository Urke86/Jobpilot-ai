import {
  corsHeaders,
  jsonResponse,
  requireUserClient,
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
    let supabase;
    try {
      ({ userId, supabase } = await requireUserClient(req));
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }

    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'google');

    if (error) {
      console.error('disconnect_error', error.message);
      return jsonResponse({ error: 'Failed to disconnect Google.' }, 500);
    }

    await supabase.from('activities').insert({
      user_id: userId,
      entity_type: 'user_integration',
      activity_type: 'gmail_disconnected',
      title: 'Google disconnected',
      description: 'Gmail/Calendar integration removed. Tokens deleted.',
      metadata: { provider: 'google' },
    });

    return jsonResponse({ status: 'disconnected' });
  } catch (error) {
    console.error('disconnect_unhandled', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unexpected server error.' }, 500);
  }
});
