import type {
  ActivitiesRepository,
  ActivityInsert,
  ActivityRecord,
} from '@/services/contracts';
import { requireSupabaseClient } from '@/services/supabase/client';

export const supabaseActivitiesRepository: ActivitiesRepository = {
  async list(limit = 50): Promise<ActivityRecord[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async create(input: ActivityInsert): Promise<ActivityRecord> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('activities')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
};
