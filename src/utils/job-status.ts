import type { Enums } from '@/types/database';

export function getJobStatusStyle(status: Enums<'job_status'>): string {
  const styles: Record<Enums<'job_status'>, string> = {
    new: 'bg-blue-100 text-blue-700 border-blue-200',
    analyzing: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    reviewed: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    shortlisted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    skipped: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    applied: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    archived: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return styles[status];
}

export function getJobStatusBadgeStyle(status: Enums<'job_status'>): string {
  const styles: Record<Enums<'job_status'>, string> = {
    new: 'bg-blue-500/15 text-blue-600 border-blue-500/25',
    analyzing: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/25',
    reviewed: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/25',
    shortlisted: 'bg-violet-500/15 text-violet-600 border-violet-500/25',
    skipped: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/25',
    applied: 'bg-sky-500/15 text-sky-600 border-sky-500/25',
    archived: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/25',
  };
  return styles[status];
}
