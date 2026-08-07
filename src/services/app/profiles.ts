import type { Profile, ProfileUpdate } from '@/services/contracts';
import { ensureProfile } from '@/services/auth';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';

export async function getCurrentProfile(): Promise<Profile | null> {
  const userId = await requireUserId();
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  return ensureProfile();
}

export async function updateCurrentProfile(
  input: Omit<ProfileUpdate, 'user_id' | 'id'>,
): Promise<Profile> {
  const userId = await requireUserId();
  const supabase = requireSupabaseClient();
  const existing = await getCurrentProfile();
  if (!existing) {
    throw new Error('Profile not found.');
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(input)
    .eq('id', existing.id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
