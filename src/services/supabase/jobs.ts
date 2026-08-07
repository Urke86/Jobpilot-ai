import type {
  JobInsert,
  JobRecord,
  JobsRepository,
  JobUpdate,
} from '@/services/contracts';
import { requireSupabaseClient } from '@/services/supabase/client';

export const supabaseJobsRepository: JobsRepository = {
  async list(): Promise<JobRecord[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('date_discovered', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<JobRecord | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async listByCompany(companyId: string): Promise<JobRecord[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('company_id', companyId)
      .order('date_discovered', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: JobInsert): Promise<JobRecord> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('jobs')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: JobUpdate): Promise<JobRecord> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('jobs')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) throw error;
  },
};
