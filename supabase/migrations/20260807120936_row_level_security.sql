-- JobPilot AI — Row Level Security
-- Ownership is enforced via user_id = auth.uid().
-- Related-row inserts/updates also verify parent ownership.

-- ---------------------------------------------------------------------------
-- Helper: current authenticated user
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_delete_own
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

CREATE POLICY companies_select_own
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY companies_insert_own
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY companies_update_own
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY companies_delete_own
  ON public.companies
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- contacts (must belong to caller's company)
-- ---------------------------------------------------------------------------

CREATE POLICY contacts_select_own
  ON public.contacts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY contacts_insert_own
  ON public.contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY contacts_update_own
  ON public.contacts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY contacts_delete_own
  ON public.contacts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- jobs (optional company must be owned by caller)
-- ---------------------------------------------------------------------------

CREATE POLICY jobs_select_own
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY jobs_insert_own
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      company_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = company_id
          AND c.user_id = auth.uid()
      )
    )
  );

CREATE POLICY jobs_update_own
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      company_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = company_id
          AND c.user_id = auth.uid()
      )
    )
  );

CREATE POLICY jobs_delete_own
  ON public.jobs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- job_analysis (must belong to caller's job)
-- ---------------------------------------------------------------------------

CREATE POLICY job_analysis_select_own
  ON public.job_analysis
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY job_analysis_insert_own
  ON public.job_analysis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_id
        AND j.user_id = auth.uid()
    )
  );

CREATE POLICY job_analysis_update_own
  ON public.job_analysis
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_id
        AND j.user_id = auth.uid()
    )
  );

CREATE POLICY job_analysis_delete_own
  ON public.job_analysis
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- applications (must belong to caller's job)
-- ---------------------------------------------------------------------------

CREATE POLICY applications_select_own
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY applications_insert_own
  ON public.applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_id
        AND j.user_id = auth.uid()
    )
  );

CREATE POLICY applications_update_own
  ON public.applications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_id
        AND j.user_id = auth.uid()
    )
  );

CREATE POLICY applications_delete_own
  ON public.applications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- application_artifacts (must belong to caller's application)
-- ---------------------------------------------------------------------------

CREATE POLICY application_artifacts_select_own
  ON public.application_artifacts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY application_artifacts_insert_own
  ON public.application_artifacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.applications a
      WHERE a.id = application_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY application_artifacts_update_own
  ON public.application_artifacts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.applications a
      WHERE a.id = application_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY application_artifacts_delete_own
  ON public.application_artifacts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------

CREATE POLICY activities_select_own
  ON public.activities
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY activities_insert_own
  ON public.activities
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY activities_update_own
  ON public.activities
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY activities_delete_own
  ON public.activities
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
