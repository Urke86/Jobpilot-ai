-- Phase 5A.1 — P0/P1 hardening (RLS, ciphers, leases, analytics RPC, uniqueness)

-- ---------------------------------------------------------------------------
-- R1: Hide Google token ciphertext from authenticated clients
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.user_integrations FROM PUBLIC;
REVOKE ALL ON TABLE public.user_integrations FROM anon;
REVOKE ALL ON TABLE public.user_integrations FROM authenticated;

GRANT SELECT (
  id,
  user_id,
  provider,
  provider_account_email,
  scopes,
  expires_at,
  metadata,
  created_at,
  updated_at
) ON TABLE public.user_integrations TO authenticated;

-- Mutations without cipher columns (token writes stay service_role / table owner)
GRANT INSERT (
  id,
  user_id,
  provider,
  provider_account_email,
  scopes,
  expires_at,
  metadata,
  created_at,
  updated_at
) ON TABLE public.user_integrations TO authenticated;

GRANT UPDATE (
  provider_account_email,
  scopes,
  expires_at,
  metadata,
  updated_at
) ON TABLE public.user_integrations TO authenticated;

GRANT DELETE ON TABLE public.user_integrations TO authenticated;

-- Safe view for documentation / optional client use
CREATE OR REPLACE VIEW public.user_integrations_public
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  provider,
  provider_account_email,
  scopes,
  expires_at,
  metadata,
  created_at,
  updated_at
FROM public.user_integrations;

GRANT SELECT ON public.user_integrations_public TO authenticated;

-- ---------------------------------------------------------------------------
-- S4: Atomic rate-limit leases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lease_key text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT rate_limit_leases_user_key_unique UNIQUE (user_id, lease_key)
);

CREATE INDEX IF NOT EXISTS rate_limit_leases_expires_idx
  ON public.rate_limit_leases (expires_at);

ALTER TABLE public.rate_limit_leases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limit_leases_select_own ON public.rate_limit_leases;
CREATE POLICY rate_limit_leases_select_own
  ON public.rate_limit_leases FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS rate_limit_leases_insert_own ON public.rate_limit_leases;
CREATE POLICY rate_limit_leases_insert_own
  ON public.rate_limit_leases FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rate_limit_leases_update_own ON public.rate_limit_leases;
CREATE POLICY rate_limit_leases_update_own
  ON public.rate_limit_leases FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rate_limit_leases_delete_own ON public.rate_limit_leases;
CREATE POLICY rate_limit_leases_delete_own
  ON public.rate_limit_leases FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.try_acquire_rate_limit(
  p_lease_key text,
  p_ttl_seconds integer,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  now_ts timestamptz := timezone('utc', now());
  new_exp timestamptz;
  updated_id uuid;
BEGIN
  IF p_lease_key IS NULL OR length(trim(p_lease_key)) = 0 THEN
    RETURN false;
  END IF;
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 1 OR p_ttl_seconds > 3600 THEN
    RETURN false;
  END IF;

  uid := auth.uid();
  IF p_user_id IS NOT NULL THEN
    -- service_role may act for a target user; authenticated may only self-target
    IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
      uid := p_user_id;
    ELSIF auth.uid() IS NOT NULL AND auth.uid() = p_user_id THEN
      uid := p_user_id;
    ELSE
      RETURN false;
    END IF;
  END IF;

  IF uid IS NULL THEN
    RETURN false;
  END IF;

  new_exp := now_ts + make_interval(secs => p_ttl_seconds);

  UPDATE public.rate_limit_leases
  SET expires_at = new_exp,
      created_at = now_ts
  WHERE user_id = uid
    AND lease_key = p_lease_key
    AND expires_at < now_ts
  RETURNING id INTO updated_id;

  IF updated_id IS NOT NULL THEN
    RETURN true;
  END IF;

  BEGIN
    INSERT INTO public.rate_limit_leases (user_id, lease_key, expires_at)
    VALUES (uid, p_lease_key, new_exp);
    RETURN true;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN false;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_rate_limit(text, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_acquire_rate_limit(text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_rate_limit(text, integer, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- R2: job_emails ownership for job_id + company_id
-- ---------------------------------------------------------------------------
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
    AND (
      job_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = job_id AND j.user_id = auth.uid()
      )
    )
    AND (
      company_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = company_id AND c.user_id = auth.uid()
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
    AND (
      job_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = job_id AND j.user_id = auth.uid()
      )
    )
    AND (
      company_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = company_id AND c.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- R3 + R5: ai_conversations / ai_messages — authenticated + context ownership
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ai_conversations_select_own ON public.ai_conversations;
CREATE POLICY ai_conversations_select_own
  ON public.ai_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_conversations_insert_own ON public.ai_conversations;
CREATE POLICY ai_conversations_insert_own
  ON public.ai_conversations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      context_job_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = context_job_id AND j.user_id = auth.uid()
      )
    )
    AND (
      context_application_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id = context_application_id AND a.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS ai_conversations_update_own ON public.ai_conversations;
CREATE POLICY ai_conversations_update_own
  ON public.ai_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      context_job_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = context_job_id AND j.user_id = auth.uid()
      )
    )
    AND (
      context_application_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id = context_application_id AND a.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS ai_conversations_delete_own ON public.ai_conversations;
CREATE POLICY ai_conversations_delete_own
  ON public.ai_conversations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_messages_select_own ON public.ai_messages;
CREATE POLICY ai_messages_select_own
  ON public.ai_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_messages_insert_own ON public.ai_messages;
CREATE POLICY ai_messages_insert_own
  ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_update_own ON public.ai_messages;
CREATE POLICY ai_messages_update_own
  ON public.ai_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_delete_own ON public.ai_messages;
CREATE POLICY ai_messages_delete_own
  ON public.ai_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- R4: ai_evaluations — generation must belong to caller
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ai_evaluations_insert_own ON public.ai_evaluations;
CREATE POLICY ai_evaluations_insert_own
  ON public.ai_evaluations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.ai_generations g
      WHERE g.id = generation_id AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_evaluations_update_own ON public.ai_evaluations;
CREATE POLICY ai_evaluations_update_own
  ON public.ai_evaluations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.ai_generations g
      WHERE g.id = generation_id AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_generations_delete_own ON public.ai_generations;
CREATE POLICY ai_generations_delete_own
  ON public.ai_generations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- D5: unique artifact versions (remove duplicate rows, keep earliest)
-- ---------------------------------------------------------------------------
DELETE FROM public.application_artifacts a
USING public.application_artifacts b
WHERE a.application_id = b.application_id
  AND a.artifact_type = b.artifact_type
  AND a.version = b.version
  AND (
    a.created_at > b.created_at
    OR (a.created_at = b.created_at AND a.id::text > b.id::text)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'application_artifacts_app_type_version_unique'
  ) THEN
    ALTER TABLE public.application_artifacts
      ADD CONSTRAINT application_artifacts_app_type_version_unique
      UNIQUE (application_id, artifact_type, version);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- P2: server-side AI analytics summary RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_analytics_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  now_ts timestamptz := timezone('utc', now());
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  WITH gens AS (
    SELECT *
    FROM public.ai_generations
    WHERE user_id = uid
    ORDER BY created_at DESC
    LIMIT 2000
  ),
  stats AS (
    SELECT
      coalesce(sum(estimated_cost_usd), 0)::numeric AS total_spend,
      coalesce(sum(estimated_cost_usd) FILTER (
        WHERE created_at >= now_ts - interval '1 day'
      ), 0)::numeric AS daily_spend,
      coalesce(sum(estimated_cost_usd) FILTER (
        WHERE created_at >= now_ts - interval '7 day'
      ), 0)::numeric AS weekly_spend,
      coalesce(sum(estimated_cost_usd) FILTER (
        WHERE created_at >= now_ts - interval '30 day'
      ), 0)::numeric AS monthly_spend,
      count(*)::int AS total_generations,
      count(*) FILTER (WHERE status = 'success')::int AS success_count,
      count(*) FILTER (WHERE status <> 'success')::int AS failure_count,
      coalesce(avg(latency_ms) FILTER (WHERE latency_ms IS NOT NULL AND latency_ms > 0), 0)::float8 AS avg_latency_ms,
      coalesce(avg(input_tokens) FILTER (WHERE input_tokens IS NOT NULL AND input_tokens > 0), 0)::float8 AS avg_input_tokens,
      coalesce(avg(output_tokens) FILTER (WHERE output_tokens IS NOT NULL AND output_tokens > 0), 0)::float8 AS avg_output_tokens,
      coalesce(avg(estimated_cost_usd) FILTER (WHERE estimated_cost_usd IS NOT NULL AND estimated_cost_usd > 0), 0)::float8 AS avg_cost,
      coalesce(max(estimated_cost_usd), 0)::float8 AS max_cost
    FROM gens
  ),
  by_feature AS (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'key', feature,
        'spend', spend,
        'count', cnt
      ) ORDER BY spend DESC
    ), '[]'::jsonb) AS spend_by_feature
    FROM (
      SELECT feature::text AS feature,
        coalesce(sum(estimated_cost_usd), 0)::float8 AS spend,
        count(*)::int AS cnt
      FROM gens
      GROUP BY feature
    ) f
  ),
  by_model AS (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'key', model,
        'spend', spend,
        'count', cnt
      ) ORDER BY cnt DESC
    ), '[]'::jsonb) AS spend_by_model
    FROM (
      SELECT coalesce(model, 'unknown') AS model,
        coalesce(sum(estimated_cost_usd), 0)::float8 AS spend,
        count(*)::int AS cnt
      FROM gens
      GROUP BY coalesce(model, 'unknown')
    ) m
  ),
  series AS (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'date', day,
        'spend', spend,
        'latency_ms', latency_ms,
        'count', cnt
      ) ORDER BY day
    ), '[]'::jsonb) AS series
    FROM (
      SELECT
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
        coalesce(sum(estimated_cost_usd), 0)::float8 AS spend,
        coalesce(avg(latency_ms) FILTER (WHERE latency_ms > 0), 0)::float8 AS latency_ms,
        count(*)::int AS cnt
      FROM gens
      GROUP BY 1
    ) d
  ),
  top_feature AS (
    SELECT feature::text AS feature
    FROM gens
    GROUP BY feature
    ORDER BY sum(estimated_cost_usd) DESC NULLS LAST
    LIMIT 1
  ),
  top_model AS (
    SELECT coalesce(model, 'unknown') AS model
    FROM gens
    GROUP BY coalesce(model, 'unknown')
    ORDER BY count(*) DESC
    LIMIT 1
  ),
  evals AS (
    SELECT avg(score)::float8 AS avg_eval_score
    FROM public.ai_evaluations
    WHERE user_id = uid
  )
  SELECT jsonb_build_object(
    'totalSpend', (SELECT total_spend FROM stats),
    'dailySpend', (SELECT daily_spend FROM stats),
    'weeklySpend', (SELECT weekly_spend FROM stats),
    'monthlySpend', (SELECT monthly_spend FROM stats),
    'totalGenerations', (SELECT total_generations FROM stats),
    'successCount', (SELECT success_count FROM stats),
    'failureCount', (SELECT failure_count FROM stats),
    'successRate', CASE
      WHEN (SELECT total_generations FROM stats) = 0 THEN 100
      ELSE round(
        ((SELECT success_count FROM stats)::numeric
          / (SELECT total_generations FROM stats)::numeric) * 100,
        2
      )
    END,
    'avgLatencyMs', (SELECT avg_latency_ms FROM stats),
    'avgInputTokens', (SELECT avg_input_tokens FROM stats),
    'avgOutputTokens', (SELECT avg_output_tokens FROM stats),
    'avgCost', (SELECT avg_cost FROM stats),
    'maxCost', (SELECT max_cost FROM stats),
    'mostExpensiveFeature', (SELECT feature FROM top_feature),
    'mostUsedModel', (SELECT model FROM top_model),
    'spendByFeature', (SELECT spend_by_feature FROM by_feature),
    'spendByModel', (SELECT spend_by_model FROM by_model),
    'series', (SELECT series FROM series),
    'avgEvalScore', (SELECT avg_eval_score FROM evals)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_analytics_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_analytics_summary() TO authenticated;
