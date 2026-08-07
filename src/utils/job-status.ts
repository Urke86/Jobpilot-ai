import type { Job, JobStatus } from '@/types';

/** Solid badge styles used on Jobs / Job Detail lists. */
export function getJobStatusStyle(status: JobStatus): string {
  const styles: Record<JobStatus, string> = {
    new: 'bg-blue-100 text-blue-700 border-blue-200',
    shortlisted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    applied: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    interviewing: 'bg-purple-100 text-purple-700 border-purple-200',
    offer: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    archived: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return styles[status];
}

/** Soft badge styles used on Dashboard summaries. */
export function getJobStatusBadgeStyle(status: JobStatus): string {
  const styles: Record<JobStatus, string> = {
    new: 'bg-blue-500/15 text-blue-600 border-blue-500/25',
    shortlisted: 'bg-violet-500/15 text-violet-600 border-violet-500/25',
    applied: 'bg-sky-500/15 text-sky-600 border-sky-500/25',
    interviewing: 'bg-amber-500/15 text-amber-600 border-amber-500/25',
    offer: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25',
    rejected: 'bg-red-500/15 text-red-600 border-red-500/25',
    archived: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/25',
  };
  return styles[status];
}

export function getRecommendationStyle(
  recommendation: Job['recommendation'],
): string {
  const styles: Record<Job['recommendation'], string> = {
    strong: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    good: 'bg-blue-100 text-blue-700 border-blue-200',
    moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    weak: 'bg-red-100 text-red-700 border-red-200',
  };
  return styles[recommendation];
}
