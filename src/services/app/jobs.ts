import type {
  JobInsert,
  JobRecord,
  JobUpdate,
} from '@/services/contracts';
import { logActivity } from '@/services/app/activities';
import { createCompany, findCompanyByName } from '@/services/app/companies';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';
import type { Enums } from '@/types/database';

/** List/table projection — excludes large `job_description` / metadata blobs. */
const JOB_LIST_COLUMNS =
  'id, user_id, company_id, company_name_snapshot, job_title, job_url, source, location, remote_scope, salary_min, salary_max, salary_currency, employment_type, date_discovered, deadline, status, created_at, updated_at';

/** Soft cap for list pages (closed-beta scale). Detail fetches remain unbounded. */
const JOB_LIST_LIMIT = 500;

export type CreateJobInput = {
  jobTitle: string;
  companyId?: string | null;
  companyName: string;
  jobUrl?: string | null;
  source?: string | null;
  location?: string | null;
  remoteScope?: Enums<'remote_scope'>;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  employmentType?: Enums<'employment_type'>;
  jobDescription?: string | null;
  deadline?: string | null;
};

async function resolveCompanyId(
  companyId: string | null | undefined,
  companyName: string,
): Promise<{ id: string | null; name: string }> {
  const trimmed = companyName.trim();
  if (companyId) {
    return { id: companyId, name: trimmed };
  }
  if (!trimmed) {
    throw new Error('Company name is required.');
  }
  const existing = await findCompanyByName(trimmed);
  if (existing) {
    return { id: existing.id, name: existing.name };
  }
  const created = await createCompany({ name: trimmed });
  return { id: created.id, name: created.name };
}

export async function listJobs(): Promise<JobRecord[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_LIST_COLUMNS)
    .order('date_discovered', { ascending: false })
    .limit(JOB_LIST_LIMIT);
  if (error) throw error;
  return (data ?? []) as JobRecord[];
}

export async function getJobById(id: string): Promise<JobRecord | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listJobsByCompany(
  companyId: string,
): Promise<JobRecord[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_LIST_COLUMNS)
    .eq('company_id', companyId)
    .order('date_discovered', { ascending: false })
    .limit(JOB_LIST_LIMIT);
  if (error) throw error;
  return (data ?? []) as JobRecord[];
}

export async function createJob(input: CreateJobInput): Promise<JobRecord> {
  const userId = await requireUserId();
  const company = await resolveCompanyId(input.companyId, input.companyName);
  const supabase = requireSupabaseClient();

  const row: JobInsert = {
    user_id: userId,
    company_id: company.id,
    company_name_snapshot: company.name,
    job_title: input.jobTitle.trim(),
    job_url: input.jobUrl?.trim() || null,
    source: input.source?.trim() || null,
    location: input.location?.trim() || null,
    remote_scope: input.remoteScope ?? 'unknown',
    salary_min: input.salaryMin ?? null,
    salary_max: input.salaryMax ?? null,
    salary_currency: input.salaryCurrency ?? 'EUR',
    employment_type: input.employmentType ?? 'unknown',
    job_description: input.jobDescription?.trim() || null,
    deadline: input.deadline || null,
    status: 'new',
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;

  await logActivity({
    activityType: 'job_discovered',
    entityType: 'job',
    entityId: data.id,
    title: 'Job saved',
    description: `Saved ${data.job_title} at ${data.company_name_snapshot}.`,
  });

  return data;
}

export async function updateJob(
  id: string,
  input: Omit<JobUpdate, 'user_id' | 'id'>,
): Promise<JobRecord> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('jobs')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function setJobStatus(
  id: string,
  status: Enums<'job_status'>,
): Promise<JobRecord> {
  const job = await updateJob(id, { status });
  if (status === 'shortlisted') {
    await logActivity({
      activityType: 'job_status_changed',
      entityType: 'job',
      entityId: job.id,
      title: 'Job shortlisted',
      description: `${job.job_title} at ${job.company_name_snapshot} was shortlisted.`,
    });
  } else {
    await logActivity({
      activityType: 'job_status_changed',
      entityType: 'job',
      entityId: job.id,
      title: 'Job status updated',
      description: `${job.job_title} is now ${status}.`,
    });
  }
  return job;
}

export async function deleteJob(id: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.from('jobs').delete().eq('id', id);
  if (error) throw error;
}

export function formatSalary(job: JobRecord): string {
  const currency = job.salary_currency || 'EUR';
  if (job.salary_min != null && job.salary_max != null) {
    return `${currency} ${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}`;
  }
  if (job.salary_min != null) {
    return `${currency} ${job.salary_min.toLocaleString()}+`;
  }
  if (job.salary_max != null) {
    return `Up to ${currency} ${job.salary_max.toLocaleString()}`;
  }
  return 'Not specified';
}
