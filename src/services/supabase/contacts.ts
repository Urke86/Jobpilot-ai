import type {
  Contact,
  ContactInsert,
  ContactsRepository,
  ContactUpdate,
} from '@/services/contracts';
import { requireSupabaseClient } from '@/services/supabase/client';

export const supabaseContactsRepository: ContactsRepository = {
  async listByCompany(companyId: string): Promise<Contact[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: ContactInsert): Promise<Contact> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('contacts')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: ContactUpdate): Promise<Contact> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('contacts')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) throw error;
  },
};
