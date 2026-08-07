import type {
  ApplicationArtifact,
  ApplicationArtifactInsert,
} from '@/services/contracts';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';

export async function listArtifactsByApplication(
  applicationId: string,
): Promise<ApplicationArtifact[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('application_artifacts')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createArtifact(
  input: Omit<ApplicationArtifactInsert, 'user_id'>,
): Promise<ApplicationArtifact> {
  const userId = await requireUserId();
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('application_artifacts')
    .insert({ ...input, user_id: userId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
