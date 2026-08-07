import type {
  ApplicationArtifact,
  ApplicationArtifactInsert,
  ApplicationArtifactsRepository,
  ApplicationArtifactUpdate,
} from '@/services/contracts';
import { requireSupabaseClient } from '@/services/supabase/client';

export const supabaseApplicationArtifactsRepository: ApplicationArtifactsRepository =
  {
    async listByApplication(
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
    },

    async create(
      input: ApplicationArtifactInsert,
    ): Promise<ApplicationArtifact> {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('application_artifacts')
        .insert(input)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },

    async update(
      id: string,
      input: ApplicationArtifactUpdate,
    ): Promise<ApplicationArtifact> {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('application_artifacts')
        .update(input)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id: string): Promise<void> {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from('application_artifacts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
  };
