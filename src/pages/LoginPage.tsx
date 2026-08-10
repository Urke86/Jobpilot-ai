import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Compass, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts';
import { ROUTES } from '@/constants/routes';
import { APP_NAME } from '@/constants';
import { env } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function resolvePostLoginPath(from: unknown): string {
  if (
    from &&
    typeof from === 'object' &&
    'pathname' in from &&
    typeof (from as { pathname: unknown }).pathname === 'string'
  ) {
    const loc = from as { pathname: string; search?: string; hash?: string };
    if (
      loc.pathname &&
      loc.pathname !== ROUTES.login &&
      loc.pathname !== ROUTES.signup
    ) {
      return `${loc.pathname}${loc.search ?? ''}${loc.hash ?? ''}`;
    }
  }
  return ROUTES.dashboard;
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!env.isSupabaseConfigured) {
      setFormError(
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.',
      );
      return;
    }
    try {
      await signIn(values);
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(resolvePostLoginPath(from), { replace: true });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to sign in. Please try again.',
      );
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-12 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
      <Card className="relative w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Compass className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl tracking-tight">{APP_NAME}</CardTitle>
            <CardDescription>Sign in to continue to your workspace</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!env.isSupabaseConfigured ? (
            <p
              className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              Backend is not configured. Add Supabase URL and anon key to continue.
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                disabled={isSubmitting}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isSubmitting}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            {formError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
            <Button
              type="submit"
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              to={ROUTES.signup}
              className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Create one
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
