import type { Enums } from '@/types/database';

export function getStageBadgeClass(stage: Enums<'application_stage'>): string {
  const styles: Record<Enums<'application_stage'>, string> = {
    preparing: 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-100',
    applied: 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-blue-100',
    questionnaire:
      'border-yellow-300 bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
    interview: 'border-sky-300 bg-sky-100 text-sky-700 hover:bg-sky-100',
    assignment:
      'border-orange-300 bg-orange-100 text-orange-700 hover:bg-orange-100',
    offer: 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
    rejected: 'border-red-300 bg-red-100 text-red-700 hover:bg-red-100',
    withdrawn: 'border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-100',
  };
  return styles[stage];
}

export function getColumnHeaderClass(stage: Enums<'application_stage'>): string {
  const styles: Record<Enums<'application_stage'>, string> = {
    preparing: 'bg-gray-100 text-gray-700',
    applied: 'bg-blue-100 text-blue-700',
    questionnaire: 'bg-yellow-100 text-yellow-700',
    interview: 'bg-sky-100 text-sky-700',
    assignment: 'bg-orange-100 text-orange-700',
    offer: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    withdrawn: 'bg-zinc-100 text-zinc-700',
  };
  return styles[stage];
}

export function getColumnBorderClass(stage: Enums<'application_stage'>): string {
  const styles: Record<Enums<'application_stage'>, string> = {
    preparing: 'border-t-gray-400',
    applied: 'border-t-blue-400',
    questionnaire: 'border-t-yellow-400',
    interview: 'border-t-sky-400',
    assignment: 'border-t-orange-400',
    offer: 'border-t-emerald-400',
    rejected: 'border-t-red-400',
    withdrawn: 'border-t-zinc-400',
  };
  return styles[stage];
}
