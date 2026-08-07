import type {
  JobAnalysis,
  JobAnalysisInsert,
  JobAnalysisRepository,
} from '@/services/contracts';
import { requireSupabaseClient } from '@/services/supabase/client';

export const supabaseJobAnalysisRepository: JobAnalysisRepository = {
  async listByJob(jobId: string): Promise<JobAnalysis[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('job_analysis')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getLatestForJob(jobId: string): Promise<JobAnalysis | null> {
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
  },

  async create(input: JobAnalysisInsert): Promise<JobAnalysis> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('job_analysis')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
};
