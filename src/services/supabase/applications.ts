import type {
  ApplicationInsert,
  ApplicationRecord,
  ApplicationsRepository,
  ApplicationUpdate,
} from '@/services/contracts';
import { requireSupabaseClient } from '@/services/supabase/client';

export const supabaseApplicationsRepository: ApplicationsRepository = {
  async list(): Promise<ApplicationRecord[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<ApplicationRecord | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getByJobId(jobId: string): Promise<ApplicationRecord | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: ApplicationInsert): Promise<ApplicationRecord> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('applications')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(
    id: string,
    input: ApplicationUpdate,
  ): Promise<ApplicationRecord> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('applications')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('applications').delete().eq('id', id);
    if (error) throw error;
  },
};
