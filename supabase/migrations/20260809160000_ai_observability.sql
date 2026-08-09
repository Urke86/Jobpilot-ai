-- Phase 4E: AI observability, spend, evaluations, soft alerts

DO $$ BEGIN
  CREATE TYPE public.ai_feature AS ENUM (
    'analyze_job',
    'assistant',
    'cv_recommendations',
    'cv_summary',
    'cover_letter',
    'questionnaire',
    'linkedin_message',
    'follow_up',
    'interview_questions',
    'interview_answers',
    'company_research',
    'gmail_classification',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_generation_status AS ENUM (
    'success',
    'error',
    'validation_failed',
    'rate_limited',
    'provider_error',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_alert_severity AS ENUM (
    'info',
    'warning',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_alert_kind AS ENUM (
    'daily_spend_exceeded',
    'latency_elevated',
    'failure_rate_elevated',
    'cost_trend_up',
    'eval_score_declining',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Immutable prompt registry (never overwrite rows; insert new versions)
CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature public.ai_feature NOT NULL,
  version text NOT NULL,
  description text,
  system_prompt text NOT NULL DEFAULT '',
  changelog text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT prompt_versions_feature_version_unique UNIQUE (feature, version)
);

CREATE INDEX IF NOT EXISTS prompt_versions_feature_idx
  ON public.prompt_versions (feature, created_at DESC);

-- Central AI generation log (complements existing per-feature metadata)
CREATE TABLE IF NOT EXISTS public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  feature public.ai_feature NOT NULL,
  provider text NOT NULL DEFAULT 'openai',
  model text,
  prompt_version text,
  status public.ai_generation_status NOT NULL DEFAULT 'success',
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(12, 8),
  latency_ms integer,
  error_code text,
  error_message text,
  source_table text,
  source_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS ai_generations_user_created_idx
  ON public.ai_generations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_generations_user_feature_idx
  ON public.ai_generations (user_id, feature, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_generations_user_status_idx
  ON public.ai_generations (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_generations_user_model_idx
  ON public.ai_generations (user_id, model, created_at DESC);

-- Manual / automated evaluations (1–5 scores per dimension in result jsonb)
CREATE TABLE IF NOT EXISTS public.ai_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  generation_id uuid NOT NULL REFERENCES public.ai_generations (id) ON DELETE CASCADE,
  evaluator text NOT NULL DEFAULT 'user',
  score numeric(4, 2) NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT ai_evaluations_score_range CHECK (score >= 1 AND score <= 5)
);

CREATE INDEX IF NOT EXISTS ai_evaluations_generation_idx
  ON public.ai_evaluations (generation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_evaluations_user_created_idx
  ON public.ai_evaluations (user_id, created_at DESC);

-- Soft in-app alerts (no external notification channels in 4E)
CREATE TABLE IF NOT EXISTS public.ai_observability_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind public.ai_alert_kind NOT NULL,
  severity public.ai_alert_severity NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  message text NOT NULL,
  metric_value numeric(14, 6),
  threshold_value numeric(14, 6),
  acknowledged_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS ai_observability_alerts_user_idx
  ON public.ai_observability_alerts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_observability_alerts_open_idx
  ON public.ai_observability_alerts (user_id, acknowledged_at)
  WHERE acknowledged_at IS NULL;

ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_observability_alerts ENABLE ROW LEVEL SECURITY;

-- Prompt catalog: authenticated users can read; writes via service/migrations
DROP POLICY IF EXISTS prompt_versions_select_authenticated ON public.prompt_versions;
CREATE POLICY prompt_versions_select_authenticated
  ON public.prompt_versions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS ai_generations_select_own ON public.ai_generations;
CREATE POLICY ai_generations_select_own
  ON public.ai_generations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_generations_insert_own ON public.ai_generations;
CREATE POLICY ai_generations_insert_own
  ON public.ai_generations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_generations_update_own ON public.ai_generations;
CREATE POLICY ai_generations_update_own
  ON public.ai_generations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_evaluations_select_own ON public.ai_evaluations;
CREATE POLICY ai_evaluations_select_own
  ON public.ai_evaluations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_evaluations_insert_own ON public.ai_evaluations;
CREATE POLICY ai_evaluations_insert_own
  ON public.ai_evaluations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_evaluations_delete_own ON public.ai_evaluations;
CREATE POLICY ai_evaluations_delete_own
  ON public.ai_evaluations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_alerts_select_own ON public.ai_observability_alerts;
CREATE POLICY ai_alerts_select_own
  ON public.ai_observability_alerts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_alerts_insert_own ON public.ai_observability_alerts;
CREATE POLICY ai_alerts_insert_own
  ON public.ai_observability_alerts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_alerts_update_own ON public.ai_observability_alerts;
CREATE POLICY ai_alerts_update_own
  ON public.ai_observability_alerts FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Seed immutable prompt versions (append-only; do not overwrite)
INSERT INTO public.prompt_versions (feature, version, description, system_prompt, changelog, is_active)
VALUES
  (
    'analyze_job',
    'v1-structured',
    'Structured job-fit analysis with anti-hallucination scoring',
    'JobPilot analyze-job system prompt (see Edge Function analyze-job).',
    'Initial Phase 4A structured analysis prompt',
    true
  ),
  (
    'assistant',
    'v1-assistant',
    'Streaming contextual assistant',
    'JobPilot assistant system prompt (see src/lib/ai/assistant-prompts.ts).',
    'Initial Phase 4C.1 assistant prompt',
    true
  ),
  (
    'cv_recommendations',
    'v1-toolkit',
    'CV recommendations artifact',
    'Artifact toolkit CV recommendations instructions.',
    'Initial Phase 4B artifact prompt',
    true
  ),
  (
    'cv_summary',
    'v1-toolkit',
    'CV summary artifact',
    'Artifact toolkit CV summary instructions.',
    'Initial Phase 4B artifact prompt',
    true
  ),
  (
    'cover_letter',
    'v1-toolkit',
    'Cover letter artifact',
    'Artifact toolkit cover letter instructions.',
    'Initial Phase 4B artifact prompt',
    true
  ),
  (
    'questionnaire',
    'v1-toolkit',
    'Questionnaire answer artifact',
    'Artifact toolkit questionnaire instructions.',
    'Initial Phase 4B artifact prompt',
    true
  ),
  (
    'interview_questions',
    'v1-toolkit',
    'Interview questions artifact',
    'Artifact toolkit interview questions instructions.',
    'Initial Phase 4B artifact prompt',
    true
  ),
  (
    'interview_answers',
    'v1-toolkit',
    'Interview answers artifact',
    'Artifact toolkit interview answers instructions.',
    'Initial Phase 4B artifact prompt',
    true
  ),
  (
    'company_research',
    'v1-toolkit',
    'Company research artifact',
    'Artifact toolkit company research instructions.',
    'Initial Phase 4B artifact prompt',
    true
  ),
  (
    'linkedin_message',
    'v1-toolkit',
    'LinkedIn message artifact',
    'Artifact toolkit LinkedIn message instructions.',
    'Initial Phase 4B artifact prompt',
    true
  ),
  (
    'follow_up',
    'v1-toolkit',
    'Follow-up message artifact',
    'Artifact toolkit follow-up instructions.',
    'Initial Phase 4B artifact prompt',
    true
  ),
  (
    'custom',
    'v1-toolkit',
    'Custom artifact',
    'Artifact toolkit custom instructions.',
    'Initial Phase 4B artifact prompt',
    true
  ),
  (
    'gmail_classification',
    'gmail-sync-v1',
    'Hiring email classification',
    'Gmail classify system prompt (see _shared/email-classify.ts).',
    'Initial Phase 4D classification prompt',
    true
  )
ON CONFLICT (feature, version) DO NOTHING;

-- Activity enums for observability (optional feed entries)
DO $$ BEGIN
  ALTER TYPE public.activity_entity_type ADD VALUE IF NOT EXISTS 'ai_generation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'ai_generation_recorded';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'ai_evaluation_submitted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'ai_alert_raised';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
