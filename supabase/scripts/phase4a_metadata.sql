-- Phase 4A: paste in Supabase SQL Editor if CLI db push is unavailable
-- Project: JobPilot AI (xzzoznhmezmaarcvavpr)

ALTER TABLE public.job_analysis
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.job_analysis
  DROP CONSTRAINT IF EXISTS job_analysis_metadata_is_object;

ALTER TABLE public.job_analysis
  ADD CONSTRAINT job_analysis_metadata_is_object
  CHECK (jsonb_typeof(metadata) = 'object');

COMMENT ON COLUMN public.job_analysis.metadata IS
  'AI run metadata: model, duration_ms, token usage, estimated_cost_usd, cv_focus, interview_focus, recommendation_reason';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260807130532', 'job_analysis_metadata')
ON CONFLICT (version) DO NOTHING;
