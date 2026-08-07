import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Returns a configured Supabase client or throws.
 * Use only from Supabase repository implementations (not pages).
 */
export function requireSupabaseClient(): TypedSupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return client;
}

export async function requireUserId(): Promise<string> {
  const supabase = requireSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('You must be signed in to continue.');
  return user.id;
}
