import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.58.0';
import { z } from 'npm:zod@3.23.8';
import { corsHeadersFor } from '../_shared/cors.ts';
import {
  ANALYZE_PROXY_TIMEOUT_MS,
  fetchWithTimeout,
} from '../_shared/fetch-timeout.ts';
import { tryAcquireRateLimit } from '../_shared/rate-limit.ts';

const AUTOMATION_VERSION = 'ingest-v1';
const DEDUPE_WINDOW_DAYS = 30;
const MIN_ANALYZE_DESCRIPTION = 80;

const REMOTE_SCOPES = [
  'onsite',
  'hybrid',
  'remote_country',
  'remote_europe',
  'remote_emea',
  'remote_global',
  'unknown',
] as const;

const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'temporary',
  'internship',
  'unknown',
] as const;

type RemoteScope = (typeof REMOTE_SCOPES)[number];
type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
type IngestStatus =
  | 'created'
  | 'duplicate'
  | 'potential_duplicate'
  | 'rejected';

type IngestResult = {
  status: IngestStatus;
  job_id: string | null;
  company_id: string | null;
  reason: string | null;
  analyzed?: boolean;
  analysis_id?: string | null;
  analysis_error?: string | null;
};

function createJsonResponse(req: Request) {
  return (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeadersFor(req),
        'Content-Type': 'application/json',
      },
    });
}

function collapseWs(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeCompanyName(value: string): string {
  return collapseWs(value);
}

function normalizeTitle(value: string): string {
  return collapseWs(value);
}

function normalizeSource(value: string): string {
  return collapseWs(value).toLowerCase();
}

/** Strip tracking params and trailing slash; lowercase host. */
function normalizeJobUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    url.hash = '';
    const drop = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'mc_cid',
      'mc_eid',
    ];
    for (const key of drop) url.searchParams.delete(key);
    url.hostname = url.hostname.toLowerCase();
    let out = url.toString();
    if (out.endsWith('/') && url.pathname !== '/') {
      out = out.slice(0, -1);
    }
    return out;
  } catch {
    return collapseWs(trimmed);
  }
}

function mapRemoteScope(raw: unknown): RemoteScope {
  if (typeof raw !== 'string' || !raw.trim()) return 'unknown';
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if ((REMOTE_SCOPES as readonly string[]).includes(v)) {
    return v as RemoteScope;
  }
  if (v.includes('hybrid')) return 'hybrid';
  if (v.includes('onsite') || v.includes('on_site') || v === 'office') {
    return 'onsite';
  }
  if (v.includes('europe') || v === 'eu') return 'remote_europe';
  if (v.includes('emea')) return 'remote_emea';
  if (v.includes('global') || v.includes('worldwide')) return 'remote_global';
  if (v.includes('remote') || v.includes('wfh')) return 'remote_global';
  return 'unknown';
}

function mapEmploymentType(raw: unknown): EmploymentType {
  if (typeof raw !== 'string' || !raw.trim()) return 'unknown';
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if ((EMPLOYMENT_TYPES as readonly string[]).includes(v)) {
    return v as EmploymentType;
  }
  if (v.includes('full')) return 'full_time';
  if (v.includes('part')) return 'part_time';
  if (v.includes('contract') || v.includes('freelance')) return 'contract';
  if (v.includes('temp')) return 'temporary';
  if (v.includes('intern')) return 'internship';
  return 'unknown';
}

function mapCurrency(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return 'EUR';
  const v = raw.trim().toUpperCase();
  if (v.length === 3) return v;
  if (v === '€' || v === 'EURO') return 'EUR';
  if (v === '$' || v === 'USD$' || v === 'US$') return 'USD';
  if (v === '£' || v === 'GBP£') return 'GBP';
  return 'EUR';
}

function parseOptionalDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
}

function parseOptionalInt(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

const jobPayloadSchema = z.object({
  job_title: z.string().min(1),
  company_name: z.string().min(1),
  source: z.string().min(1),
  job_url: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  remote_scope: z.string().optional().nullable(),
  salary_min: z.union([z.number(), z.string()]).optional().nullable(),
  salary_max: z.union([z.number(), z.string()]).optional().nullable(),
  salary_currency: z.string().optional().nullable(),
  employment_type: z.string().optional().nullable(),
  job_description: z.string().optional().nullable(),
  date_discovered: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  external_id: z.string().optional().nullable(),
  ingestion_metadata: z.record(z.unknown()).optional().nullable(),
});

type JobPayload = z.infer<typeof jobPayloadSchema>;

type NormalizedJob = {
  job_title: string;
  company_name: string;
  source: string;
  job_url: string | null;
  location: string | null;
  remote_scope: RemoteScope;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  employment_type: EmploymentType;
  job_description: string | null;
  date_discovered: string | null;
  deadline: string | null;
  ingestion_metadata: Record<string, unknown>;
};

function normalizeJob(raw: JobPayload, workflowHint?: string | null): NormalizedJob {
  const title = normalizeTitle(raw.job_title);
  const company = normalizeCompanyName(raw.company_name);
  const source = normalizeSource(raw.source);
  const job_url = normalizeJobUrl(raw.job_url);
  let salary_min = parseOptionalInt(raw.salary_min);
  let salary_max = parseOptionalInt(raw.salary_max);
  if (salary_min != null && salary_max != null && salary_max < salary_min) {
    const tmp = salary_min;
    salary_min = salary_max;
    salary_max = tmp;
  }

  const baseMeta =
    raw.ingestion_metadata && typeof raw.ingestion_metadata === 'object'
      ? { ...raw.ingestion_metadata }
      : {};

  const ingestion_metadata: Record<string, unknown> = {
    ...baseMeta,
    source,
    automation_version: AUTOMATION_VERSION,
    ingested_at: new Date().toISOString(),
    original_job_url: typeof raw.job_url === 'string' ? raw.job_url.trim() || null : null,
  };
  if (raw.external_id) ingestion_metadata.external_id = String(raw.external_id);
  if (workflowHint) ingestion_metadata.workflow = workflowHint;

  return {
    job_title: title,
    company_name: company,
    source,
    job_url,
    location: raw.location ? collapseWs(String(raw.location)) : null,
    remote_scope: mapRemoteScope(raw.remote_scope),
    salary_min,
    salary_max,
    salary_currency: mapCurrency(raw.salary_currency),
    employment_type: mapEmploymentType(raw.employment_type),
    job_description: raw.job_description
      ? String(raw.job_description).trim() || null
      : null,
    date_discovered: parseOptionalDate(raw.date_discovered),
    deadline: parseOptionalDate(raw.deadline),
    ingestion_metadata,
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function parseAllowedUserIds(): Set<string> {
  const raw = Deno.env.get('INGESTION_ALLOWED_USER_IDS')?.trim();
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function assertAutomationAllowlist(
  targetUserId: string,
  jsonResponse: (body: unknown, status?: number) => Response,
): Response | null {
  const allowed = parseAllowedUserIds();
  if (allowed.size === 0) {
    console.error('ingestion_allowlist_missing');
    return jsonResponse(
      {
        error:
          'INGESTION_ALLOWED_USER_IDS must be configured for automation auth.',
      },
      503,
    );
  }
  if (!allowed.has(targetUserId)) {
    return jsonResponse(
      { error: 'target_user_id is not allowlisted for automation.' },
      403,
    );
  }
  return null;
}

function envAutoAnalyzeDefault(): boolean {
  const v = (Deno.env.get('AUTO_ANALYZE_INGESTED_JOBS') ?? 'false').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

async function findCompany(
  client: SupabaseClient,
  userId: string,
  companyName: string,
): Promise<{ id: string; name: string; created: boolean }> {
  const { data: existing, error } = await client
    .from('companies')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', companyName)
    .limit(25);

  if (error) {
    console.error('company_lookup_error', error.message);
    throw new Error('Unable to look up company.');
  }

  const match = (existing ?? []).find(
    (c) => collapseWs(c.name).toLowerCase() === companyName.toLowerCase(),
  );
  if (match) {
    return { id: match.id, name: match.name, created: false };
  }

  const { data: created, error: insertError } = await client
    .from('companies')
    .insert({ user_id: userId, name: companyName })
    .select('id, name')
    .single();

  if (insertError || !created) {
    console.error('company_insert_error', insertError?.message);
    throw new Error('Unable to create company.');
  }

  await client.from('activities').insert({
    user_id: userId,
    entity_type: 'company',
    entity_id: created.id,
    activity_type: 'company_added',
    title: 'Company added',
    description: `Added ${created.name} via job ingestion.`,
    metadata: { via: 'ingest-job', automation_version: AUTOMATION_VERSION },
  });

  return { id: created.id, name: created.name, created: true };
}

async function findUrlDuplicate(
  client: SupabaseClient,
  userId: string,
  jobUrl: string,
): Promise<{ id: string; company_id: string | null } | null> {
  // Prefer DB-normalized key (trigger/SQL). Fall back to exact job_url for
  // any pre-migration rows that were not backfilled onto a unique slot.
  const { data, error } = await client
    .from('jobs')
    .select('id, company_id')
    .eq('user_id', userId)
    .eq('normalized_job_url', jobUrl)
    .maybeSingle();

  if (error) {
    console.error('url_dedupe_error', error.message);
    throw new Error('Unable to check duplicates.');
  }
  if (data) return { id: data.id, company_id: data.company_id };

  const { data: byExact, error: exactError } = await client
    .from('jobs')
    .select('id, company_id')
    .eq('user_id', userId)
    .eq('job_url', jobUrl)
    .maybeSingle();

  if (exactError) {
    console.error('url_dedupe_exact_error', exactError.message);
    throw new Error('Unable to check duplicates.');
  }

  return byExact ? { id: byExact.id, company_id: byExact.company_id } : null;
}

async function findTitleCompanyRecent(
  client: SupabaseClient,
  userId: string,
  title: string,
  company: string,
): Promise<{ id: string; company_id: string | null } | null> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - DEDUPE_WINDOW_DAYS);
  const { data, error } = await client
    .from('jobs')
    .select('id, company_id, job_title, company_name_snapshot, created_at')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .limit(300);

  if (error) {
    console.error('title_dedupe_error', error.message);
    throw new Error('Unable to check duplicates.');
  }

  const t = title.toLowerCase();
  const c = company.toLowerCase();
  const hit = (data ?? []).find(
    (row) =>
      collapseWs(row.job_title).toLowerCase() === t &&
      collapseWs(row.company_name_snapshot).toLowerCase() === c,
  );
  return hit ? { id: hit.id, company_id: hit.company_id } : null;
}

async function triggerAnalyzeJob(params: {
  supabaseUrl: string;
  anonKey: string;
  ingestSecret: string;
  jobId: string;
  targetUserId: string;
}): Promise<{ ok: boolean; analysisId: string | null; error: string | null }> {
  try {
    const res = await fetchWithTimeout(
      `${params.supabaseUrl}/functions/v1/analyze-job`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.anonKey}`,
          apikey: params.anonKey,
          'Content-Type': 'application/json',
          'x-jobpilot-ingest-secret': params.ingestSecret,
        },
        body: JSON.stringify({
          jobId: params.jobId,
          target_user_id: params.targetUserId,
        }),
      },
      ANALYZE_PROXY_TIMEOUT_MS,
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        analysisId: null,
        error:
          typeof json.error === 'string'
            ? json.error
            : `analyze failed (${res.status})`,
      };
    }
    return {
      ok: true,
      analysisId:
        typeof json?.analysis?.id === 'string' ? json.analysis.id : null,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'analyze request failed';
    const sanitized = /timed out/i.test(msg)
      ? 'Analysis timed out. Job was saved; retry analysis later.'
      : 'Analysis request failed. Job was saved; retry analysis later.';
    console.error('analyze_proxy_error', /timed out/i.test(msg) ? 'timeout' : 'error');
    return {
      ok: false,
      analysisId: null,
      error: sanitized,
    };
  }
}

async function ingestOne(
  client: SupabaseClient,
  userId: string,
  raw: unknown,
  opts: {
    workflow?: string | null;
    autoAnalyze: boolean;
    analyzeCtx?: {
      supabaseUrl: string;
      anonKey: string;
      ingestSecret: string;
    };
  },
): Promise<IngestResult> {
  const parsed = jobPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'rejected',
      job_id: null,
      company_id: null,
      reason: 'Malformed payload. Required: job_title, company_name, source.',
    };
  }

  const job = normalizeJob(parsed.data, opts.workflow);
  if (!job.job_title || !job.company_name || !job.source) {
    return {
      status: 'rejected',
      job_id: null,
      company_id: null,
      reason: 'job_title, company_name, and source are required after normalization.',
    };
  }

  if (job.job_url) {
    const dup = await findUrlDuplicate(client, userId, job.job_url);
    if (dup) {
      return {
        status: 'duplicate',
        job_id: dup.id,
        company_id: dup.company_id,
        reason: 'Job URL already exists for this user.',
      };
    }
  } else {
    const soft = await findTitleCompanyRecent(
      client,
      userId,
      job.job_title,
      job.company_name,
    );
    if (soft) {
      return {
        status: 'potential_duplicate',
        job_id: soft.id,
        company_id: soft.company_id,
        reason: `Same title+company within ${DEDUPE_WINDOW_DAYS} days (no URL). Skipped auto-create.`,
      };
    }
  }

  const company = await findCompany(client, userId, job.company_name);

  const row = {
    user_id: userId,
    company_id: company.id,
    company_name_snapshot: company.name,
    job_title: job.job_title,
    job_url: job.job_url,
    // Trigger also sets this; explicit value keeps Edge + DB semantics aligned.
    normalized_job_url: job.job_url,
    source: job.source,
    location: job.location,
    remote_scope: job.remote_scope,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
    employment_type: job.employment_type,
    job_description: job.job_description,
    date_discovered: job.date_discovered ?? undefined,
    deadline: job.deadline,
    status: 'new' as const,
    ingestion_metadata: job.ingestion_metadata,
  };

  const { data: inserted, error: insertError } = await client
    .from('jobs')
    .insert(row)
    .select('id, company_id')
    .single();

  if (insertError) {
    if (insertError.code === '23505' || /duplicate|unique/i.test(insertError.message)) {
      const again = job.job_url
        ? await findUrlDuplicate(client, userId, job.job_url)
        : null;
      return {
        status: 'duplicate',
        job_id: again?.id ?? null,
        company_id: again?.company_id ?? company.id,
        reason: 'Unique constraint: job URL already exists.',
      };
    }
    console.error('job_insert_error', insertError.message);
    return {
      status: 'rejected',
      job_id: null,
      company_id: company.id,
      reason: 'Failed to persist job.',
    };
  }

  await client.from('activities').insert({
    user_id: userId,
    entity_type: 'job',
    entity_id: inserted.id,
    activity_type: 'job_discovered',
    title: 'Job ingested',
    description: `Ingested ${job.job_title} at ${company.name} (${job.source}).`,
    metadata: {
      via: 'ingest-job',
      source: job.source,
      workflow: job.ingestion_metadata.workflow ?? null,
      automation_version: AUTOMATION_VERSION,
      company_created: company.created,
    },
  });

  const result: IngestResult = {
    status: 'created',
    job_id: inserted.id,
    company_id: inserted.company_id,
    reason: null,
  };

  const descLen = (job.job_description ?? '').length;
  if (
    opts.autoAnalyze &&
    opts.analyzeCtx &&
    descLen >= MIN_ANALYZE_DESCRIPTION
  ) {
    const analysis = await triggerAnalyzeJob({
      ...opts.analyzeCtx,
      jobId: inserted.id,
      targetUserId: userId,
    });
    result.analyzed = analysis.ok;
    result.analysis_id = analysis.analysisId;
    result.analysis_error = analysis.error;
  } else if (opts.autoAnalyze && descLen < MIN_ANALYZE_DESCRIPTION) {
    result.analyzed = false;
    result.analysis_error =
      'Description too short for auto-analysis; skipped.';
  } else {
    result.analyzed = false;
  }

  return result;
}

function extractItems(body: Record<string, unknown>): unknown[] {
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.jobs)) return body.jobs;
  if (body.job && typeof body.job === 'object') return [body.job];
  // Single flat payload
  if (typeof body.job_title === 'string') return [body];
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }

  const jsonResponse = createJsonResponse(req);
  const startedAt = Date.now();

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ingestSecret = Deno.env.get('INGESTION_SECRET')?.trim() ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Supabase environment is incomplete.' }, 500);
    }

    const providedSecret = req.headers.get('x-jobpilot-ingest-secret')?.trim() ?? '';
    const automationAuth =
      Boolean(ingestSecret) &&
      Boolean(providedSecret) &&
      timingSafeEqual(providedSecret, ingestSecret);

    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') {
      return jsonResponse({ error: 'JSON body required.' }, 400);
    }

    let userId: string;
    let client: SupabaseClient;

    if (automationAuth) {
      if (!serviceRoleKey) {
        return jsonResponse(
          { error: 'Service role is not configured for ingestion.' },
          500,
        );
      }
      const target =
        typeof body.target_user_id === 'string'
          ? body.target_user_id.trim()
          : typeof body.user_id === 'string'
            ? body.user_id.trim()
            : '';
      if (!target || !z.string().uuid().safeParse(target).success) {
        return jsonResponse(
          {
            error:
              'target_user_id (UUID) is required when using the ingestion secret.',
          },
          400,
        );
      }
      const allowErr = assertAutomationAllowlist(target, jsonResponse);
      if (allowErr) return allowErr;
      userId = target;
      client = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Authentication required.' }, 401);
      }
      client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();
      if (userError || !user) {
        return jsonResponse({ error: 'Authentication required.' }, 401);
      }
      // Ignore any caller-supplied user ids on the JWT path
      userId = user.id;
    }

    const ingestLease = await tryAcquireRateLimit(
      client,
      `ingest-job:${userId}`,
      15,
      userId,
    );
    if (!ingestLease) {
      return jsonResponse(
        {
          error:
            'Ingestion rate limit reached. Wait a few seconds and retry.',
          code: 'rate_limited',
        },
        429,
      );
    }

    const items = extractItems(body);
    if (items.length === 0) {
      return jsonResponse(
        {
          error:
            'No jobs provided. Send a job object, { job }, { items: [] }, or { jobs: [] }.',
        },
        400,
      );
    }
    if (items.length > 50) {
      return jsonResponse({ error: 'Batch size limited to 50 jobs.' }, 400);
    }

    const workflow =
      typeof body.workflow === 'string' ? collapseWs(body.workflow) : null;

    let autoAnalyze = envAutoAnalyzeDefault();
    if (typeof body.auto_analyze === 'boolean') {
      // Only automation callers may force auto_analyze true remotely;
      // authenticated users may opt in explicitly from the UI.
      autoAnalyze = body.auto_analyze;
    }
    if (!automationAuth && body.auto_analyze === true) {
      // Manual UI import defaults off unless user explicitly sets true —
      // already handled; keep allowed for JWT callers.
      autoAnalyze = true;
    }

    const analyzeCtx =
      autoAnalyze && ingestSecret
        ? {
            supabaseUrl,
            anonKey: supabaseAnonKey,
            ingestSecret,
          }
        : undefined;

    // If auto-analyze requested but secret missing, skip analyze quietly for JWT path
    // unless we can call analyze-job with the user's JWT (preferred for manual).
    const userAuthHeader = req.headers.get('Authorization');

    const results: IngestResult[] = [];
    for (const item of items) {
      try {
        const one = await ingestOne(client, userId, item, {
          workflow,
          autoAnalyze: Boolean(autoAnalyze && (analyzeCtx || userAuthHeader)),
          analyzeCtx: analyzeCtx ?? undefined,
        });

        // JWT path: call analyze-job with user token when no automation secret
        if (
          one.status === 'created' &&
          autoAnalyze &&
          !analyzeCtx &&
          userAuthHeader &&
          one.job_id
        ) {
          const desc =
            typeof (item as { job_description?: string })?.job_description ===
            'string'
              ? (item as { job_description: string }).job_description
              : '';
          if (desc.trim().length >= MIN_ANALYZE_DESCRIPTION) {
            try {
              const res = await fetchWithTimeout(
                `${supabaseUrl}/functions/v1/analyze-job`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: userAuthHeader,
                    apikey: supabaseAnonKey,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ jobId: one.job_id }),
                },
                ANALYZE_PROXY_TIMEOUT_MS,
              );
              const json = await res.json().catch(() => ({}));
              one.analyzed = res.ok;
              one.analysis_id =
                typeof json?.analysis?.id === 'string' ? json.analysis.id : null;
              one.analysis_error = res.ok
                ? null
                : typeof json.error === 'string'
                  ? json.error
                  : `analyze failed (${res.status})`;
            } catch (err) {
              one.analyzed = false;
              const msg =
                err instanceof Error ? err.message : 'analyze failed';
              one.analysis_error = /timed out/i.test(msg)
                ? 'Analysis timed out. Job was saved; retry analysis later.'
                : 'Analysis request failed. Job was saved; retry analysis later.';
              console.error(
                'analyze_proxy_error',
                /timed out/i.test(msg) ? 'timeout' : 'error',
              );
            }
          }
        }

        results.push(one);
      } catch (err) {
        console.error(
          'item_error',
          err instanceof Error ? err.message : err,
        );
        results.push({
          status: 'rejected',
          job_id: null,
          company_id: null,
          reason: 'Unexpected error processing item.',
        });
      }
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === 'created').length,
      duplicate: results.filter((r) => r.status === 'duplicate').length,
      potential_duplicate: results.filter(
        (r) => r.status === 'potential_duplicate',
      ).length,
      rejected: results.filter((r) => r.status === 'rejected').length,
      auto_analyzed: results.filter((r) => r.analyzed).length,
      duration_ms: Date.now() - startedAt,
    };

    return jsonResponse({
      results: items.length === 1 ? undefined : results,
      ...(items.length === 1 ? results[0] : {}),
      summary,
      automation_version: AUTOMATION_VERSION,
    });
  } catch (error) {
    console.error('unhandled', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unexpected server error.' }, 500);
  }
});
