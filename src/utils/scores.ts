/** Text color for match score values. */
export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 80) return 'text-blue-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-gray-500';
}

/** Solid ring/dot color for match score indicators. */
export function getScoreRingColor(score: number): string {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 80) return 'bg-blue-500';
  if (score >= 70) return 'bg-yellow-500';
  return 'bg-gray-400';
}

/** Soft ring/border style for large score indicators (Job Detail). */
export function getScoreRingBorderColor(score: number): string {
  if (score >= 90) return 'border-emerald-500 bg-emerald-50';
  if (score >= 80) return 'border-blue-500 bg-blue-50';
  if (score >= 70) return 'border-yellow-500 bg-yellow-50';
  return 'border-gray-400 bg-gray-50';
}

/** Soft badge classes for match score chips (Dashboard). */
export function getMatchScoreBadgeStyle(score: number): string {
  if (score >= 85) {
    return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25 hover:bg-emerald-500/20';
  }
  if (score >= 70) {
    return 'bg-blue-500/15 text-blue-600 border-blue-500/25 hover:bg-blue-500/20';
  }
  return 'bg-amber-500/15 text-amber-600 border-amber-500/25 hover:bg-amber-500/20';
}
