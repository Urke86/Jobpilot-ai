import type {
  AuthChangeEvent,
  AuthError,
  Session,
  User,
} from '@supabase/supabase-js';
import type { Profile } from '@/services/contracts';
import { requireSupabaseClient } from '@/services/supabase/client';

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

function mapAuthError(error: AuthError | { message?: string } | null): Error {
  const message = error?.message?.trim() || 'Something went wrong. Please try again.';
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return new Error('Invalid email or password.');
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('email address has already been registered')
  ) {
    return new Error('An account with this email already exists.');
  }
  if (lower.includes('email not confirmed')) {
    return new Error('Please confirm your email before signing in.');
  }
  if (lower.includes('password should be at least')) {
    return new Error('Password must be at least 6 characters.');
  }
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return new Error('Please enter a valid email address.');
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return new Error('Too many attempts. Please wait a moment and try again.');
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return new Error('Network error. Check your connection and try again.');
  }

  return new Error(message);
}

/**
 * Ensures a profiles row exists for the signed-in user.
 * Selects first; inserts only when missing. Never overwrites existing fields.
 * Ownership always comes from the session user — never from callers.
 */
export async function ensureProfile(fullName?: string | null): Promise<Profile | null> {
  const supabase = requireSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw mapAuthError(userError);
  if (!user) return null;

  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (selectError) throw mapAuthError(selectError);
  if (existing) return existing;

  const metadataName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : null;

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      user_id: user.id,
      full_name: fullName?.trim() || metadataName,
    })
    .select('*')
    .single();

  if (insertError) throw mapAuthError(insertError);
  return created;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = requireSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw mapAuthError(userError);
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw mapAuthError(error);
  return data;
}

export async function signUp({
  email,
  password,
  fullName,
}: SignUpInput): Promise<{
  user: User | null;
  session: Session | null;
  needsEmailConfirmation: boolean;
}> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo:
        typeof window !== 'undefined'
          ? `${window.location.origin}/login`
          : undefined,
    },
  });

  if (error) throw mapAuthError(error);

  // Supabase may return an empty identities array when the email is already registered.
  const identities = data.user?.identities ?? null;
  if (data.user && Array.isArray(identities) && identities.length === 0) {
    throw new Error('An account with this email already exists.');
  }

  // Only ensure profile when a session exists (email confirmation may defer this).
  if (data.session?.user) {
    await ensureProfile(fullName);
  }

  return {
    user: data.user,
    session: data.session,
    needsEmailConfirmation: Boolean(data.user) && !data.session,
  };
}

export async function signIn({
  email,
  password,
}: SignInInput): Promise<{ user: User | null; session: Session | null }> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw mapAuthError(error);
  return { user: data.user, session: data.session };
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw mapAuthError(error);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/login`
      : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });
  if (error) throw mapAuthError(error);
}

export async function getSession(): Promise<Session | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw mapAuthError(error);
  return data.session;
}

export async function getUser(): Promise<User | null> {
  const supabase = requireSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw mapAuthError(error);
  return user;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): { data: { subscription: { unsubscribe: () => void } } } {
  const supabase = requireSupabaseClient();
  return supabase.auth.onAuthStateChange(callback);
}
