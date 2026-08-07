import type { Enums } from '@/types/database';

export const JOB_STATUSES: Enums<'job_status'>[] = [
  'new',
  'analyzing',
  'reviewed',
  'shortlisted',
  'skipped',
  'applied',
  'archived',
];

export const JOB_STATUS_LABELS: Record<Enums<'job_status'>, string> = {
  new: 'New',
  analyzing: 'Analyzing',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  skipped: 'Skipped',
  applied: 'Applied',
  archived: 'Archived',
};

export const APPLICATION_STAGES: Enums<'application_stage'>[] = [
  'preparing',
  'applied',
  'questionnaire',
  'interview',
  'assignment',
  'offer',
  'rejected',
  'withdrawn',
];

export const APPLICATION_STAGE_LABELS: Record<
  Enums<'application_stage'>,
  string
> = {
  preparing: 'Preparing',
  applied: 'Applied',
  questionnaire: 'Questionnaire',
  interview: 'Interview',
  assignment: 'Assignment',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const REMOTE_SCOPE_LABELS: Record<Enums<'remote_scope'>, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote_country: 'Remote (Country)',
  remote_europe: 'Remote (Europe)',
  remote_emea: 'Remote (EMEA)',
  remote_global: 'Remote (Global)',
  unknown: 'Unknown',
};

export const EMPLOYMENT_TYPE_LABELS: Record<
  Enums<'employment_type'>,
  string
> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  temporary: 'Temporary',
  internship: 'Internship',
  unknown: 'Unknown',
};

export const REMOTE_PREFERENCE_LABELS: Record<
  Enums<'remote_preference'>,
  string
> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
  flexible: 'Flexible',
  unknown: 'Unknown',
};
