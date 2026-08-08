import type { ApplicationArtifact } from '@/services/contracts';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';
import type {
  ArtifactRunMetadata,
  ArtifactType,
} from '@/lib/ai/artifact-schemas';
import type { Json } from '@/types/database';

export interface GenerateArtifactInput {
  applicationId: string;
  artifactType: ArtifactType;
  question?: string;
  userNotes?: string;
  userInstruction?: string;
  contactName?: string;
  contactRole?: string;
  daysSinceApplication?: number;
  preferredLength?: string;
}

export interface GenerateArtifactResponse {
  artifact: ApplicationArtifact;
  meta?: {
    duration_ms?: number;
    model?: string;
    usage?: ArtifactRunMetadata['usage'];
    estimated_cost_usd?: number | null;
  };
}

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

export async function listArtifactsByType(
  applicationId: string,
  artifactType: ArtifactType,
): Promise<ApplicationArtifact[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('application_artifacts')
    .select('*')
    .eq('application_id', applicationId)
    .eq('artifact_type', artifactType)
    .order('version', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLatestArtifactByType(
  applicationId: string,
  artifactType: ArtifactType,
): Promise<ApplicationArtifact | null> {
  const rows = await listArtifactsByType(applicationId, artifactType);
  return rows[0] ?? null;
}

export async function createArtifact(input: {
  applicationId: string;
  artifactType: ArtifactType;
  content: string;
  version?: number;
  metadata?: Json;
}): Promise<ApplicationArtifact> {
  const userId = await requireUserId();
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('application_artifacts')
    .insert({
      user_id: userId,
      application_id: input.applicationId,
      artifact_type: input.artifactType,
      content: input.content,
      version: input.version ?? 1,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateArtifactContent(
  artifactId: string,
  content: string,
): Promise<ApplicationArtifact> {
  await requireUserId();
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('application_artifacts')
    .update({ content })
    .eq('id', artifactId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Invokes secure generate-artifact Edge Function.
 */
export async function requestArtifactGeneration(
  input: GenerateArtifactInput,
): Promise<GenerateArtifactResponse> {
  await requireUserId();
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase.functions.invoke('generate-artifact', {
    body: {
      applicationId: input.applicationId,
      artifactType: input.artifactType,
      question: input.question,
      userNotes: input.userNotes,
      userInstruction: input.userInstruction,
      contactName: input.contactName,
      contactRole: input.contactRole,
      daysSinceApplication: input.daysSinceApplication,
      preferredLength: input.preferredLength,
    },
  });

  if (error) {
    throw new Error(sanitizeClientError(await extractFunctionError(error, data)));
  }
  if (data?.error) {
    throw new Error(sanitizeClientError(String(data.error)));
  }
  if (!data?.artifact) {
    throw new Error('Generation failed. Empty response from server.');
  }
  return data as GenerateArtifactResponse;
}

export function getArtifactMetadata(
  artifact: ApplicationArtifact,
): ArtifactRunMetadata {
  const raw = artifact.metadata;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as ArtifactRunMetadata;
}

async function extractFunctionError(
  error: { message?: string; context?: Response },
  data: unknown,
): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  try {
    const ctx = error.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body && typeof body.error === 'string' && body.error.trim()) {
        return body.error;
      }
    }
  } catch {
    // ignore
  }
  if (typeof error.message === 'string' && error.message.trim()) {
    if (error.message.includes('non-2xx')) {
      return 'Generation failed. Please try again.';
    }
    return error.message;
  }
  return 'Generation failed. Please try again.';
}

function sanitizeClientError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('openai') ||
    lower.includes('api key') ||
    lower.includes('api_key')
  ) {
    return 'AI generation is temporarily unavailable. Please try again later.';
  }
  return message;
}
