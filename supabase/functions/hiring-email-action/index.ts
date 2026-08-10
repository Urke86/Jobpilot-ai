import {
  adminClient,
  corsHeadersFor,
  getValidGoogleAccessToken,
  jsonResponse,
  requireUserClient,
} from '../_shared/google-auth.ts';
import { fetchWithTimeout, GOOGLE_TIMEOUT_MS } from '../_shared/fetch-timeout.ts';
import { tryAcquireRateLimit } from '../_shared/rate-limit.ts';

const STAGES = new Set([
  'preparing',
  'applied',
  'questionnaire',
  'interview',
  'assignment',
  'offer',
  'rejected',
  'withdrawn',
]);

/** Google Calendar custom IDs must be base32hex: [0-9a-v], length 5–1024. */
function toBase32Hex(bytes: Uint8Array): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuv';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += alphabet[(value << (5 - bits)) & 31];
  }
  return out;
}

async function deriveCalendarIds(input: {
  userId: string;
  applicationId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  clientKey?: string | null;
}): Promise<{ idempotencyKey: string; googleEventId: string }> {
  const material = input.clientKey?.trim()
    ? `client\0${input.userId}\0${input.clientKey.trim()}`
    : [
        'jp-cal-v1',
        input.userId,
        input.applicationId,
        input.startsAt,
        input.endsAt,
        input.title.trim().toLowerCase(),
      ].join('\0');
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(material),
    ),
  );
  const idempotencyKey = [...digest]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // 32 chars keeps us well within Google's limits and inside [0-9a-v].
  const googleEventId = toBase32Hex(digest).slice(0, 32);
  return { idempotencyKey, googleEventId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, req);
    }

    let userId: string;
    let supabase;
    try {
      ({ userId, supabase } = await requireUserClient(req));
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }

    const body = await req.json().catch(() => null);
    const action = typeof body?.action === 'string' ? body.action : '';
    const emailId = typeof body?.emailId === 'string' ? body.emailId : '';

    if (!action) {
      return jsonResponse({ error: 'action is required.' }, 400, req);
    }

    if (action !== 'create_calendar_event' && !emailId) {
      return jsonResponse({ error: 'emailId is required.' }, 400, req);
    }

    const loadEmail = async () => {
      const { data, error } = await supabase
        .from('job_emails')
        .select('*')
        .eq('id', emailId)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.user_id !== userId) {
        return null;
      }
      return data;
    };

    if (action === 'link_application') {
      const applicationId =
        typeof body.applicationId === 'string' ? body.applicationId : '';
      if (!applicationId) {
        return jsonResponse({ error: 'applicationId is required.' }, 400, req);
      }
      const { data: app } = await supabase
        .from('applications')
        .select('id, job_id, user_id')
        .eq('id', applicationId)
        .maybeSingle();
      if (!app || app.user_id !== userId) {
        return jsonResponse({ error: 'Application not found.' }, 404, req);
      }
      const email = await loadEmail();
      if (!email) return jsonResponse({ error: 'Email not found.' }, 404, req);

      const { data: job } = await supabase
        .from('jobs')
        .select('id, company_id')
        .eq('id', app.job_id)
        .maybeSingle();

      const { data: updated, error } = await supabase
        .from('job_emails')
        .update({
          application_id: app.id,
          job_id: app.job_id,
          company_id: job?.company_id ?? email.company_id,
          match_status: 'matched',
          extracted_data: {
            ...(email.extracted_data ?? {}),
            match_reason: 'Manually linked by user',
          },
        })
        .eq('id', email.id)
        .select('*')
        .single();
      if (error) {
        return jsonResponse({ error: 'Failed to link application.' }, 500, req);
      }

      // Propagate thread link
      if (email.gmail_thread_id) {
        await supabase
          .from('job_emails')
          .update({
            application_id: app.id,
            job_id: app.job_id,
            company_id: job?.company_id ?? null,
            match_status: 'matched',
          })
          .eq('user_id', userId)
          .eq('gmail_thread_id', email.gmail_thread_id)
          .is('application_id', null);
      }

      await supabase.from('activities').insert({
        user_id: userId,
        entity_type: 'job_email',
        entity_id: email.id,
        activity_type: 'hiring_email_linked',
        title: 'Hiring email linked',
        description: 'Linked a hiring email to an application.',
        metadata: { application_id: app.id, email_id: email.id },
      });

      return jsonResponse({ status: 'linked', email: updated }, 200, req);
    }

    if (action === 'accept_stage') {
      const email = await loadEmail();
      if (!email) return jsonResponse({ error: 'Email not found.' }, 404, req);
      const stage =
        typeof body.stage === 'string'
          ? body.stage
          : email.extracted_data?.suggested_application_stage;
      if (!stage || !STAGES.has(stage)) {
        return jsonResponse({ error: 'Valid stage is required.' }, 400, req);
      }
      if (!email.application_id) {
        return jsonResponse(
          { error: 'Link an application before changing stage.' },
          400, req);
      }

      const { data: app, error: appErr } = await supabase
        .from('applications')
        .update({ stage })
        .eq('id', email.application_id)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (appErr || !app) {
        return jsonResponse({ error: 'Failed to update application stage.' }, 500, req);
      }

      await supabase
        .from('job_emails')
        .update({
          needs_action: false,
          processed_at: new Date().toISOString(),
          metadata: {
            ...(email.metadata ?? {}),
            stage_accepted: stage,
            stage_accepted_at: new Date().toISOString(),
          },
        })
        .eq('id', email.id);

      await supabase.from('activities').insert({
        user_id: userId,
        entity_type: 'application',
        entity_id: app.id,
        activity_type: 'stage_accepted_from_email',
        title: 'Stage updated from email',
        description: `Application stage set to ${stage} after email review.`,
        metadata: { email_id: email.id, stage },
      });

      return jsonResponse({ status: 'stage_updated', application: app }, 200, req);
    }

    if (action === 'ignore_suggestion' || action === 'mark_processed') {
      const email = await loadEmail();
      if (!email) return jsonResponse({ error: 'Email not found.' }, 404, req);
      const { data: updated, error } = await supabase
        .from('job_emails')
        .update({
          needs_action: false,
          processed_at: new Date().toISOString(),
          metadata: {
            ...(email.metadata ?? {}),
            ignored: action === 'ignore_suggestion',
          },
        })
        .eq('id', email.id)
        .select('*')
        .single();
      if (error) {
        return jsonResponse({ error: 'Failed to update email.' }, 500, req);
      }
      return jsonResponse({ status: 'processed', email: updated }, 200, req);
    }

    if (action === 'create_calendar_event') {
      const email = emailId ? await loadEmail() : null;
      const preview = body.event && typeof body.event === 'object' ? body.event : null;
      if (!preview) {
        return jsonResponse({ error: 'event preview payload required.' }, 400, req);
      }

      const title = String(preview.title ?? '').trim();
      const startsAt = String(preview.starts_at ?? '').trim();
      const endsAt = String(preview.ends_at ?? '').trim();
      const timezone = String(preview.timezone ?? '').trim();
      const meetingUrl =
        typeof preview.meeting_url === 'string' ? preview.meeting_url : null;
      const applicationId =
        typeof preview.application_id === 'string'
          ? preview.application_id
          : email?.application_id;

      if (!title || !startsAt || !endsAt) {
        return jsonResponse(
          { error: 'title, starts_at, and ends_at are required.' },
          400, req);
      }
      if (!timezone || timezone.toLowerCase() === 'ambiguous') {
        return jsonResponse(
          {
            error:
              'Timezone is ambiguous or missing. Confirm timezone before creating the event.',
            code: 'timezone_ambiguous',
          },
          400, req);
      }
      if (!applicationId) {
        return jsonResponse(
          { error: 'application_id is required to create an interview event.' },
          400, req);
      }

      const { data: app } = await supabase
        .from('applications')
        .select('id, user_id, job_id')
        .eq('id', applicationId)
        .maybeSingle();
      if (!app || app.user_id !== userId) {
        return jsonResponse({ error: 'Application not found.' }, 404, req);
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
          401, req);
      }

      const clientKey =
        typeof preview.idempotency_key === 'string'
          ? preview.idempotency_key.trim().slice(0, 128)
          : typeof body?.idempotency_key === 'string'
            ? body.idempotency_key.trim().slice(0, 128)
            : null;

      const { idempotencyKey, googleEventId } = await deriveCalendarIds({
        userId,
        applicationId,
        startsAt,
        endsAt,
        title,
        clientKey,
      });

      const { data: existingEvent } = await supabase
        .from('application_events')
        .select('*')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingEvent) {
        return jsonResponse(
          {
            status: 'already_created',
            event: existingEvent,
            google_event_id: existingEvent.external_event_id,
            html_link:
              typeof existingEvent.metadata === 'object' &&
              existingEvent.metadata &&
              !Array.isArray(existingEvent.metadata) &&
              typeof (existingEvent.metadata as Record<string, unknown>)
                .html_link === 'string'
                ? ((existingEvent.metadata as Record<string, unknown>)
                    .html_link as string)
                : null,
            idempotency_key: idempotencyKey,
          },
          200,
          req,
        );
      }

      // Soft lease reduces stampedes; durable uniqueness is idempotency_key + Google id.
      const calLease = await tryAcquireRateLimit(
        supabase,
        `calendar-create:${idempotencyKey}`,
        30,
      );
      if (!calLease) {
        const { data: raced } = await supabase
          .from('application_events')
          .select('*')
          .eq('user_id', userId)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (raced) {
          return jsonResponse(
            {
              status: 'already_created',
              event: raced,
              google_event_id: raced.external_event_id,
              html_link:
                typeof raced.metadata === 'object' &&
                raced.metadata &&
                !Array.isArray(raced.metadata) &&
                typeof (raced.metadata as Record<string, unknown>).html_link ===
                  'string'
                  ? ((raced.metadata as Record<string, unknown>)
                      .html_link as string)
                  : null,
              idempotency_key: idempotencyKey,
            },
            200,
            req,
          );
        }
        return jsonResponse(
          {
            error:
              'A calendar create for this interview is already in progress. Retry shortly.',
            code: 'duplicate_calendar_request',
            idempotency_key: idempotencyKey,
          },
          409,
          req,
        );
      }

      const descriptionParts = [
        'Created from JobPilot Hiring Inbox (user-confirmed).',
        meetingUrl ? `Meeting: ${meetingUrl}` : null,
        typeof preview.notes === 'string' ? preview.notes : null,
      ].filter(Boolean);

      const eventBody = {
        id: googleEventId,
        summary: title,
        description: descriptionParts.join('\n'),
        start: { dateTime: startsAt, timeZone: timezone },
        end: { dateTime: endsAt, timeZone: timezone },
        location: meetingUrl || undefined,
      };

      const calRes = await fetchWithTimeout(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleAccess}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventBody),
        },
        GOOGLE_TIMEOUT_MS,
      );

      let created: { id?: string; htmlLink?: string };
      if (calRes.ok) {
        created = await calRes.json();
      } else if (calRes.status === 409) {
        // Deterministic Google id already exists — safe retry path.
        const getRes = await fetchWithTimeout(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${googleAccess}` },
          },
          GOOGLE_TIMEOUT_MS,
        );
        if (!getRes.ok) {
          console.error('calendar_get_after_conflict_failed', getRes.status);
          return jsonResponse(
            { error: 'Google Calendar API failed.' },
            502,
            req,
          );
        }
        created = await getRes.json();
      } else {
        console.error('calendar_create_failed', calRes.status);
        return jsonResponse({ error: 'Google Calendar API failed.' }, 502, req);
      }

      const externalId =
        typeof created.id === 'string' && created.id
          ? created.id
          : googleEventId;

      const { data: eventRow, error: eventErr } = await supabase
        .from('application_events')
        .insert({
          user_id: userId,
          application_id: applicationId,
          provider: 'google',
          external_event_id: externalId,
          idempotency_key: idempotencyKey,
          event_type: 'interview',
          title,
          starts_at: startsAt,
          ends_at: endsAt,
          timezone,
          meeting_url: meetingUrl,
          metadata: {
            html_link: created.htmlLink ?? null,
            email_id: email?.id ?? null,
            source: 'hiring-email-action',
            idempotency_key: idempotencyKey,
          },
        })
        .select('*')
        .single();

      if (eventErr) {
        // Concurrent insert or retry after provider success — return winner row.
        if (
          eventErr.code === '23505' ||
          /duplicate|unique/i.test(eventErr.message)
        ) {
          const { data: raced } = await supabase
            .from('application_events')
            .select('*')
            .eq('user_id', userId)
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();
          if (raced) {
            return jsonResponse(
              {
                status: 'already_created',
                event: raced,
                google_event_id: raced.external_event_id,
                html_link:
                  typeof raced.metadata === 'object' &&
                  raced.metadata &&
                  !Array.isArray(raced.metadata) &&
                  typeof (raced.metadata as Record<string, unknown>)
                    .html_link === 'string'
                    ? ((raced.metadata as Record<string, unknown>)
                        .html_link as string)
                    : (created.htmlLink ?? null),
                idempotency_key: idempotencyKey,
              },
              200,
              req,
            );
          }
        }
        console.error('application_event_insert', eventErr.message);
        return jsonResponse(
          {
            error:
              'Google Calendar event exists but failed to save locally. Retry safely — the same logical event will not be duplicated.',
            code: 'calendar_persist_failed',
            google_event_id: externalId,
            html_link: created.htmlLink ?? null,
            idempotency_key: idempotencyKey,
          },
          500,
          req,
        );
      }

      if (email) {
        await supabase
          .from('job_emails')
          .update({
            metadata: {
              ...(email.metadata ?? {}),
              calendar_event_id: externalId,
              calendar_created_at: new Date().toISOString(),
            },
          })
          .eq('id', email.id);
      }

      await supabase.from('activities').insert({
        user_id: userId,
        entity_type: 'application_event',
        entity_id: eventRow?.id ?? null,
        activity_type: 'interview_event_created',
        title: 'Interview calendar event created',
        description: title,
        metadata: {
          application_id: applicationId,
          external_event_id: externalId,
          idempotency_key: idempotencyKey,
        },
      });

      return jsonResponse(
        {
          status: 'created',
          event: eventRow,
          google_event_id: externalId,
          html_link: created.htmlLink ?? null,
          idempotency_key: idempotencyKey,
        },
        200,
        req,
      );
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400, req);
  } catch (error) {
    console.error(
      'hiring_email_action_unhandled',
      error instanceof Error ? error.message : error,
    );
    return jsonResponse({ error: 'Unexpected server error.' }, 500, req);
  }
});
