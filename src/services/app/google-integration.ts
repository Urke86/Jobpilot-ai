import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';
import type { Enums, Json } from '@/types/database';

export type GoogleIntegrationStatus = {
  connected: boolean;
  provider_account_email: string | null;
  scopes: string[];
  expires_at: string | null;
  gmail_readonly: boolean;
  calendar_events: boolean;
  last_sync_at: string | null;
  last_sync_summary: Record<string, unknown> | null;
  connected_at: string | null;
};

export type JobEmailRecord = {
  id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  sender_name: string | null;
  sender_email: string | null;
  recipients: Json;
  subject: string | null;
  received_at: string | null;
  snippet: string | null;
  body_text: string | null;
  classification: Enums<'email_classification'>;
  confidence_score: number | null;
  match_status: Enums<'email_match_status'>;
  company_id: string | null;
  job_id: string | null;
  application_id: string | null;
  extracted_data: Json;
  metadata: Json;
  needs_action: boolean;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

async function getAccessToken(): Promise<string> {
  await requireUserId();
  const supabase = requireSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('You must be signed in to continue.');
  }
  return session.access_token;
}

function functionUrl(name: string): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  return `${url}/functions/v1/${name}`;
}

async function invokeJson<T>(
  name: string,
  body?: unknown,
  method: 'POST' | 'GET' = 'POST',
): Promise<T> {
  const token = await getAccessToken();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const res = await fetch(functionUrl(name), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
      'Content-Type': 'application/json',
    },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json;
}

/** Safe integration status — never selects token cipher columns. */
export async function getGoogleIntegrationStatus(): Promise<GoogleIntegrationStatus> {
  const supabase = requireSupabaseClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('user_integrations_public')
    .select(
      'provider_account_email, scopes, expires_at, metadata, created_at',
    )
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      connected: false,
      provider_account_email: null,
      scopes: [],
      expires_at: null,
      gmail_readonly: false,
      calendar_events: false,
      last_sync_at: null,
      last_sync_summary: null,
      connected_at: null,
    };
  }
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  const scopes = (data.scopes ?? []) as string[];
  return {
    connected: true,
    provider_account_email: data.provider_account_email,
    scopes,
    expires_at: data.expires_at,
    gmail_readonly: scopes.some((s) => s.includes('gmail.readonly')),
    calendar_events: scopes.some((s) => s.includes('calendar.events')),
    last_sync_at:
      typeof meta.last_sync_at === 'string' ? meta.last_sync_at : null,
    last_sync_summary:
      meta.last_sync_summary && typeof meta.last_sync_summary === 'object'
        ? (meta.last_sync_summary as Record<string, unknown>)
        : null,
    connected_at:
      typeof meta.connected_at === 'string'
        ? meta.connected_at
        : data.created_at,
  };
}

export async function startGoogleOAuth(): Promise<{ url: string }> {
  return invokeJson<{ url: string }>('google-oauth-start', {});
}

export async function disconnectGoogle(): Promise<void> {
  await invokeJson('google-disconnect', {});
}

export async function syncGmail(): Promise<{
  imported: number;
  classified: number;
  skipped_existing: number;
  fetched: number;
  duration_ms: number;
}> {
  return invokeJson('gmail-sync', {});
}

export async function listJobEmails(limit = 50): Promise<JobEmailRecord[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('job_emails')
    .select(
      'id, user_id, application_id, company_id, job_id, gmail_message_id, gmail_thread_id, subject, snippet, sender_email, sender_name, received_at, classification, confidence_score, match_status, needs_action, processed_at, extracted_data, metadata, recipients, created_at, updated_at',
    )
    .order('received_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as JobEmailRecord[];
}

export async function getJobEmailById(
  id: string,
): Promise<JobEmailRecord | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('job_emails')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as JobEmailRecord | null;
}

export async function linkEmailToApplication(
  emailId: string,
  applicationId: string,
): Promise<JobEmailRecord> {
  const json = await invokeJson<{ email: JobEmailRecord }>(
    'hiring-email-action',
    { action: 'link_application', emailId, applicationId },
  );
  return json.email;
}

export async function acceptStageFromEmail(
  emailId: string,
  stage?: string,
): Promise<void> {
  await invokeJson('hiring-email-action', {
    action: 'accept_stage',
    emailId,
    stage,
  });
}

export async function markEmailProcessed(
  emailId: string,
  ignore = false,
): Promise<void> {
  await invokeJson('hiring-email-action', {
    action: ignore ? 'ignore_suggestion' : 'mark_processed',
    emailId,
  });
}

export type CalendarEventPreview = {
  title: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  meeting_url?: string | null;
  notes?: string | null;
  application_id?: string | null;
};

export async function createInterviewCalendarEvent(
  emailId: string | null,
  event: CalendarEventPreview,
): Promise<{
  status: string;
  google_event_id?: string;
  html_link?: string | null;
  error?: string;
  code?: string;
}> {
  return invokeJson('hiring-email-action', {
    action: 'create_calendar_event',
    emailId,
    event,
  });
}

export function getExtractedData(
  email: JobEmailRecord,
): Record<string, unknown> {
  const d = email.extracted_data;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
  return d as Record<string, unknown>;
}
