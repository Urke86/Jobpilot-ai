import { env } from '@/lib/env';
import type { Tables, TablesInsert } from '@/types/database';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';

export type AiConversation = Tables<'ai_conversations'>;
export type AiMessage = Tables<'ai_messages'>;
export type AiConversationInsert = TablesInsert<'ai_conversations'>;

export type AssistantContextType = 'none' | 'job' | 'application';

export interface CreateConversationInput {
  title?: string;
  contextType?: AssistantContextType;
  contextJobId?: string | null;
  contextApplicationId?: string | null;
}

export async function listConversations(): Promise<AiConversation[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('ai_conversations')
    .select(
      'id, user_id, title, context_type, context_job_id, context_application_id, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getConversation(
  id: string,
): Promise<AiConversation | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createConversation(
  input: CreateConversationInput = {},
): Promise<AiConversation> {
  const userId = await requireUserId();
  const supabase = requireSupabaseClient();
  const contextType = input.contextType ?? 'none';

  const row: AiConversationInsert = {
    user_id: userId,
    title: input.title?.trim() || 'New conversation',
    context_type: contextType,
    context_job_id:
      contextType === 'job' ? (input.contextJobId ?? null) : null,
    context_application_id:
      contextType === 'application'
        ? (input.contextApplicationId ?? null)
        : null,
  };

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;

  // Meaningful activity only on conversation start
  await supabase.from('activities').insert({
    user_id: userId,
    entity_type: 'ai_conversation',
    entity_id: data.id,
    activity_type: 'assistant_started',
    title: 'Assistant conversation started',
    description: data.title,
    metadata: {
      context_type: data.context_type,
      context_job_id: data.context_job_id,
      context_application_id: data.context_application_id,
    },
  });

  return data;
}

export async function updateConversation(
  id: string,
  patch: {
    title?: string;
    contextType?: AssistantContextType;
    contextJobId?: string | null;
    contextApplicationId?: string | null;
  },
): Promise<AiConversation> {
  await requireUserId();
  const supabase = requireSupabaseClient();
  const update: Record<string, unknown> = {};
  if (patch.title != null) update.title = patch.title.trim() || 'New conversation';
  if (patch.contextType != null) {
    update.context_type = patch.contextType;
    update.context_job_id =
      patch.contextType === 'job' ? (patch.contextJobId ?? null) : null;
    update.context_application_id =
      patch.contextType === 'application'
        ? (patch.contextApplicationId ?? null)
        : null;
  }
  const { data, error } = await supabase
    .from('ai_conversations')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  await requireUserId();
  const supabase = requireSupabaseClient();
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function listMessages(
  conversationId: string,
): Promise<AiMessage[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('ai_messages')
    .select('id, conversation_id, user_id, role, content, metadata, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export interface StreamChatHandlers {
  onUserMessage?: (message: AiMessage) => void;
  onToken?: (token: string) => void;
  onDone?: (message: AiMessage, meta?: Record<string, unknown>) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * Streams chat via Edge Function SSE. Does not use functions.invoke (buffers).
 */
export async function streamAssistantMessage(
  conversationId: string,
  message: string,
  handlers: StreamChatHandlers = {},
): Promise<void> {
  await requireUserId();
  const supabase = requireSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to continue.');
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error('Supabase is not configured.');
  }

  const response = await fetch(
    `${env.supabaseUrl}/functions/v1/chat-assistant`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: env.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId, message }),
      signal: handlers.signal,
    },
  );

  if (!response.ok) {
    let err = 'Assistant request failed.';
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') err = body.error;
    } catch {
      // ignore
    }
    throw new Error(sanitizeClientError(err));
  }

  if (!response.body) {
    throw new Error('Empty stream from assistant.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const line = chunk
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let event: {
        type?: string;
        content?: string;
        message?: AiMessage;
        meta?: Record<string, unknown>;
        error?: string;
      };
      try {
        event = JSON.parse(raw);
      } catch {
        continue;
      }

      if (event.type === 'user_message' && event.message) {
        handlers.onUserMessage?.(event.message);
      } else if (event.type === 'token' && typeof event.content === 'string') {
        handlers.onToken?.(event.content);
      } else if (event.type === 'done' && event.message) {
        handlers.onDone?.(event.message, event.meta);
      } else if (event.type === 'error') {
        handlers.onError?.(
          sanitizeClientError(event.error || 'Assistant stream failed.'),
        );
      }
    }
  }
}

function sanitizeClientError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('openai') ||
    lower.includes('api key') ||
    lower.includes('api_key')
  ) {
    return 'AI assistant is temporarily unavailable. Please try again later.';
  }
  return message;
}
