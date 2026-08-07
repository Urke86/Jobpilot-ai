import type {
  ActivityInsert,
  ActivityRecord,
} from '@/services/contracts';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';
import type { Enums, Json } from '@/types/database';

type ActivityType = Enums<'activity_type'>;
type EntityType = Enums<'activity_entity_type'>;

export async function logActivity(input: {
  activityType: ActivityType;
  entityType: EntityType;
  entityId?: string | null;
  title: string;
  description?: string | null;
  metadata?: Json;
}): Promise<ActivityRecord | null> {
  try {
    const userId = await requireUserId();
    const supabase = requireSupabaseClient();
    const row: ActivityInsert = {
      user_id: userId,
      activity_type: input.activityType,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      title: input.title,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    };
    const { data, error } = await supabase
      .from('activities')
      .insert(row)
      .select('*')
      .single();
    if (error) {
      console.error('[logActivity]', error.message);
      return null;
    }
    return data;
  } catch (error) {
    console.error('[logActivity]', error);
    return null;
  }
}

export async function listActivities(limit = 20): Promise<ActivityRecord[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
