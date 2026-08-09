/**
 * AI observability — spend, latency, evaluations, soft alerts (Phase 4E).
 */
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';
import {
  EVAL_DIMENSIONS,
  OBSERVABILITY_THRESHOLDS,
  PROMPT_REGISTRY,
  type EvalDimension,
  type AiFeatureId,
} from '@/lib/ai/prompt-registry';
import type { Enums, Json } from '@/types/database';

export type AiGenerationRow = {
  id: string;
  user_id: string;
  feature: Enums<'ai_feature'> | string;
  provider: string;
  model: string | null;
  prompt_version: string | null;
  status: Enums<'ai_generation_status'> | string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  latency_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  source_table: string | null;
  source_id: string | null;
  metadata: Json;
  created_at: string;
};

export type AiEvaluationRow = {
  id: string;
  user_id: string;
  generation_id: string;
  evaluator: string;
  score: number;
  result: Json;
  explanation: string | null;
  metadata: Json;
  created_at: string;
};

export type AiAlertRow = {
  id: string;
  user_id: string;
  kind: string;
  severity: string;
  title: string;
  message: string;
  metric_value: number | null;
  threshold_value: number | null;
  acknowledged_at: string | null;
  metadata: Json;
  created_at: string;
};

export type PromptVersionRow = {
  id: string;
  feature: string;
  version: string;
  description: string | null;
  system_prompt: string;
  changelog: string | null;
  is_active: boolean;
  created_at: string;
};

export type SpendBucket = { key: string; spend: number; count: number };
export type SeriesPoint = { date: string; spend: number; latency_ms: number; count: number };

export type AiAnalyticsSummary = {
  totalSpend: number;
  monthlySpend: number;
  weeklySpend: number;
  dailySpend: number;
  totalGenerations: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  medianTokens: number;
  avgCost: number;
  maxCost: number;
  mostExpensiveFeature: string | null;
  mostUsedModel: string | null;
  spendByFeature: SpendBucket[];
  spendByModel: SpendBucket[];
  modelStats: Array<{
    model: string;
    count: number;
    avgCost: number;
    avgLatency: number;
    successRate: number;
  }>;
  series: SeriesPoint[];
  slowest: AiGenerationRow[];
  recentFailures: AiGenerationRow[];
  topTokenConsumers: AiGenerationRow[];
  avgEvalScore: number | null;
  regressionWarnings: string[];
};

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function isSuccess(status: string): boolean {
  return status === 'success';
}

export async function listAiGenerations(limit = 500): Promise<AiGenerationRow[]> {
  const supabase = requireSupabaseClient();
  await requireUserId();
  const { data, error } = await supabase
    .from('ai_generations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AiGenerationRow[];
}

export async function listPromptVersions(): Promise<PromptVersionRow[]> {
  const supabase = requireSupabaseClient();
  await requireUserId();
  const { data, error } = await supabase
    .from('prompt_versions')
    .select(
      'id, feature, version, description, system_prompt, changelog, is_active, created_at',
    )
    .order('feature', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PromptVersionRow[];
}

export async function listAiEvaluations(limit = 100): Promise<AiEvaluationRow[]> {
  const supabase = requireSupabaseClient();
  await requireUserId();
  const { data, error } = await supabase
    .from('ai_evaluations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AiEvaluationRow[];
}

export async function listAiAlerts(includeAcked = false): Promise<AiAlertRow[]> {
  const supabase = requireSupabaseClient();
  await requireUserId();
  let q = supabase
    .from('ai_observability_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (!includeAcked) q = q.is('acknowledged_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AiAlertRow[];
}

export async function acknowledgeAiAlert(alertId: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const userId = await requireUserId();
  const { error } = await supabase
    .from('ai_observability_alerts')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', alertId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function submitAiEvaluation(input: {
  generationId: string;
  scores: Partial<Record<EvalDimension, number>>;
  explanation?: string;
  evaluator?: string;
}): Promise<AiEvaluationRow> {
  const supabase = requireSupabaseClient();
  const userId = await requireUserId();

  const dims = EVAL_DIMENSIONS.filter((d) => input.scores[d] != null);
  if (dims.length === 0) throw new Error('Provide at least one dimension score.');
  for (const d of dims) {
    const s = input.scores[d]!;
    if (s < 1 || s > 5) throw new Error('Scores must be between 1 and 5.');
  }
  const avg =
    dims.reduce((sum, d) => sum + (input.scores[d] ?? 0), 0) / dims.length;

  const { data, error } = await supabase
    .from('ai_evaluations')
    .insert({
      user_id: userId,
      generation_id: input.generationId,
      evaluator: input.evaluator ?? 'user',
      score: Math.round(avg * 100) / 100,
      result: input.scores as Json,
      explanation: input.explanation ?? null,
      metadata: { dimensions: dims },
    })
    .select('*')
    .single();
  if (error) throw error;

  await supabase.from('activities').insert({
    user_id: userId,
    entity_type: 'ai_generation',
    entity_id: input.generationId,
    activity_type: 'ai_evaluation_submitted',
    title: 'AI evaluation submitted',
    description: `Score ${avg.toFixed(1)}/5`,
    metadata: { generation_id: input.generationId, score: avg },
  });

  return data as AiEvaluationRow;
}

/** Record a simulated / manual failure for QA (FLOW F). */
export async function recordManualAiFailure(input?: {
  feature?: AiFeatureId;
  errorCode?: string;
  errorMessage?: string;
}): Promise<AiGenerationRow> {
  const supabase = requireSupabaseClient();
  const userId = await requireUserId();
  const feature = input?.feature ?? 'custom';
  const prompt = PROMPT_REGISTRY.find((p) => p.feature === feature);
  const { data, error } = await supabase
    .from('ai_generations')
    .insert({
      user_id: userId,
      feature,
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt_version: prompt?.version ?? 'v1',
      status: 'provider_error',
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      latency_ms: 0,
      error_code: input?.errorCode ?? 'simulated_failure',
      error_message: input?.errorMessage ?? 'Simulated failure for observability QA',
      metadata: { simulated: true },
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as AiGenerationRow;
}

export function computeAnalyticsSummary(
  generations: AiGenerationRow[],
  evaluations: AiEvaluationRow[] = [],
): AiAnalyticsSummary {
  const now = Date.now();
  const dayMs = 86_400_000;
  const daily = generations.filter(
    (g) => now - new Date(g.created_at).getTime() <= dayMs,
  );
  const weekly = generations.filter(
    (g) => now - new Date(g.created_at).getTime() <= 7 * dayMs,
  );
  const monthly = generations.filter(
    (g) => now - new Date(g.created_at).getTime() <= 30 * dayMs,
  );

  const sumCost = (rows: AiGenerationRow[]) =>
    rows.reduce((s, r) => s + num(r.estimated_cost_usd), 0);

  const success = generations.filter((g) => isSuccess(String(g.status)));
  const failures = generations.filter((g) => !isSuccess(String(g.status)));
  const latencies = generations
    .map((g) => num(g.latency_ms))
    .filter((n) => n > 0);
  const inputTokens = generations
    .map((g) => num(g.input_tokens))
    .filter((n) => n > 0);
  const outputTokens = generations
    .map((g) => num(g.output_tokens))
    .filter((n) => n > 0);
  const totals = generations
    .map((g) => num(g.total_tokens))
    .filter((n) => n > 0);
  const costs = generations
    .map((g) => num(g.estimated_cost_usd))
    .filter((n) => n > 0);

  const byFeature = new Map<string, { spend: number; count: number }>();
  const byModel = new Map<
    string,
    { spend: number; count: number; latency: number; success: number }
  >();
  for (const g of generations) {
    const f = String(g.feature);
    const m = g.model || 'unknown';
    const c = num(g.estimated_cost_usd);
    const prevF = byFeature.get(f) ?? { spend: 0, count: 0 };
    byFeature.set(f, { spend: prevF.spend + c, count: prevF.count + 1 });
    const prevM = byModel.get(m) ?? {
      spend: 0,
      count: 0,
      latency: 0,
      success: 0,
    };
    byModel.set(m, {
      spend: prevM.spend + c,
      count: prevM.count + 1,
      latency: prevM.latency + num(g.latency_ms),
      success: prevM.success + (isSuccess(String(g.status)) ? 1 : 0),
    });
  }

  const spendByFeature = [...byFeature.entries()]
    .map(([key, v]) => ({ key, spend: v.spend, count: v.count }))
    .sort((a, b) => b.spend - a.spend);
  const spendByModel = [...byModel.entries()]
    .map(([key, v]) => ({ key, spend: v.spend, count: v.count }))
    .sort((a, b) => b.count - a.count);

  const seriesMap = new Map<string, SeriesPoint>();
  for (const g of generations) {
    const d = dayKey(g.created_at);
    const prev = seriesMap.get(d) ?? {
      date: d,
      spend: 0,
      latency_ms: 0,
      count: 0,
    };
    seriesMap.set(d, {
      date: d,
      spend: prev.spend + num(g.estimated_cost_usd),
      latency_ms: prev.latency_ms + num(g.latency_ms),
      count: prev.count + 1,
    });
  }
  const series = [...seriesMap.values()]
    .map((p) => ({
      ...p,
      latency_ms: p.count ? p.latency_ms / p.count : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const prevWeek = generations.filter((g) => {
    const age = now - new Date(g.created_at).getTime();
    return age > 7 * dayMs && age <= 14 * dayMs;
  });
  const regressionWarnings: string[] = [];
  const weekLatency =
    weekly.filter((g) => num(g.latency_ms) > 0).reduce((s, g) => s + num(g.latency_ms), 0) /
    Math.max(1, weekly.filter((g) => num(g.latency_ms) > 0).length);
  const prevLatency =
    prevWeek.filter((g) => num(g.latency_ms) > 0).reduce((s, g) => s + num(g.latency_ms), 0) /
    Math.max(1, prevWeek.filter((g) => num(g.latency_ms) > 0).length);
  if (prevWeek.length >= 3 && weekLatency > prevLatency * 1.4) {
    regressionWarnings.push(
      `Latency up ${(((weekLatency - prevLatency) / Math.max(prevLatency, 1)) * 100).toFixed(0)}% vs prior week`,
    );
  }
  const weekCost = sumCost(weekly);
  const prevCost = sumCost(prevWeek);
  if (prevWeek.length >= 3 && weekCost > prevCost * (1 + OBSERVABILITY_THRESHOLDS.costTrendUpPct / 100)) {
    regressionWarnings.push('Weekly spend trending up vs prior week');
  }
  const weekFailRate =
    weekly.length === 0
      ? 0
      : (weekly.filter((g) => !isSuccess(String(g.status))).length / weekly.length) *
        100;
  if (weekFailRate >= OBSERVABILITY_THRESHOLDS.failureRatePct) {
    regressionWarnings.push(
      `Failure rate ${weekFailRate.toFixed(0)}% exceeds ${OBSERVABILITY_THRESHOLDS.failureRatePct}%`,
    );
  }

  const evalScores = evaluations.map((e) => num(e.score)).filter((n) => n > 0);
  const recentEvals = evaluations.filter(
    (e) => now - new Date(e.created_at).getTime() <= 7 * dayMs,
  );
  const olderEvals = evaluations.filter((e) => {
    const age = now - new Date(e.created_at).getTime();
    return age > 7 * dayMs && age <= 14 * dayMs;
  });
  if (recentEvals.length >= 2 && olderEvals.length >= 2) {
    const recentAvg =
      recentEvals.reduce((s, e) => s + num(e.score), 0) / recentEvals.length;
    const olderAvg =
      olderEvals.reduce((s, e) => s + num(e.score), 0) / olderEvals.length;
    if (olderAvg - recentAvg >= OBSERVABILITY_THRESHOLDS.evalDeclinePoints) {
      regressionWarnings.push(
        `Evaluation scores declined ${(olderAvg - recentAvg).toFixed(1)} pts vs prior week`,
      );
    }
  }

  return {
    totalSpend: sumCost(generations),
    monthlySpend: sumCost(monthly),
    weeklySpend: sumCost(weekly),
    dailySpend: sumCost(daily),
    totalGenerations: generations.length,
    successCount: success.length,
    failureCount: failures.length,
    successRate:
      generations.length === 0
        ? 100
        : (success.length / generations.length) * 100,
    avgLatencyMs:
      latencies.length === 0
        ? 0
        : latencies.reduce((a, b) => a + b, 0) / latencies.length,
    medianLatencyMs: median(latencies),
    p95LatencyMs: percentile(latencies, 95),
    avgInputTokens:
      inputTokens.length === 0
        ? 0
        : inputTokens.reduce((a, b) => a + b, 0) / inputTokens.length,
    avgOutputTokens:
      outputTokens.length === 0
        ? 0
        : outputTokens.reduce((a, b) => a + b, 0) / outputTokens.length,
    medianTokens: median(totals),
    avgCost:
      costs.length === 0 ? 0 : costs.reduce((a, b) => a + b, 0) / costs.length,
    maxCost: costs.length === 0 ? 0 : Math.max(...costs),
    mostExpensiveFeature: spendByFeature[0]?.key ?? null,
    mostUsedModel: spendByModel[0]?.key ?? null,
    spendByFeature,
    spendByModel,
    modelStats: [...byModel.entries()].map(([model, v]) => ({
      model,
      count: v.count,
      avgCost: v.count ? v.spend / v.count : 0,
      avgLatency: v.count ? v.latency / v.count : 0,
      successRate: v.count ? (v.success / v.count) * 100 : 0,
    })),
    series,
    slowest: [...generations]
      .sort((a, b) => num(b.latency_ms) - num(a.latency_ms))
      .slice(0, 5),
    recentFailures: failures.slice(0, 8),
    topTokenConsumers: [...generations]
      .sort((a, b) => num(b.total_tokens) - num(a.total_tokens))
      .slice(0, 5),
    avgEvalScore:
      evalScores.length === 0
        ? null
        : evalScores.reduce((a, b) => a + b, 0) / evalScores.length,
    regressionWarnings,
  };
}

export async function getAiAnalyticsSummary(): Promise<AiAnalyticsSummary> {
  const [generations, evaluations] = await Promise.all([
    listAiGenerations(500),
    listAiEvaluations(200),
  ]);
  return computeAnalyticsSummary(generations, evaluations);
}

/**
 * Soft alerts: insert open alerts when thresholds exceeded.
 * Idempotent per day+kind (skips if an open alert of same kind exists today).
 */
export async function refreshSoftAlerts(
  summary?: AiAnalyticsSummary,
): Promise<AiAlertRow[]> {
  const supabase = requireSupabaseClient();
  const userId = await requireUserId();
  const s = summary ?? (await getAiAnalyticsSummary());
  const existing = await listAiAlerts(false);
  const today = new Date().toISOString().slice(0, 10);

  const hasOpenToday = (kind: string) =>
    existing.some(
      (a) => a.kind === kind && a.created_at.slice(0, 10) === today,
    );

  const toInsert: Array<{
    user_id: string;
    kind: Enums<'ai_alert_kind'>;
    severity: Enums<'ai_alert_severity'>;
    title: string;
    message: string;
    metric_value?: number | null;
    threshold_value?: number | null;
    metadata: Json;
  }> = [];

  if (
    s.dailySpend >= OBSERVABILITY_THRESHOLDS.dailySpendUsd &&
    !hasOpenToday('daily_spend_exceeded')
  ) {
    toInsert.push({
      user_id: userId,
      kind: 'daily_spend_exceeded',
      severity: 'warning',
      title: 'Daily AI spend threshold',
      message: `Today's estimated spend is $${s.dailySpend.toFixed(4)} (threshold $${OBSERVABILITY_THRESHOLDS.dailySpendUsd}).`,
      metric_value: s.dailySpend,
      threshold_value: OBSERVABILITY_THRESHOLDS.dailySpendUsd,
      metadata: {},
    });
  }

  if (
    s.avgLatencyMs >= OBSERVABILITY_THRESHOLDS.avgLatencyMs &&
    !hasOpenToday('latency_elevated')
  ) {
    toInsert.push({
      user_id: userId,
      kind: 'latency_elevated',
      severity: 'warning',
      title: 'Elevated AI latency',
      message: `Average latency is ${Math.round(s.avgLatencyMs)}ms (threshold ${OBSERVABILITY_THRESHOLDS.avgLatencyMs}ms).`,
      metric_value: s.avgLatencyMs,
      threshold_value: OBSERVABILITY_THRESHOLDS.avgLatencyMs,
      metadata: {},
    });
  }

  const failRate =
    s.totalGenerations === 0
      ? 0
      : (s.failureCount / s.totalGenerations) * 100;
  if (
    failRate >= OBSERVABILITY_THRESHOLDS.failureRatePct &&
    !hasOpenToday('failure_rate_elevated')
  ) {
    toInsert.push({
      user_id: userId,
      kind: 'failure_rate_elevated',
      severity: 'critical',
      title: 'AI failure rate elevated',
      message: `Failure rate is ${failRate.toFixed(0)}% across recent generations.`,
      metric_value: failRate,
      threshold_value: OBSERVABILITY_THRESHOLDS.failureRatePct,
      metadata: {},
    });
  }

  for (const warning of s.regressionWarnings) {
    if (warning.toLowerCase().includes('evaluation') && !hasOpenToday('eval_score_declining')) {
      toInsert.push({
        user_id: userId,
        kind: 'eval_score_declining',
        severity: 'warning',
        title: 'Evaluation score regression',
        message: warning,
        metadata: {},
      });
    } else if (
      warning.toLowerCase().includes('spend') &&
      !hasOpenToday('cost_trend_up')
    ) {
      toInsert.push({
        user_id: userId,
        kind: 'cost_trend_up',
        severity: 'info',
        title: 'Cost trend warning',
        message: warning,
        metadata: {},
      });
    } else if (
      warning.toLowerCase().includes('latency') &&
      !hasOpenToday('latency_elevated')
    ) {
      toInsert.push({
        user_id: userId,
        kind: 'latency_elevated',
        severity: 'warning',
        title: 'Latency regression',
        message: warning,
        metadata: {},
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from('ai_observability_alerts')
      .insert(toInsert);
    if (error) throw error;
  }

  return listAiAlerts(false);
}

export { OBSERVABILITY_THRESHOLDS, EVAL_DIMENSIONS, PROMPT_REGISTRY };
