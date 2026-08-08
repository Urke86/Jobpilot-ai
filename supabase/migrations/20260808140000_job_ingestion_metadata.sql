-- Phase 4C.2 — job ingestion metadata for n8n / webhook / manual import

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS ingestion_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.jobs.ingestion_metadata IS
  'Automation/import provenance: workflow, source, external_id, raw URL, automation_version, etc.';

CREATE INDEX IF NOT EXISTS jobs_ingestion_source_idx
  ON public.jobs ((ingestion_metadata->>'source'))
  WHERE ingestion_metadata ? 'source';

CREATE INDEX IF NOT EXISTS jobs_user_title_company_norm_idx
  ON public.jobs (
    user_id,
    lower(trim(job_title)),
    lower(trim(company_name_snapshot))
  );
