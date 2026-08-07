import type { ApplicationStage, JobStatus, RemoteType } from '@/types';

export const JOB_STATUSES: JobStatus[] = [
  'new',
  'shortlisted',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'archived',
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  new: 'New',
  shortlisted: 'Shortlisted',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  archived: 'Archived',
};

export const APPLICATION_STAGES: ApplicationStage[] = [
  'preparing',
  'applied',
  'questionnaire',
  'interview',
  'assignment',
  'offer',
  'rejected',
];

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  preparing: 'Preparing',
  applied: 'Applied',
  questionnaire: 'Questionnaire',
  interview: 'Interview',
  assignment: 'Assignment',
  offer: 'Offer',
  rejected: 'Rejected',
};

export const REMOTE_TYPE_LABELS: Record<RemoteType, string> = {
  'fully-remote': 'Fully Remote',
  hybrid: 'Hybrid',
  'on-site': 'On-site',
};

export const RECOMMENDATION_LABELS = {
  strong: 'Strong',
  good: 'Good',
  moderate: 'Moderate',
  weak: 'Weak',
} as const;
