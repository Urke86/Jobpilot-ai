import type {
  Profile,
  ProfileInsert,
  ProfilesRepository,
  ProfileUpdate,
} from '@/services/contracts';
import { requireSupabaseClient } from '@/services/supabase/client';

export const supabaseProfilesRepository: ProfilesRepository = {
  async getByUserId(userId: string): Promise<Profile | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(input: ProfileInsert): Promise<Profile> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .upsert(input, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: ProfileUpdate): Promise<Profile> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
};
