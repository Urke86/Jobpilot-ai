import type {
  ApplicationInsert,
  ApplicationRecord,
  ApplicationUpdate,
} from '@/services/contracts';
import { logActivity } from '@/services/app/activities';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';
import type { Enums } from '@/types/database';

export type CreateApplicationInput = {
  jobId: string;
  stage?: Enums<'application_stage'>;
  applicationDate?: string;
  cvVersion?: string | null;
  portfolioSent?: boolean;
  salaryExpectation?: number | null;
  salaryCurrency?: string;
  coverLetter?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
};

export async function listApplications(): Promise<ApplicationRecord[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getApplicationById(
  id: string,
): Promise<ApplicationRecord | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getApplicationByJobId(
  jobId: string,
): Promise<ApplicationRecord | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<ApplicationRecord> {
  const userId = await requireUserId();
  const supabase = requireSupabaseClient();
  const row: ApplicationInsert = {
    user_id: userId,
    job_id: input.jobId,
    stage: input.stage ?? 'preparing',
    application_date:
      input.applicationDate ?? new Date().toISOString().slice(0, 10),
    cv_version: input.cvVersion ?? null,
    portfolio_sent: input.portfolioSent ?? false,
    salary_expectation: input.salaryExpectation ?? null,
    salary_currency: input.salaryCurrency ?? 'EUR',
    cover_letter: input.coverLetter ?? null,
    contact_person: input.contactPerson ?? null,
    contact_email: input.contactEmail ?? null,
    follow_up_date: input.followUpDate ?? null,
    notes: input.notes ?? null,
    questionnaire_answers: {},
  };

  const { data, error } = await supabase
    .from('applications')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;

  await supabase.from('jobs').update({ status: 'applied' }).eq('id', input.jobId);

  await logActivity({
    activityType: 'application_created',
    entityType: 'application',
    entityId: data.id,
    title: 'Application created',
    description: 'A new application was started.',
    metadata: { job_id: input.jobId, stage: data.stage },
  });

  return data;
}

export async function updateApplication(
  id: string,
  input: Omit<ApplicationUpdate, 'user_id' | 'id' | 'job_id'>,
): Promise<ApplicationRecord> {
  const supabase = requireSupabaseClient();
  const previous = await getApplicationById(id);
  const { data, error } = await supabase
    .from('applications')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  if (input.stage && previous && previous.stage !== input.stage) {
    await logActivity({
      activityType: 'application_stage_changed',
      entityType: 'application',
      entityId: data.id,
      title: 'Application stage updated',
      description: `Moved from ${previous.stage} to ${input.stage}.`,
    });
  }

  if (
    input.follow_up_date &&
    previous &&
    previous.follow_up_date !== input.follow_up_date
  ) {
    await logActivity({
      activityType: 'custom',
      entityType: 'application',
      entityId: data.id,
      title: 'Follow-up date updated',
      description: `Follow-up set to ${input.follow_up_date}.`,
    });
  }

  return data;
}

export async function setApplicationStage(
  id: string,
  stage: Enums<'application_stage'>,
): Promise<ApplicationRecord> {
  return updateApplication(id, { stage });
}

export async function deleteApplication(id: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) throw error;
}
