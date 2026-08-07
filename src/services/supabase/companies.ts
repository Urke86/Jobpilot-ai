import type {
  CompaniesRepository,
  CompanyInsert,
  CompanyRecord,
  CompanyUpdate,
} from '@/services/contracts';
import { requireSupabaseClient } from '@/services/supabase/client';

export const supabaseCompaniesRepository: CompaniesRepository = {
  async list(): Promise<CompanyRecord[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<CompanyRecord | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: CompanyInsert): Promise<CompanyRecord> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('companies')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: CompanyUpdate): Promise<CompanyRecord> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('companies')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) throw error;
  },
};
