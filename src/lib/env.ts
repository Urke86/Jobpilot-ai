/**
 * Typed environment configuration.
 * Values come from Vite `import.meta.env` (see `.env.example`).
 *
 * Supabase keys are optional until backend integration is enabled.
 */
function readEnv(key: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export const env = {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
  /** True when both Supabase URL and anon key are configured. */
  get isSupabaseConfigured(): boolean {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey);
  },
} as const;

export type AppEnv = typeof env;
