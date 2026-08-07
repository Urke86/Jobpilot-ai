import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts';
import { LoadingState } from '@/components/common';
import { ROUTES } from '@/constants/routes';

export function PublicOnlyRoute() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingState label="Loading…" className="min-h-screen" />;
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <Outlet />;
}
