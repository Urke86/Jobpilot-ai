import {
  adminClient,
  corsHeaders,
  getValidGoogleAccessToken,
  jsonResponse,
  requireUserClient,
} from '../_shared/google-auth.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    const body = await req.json().catch(() => null);
    const action = typeof body?.action === 'string' ? body.action : '';
    const emailId = typeof body?.emailId === 'string' ? body.emailId : '';

    if (!action) {
      return jsonResponse({ error: 'action is required.' }, 400);
    }

    if (action !== 'create_calendar_event' && !emailId) {
      return jsonResponse({ error: 'emailId is required.' }, 400);
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
        return jsonResponse({ error: 'applicationId is required.' }, 400);
      }
      const { data: app } = await supabase
        .from('applications')
        .select('id, job_id, user_id')
        .eq('id', applicationId)
        .maybeSingle();
      if (!app || app.user_id !== userId) {
        return jsonResponse({ error: 'Application not found.' }, 404);
      }
      const email = await loadEmail();
      if (!email) return jsonResponse({ error: 'Email not found.' }, 404);

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
        return jsonResponse({ error: 'Failed to link application.' }, 500);
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

      return jsonResponse({ status: 'linked', email: updated });
    }

    if (action === 'accept_stage') {
      const email = await loadEmail();
      if (!email) return jsonResponse({ error: 'Email not found.' }, 404);
      const stage =
        typeof body.stage === 'string'
          ? body.stage
          : email.extracted_data?.suggested_application_stage;
      if (!stage || !STAGES.has(stage)) {
        return jsonResponse({ error: 'Valid stage is required.' }, 400);
      }
      if (!email.application_id) {
        return jsonResponse(
          { error: 'Link an application before changing stage.' },
          400,
        );
      }

      const { data: app, error: appErr } = await supabase
        .from('applications')
        .update({ stage })
        .eq('id', email.application_id)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (appErr || !app) {
        return jsonResponse({ error: 'Failed to update application stage.' }, 500);
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

      return jsonResponse({ status: 'stage_updated', application: app });
    }

    if (action === 'ignore_suggestion' || action === 'mark_processed') {
      const email = await loadEmail();
      if (!email) return jsonResponse({ error: 'Email not found.' }, 404);
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
        return jsonResponse({ error: 'Failed to update email.' }, 500);
      }
      return jsonResponse({ status: 'processed', email: updated });
    }

    if (action === 'create_calendar_event') {
      const email = emailId ? await loadEmail() : null;
      const preview = body.event && typeof body.event === 'object' ? body.event : null;
      if (!preview) {
        return jsonResponse({ error: 'event preview payload required.' }, 400);
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
          400,
        );
      }
      if (!timezone || timezone.toLowerCase() === 'ambiguous') {
        return jsonResponse(
          {
            error:
              'Timezone is ambiguous or missing. Confirm timezone before creating the event.',
            code: 'timezone_ambiguous',
          },
          400,
        );
      }
      if (!applicationId) {
        return jsonResponse(
          { error: 'application_id is required to create an interview event.' },
          400,
        );
      }

      const { data: app } = await supabase
        .from('applications')
        .select('id, user_id, job_id')
        .eq('id', applicationId)
        .maybeSingle();
      if (!app || app.user_id !== userId) {
        return jsonResponse({ error: 'Application not found.' }, 404);
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

      const descriptionParts = [
        'Created from JobPilot Hiring Inbox (user-confirmed).',
        meetingUrl ? `Meeting: ${meetingUrl}` : null,
        typeof preview.notes === 'string' ? preview.notes : null,
      ].filter(Boolean);

      const eventBody = {
        summary: title,
        description: descriptionParts.join('\n'),
        start: { dateTime: startsAt, timeZone: timezone },
        end: { dateTime: endsAt, timeZone: timezone },
        location: meetingUrl || undefined,
      };

      const calRes = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleAccess}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventBody),
        },
      );

      if (!calRes.ok) {
        console.error('calendar_create_failed', calRes.status);
        return jsonResponse({ error: 'Google Calendar API failed.' }, 502);
      }
      const created = await calRes.json();

      const { data: eventRow, error: eventErr } = await supabase
        .from('application_events')
        .insert({
          user_id: userId,
          application_id: applicationId,
          provider: 'google',
          external_event_id: created.id,
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
          },
        })
        .select('*')
        .single();

      if (eventErr) {
        console.error('application_event_insert', eventErr.message);
      }

      if (email) {
        await supabase
          .from('job_emails')
          .update({
            metadata: {
              ...(email.metadata ?? {}),
              calendar_event_id: created.id,
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
          external_event_id: created.id,
        },
      });

      return jsonResponse({
        status: 'created',
        event: eventRow,
        google_event_id: created.id,
        html_link: created.htmlLink ?? null,
      });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error(
      'hiring_email_action_unhandled',
      error instanceof Error ? error.message : error,
    );
    return jsonResponse({ error: 'Unexpected server error.' }, 500);
  }
});
