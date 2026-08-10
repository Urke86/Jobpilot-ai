-- Phase 5B.1 — H1 calendar durable idempotency + H2 normalized job URL dedupe

-- ---------------------------------------------------------------------------
-- H2: normalize_job_url() mirrors Edge normalizeJobUrl semantics closely
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_job_url(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
  scheme text;
  rest text;
  hostpath text;
  query text := '';
  host text;
  path text;
  pair text;
  key text;
  keep text[] := ARRAY[]::text[];
  new_query text := '';
  uri text;
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  t := btrim(raw);
  IF t = '' THEN
    RETURN NULL;
  END IF;

  -- Non-URL fallback: collapse whitespace (Edge collapseWs)
  IF t !~* '^https?://' THEN
    RETURN regexp_replace(t, '\s+', ' ', 'g');
  END IF;

  scheme := lower(substring(t FROM 1 FOR position('://' IN t) - 1));
  rest := substring(t FROM position('://' IN t) + 3);

  IF position('#' IN rest) > 0 THEN
    rest := substring(rest FROM 1 FOR position('#' IN rest) - 1);
  END IF;

  IF position('?' IN rest) > 0 THEN
    hostpath := substring(rest FROM 1 FOR position('?' IN rest) - 1);
    query := substring(rest FROM position('?' IN rest) + 1);
  ELSE
    hostpath := rest;
  END IF;

  IF position('/' IN hostpath) > 0 THEN
    host := split_part(hostpath, '/', 1);
    path := '/' || substring(hostpath FROM position('/' IN hostpath) + 1);
  ELSE
    host := hostpath;
    path := '/';
  END IF;

  host := lower(host);

  IF query <> '' THEN
    FOREACH pair IN ARRAY string_to_array(query, '&')
    LOOP
      key := split_part(pair, '=', 1);
      IF key <> ''
         AND lower(key) NOT IN (
           'utm_source',
           'utm_medium',
           'utm_campaign',
           'utm_term',
           'utm_content',
           'fbclid',
           'gclid',
           'mc_cid',
           'mc_eid'
         )
      THEN
        keep := array_append(keep, pair);
      END IF;
    END LOOP;
    new_query := array_to_string(keep, '&');
  END IF;

  -- Drop trailing slash except root path (match Edge URL.toString + strip)
  IF path <> '/' AND right(path, 1) = '/' THEN
    path := left(path, length(path) - 1);
  END IF;

  IF path = '/' THEN
    uri := scheme || '://' || host || '/';
  ELSE
    uri := scheme || '://' || host || path;
  END IF;

  IF new_query <> '' THEN
    uri := uri || '?' || new_query;
  END IF;

  RETURN uri;
END;
$$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS normalized_job_url text;

-- Backfill: assign normalized URL only to the oldest row per (user, normalized)
WITH ranked AS (
  SELECT
    id,
    user_id,
    public.normalize_job_url(job_url) AS norm,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, public.normalize_job_url(job_url)
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.jobs
  WHERE job_url IS NOT NULL
    AND public.normalize_job_url(job_url) IS NOT NULL
)
UPDATE public.jobs j
SET normalized_job_url = ranked.norm
FROM ranked
WHERE j.id = ranked.id
  AND ranked.rn = 1;

CREATE OR REPLACE FUNCTION public.set_jobs_normalized_job_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always derive from job_url so Edge/UI paths share one DB-backed key.
  NEW.normalized_job_url := public.normalize_job_url(NEW.job_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_set_normalized_job_url ON public.jobs;
CREATE TRIGGER jobs_set_normalized_job_url
BEFORE INSERT OR UPDATE OF job_url ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_jobs_normalized_job_url();

CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_normalized_url_unique
  ON public.jobs (user_id, normalized_job_url)
  WHERE normalized_job_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_user_normalized_url_idx
  ON public.jobs (user_id, normalized_job_url)
  WHERE normalized_job_url IS NOT NULL;

-- ---------------------------------------------------------------------------
-- H1: durable calendar idempotency key on application_events
-- ---------------------------------------------------------------------------

ALTER TABLE public.application_events
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS application_events_user_idempotency_unique
  ON public.application_events (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS application_events_user_idempotency_idx
  ON public.application_events (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
