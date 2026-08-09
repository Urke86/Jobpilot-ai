import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import {
  adminClient,
  corsHeaders,
  getValidGoogleAccessToken,
  jsonResponse,
  requireUserClient,
} from '../_shared/google-auth.ts';
import {
  classifyEmailWithAi,
  estimateCostUsd,
  looksHiringRelated,
} from '../_shared/email-classify.ts';
import { recordAiGeneration } from '../_shared/ai-observability.ts';

const MAX_MESSAGES = 25;
const LOOKBACK_DAYS = 14;
const BODY_MAX_CHARS = 8000;
const SYNC_COOLDOWN_SECONDS = 120;

type GmailHeader = { name: string; value: string };

function headerValue(headers: GmailHeader[], name: string): string {
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

function parseFrom(raw: string): { name: string | null; email: string | null } {
  const m = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) {
    return {
      name: m[1].replace(/"/g, '').trim() || null,
      email: m[2].trim().toLowerCase(),
    };
  }
  if (raw.includes('@')) {
    return { name: null, email: raw.trim().toLowerCase() };
  }
  return { name: raw.trim() || null, email: null };
}

function decodeBodyData(data?: string): string {
  if (!data) return '';
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(normalized);
    // Prefer UTF-8
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function extractPlainText(payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  const mime = String(payload.mimeType ?? '');
  const body = payload.body as { data?: string } | undefined;
  if (mime === 'text/plain' && body?.data) {
    return decodeBodyData(body.data);
  }
  const parts = payload.parts as Record<string, unknown>[] | undefined;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      const text = extractPlainText(part);
      if (text.trim()) return text;
    }
  }
  if (mime === 'text/html' && body?.data) {
    return decodeBodyData(body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

async function matchApplication(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  opts: {
    companyName: string | null;
    jobTitle: string | null;
    senderEmail: string | null;
    threadId: string | null;
  },
): Promise<{
  match_status: 'matched' | 'suggested_match' | 'unmatched';
  application_id: string | null;
  job_id: string | null;
  company_id: string | null;
  reason: string | null;
}> {
  if (opts.threadId) {
    const { data: prior } = await supabase
      .from('job_emails')
      .select('application_id, job_id, company_id')
      .eq('user_id', userId)
      .eq('gmail_thread_id', opts.threadId)
      .not('application_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior?.application_id) {
      return {
        match_status: 'matched',
        application_id: prior.application_id,
        job_id: prior.job_id,
        company_id: prior.company_id,
        reason: 'Previously linked Gmail thread',
      };
    }
  }

  const { data: apps } = await supabase
    .from('applications')
    .select('id, job_id, stage, jobs(id, job_title, company_name_snapshot, company_id)')
    .eq('user_id', userId)
    .limit(100);

  type AppRow = {
    id: string;
    job_id: string;
    stage: string;
    jobs:
      | {
          id: string;
          job_title: string;
          company_name_snapshot: string;
          company_id: string | null;
        }
      | {
          id: string;
          job_title: string;
          company_name_snapshot: string;
          company_id: string | null;
        }[]
      | null;
  };

  const normalized = ((apps ?? []) as AppRow[]).map((a) => {
    const job = Array.isArray(a.jobs) ? a.jobs[0] : a.jobs;
    return {
      id: a.id,
      job_id: a.job_id,
      stage: a.stage,
      company_name: job?.company_name_snapshot ?? '',
      job_title: job?.job_title ?? '',
      company_id: job?.company_id ?? null,
    };
  });

  const company = (opts.companyName ?? '').trim().toLowerCase();
  const title = (opts.jobTitle ?? '').trim().toLowerCase();

  if (company && normalized.length) {
    const exact = normalized.filter(
      (a) =>
        a.company_name.toLowerCase() === company &&
        (!title ||
          a.job_title.toLowerCase().includes(title) ||
          title.includes(a.job_title.toLowerCase())),
    );
    if (exact.length === 1) {
      return {
        match_status: 'matched',
        application_id: exact[0].id,
        job_id: exact[0].job_id,
        company_id: exact[0].company_id,
        reason: 'Exact company (+ title) match',
      };
    }
    if (exact.length > 1) {
      return {
        match_status: 'suggested_match',
        application_id: exact[0].id,
        job_id: exact[0].job_id,
        company_id: exact[0].company_id,
        reason: 'Multiple applications for company; suggested first match',
      };
    }
    const soft = normalized.filter(
      (a) =>
        a.company_name.toLowerCase().includes(company) ||
        company.includes(a.company_name.toLowerCase()),
    );
    if (soft.length === 1) {
      return {
        match_status: 'suggested_match',
        application_id: soft[0].id,
        job_id: soft[0].job_id,
        company_id: soft[0].company_id,
        reason: 'Fuzzy company name match',
      };
    }
  }

  if (opts.senderEmail) {
    const domain = opts.senderEmail.split('@')[1] ?? '';
    if (
      domain &&
      !['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(domain)
    ) {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, website')
        .eq('user_id', userId)
        .limit(100);
      const hit = (companies ?? []).find((c) => {
        const site = (c.website ?? '').toLowerCase();
        return site.includes(domain);
      });
      if (hit) {
        const companyApps = normalized.filter(
          (a) => a.company_name.toLowerCase() === hit.name.toLowerCase(),
        );
        if (companyApps.length === 1) {
          return {
            match_status: 'suggested_match',
            application_id: companyApps[0].id,
            job_id: companyApps[0].job_id,
            company_id: hit.id,
            reason: `Sender domain ~ company website (${domain})`,
          };
        }
        return {
          match_status: 'suggested_match',
          application_id: null,
          job_id: null,
          company_id: hit.id,
          reason: `Sender domain matched company ${hit.name}`,
        };
      }
    }
  }

  return {
    match_status: 'unmatched',
    application_id: null,
    job_id: null,
    company_id: null,
    reason: null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const started = Date.now();
  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    let userId: string;
    let supabase;
    try {
      ({ userId, supabase } = await requireUserClient(req));
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
    const model = Deno.env.get('OPENAI_ANALYSIS_MODEL') ?? 'gpt-4o-mini';

    // Rate limit: last sync in metadata
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('id, metadata, updated_at')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();

    if (!integration) {
      return jsonResponse({ error: 'Connect Google before syncing Gmail.' }, 400);
    }

    const meta = (integration.metadata ?? {}) as Record<string, unknown>;
    const lastSync = typeof meta.last_sync_at === 'string'
      ? new Date(meta.last_sync_at).getTime()
      : 0;
    if (lastSync && Date.now() - lastSync < SYNC_COOLDOWN_SECONDS * 1000) {
      return jsonResponse(
        {
          error: `Please wait ${SYNC_COOLDOWN_SECONDS}s between Gmail syncs.`,
        },
        429,
      );
    }

    const admin = adminClient();
    let googleAccess: string;
    try {
      ({ accessToken: googleAccess } = await getValidGoogleAccessToken(
        admin,
        userId,
      ));
    } catch (err) {
      return jsonResponse(
        {
          error:
            err instanceof Error
              ? err.message
              : 'Google session invalid. Reconnect Google.',
        },
        401,
      );
    }

    const after = Math.floor(
      (Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000,
    );
    const q =
      `after:${after} (interview OR recruiter OR hiring OR questionnaire OR assessment OR application OR candidate OR offer OR position OR role)`;

    const listUrl =
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${MAX_MESSAGES}&q=${encodeURIComponent(q)}`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${googleAccess}` },
    });
    if (!listRes.ok) {
      console.error('gmail_list_failed', listRes.status);
      if (listRes.status === 401 || listRes.status === 403) {
        return jsonResponse(
          { error: 'Gmail access denied. Reconnect Google with Gmail permission.' },
          403,
        );
      }
      return jsonResponse({ error: 'Gmail API failed.' }, 502);
    }
    const listJson = await listRes.json();
    const messageRefs = (listJson.messages ?? []) as { id: string; threadId: string }[];

    const { data: apps } = await supabase
      .from('applications')
      .select('id, stage, jobs(job_title, company_name_snapshot)')
      .eq('user_id', userId)
      .limit(40);
    const contextSummary =
      (apps ?? [])
        .map((a) => {
          const job = Array.isArray(a.jobs) ? a.jobs[0] : a.jobs;
          return `- ${job?.company_name_snapshot ?? 'Unknown'} / ${job?.job_title ?? 'Unknown'} [${a.stage}]`;
        })
        .join('\n') || 'No applications yet.';

    let imported = 0;
    let classified = 0;
    let skippedExisting = 0;
    let skippedUnrelatedPre = 0;
    let classifyFailed = 0;

    for (const ref of messageRefs) {
      const { data: existing } = await supabase
        .from('job_emails')
        .select('id, classification')
        .eq('user_id', userId)
        .eq('gmail_message_id', ref.id)
        .maybeSingle();
      if (existing && existing.classification !== 'pending') {
        skippedExisting++;
        continue;
      }
      const pendingId = existing?.classification === 'pending' ? existing.id : null;

      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
        { headers: { Authorization: `Bearer ${googleAccess}` } },
      );
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();
      const headers = (msg.payload?.headers ?? []) as GmailHeader[];
      const subject = headerValue(headers, 'Subject');
      const fromRaw = headerValue(headers, 'From');
      const toRaw = headerValue(headers, 'To');
      const dateRaw = headerValue(headers, 'Date');
      const from = parseFrom(fromRaw);
      const snippet = String(msg.snippet ?? '');
      const bodyText = extractPlainText(msg.payload ?? null).slice(0, BODY_MAX_CHARS);

      if (!looksHiringRelated(subject, snippet, fromRaw)) {
        skippedUnrelatedPre++;
        if (pendingId) {
          await supabase.from('job_emails').delete().eq('id', pendingId);
        }
        continue;
      }

      let classification:
        | 'pending'
        | 'unrelated'
        | 'recruiter_outreach'
        | 'application_confirmation'
        | 'questionnaire'
        | 'assessment'
        | 'interview_invitation'
        | 'interview_followup'
        | 'rejection'
        | 'offer'
        | 'general_hiring_message' = 'pending';
      let confidence: number | null = null;
      let extracted: Record<string, unknown> = {};
      let needsAction = false;
      let aiMeta: Record<string, unknown> = {};

      if (openaiKey) {
        try {
          const { result, usage, duration_ms } = await classifyEmailWithAi({
            openaiKey,
            model,
            subject,
            snippet,
            bodyExcerpt: bodyText || snippet,
            sender: fromRaw,
            contextSummary,
          });
          classification = result.classification;
          confidence = result.confidence;
          needsAction =
            result.requires_user_action && result.classification !== 'unrelated';
          extracted = {
            company_name: result.company_name,
            job_title: result.job_title,
            application_match_reason: result.application_match_reason,
            suggested_application_stage: result.suggested_application_stage,
            suggested_action: result.suggested_action,
            requires_user_action: result.requires_user_action,
            interview: result.interview,
          };
          aiMeta = {
            model,
            duration_ms,
            usage,
            estimated_cost_usd: estimateCostUsd(
              model,
              usage.prompt_tokens,
              usage.completion_tokens,
            ),
          };
          classified++;
          await recordAiGeneration(supabase, {
            userId,
            feature: 'gmail_classification',
            model,
            promptVersion: 'gmail-sync-v1',
            status: 'success',
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            estimatedCostUsd: aiMeta.estimated_cost_usd as number,
            latencyMs: duration_ms,
            metadata: {
              gmail_message_id: ref.id,
              classification,
            },
          });
        } catch (err) {
          classifyFailed++;
          console.error(
            'classify_item_failed',
            err instanceof Error ? err.message : 'unknown',
          );
          await recordAiGeneration(supabase, {
            userId,
            feature: 'gmail_classification',
            model,
            promptVersion: 'gmail-sync-v1',
            status: 'provider_error',
            errorCode: 'classify_failed',
            errorMessage:
              err instanceof Error ? err.message : 'classify_failed',
            metadata: { gmail_message_id: ref.id },
          });
          // Deterministic fallback so sync still yields actionable hiring rows.
          const blob = `${subject}\n${snippet}\n${bodyText}`.toLowerCase();
          if (/\bquestionnaire\b|\bapplication form\b|\bplease complete\b/.test(blob)) {
            classification = 'questionnaire';
            extracted = {
              suggested_application_stage: 'questionnaire',
              suggested_action: 'Review questionnaire and open Artifact Toolkit',
              requires_user_action: true,
              interview: { detected: false, date: null, start_time: null, end_time: null, timezone: null, meeting_url: null },
            };
            needsAction = true;
            confidence = 40;
          } else if (/\binterview\b|\bcalendar\b|\bzoom\b|\bmeet\.google\b/.test(blob)) {
            classification = 'interview_invitation';
            extracted = {
              suggested_application_stage: 'interview',
              suggested_action: 'Review interview details and confirm Calendar event',
              requires_user_action: true,
              interview: {
                detected: true,
                date: null,
                start_time: null,
                end_time: null,
                timezone: null,
                meeting_url: null,
                timezone_ambiguous: true,
              },
            };
            needsAction = true;
            confidence = 40;
          } else if (/\breject|unfortunately|not moving forward\b/.test(blob)) {
            classification = 'rejection';
            extracted = {
              suggested_application_stage: 'rejected',
              suggested_action: 'Confirm stage change to rejected',
              requires_user_action: true,
              interview: { detected: false, date: null, start_time: null, end_time: null, timezone: null, meeting_url: null },
            };
            needsAction = true;
            confidence = 40;
          } else if (/\boffer\b/.test(blob)) {
            classification = 'offer';
            extracted = {
              suggested_application_stage: 'offer',
              suggested_action: 'Confirm stage change to offer',
              requires_user_action: true,
              interview: { detected: false, date: null, start_time: null, end_time: null, timezone: null, meeting_url: null },
            };
            needsAction = true;
            confidence = 40;
          } else {
            classification = 'general_hiring_message';
            extracted = {
              suggested_application_stage: null,
              suggested_action: 'Review and link to an application if relevant',
              requires_user_action: true,
              interview: { detected: false, date: null, start_time: null, end_time: null, timezone: null, meeting_url: null },
            };
            needsAction = true;
            confidence = 30;
          }
          aiMeta = { fallback: true, reason: 'classify_failed' };
        }
      }

      if (classification === 'unrelated') {
        // Store lightly? Spec: prefer not flooding. Skip persist for unrelated.
        skippedUnrelatedPre++;
        if (pendingId) {
          await supabase.from('job_emails').delete().eq('id', pendingId);
        }
        continue;
      }

      const match = await matchApplication(supabase, userId, {
        companyName:
          typeof extracted.company_name === 'string'
            ? extracted.company_name
            : null,
        jobTitle:
          typeof extracted.job_title === 'string' ? extracted.job_title : null,
        senderEmail: from.email,
        threadId: msg.threadId ?? ref.threadId,
      });

      const receivedAt = dateRaw
        ? new Date(dateRaw).toISOString()
        : msg.internalDate
          ? new Date(Number(msg.internalDate)).toISOString()
          : new Date().toISOString();

      const row = {
        user_id: userId,
        gmail_message_id: ref.id,
        gmail_thread_id: msg.threadId ?? ref.threadId,
        sender_name: from.name,
        sender_email: from.email,
        recipients: toRaw ? [{ raw: toRaw }] : [],
        subject,
        received_at: receivedAt,
        snippet: snippet.slice(0, 500),
        body_text: bodyText || snippet,
        classification,
        confidence_score: confidence,
        match_status: match.match_status,
        company_id: match.company_id,
        job_id: match.job_id,
        application_id: match.application_id,
        extracted_data: {
          ...extracted,
          match_reason: match.reason,
        },
        metadata: {
          ai: aiMeta,
          sync_version: 'gmail-sync-v1',
        },
        needs_action: needsAction,
      };

      if (pendingId) {
        const { error: updateError } = await supabase
          .from('job_emails')
          .update(row)
          .eq('id', pendingId);
        if (!updateError) imported++;
        else console.error('job_email_update', updateError.message);
      } else {
        const { error: insertError } = await supabase.from('job_emails').insert(row);
        if (!insertError) imported++;
        else console.error('job_email_insert', insertError.message);
      }
    }

    await admin
      .from('user_integrations')
      .update({
        metadata: {
          ...meta,
          last_sync_at: new Date().toISOString(),
          last_sync_summary: {
            imported,
            classified,
            skipped_existing: skippedExisting,
            skipped_prefilter: skippedUnrelatedPre,
            classify_failed: classifyFailed,
            fetched: messageRefs.length,
          },
        },
      })
      .eq('id', integration.id);

    await supabase.from('activities').insert({
      user_id: userId,
      entity_type: 'user_integration',
      entity_id: integration.id,
      activity_type: 'gmail_synced',
      title: 'Gmail synced',
      description: `Imported ${imported} hiring-related message(s).`,
      metadata: {
        imported,
        classified,
        skipped_existing: skippedExisting,
        duration_ms: Date.now() - started,
      },
    });

    return jsonResponse({
      status: 'ok',
      imported,
      classified,
      skipped_existing: skippedExisting,
      skipped_prefilter: skippedUnrelatedPre,
      classify_failed: classifyFailed,
      fetched: messageRefs.length,
      lookback_days: LOOKBACK_DAYS,
      max_messages: MAX_MESSAGES,
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    console.error('gmail_sync_unhandled', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unexpected server error.' }, 500);
  }
});
