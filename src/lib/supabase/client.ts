import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

export type { Database } from '@/types/database';

let client: SupabaseClient<Database> | null = null;

/**
 * Returns a shared Supabase browser client when env vars are set.
 * Returns `null` until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured.
 *
 * Prefer repository modules in `src/services/supabase` over calling this from pages.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!env.isSupabaseConfigured) {
    return null;
  }

  if (!client) {
    client = createClient<Database>(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}
