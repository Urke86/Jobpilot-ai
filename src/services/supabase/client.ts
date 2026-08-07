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
