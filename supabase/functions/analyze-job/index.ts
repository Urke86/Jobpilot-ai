import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { z } from 'npm:zod@3.23.8';

const ANALYSIS_VERSION = 'v1-structured';
const DEFAULT_MODEL = Deno.env.get('OPENAI_ANALYSIS_MODEL') ?? 'gpt-4o-mini';
const MIN_DESCRIPTION_CHARS = 80;
const RATE_LIMIT_SECONDS = 30;

const scoreSchema = z.number().int().min(0).max(100);

const analysisResultSchema = z.object({
  overall_match_score: scoreSchema,
  product_fit_score: scoreSchema,
  technical_fit_score: scoreSchema,
  ai_tools_fit_score: scoreSchema,
  remote_fit_score: scoreSchema,
  experience_fit_score: scoreSchema,
  strengths: z
    .array(
      z.object({
        title: z.string().min(1),
        evidence: z.string().min(1),
      }),
    )
    .max(8),
  gaps: z
    .array(
      z.object({
        title: z.string().min(1),
        evidence: z.string().min(1),
        severity: z.enum(['low', 'medium', 'high']),
      }),
    )
    .max(8),
  risks: z
    .array(
      z.object({
        title: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .max(8),
  recommendation: z.enum(['apply', 'consider', 'skip']),
  recommendation_reason: z.string().min(1),
  reasoning_summary: z.string().min(1),
  cv_focus: z.array(z.string().min(1)).max(8),
  interview_focus: z.array(z.string().min(1)).max(8),
});

const SYSTEM_PROMPT = `You are a rigorous hiring-fit evaluator for JobPilot AI.

ROLE
- Compare a job opportunity against a candidate profile using ONLY explicit evidence.
- Produce a structured JSON analysis for a job seeker.

ANTI-HALLUCINATION RULES (MANDATORY)
- NEVER invent candidate experience, tools, years, projects, achievements, certifications, salary history, or technical depth.
- Use ONLY information present in CANDIDATE PROFILE, MASTER CV, and PORTFOLIO sections.
- If something is missing, say it is "not demonstrated in the provided materials" — do NOT conclude the candidate cannot do it unless materials contradict it.
- Job requirements that are unmet because evidence is absent must appear as gaps with evidence explaining what is missing.

SCORING METHODOLOGY
- Score each category as an integer 0–100 based on explicit evidence.
- Do NOT simply average category scores for overall_match_score.
- overall_match_score must reflect practical hiring fit for THIS role.
- Suggested bands: 90–100 exceptional; 80–89 strong; 70–79 good with meaningful gaps; 60–69 stretch; below 60 weak.

CATEGORY GUIDANCE
- product_fit_score: product sense, stakeholder/user focus, roadmap/prioritization signals vs role needs.
- technical_fit_score: technical skills/stack depth vs requirements.
- ai_tools_fit_score: AI/LLM/tooling evidence vs AI-related requirements (score mid if job has little AI need).
- remote_fit_score: location/remote preference alignment with job remote scope/location.
- experience_fit_score: seniority/scope alignment based on demonstrated experience only.

RECOMMENDATION RULES
- apply: strong evidence of fit; gaps are manageable and explicitly acknowledged.
- consider: plausible fit but meaningful gaps or missing evidence on key requirements.
- skip: weak fit or critical requirements not demonstrated.
- recommendation_reason must cite concrete evidence (or absence of evidence).

OUTPUT
- Return ONLY valid JSON matching the required schema.
- strengths/gaps/risks must include concrete evidence strings.
- cv_focus: what the candidate should emphasize or clarify on a CV for THIS job (no invented experience).
- interview_focus: topics to prepare based on gaps and job needs.`;

const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'overall_match_score',
    'product_fit_score',
    'technical_fit_score',
    'ai_tools_fit_score',
    'remote_fit_score',
    'experience_fit_score',
    'strengths',
    'gaps',
    'risks',
    'recommendation',
    'recommendation_reason',
    'reasoning_summary',
    'cv_focus',
    'interview_focus',
  ],
  properties: {
    overall_match_score: { type: 'integer', minimum: 0, maximum: 100 },
    product_fit_score: { type: 'integer', minimum: 0, maximum: 100 },
    technical_fit_score: { type: 'integer', minimum: 0, maximum: 100 },
    ai_tools_fit_score: { type: 'integer', minimum: 0, maximum: 100 },
    remote_fit_score: { type: 'integer', minimum: 0, maximum: 100 },
    experience_fit_score: { type: 'integer', minimum: 0, maximum: 100 },
    strengths: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'evidence'],
        properties: {
          title: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
    gaps: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'evidence', 'severity'],
        properties: {
          title: { type: 'string' },
          evidence: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    risks: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'reason'],
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    recommendation: { type: 'string', enum: ['apply', 'consider', 'skip'] },
    recommendation_reason: { type: 'string' },
    reasoning_summary: { type: 'string' },
    cv_focus: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
    },
    interview_focus: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
    },
  },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-jobpilot-ingest-secret',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const rates: Record<string, { in: number; out: number }> = {
    'gpt-4o-mini': { in: 0.15 / 1_000_000, out: 0.6 / 1_000_000 },
    'gpt-4o': { in: 2.5 / 1_000_000, out: 10 / 1_000_000 },
  };
  const rate = rates[model];
  if (!rate) return null;
  return Number(
    (promptTokens * rate.in + completionTokens * rate.out).toFixed(6),
  );
}

function buildUserPayload(input: {
  profile: Record<string, unknown> | null;
  job: Record<string, unknown>;
}) {
  const p = input.profile ?? {};
  const j = input.job;
  const targetRoles = Array.isArray(p.target_roles)
    ? (p.target_roles as string[]).join(', ')
    : 'Not provided';

  return [
    'CANDIDATE PROFILE',
    `Full name: ${p.full_name ?? 'Not provided'}`,
    `Headline: ${p.headline ?? 'Not provided'}`,
    `Location: ${p.location ?? 'Not provided'}`,
    `Target roles: ${targetRoles}`,
    `Salary minimum: ${p.salary_min ?? 'Not provided'} ${p.salary_currency ?? ''}`.trim(),
    `Remote preference: ${p.remote_preference ?? 'Not provided'}`,
    '',
    'MASTER CV',
    typeof p.master_cv_text === 'string' && p.master_cv_text.trim()
      ? p.master_cv_text.trim()
      : 'Not provided',
    '',
    'PORTFOLIO',
    typeof p.portfolio_summary === 'string' && p.portfolio_summary.trim()
      ? p.portfolio_summary.trim()
      : 'Not provided',
    '',
    'JOB METADATA',
    `Title: ${j.job_title}`,
    `Company: ${j.company_name_snapshot}`,
    `Location: ${j.location ?? 'Not provided'}`,
    `Remote scope: ${j.remote_scope ?? 'unknown'}`,
    `Employment type: ${j.employment_type ?? 'unknown'}`,
    `Salary range: ${j.salary_min ?? '?'}–${j.salary_max ?? '?'} ${j.salary_currency ?? ''}`.trim(),
    `Source: ${j.source ?? 'Not provided'}`,
    `URL: ${j.job_url ?? 'Not provided'}`,
    '',
    'JOB DESCRIPTION',
    String(j.job_description ?? '').trim(),
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!openaiKey) {
      return jsonResponse(
        { error: 'AI analysis is not configured. Missing OPENAI_API_KEY.' },
        503,
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ingestSecret = Deno.env.get('INGESTION_SECRET')?.trim() ?? '';
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Supabase environment is incomplete.' }, 500);
    }

    const body = await req.json().catch(() => null);
    const jobId = typeof body?.jobId === 'string' ? body.jobId : null;
    if (!jobId) {
      return jsonResponse({ error: 'jobId is required.' }, 400);
    }

    const providedSecret =
      req.headers.get('x-jobpilot-ingest-secret')?.trim() ?? '';
    let automationAuth = false;
    if (ingestSecret && providedSecret && providedSecret.length === ingestSecret.length) {
      let mismatch = 0;
      for (let i = 0; i < ingestSecret.length; i++) {
        mismatch |= ingestSecret.charCodeAt(i) ^ providedSecret.charCodeAt(i);
      }
      automationAuth = mismatch === 0;
    }

    let supabase;
    let actingUserId: string;

    if (automationAuth) {
      if (!serviceRoleKey) {
        return jsonResponse(
          { error: 'Service role is not configured for automation analysis.' },
          500,
        );
      }
      const target =
        typeof body?.target_user_id === 'string'
          ? body.target_user_id.trim()
          : '';
      if (!target) {
        return jsonResponse(
          {
            error:
              'target_user_id is required when using the ingestion secret.',
          },
          400,
        );
      }
      const allowRaw = Deno.env.get('INGESTION_ALLOWED_USER_IDS')?.trim();
      if (allowRaw) {
        const allowed = new Set(
          allowRaw.split(',').map((s) => s.trim()).filter(Boolean),
        );
        if (!allowed.has(target)) {
          return jsonResponse(
            { error: 'target_user_id is not allowlisted for automation.' },
            403,
          );
        }
      }
      actingUserId = target;
      supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Authentication required.' }, 401);
      }

      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        return jsonResponse({ error: 'Authentication required.' }, 401);
      }
      actingUserId = user.id;
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) {
      console.error('job_fetch_error', jobError.message);
      return jsonResponse({ error: 'Unable to load job.' }, 500);
    }
    if (!job) {
      return jsonResponse({ error: 'Job not found.' }, 404);
    }
    if (job.user_id !== actingUserId) {
      return jsonResponse({ error: 'You do not have access to this job.' }, 403);
    }

    const description = String(job.job_description ?? '').trim();
    if (description.length < MIN_DESCRIPTION_CHARS) {
      return jsonResponse(
        {
          error:
            'Job description is too short to analyze. Add a fuller description and try again.',
        },
        400,
      );
    }

    const { data: recent } = await supabase
      .from('job_analysis')
      .select('id, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.created_at) {
      const ageMs = Date.now() - new Date(recent.created_at).getTime();
      if (ageMs < RATE_LIMIT_SECONDS * 1000) {
        return jsonResponse(
          {
            error: `Please wait ${RATE_LIMIT_SECONDS} seconds before re-analyzing.`,
          },
          429,
        );
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', actingUserId)
      .maybeSingle();

    if (profileError) {
      console.error('profile_fetch_error', profileError.message);
      return jsonResponse({ error: 'Unable to load profile.' }, 500);
    }

    await supabase.from('jobs').update({ status: 'analyzing' }).eq('id', jobId);

    const model = DEFAULT_MODEL;
    const userPayload = buildUserPayload({ profile, job });

    const openaiStarted = Date.now();
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPayload },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'job_analysis_result',
            strict: true,
            schema: jsonSchema,
          },
        },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      // Log status + error code only — never log API keys or full provider payloads.
      let providerCode = 'unknown';
      try {
        const parsedErr = JSON.parse(errText) as {
          error?: { code?: string; type?: string };
        };
        providerCode =
          parsedErr.error?.code ?? parsedErr.error?.type ?? 'unknown';
      } catch {
        providerCode = 'unparseable';
      }
      console.error('openai_error', {
        status: openaiRes.status,
        code: providerCode,
      });
      await supabase.from('jobs').update({ status: 'reviewed' }).eq('id', jobId);

      if (openaiRes.status === 401 || openaiRes.status === 403) {
        return jsonResponse(
          {
            error:
              'AI provider authentication failed. Check OPENAI_API_KEY secret.',
          },
          502,
        );
      }
      if (openaiRes.status === 429) {
        return jsonResponse(
          { error: 'AI provider rate limit reached. Please try again shortly.' },
          502,
        );
      }
      return jsonResponse(
        { error: 'AI provider failed. Please try again shortly.' },
        502,
      );
    }

    const openaiJson = await openaiRes.json();
    const content = openaiJson?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      await supabase.from('jobs').update({ status: 'reviewed' }).eq('id', jobId);
      return jsonResponse({ error: 'AI returned an empty response.' }, 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      await supabase.from('jobs').update({ status: 'reviewed' }).eq('id', jobId);
      return jsonResponse({ error: 'AI returned invalid JSON.' }, 502);
    }

    const validated = analysisResultSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('schema_error', validated.error.message);
      await supabase.from('jobs').update({ status: 'reviewed' }).eq('id', jobId);
      return jsonResponse(
        { error: 'AI response failed validation and was not saved.' },
        502,
      );
    }

    const result = validated.data;
    const usage = openaiJson.usage ?? {};
    const promptTokens = Number(usage.prompt_tokens ?? 0);
    const completionTokens = Number(usage.completion_tokens ?? 0);
    const totalTokens = Number(usage.total_tokens ?? promptTokens + completionTokens);
    const durationMs = Date.now() - openaiStarted;
    const estimatedCost = estimateCostUsd(model, promptTokens, completionTokens);

    const metadata = {
      provider: 'openai',
      model,
      analysis_version: ANALYSIS_VERSION,
      duration_ms: durationMs,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
      estimated_cost_usd: estimatedCost,
      recommendation_reason: result.recommendation_reason,
      cv_focus: result.cv_focus,
      interview_focus: result.interview_focus,
    };

    const insertPayload = {
      user_id: actingUserId,
      job_id: jobId,
      overall_match_score: result.overall_match_score,
      product_fit_score: result.product_fit_score,
      technical_fit_score: result.technical_fit_score,
      ai_tools_fit_score: result.ai_tools_fit_score,
      remote_fit_score: result.remote_fit_score,
      experience_fit_score: result.experience_fit_score,
      strengths: result.strengths,
      gaps: result.gaps,
      risks: result.risks,
      recommendation: result.recommendation,
      reasoning_summary: result.reasoning_summary,
      analysis_version: ANALYSIS_VERSION,
      metadata,
    };

    let { data: inserted, error: insertError } = await supabase
      .from('job_analysis')
      .insert(insertPayload)
      .select('*')
      .single();

    // Graceful fallback if metadata migration not yet applied
    if (
      insertError &&
      /metadata|schema cache|column/i.test(insertError.message)
    ) {
      console.warn('metadata_insert_fallback', insertError.message);
      const { metadata: _ignored, ...withoutMeta } = insertPayload;
      const retry = await supabase
        .from('job_analysis')
        .insert(withoutMeta)
        .select('*')
        .single();
      inserted = retry.data;
      insertError = retry.error;
    }

    if (insertError) {
      console.error('insert_error', insertError.message);
      await supabase.from('jobs').update({ status: 'reviewed' }).eq('id', jobId);
      return jsonResponse({ error: 'Failed to save analysis.' }, 500);
    }

    await supabase.from('jobs').update({ status: 'reviewed' }).eq('id', jobId);

    await supabase.from('activities').insert({
      user_id: actingUserId,
      entity_type: 'job_analysis',
      entity_id: inserted.id,
      activity_type: 'analysis_completed',
      title: 'Job analysis completed',
      description: `${job.job_title}: ${result.recommendation} (${result.overall_match_score}%)`,
      metadata: {
        job_id: jobId,
        overall_match_score: result.overall_match_score,
        recommendation: result.recommendation,
        duration_ms: durationMs,
        model,
      },
    });

    return jsonResponse({
      analysis: inserted,
      meta: {
        duration_ms: Date.now() - startedAt,
        model,
        usage: metadata.usage,
        estimated_cost_usd: estimatedCost,
      },
    });
  } catch (error) {
    console.error('unhandled', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unexpected server error.' }, 500);
  }
});
