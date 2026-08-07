-- COMBINED MIGRATION (for Dashboard SQL Editor if CLI push is unavailable)
-- Prefer: npm run db:push
-- Do not commit as an official migration; official files are timestamped.

-- JobPilot AI â€” core schema
-- Enums, helpers, tables, indexes, and updated_at triggers.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.remote_preference AS ENUM (
  'onsite',
  'hybrid',
  'remote',
  'flexible',
  'unknown'
);

CREATE TYPE public.remote_scope AS ENUM (
  'onsite',
  'hybrid',
  'remote_country',
  'remote_europe',
  'remote_emea',
  'remote_global',
  'unknown'
);

CREATE TYPE public.employment_type AS ENUM (
  'full_time',
  'part_time',
  'contract',
  'temporary',
  'internship',
  'unknown'
);

CREATE TYPE public.job_status AS ENUM (
  'new',
  'analyzing',
  'reviewed',
  'shortlisted',
  'skipped',
  'applied',
  'archived'
);

CREATE TYPE public.analysis_recommendation AS ENUM (
  'apply',
  'consider',
  'skip'
);

CREATE TYPE public.application_stage AS ENUM (
  'preparing',
  'applied',
  'questionnaire',
  'interview',
  'assignment',
  'offer',
  'rejected',
  'withdrawn'
);

CREATE TYPE public.artifact_type AS ENUM (
  'cv_recommendations',
  'cv_summary',
  'cover_letter',
  'questionnaire_answer',
  'linkedin_message',
  'follow_up',
  'interview_questions',
  'interview_answers',
  'company_research',
  'custom'
);

CREATE TYPE public.activity_entity_type AS ENUM (
  'profile',
  'company',
  'contact',
  'job',
  'job_analysis',
  'application',
  'application_artifact',
  'system'
);

CREATE TYPE public.activity_type AS ENUM (
  'job_discovered',
  'job_status_changed',
  'application_created',
  'application_stage_changed',
  'analysis_completed',
  'artifact_created',
  'company_added',
  'contact_added',
  'note_added',
  'custom'
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  headline text,
  location text,
  target_roles text[] NOT NULL DEFAULT '{}'::text[],
  salary_min integer CHECK (salary_min IS NULL OR salary_min >= 0),
  salary_currency text NOT NULL DEFAULT 'EUR',
  remote_preference public.remote_preference NOT NULL DEFAULT 'unknown',
  master_cv_text text,
  portfolio_summary text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX profiles_user_id_idx ON public.profiles (user_id);

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  website text,
  industry text,
  company_size text,
  ai_focus text,
  careers_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT companies_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX companies_user_id_idx ON public.companies (user_id);
CREATE INDEX companies_user_name_norm_idx
  ON public.companies (user_id, lower(trim(name)));

CREATE TRIGGER companies_set_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  linkedin_url text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT contacts_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX contacts_user_id_idx ON public.contacts (user_id);
CREATE INDEX contacts_company_id_idx ON public.contacts (company_id);

CREATE TRIGGER contacts_set_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies (id) ON DELETE SET NULL,
  company_name_snapshot text NOT NULL,
  job_title text NOT NULL,
  job_url text,
  source text,
  location text,
  remote_scope public.remote_scope NOT NULL DEFAULT 'unknown',
  salary_min integer CHECK (salary_min IS NULL OR salary_min >= 0),
  salary_max integer CHECK (salary_max IS NULL OR salary_max >= 0),
  salary_currency text NOT NULL DEFAULT 'EUR',
  employment_type public.employment_type NOT NULL DEFAULT 'unknown',
  job_description text,
  date_discovered date NOT NULL DEFAULT (timezone('utc', now()))::date,
  deadline date,
  status public.job_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT jobs_title_not_blank CHECK (length(trim(job_title)) > 0),
  CONSTRAINT jobs_company_snapshot_not_blank CHECK (length(trim(company_name_snapshot)) > 0),
  CONSTRAINT jobs_salary_range_valid CHECK (
    salary_min IS NULL
    OR salary_max IS NULL
    OR salary_max >= salary_min
  )
);

CREATE INDEX jobs_user_id_idx ON public.jobs (user_id);
CREATE INDEX jobs_company_id_idx ON public.jobs (company_id);
CREATE INDEX jobs_status_idx ON public.jobs (status);
CREATE INDEX jobs_date_discovered_idx ON public.jobs (date_discovered DESC);
CREATE INDEX jobs_job_title_idx ON public.jobs (lower(job_title));
CREATE INDEX jobs_source_idx ON public.jobs (source);
CREATE INDEX jobs_user_status_discovered_idx
  ON public.jobs (user_id, status, date_discovered DESC);

CREATE UNIQUE INDEX jobs_user_url_unique
  ON public.jobs (user_id, job_url)
  WHERE job_url IS NOT NULL;

CREATE TRIGGER jobs_set_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- job_analysis
-- ---------------------------------------------------------------------------

CREATE TABLE public.job_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  overall_match_score integer NOT NULL,
  product_fit_score integer,
  technical_fit_score integer,
  ai_tools_fit_score integer,
  remote_fit_score integer,
  experience_fit_score integer,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation public.analysis_recommendation NOT NULL,
  reasoning_summary text,
  analysis_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT job_analysis_overall_score_range
    CHECK (overall_match_score BETWEEN 0 AND 100),
  CONSTRAINT job_analysis_product_score_range
    CHECK (product_fit_score IS NULL OR product_fit_score BETWEEN 0 AND 100),
  CONSTRAINT job_analysis_technical_score_range
    CHECK (technical_fit_score IS NULL OR technical_fit_score BETWEEN 0 AND 100),
  CONSTRAINT job_analysis_ai_tools_score_range
    CHECK (ai_tools_fit_score IS NULL OR ai_tools_fit_score BETWEEN 0 AND 100),
  CONSTRAINT job_analysis_remote_score_range
    CHECK (remote_fit_score IS NULL OR remote_fit_score BETWEEN 0 AND 100),
  CONSTRAINT job_analysis_experience_score_range
    CHECK (experience_fit_score IS NULL OR experience_fit_score BETWEEN 0 AND 100),
  CONSTRAINT job_analysis_strengths_is_array CHECK (jsonb_typeof(strengths) = 'array'),
  CONSTRAINT job_analysis_gaps_is_array CHECK (jsonb_typeof(gaps) = 'array'),
  CONSTRAINT job_analysis_risks_is_array CHECK (jsonb_typeof(risks) = 'array')
);

CREATE INDEX job_analysis_user_id_idx ON public.job_analysis (user_id);
CREATE INDEX job_analysis_job_id_idx ON public.job_analysis (job_id);
CREATE INDEX job_analysis_job_created_desc_idx
  ON public.job_analysis (job_id, created_at DESC);

CREATE TRIGGER job_analysis_set_updated_at
BEFORE UPDATE ON public.job_analysis
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------

CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  application_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  stage public.application_stage NOT NULL DEFAULT 'preparing',
  cv_version text,
  portfolio_sent boolean NOT NULL DEFAULT false,
  salary_expectation integer CHECK (
    salary_expectation IS NULL OR salary_expectation >= 0
  ),
  salary_currency text NOT NULL DEFAULT 'EUR',
  cover_letter text,
  questionnaire_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_person text,
  contact_email text,
  follow_up_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT applications_questionnaire_is_object
    CHECK (jsonb_typeof(questionnaire_answers) = 'object'),
  CONSTRAINT applications_user_job_unique UNIQUE (user_id, job_id)
);

CREATE INDEX applications_user_id_idx ON public.applications (user_id);
CREATE INDEX applications_job_id_idx ON public.applications (job_id);
CREATE INDEX applications_stage_idx ON public.applications (stage);
CREATE INDEX applications_user_stage_idx ON public.applications (user_id, stage);

CREATE TRIGGER applications_set_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- application_artifacts
-- ---------------------------------------------------------------------------

CREATE TABLE public.application_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.applications (id) ON DELETE CASCADE,
  artifact_type public.artifact_type NOT NULL,
  content text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT application_artifacts_content_not_blank
    CHECK (length(trim(content)) > 0),
  CONSTRAINT application_artifacts_metadata_is_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX application_artifacts_user_id_idx
  ON public.application_artifacts (user_id);
CREATE INDEX application_artifacts_application_id_idx
  ON public.application_artifacts (application_id);
CREATE INDEX application_artifacts_type_idx
  ON public.application_artifacts (artifact_type);
CREATE INDEX application_artifacts_app_type_version_idx
  ON public.application_artifacts (application_id, artifact_type, version DESC);

CREATE TRIGGER application_artifacts_set_updated_at
BEFORE UPDATE ON public.application_artifacts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- activities (polymorphic; no FK on entity_id)
-- ---------------------------------------------------------------------------

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entity_type public.activity_entity_type NOT NULL,
  entity_id uuid,
  activity_type public.activity_type NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT activities_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT activities_metadata_is_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX activities_user_id_idx ON public.activities (user_id);
CREATE INDEX activities_user_created_idx
  ON public.activities (user_id, created_at DESC);
CREATE INDEX activities_entity_idx
  ON public.activities (entity_type, entity_id);


-- JobPilot AI â€” Row Level Security
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
