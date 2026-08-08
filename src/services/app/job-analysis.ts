import type { JobAnalysis } from '@/services/contracts';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';
import type {
  AnalysisGap,
  AnalysisRisk,
  AnalysisStrength,
  JobAnalysisMetadata,
} from '@/lib/ai/job-analysis-schema';
import type { Json } from '@/types/database';

export async function getLatestJobAnalysis(
  jobId: string,
): Promise<JobAnalysis | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('job_analysis')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listJobAnalyses(jobId: string): Promise<JobAnalysis[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('job_analysis')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface AnalyzeJobResponse {
  analysis: JobAnalysis;
  meta?: {
    duration_ms?: number;
    model?: string;
    usage?: JobAnalysisMetadata['usage'];
    estimated_cost_usd?: number | null;
  };
}

/**
 * Invokes the secure analyze-job Edge Function.
 * UI must not know OpenAI details.
 */
export async function requestJobAnalysis(
  jobId: string,
): Promise<AnalyzeJobResponse> {
  await requireUserId();
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase.functions.invoke('analyze-job', {
    body: { jobId },
  });

  if (error) {
    const fromBody = await extractFunctionError(error, data);
    throw new Error(sanitizeClientError(fromBody));
  }

  if (data?.error) {
    throw new Error(sanitizeClientError(String(data.error)));
  }

  if (!data?.analysis) {
    throw new Error('Analysis failed. Empty response from server.');
  }

  return data as AnalyzeJobResponse;
}

async function extractFunctionError(
  error: { message?: string; context?: Response },
  data: unknown,
): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }

  try {
    const ctx = error.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body && typeof body.error === 'string' && body.error.trim()) {
        return body.error;
      }
    }
  } catch {
    // ignore parse failures
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    if (error.message.includes('non-2xx')) {
      return 'Analysis failed. Please try again.';
    }
    return error.message;
  }

  return 'Analysis failed. Please try again.';
}

function sanitizeClientError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('openai') ||
    lower.includes('api key') ||
    lower.includes('api_key')
  ) {
    return 'AI analysis is temporarily unavailable. Please try again later.';
  }
  return message;
}

export function parseAnalysisStrengths(value: Json): AnalysisStrength[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return { title: item, evidence: item };
      }
      if (
        item &&
        typeof item === 'object' &&
        'title' in item &&
        'evidence' in item
      ) {
        const row = item as { title?: unknown; evidence?: unknown };
        if (typeof row.title === 'string' && typeof row.evidence === 'string') {
          return { title: row.title, evidence: row.evidence };
        }
      }
      return null;
    })
    .filter((item): item is AnalysisStrength => item !== null);
}

export function parseAnalysisGaps(value: Json): AnalysisGap[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return {
          title: item,
          evidence: item,
          severity: 'medium' as const,
        };
      }
      if (item && typeof item === 'object' && 'title' in item) {
        const row = item as {
          title?: unknown;
          evidence?: unknown;
          severity?: unknown;
        };
        if (typeof row.title !== 'string') return null;
        const severity =
          row.severity === 'low' ||
          row.severity === 'medium' ||
          row.severity === 'high'
            ? row.severity
            : 'medium';
        return {
          title: row.title,
          evidence:
            typeof row.evidence === 'string' ? row.evidence : row.title,
          severity,
        };
      }
      return null;
    })
    .filter((item): item is AnalysisGap => item !== null);
}

export function parseAnalysisRisks(value: Json): AnalysisRisk[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return { title: item, reason: item };
      }
      if (item && typeof item === 'object' && 'title' in item) {
        const row = item as { title?: unknown; reason?: unknown };
        if (typeof row.title !== 'string') return null;
        return {
          title: row.title,
          reason: typeof row.reason === 'string' ? row.reason : row.title,
        };
      }
      return null;
    })
    .filter((item): item is AnalysisRisk => item !== null);
}

export function getAnalysisMetadata(
  analysis: JobAnalysis,
): JobAnalysisMetadata {
  const raw = (analysis as JobAnalysis & { metadata?: Json }).metadata;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as JobAnalysisMetadata;
}
