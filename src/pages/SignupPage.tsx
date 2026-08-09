import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Compass, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts';
import { ROUTES } from '@/constants/routes';
import { APP_NAME } from '@/constants';
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

const signupSchema = z
  .object({
    fullName: z.string().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { needsEmailConfirmation } = await signUp({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
      });
      if (needsEmailConfirmation) {
        setPendingEmail(values.email.trim());
        setPendingConfirmation(true);
        return;
      }
      navigate(ROUTES.dashboard, { replace: true });
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Unable to create account. Please try again.',
      );
    }
  });

  if (pendingConfirmation) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-12 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <Card className="relative w-full max-w-md border-border/60 shadow-lg">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Compass className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-2xl tracking-tight">
                Confirm your email
              </CardTitle>
              <CardDescription>
                We created your account
                {pendingEmail ? (
                  <>
                    {' '}
                    for <span className="font-medium text-foreground">{pendingEmail}</span>
                  </>
                ) : null}
                . Check your inbox and confirm before signing in.
              </CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link
              to={ROUTES.login}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-12 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
      <Card className="relative w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Compass className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl tracking-tight">
              Join {APP_NAME}
            </CardTitle>
            <CardDescription>
              Create an account to track jobs and applications
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                disabled={isSubmitting}
                {...register('fullName')}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              )}
            </div>
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
                autoComplete="new-password"
                placeholder="••••••••"
                disabled={isSubmitting}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                disabled={isSubmitting}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
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
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              to={ROUTES.login}
              className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
