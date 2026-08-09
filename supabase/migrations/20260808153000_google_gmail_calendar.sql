-- Phase 4D — Gmail + Google Calendar integration (privacy-conscious)

DO $$ BEGIN
  CREATE TYPE public.integration_provider AS ENUM ('google');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.email_classification AS ENUM (
    'recruiter_outreach',
    'application_confirmation',
    'questionnaire',
    'assessment',
    'interview_invitation',
    'interview_followup',
    'rejection',
    'offer',
    'general_hiring_message',
    'unrelated',
    'pending'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.email_match_status AS ENUM (
    'matched',
    'suggested_match',
    'unmatched'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.application_event_type AS ENUM (
    'interview',
    'assessment_deadline',
    'follow_up',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_entity_type ADD VALUE IF NOT EXISTS 'job_email';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_entity_type ADD VALUE IF NOT EXISTS 'user_integration';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_entity_type ADD VALUE IF NOT EXISTS 'application_event';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'gmail_connected';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'gmail_synced';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'gmail_disconnected';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'hiring_email_linked';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'stage_accepted_from_email';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'interview_event_created';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

COMMENT ON COLUMN public.profiles.timezone IS
  'IANA timezone for displaying interview times (e.g. Europe/Belgrade).';

CREATE TABLE IF NOT EXISTS public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  provider_account_email text,
  -- AES-GCM ciphertext (base64). Never expose via frontend selects intentionally.
  access_token_cipher text,
  refresh_token_cipher text,
  token_iv text,
  scopes text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_integrations_provider_unique UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS user_integrations_user_id_idx
  ON public.user_integrations (user_id);

CREATE TABLE IF NOT EXISTS public.job_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  gmail_thread_id text,
  sender_name text,
  sender_email text,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text,
  received_at timestamptz,
  snippet text,
  -- Bounded plain text excerpt for classification / UX (not full mailbox dump)
  body_text text,
  classification public.email_classification NOT NULL DEFAULT 'pending',
  confidence_score integer CHECK (
    confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)
  ),
  match_status public.email_match_status NOT NULL DEFAULT 'unmatched',
  company_id uuid REFERENCES public.companies (id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs (id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.applications (id) ON DELETE SET NULL,
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  needs_action boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT job_emails_user_gmail_unique UNIQUE (user_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS job_emails_user_received_idx
  ON public.job_emails (user_id, received_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS job_emails_user_class_idx
  ON public.job_emails (user_id, classification);

CREATE INDEX IF NOT EXISTS job_emails_user_needs_action_idx
  ON public.job_emails (user_id, needs_action)
  WHERE needs_action = true;

CREATE INDEX IF NOT EXISTS job_emails_thread_idx
  ON public.job_emails (user_id, gmail_thread_id)
  WHERE gmail_thread_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.applications (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  external_event_id text,
  event_type public.application_event_type NOT NULL DEFAULT 'interview',
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  meeting_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT application_events_external_unique UNIQUE (user_id, provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS application_events_user_app_idx
  ON public.application_events (user_id, application_id);

CREATE INDEX IF NOT EXISTS application_events_starts_idx
  ON public.application_events (user_id, starts_at DESC NULLS LAST);

-- updated_at triggers
DROP TRIGGER IF EXISTS user_integrations_set_updated_at ON public.user_integrations;
CREATE TRIGGER user_integrations_set_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS job_emails_set_updated_at ON public.job_emails;
CREATE TRIGGER job_emails_set_updated_at
  BEFORE UPDATE ON public.job_emails
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_integrations_select_own ON public.user_integrations;
CREATE POLICY user_integrations_select_own
  ON public.user_integrations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_integrations_insert_own ON public.user_integrations;
CREATE POLICY user_integrations_insert_own
  ON public.user_integrations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_integrations_update_own ON public.user_integrations;
CREATE POLICY user_integrations_update_own
  ON public.user_integrations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_integrations_delete_own ON public.user_integrations;
CREATE POLICY user_integrations_delete_own
  ON public.user_integrations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS job_emails_select_own ON public.job_emails;
CREATE POLICY job_emails_select_own
  ON public.job_emails FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS job_emails_insert_own ON public.job_emails;
CREATE POLICY job_emails_insert_own
  ON public.job_emails FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      application_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id = application_id AND a.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS job_emails_update_own ON public.job_emails;
CREATE POLICY job_emails_update_own
  ON public.job_emails FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      application_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id = application_id AND a.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS job_emails_delete_own ON public.job_emails;
CREATE POLICY job_emails_delete_own
  ON public.job_emails FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS application_events_select_own ON public.application_events;
CREATE POLICY application_events_select_own
  ON public.application_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS application_events_insert_own ON public.application_events;
CREATE POLICY application_events_insert_own
  ON public.application_events FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS application_events_update_own ON public.application_events;
CREATE POLICY application_events_update_own
  ON public.application_events FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS application_events_delete_own ON public.application_events;
CREATE POLICY application_events_delete_own
  ON public.application_events FOR DELETE TO authenticated
  USING (user_id = auth.uid());
