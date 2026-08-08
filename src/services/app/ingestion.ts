import { requireSupabaseClient, requireUserId } from '@/services/supabase/client';
import type { JobRecord } from '@/services/contracts';
import type { Json } from '@/types/database';

export type IngestJobPayload = {
  job_title: string;
  company_name: string;
  source: string;
  job_url?: string | null;
  location?: string | null;
  remote_scope?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  employment_type?: string | null;
  job_description?: string | null;
  date_discovered?: string | null;
  deadline?: string | null;
  external_id?: string | null;
  ingestion_metadata?: Record<string, unknown> | null;
};

export type IngestStatus =
  | 'created'
  | 'duplicate'
  | 'potential_duplicate'
  | 'rejected';

export type IngestResult = {
  status: IngestStatus;
  job_id: string | null;
  company_id: string | null;
  reason: string | null;
  analyzed?: boolean;
  analysis_id?: string | null;
  analysis_error?: string | null;
};

export type IngestResponse = IngestResult & {
  results?: IngestResult[];
  summary?: {
    total: number;
    created: number;
    duplicate: number;
    potential_duplicate: number;
    rejected: number;
    auto_analyzed: number;
    duration_ms: number;
  };
  automation_version?: string;
  error?: string;
};

async function getAccessToken(): Promise<string> {
  await requireUserId();
  const supabase = requireSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('You must be signed in to continue.');
  }
  return session.access_token;
}

export async function ingestJobs(input: {
  items: IngestJobPayload[];
  workflow?: string;
  autoAnalyze?: boolean;
}): Promise<IngestResponse> {
  const accessToken = await getAccessToken();
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${url}/functions/v1/ingest-job`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anon,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: input.items,
      workflow: input.workflow ?? 'manual-ui',
      auto_analyze: input.autoAnalyze ?? false,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as IngestResponse;
  if (!res.ok) {
    throw new Error(json.error || `Ingestion failed (${res.status})`);
  }
  return json;
}

export async function ingestSingleJob(
  job: IngestJobPayload,
  opts?: { autoAnalyze?: boolean },
): Promise<IngestResponse> {
  return ingestJobs({
    items: [job],
    workflow: 'manual-ui',
    autoAnalyze: opts?.autoAnalyze ?? false,
  });
}

/** Jobs that carry non-empty ingestion_metadata (imported / automated). */
export async function listRecentlyIngestedJobs(
  limit = 20,
): Promise<JobRecord[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  const ingested = (data ?? []).filter((job) => {
    const meta = job.ingestion_metadata as Json | null;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
    return Object.keys(meta).length > 0;
  });

  return ingested.slice(0, limit);
}

export function getIngestionMeta(
  job: JobRecord,
): Record<string, unknown> | null {
  const meta = job.ingestion_metadata as Json | null;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  if (Object.keys(meta).length === 0) return null;
  return meta as Record<string, unknown>;
}
