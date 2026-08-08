/**
 * Shared AI job analysis result schema (Zod).
 * Used by the frontend for display helpers.
 * Edge Function duplicates validation in Deno-compatible form.
 */
import { z } from 'zod';

export const analysisStrengthSchema = z.object({
  title: z.string().min(1),
  evidence: z.string().min(1),
});

export const analysisGapSchema = z.object({
  title: z.string().min(1),
  evidence: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high']),
});

export const analysisRiskSchema = z.object({
  title: z.string().min(1),
  reason: z.string().min(1),
});

export const scoreSchema = z.number().int().min(0).max(100);

export const jobAnalysisAiResultSchema = z.object({
  overall_match_score: scoreSchema,
  product_fit_score: scoreSchema,
  technical_fit_score: scoreSchema,
  ai_tools_fit_score: scoreSchema,
  remote_fit_score: scoreSchema,
  experience_fit_score: scoreSchema,
  strengths: z.array(analysisStrengthSchema).max(8),
  gaps: z.array(analysisGapSchema).max(8),
  risks: z.array(analysisRiskSchema).max(8),
  recommendation: z.enum(['apply', 'consider', 'skip']),
  recommendation_reason: z.string().min(1),
  reasoning_summary: z.string().min(1),
  cv_focus: z.array(z.string().min(1)).max(8),
  interview_focus: z.array(z.string().min(1)).max(8),
});

export type JobAnalysisAiResult = z.infer<typeof jobAnalysisAiResultSchema>;

export type AnalysisStrength = z.infer<typeof analysisStrengthSchema>;
export type AnalysisGap = z.infer<typeof analysisGapSchema>;
export type AnalysisRisk = z.infer<typeof analysisRiskSchema>;

export interface JobAnalysisMetadata {
  model?: string;
  analysis_version?: string;
  duration_ms?: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  estimated_cost_usd?: number | null;
  recommendation_reason?: string;
  cv_focus?: string[];
  interview_focus?: string[];
  provider?: string;
}

export const ANALYSIS_VERSION = 'v1-structured';
export const DEFAULT_ANALYSIS_MODEL = 'gpt-4o-mini';

/** Rough USD estimate for gpt-4o-mini (input $0.15/1M, output $0.60/1M). */
export function estimateOpenAiCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const rates: Record<string, { in: number; out: number }> = {
    'gpt-4o-mini': { in: 0.15 / 1_000_000, out: 0.6 / 1_000_000 },
    'gpt-4o': { in: 2.5 / 1_000_000, out: 10 / 1_000_000 },
  };
  const rate = rates[model];
  if (!rate) return null;
  return Number(
    (promptTokens * rate.in + completionTokens * rate.out).toFixed(6),
  );
}
