import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/services/contracts';
import {
  ensureProfile,
  getProfile,
  getSession as fetchSession,
  onAuthStateChange,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  type SignInInput,
  type SignUpInput,
} from '@/services/auth';
import { env } from '@/lib/env';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfileForSession(
  session: Session | null,
  fullName?: string | null,
): Promise<Profile | null> {
  if (!session?.user) return null;
  try {
    const ensured = await ensureProfile(fullName);
    if (ensured) return ensured;
    return await getProfile();
  } catch {
    try {
      return await getProfile();
    } catch {
      return null;
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);
    const nextProfile = await loadProfileForSession(next);
    setProfile(nextProfile);
  }, []);

  useEffect(() => {
    if (!env.isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const initial = await fetchSession();
        if (cancelled) return;
        await applySession(initial);
      } catch {
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    const { data } = onAuthStateChange((_event, nextSession) => {
      void (async () => {
        try {
          await applySession(nextSession);
        } catch {
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          setProfile(null);
        } finally {
          setIsLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (input: SignInInput) => {
    const { session: nextSession } = await authSignIn(input);
    await applySession(nextSession);
  }, [applySession]);

  const signUp = useCallback(async (input: SignUpInput) => {
    const { session: nextSession, needsEmailConfirmation } =
      await authSignUp(input);
    if (nextSession) {
      await applySession(nextSession);
    }
    return { needsEmailConfirmation };
  }, [applySession]);

  const signOut = useCallback(async () => {
    await authSignOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    const next = await loadProfileForSession(session);
    setProfile(next);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      isLoading,
      isAuthenticated: Boolean(session?.user),
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      isLoading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
