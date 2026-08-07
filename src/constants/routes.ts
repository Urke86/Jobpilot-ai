/**
 * Canonical application routes.
 * Use these constants in Router definitions and navigation links.
 */
export const ROUTES = {
  root: '/',
  login: '/login',
  signup: '/signup',
  dashboard: '/dashboard',
  jobs: '/jobs',
  jobDetail: (id: string) => `/jobs/${id}` as const,
  applications: '/applications',
  applicationDetail: (id: string) => `/applications/${id}` as const,
  companies: '/companies',
  companyDetail: (id: string) => `/companies/${id}` as const,
  assistant: '/assistant',
  settings: '/settings',
} as const;

export type AppRoute =
  | typeof ROUTES.login
  | typeof ROUTES.signup
  | typeof ROUTES.dashboard
  | typeof ROUTES.jobs
  | typeof ROUTES.applications
  | typeof ROUTES.companies
  | typeof ROUTES.assistant
  | typeof ROUTES.settings;
