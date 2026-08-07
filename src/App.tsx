import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import { ErrorBoundary, PageSkeleton } from '@/components/common';
import { ROUTES } from '@/constants/routes';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const JobsPage = lazy(() => import('@/pages/JobsPage'));
const JobDetailPage = lazy(() => import('@/pages/JobDetailPage'));
const ApplicationsPage = lazy(() => import('@/pages/ApplicationsPage'));
const ApplicationDetailPage = lazy(() => import('@/pages/ApplicationDetailPage'));
const CompaniesPage = lazy(() => import('@/pages/CompaniesPage'));
const CompanyDetailPage = lazy(() => import('@/pages/CompanyDetailPage'));
const AssistantPage = lazy(() => import('@/pages/AssistantPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function RouteSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path={ROUTES.dashboard}
          element={
            <RouteSuspense>
              <ErrorBoundary fallbackTitle="Dashboard failed to load">
                <DashboardPage />
              </ErrorBoundary>
            </RouteSuspense>
          }
        />
        <Route
          path={ROUTES.jobs}
          element={
            <RouteSuspense>
              <ErrorBoundary fallbackTitle="Jobs failed to load">
                <JobsPage />
              </ErrorBoundary>
            </RouteSuspense>
          }
        />
        <Route
          path={`${ROUTES.jobs}/:id`}
          element={
            <RouteSuspense>
              <ErrorBoundary fallbackTitle="Job detail failed to load">
                <JobDetailPage />
              </ErrorBoundary>
            </RouteSuspense>
          }
        />
        <Route
          path={ROUTES.applications}
          element={
            <RouteSuspense>
              <ErrorBoundary fallbackTitle="Applications failed to load">
                <ApplicationsPage />
              </ErrorBoundary>
            </RouteSuspense>
          }
        />
        <Route
          path={`${ROUTES.applications}/:id`}
          element={
            <RouteSuspense>
              <ErrorBoundary fallbackTitle="Application detail failed to load">
                <ApplicationDetailPage />
              </ErrorBoundary>
            </RouteSuspense>
          }
        />
        <Route
          path={ROUTES.companies}
          element={
            <RouteSuspense>
              <ErrorBoundary fallbackTitle="Companies failed to load">
                <CompaniesPage />
              </ErrorBoundary>
            </RouteSuspense>
          }
        />
        <Route
          path={`${ROUTES.companies}/:id`}
          element={
            <RouteSuspense>
              <ErrorBoundary fallbackTitle="Company detail failed to load">
                <CompanyDetailPage />
              </ErrorBoundary>
            </RouteSuspense>
          }
        />
        <Route
          path={ROUTES.assistant}
          element={
            <RouteSuspense>
              <ErrorBoundary fallbackTitle="Assistant failed to load">
                <AssistantPage />
              </ErrorBoundary>
            </RouteSuspense>
          }
        />
        <Route
          path={ROUTES.settings}
          element={
            <RouteSuspense>
              <ErrorBoundary fallbackTitle="Settings failed to load">
                <SettingsPage />
              </ErrorBoundary>
            </RouteSuspense>
          }
        />
        <Route
          path={ROUTES.root}
          element={<Navigate to={ROUTES.dashboard} replace />}
        />
        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Route>
    </Routes>
  );
}
