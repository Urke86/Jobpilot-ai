import type { JobAnalysis, JobAnalysisInsert } from '@/services/contracts';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';

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

/** Manual/dev-only analysis insert — not AI-generated. */
export async function createManualJobAnalysis(
  input: Omit<JobAnalysisInsert, 'user_id'>,
): Promise<JobAnalysis> {
  const userId = await requireUserId();
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('job_analysis')
    .insert({ ...input, user_id: userId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
