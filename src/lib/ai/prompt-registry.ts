/**
 * Prompt Registry — feature → version lookup and changelog (Phase 4E).
 * Canonical versions are also seeded in `prompt_versions` (DB).
 * Never overwrite historical versions; add new entries instead.
 */

export const AI_FEATURES = [
  'analyze_job',
  'assistant',
  'cv_recommendations',
  'cv_summary',
  'cover_letter',
  'questionnaire',
  'linkedin_message',
  'follow_up',
  'interview_questions',
  'interview_answers',
  'company_research',
  'gmail_classification',
  'custom',
] as const;

export type AiFeatureId = (typeof AI_FEATURES)[number];

export type PromptRegistryEntry = {
  feature: AiFeatureId;
  version: string;
  description: string;
  changelog: string;
  /** Local mirror of system prompt identity; full text lives in Edge / DB. */
  systemPromptRef: string;
};

/** Append-only local registry mirror (active versions). */
export const PROMPT_REGISTRY: PromptRegistryEntry[] = [
  {
    feature: 'analyze_job',
    version: 'v1-structured',
    description: 'Structured job-fit analysis with anti-hallucination scoring',
    changelog: 'Initial Phase 4A structured analysis prompt',
    systemPromptRef: 'supabase/functions/analyze-job SYSTEM_PROMPT',
  },
  {
    feature: 'assistant',
    version: 'v1-assistant',
    description: 'Streaming contextual assistant',
    changelog: 'Initial Phase 4C.1 assistant prompt',
    systemPromptRef: 'src/lib/ai/assistant-prompts.ts',
  },
  {
    feature: 'cv_recommendations',
    version: 'v1-toolkit',
    description: 'CV recommendations artifact',
    changelog: 'Initial Phase 4B artifact prompt',
    systemPromptRef: 'src/lib/ai/artifact-prompts.ts',
  },
  {
    feature: 'cv_summary',
    version: 'v1-toolkit',
    description: 'CV summary artifact',
    changelog: 'Initial Phase 4B artifact prompt',
    systemPromptRef: 'src/lib/ai/artifact-prompts.ts',
  },
  {
    feature: 'cover_letter',
    version: 'v1-toolkit',
    description: 'Cover letter artifact',
    changelog: 'Initial Phase 4B artifact prompt',
    systemPromptRef: 'src/lib/ai/artifact-prompts.ts',
  },
  {
    feature: 'questionnaire',
    version: 'v1-toolkit',
    description: 'Questionnaire answer artifact',
    changelog: 'Initial Phase 4B artifact prompt',
    systemPromptRef: 'src/lib/ai/artifact-prompts.ts',
  },
  {
    feature: 'interview_questions',
    version: 'v1-toolkit',
    description: 'Interview questions artifact',
    changelog: 'Initial Phase 4B artifact prompt',
    systemPromptRef: 'src/lib/ai/artifact-prompts.ts',
  },
  {
    feature: 'interview_answers',
    version: 'v1-toolkit',
    description: 'Interview answers artifact',
    changelog: 'Initial Phase 4B artifact prompt',
    systemPromptRef: 'src/lib/ai/artifact-prompts.ts',
  },
  {
    feature: 'company_research',
    version: 'v1-toolkit',
    description: 'Company research artifact',
    changelog: 'Initial Phase 4B artifact prompt',
    systemPromptRef: 'src/lib/ai/artifact-prompts.ts',
  },
  {
    feature: 'linkedin_message',
    version: 'v1-toolkit',
    description: 'LinkedIn message artifact',
    changelog: 'Initial Phase 4B artifact prompt',
    systemPromptRef: 'src/lib/ai/artifact-prompts.ts',
  },
  {
    feature: 'follow_up',
    version: 'v1-toolkit',
    description: 'Follow-up message artifact',
    changelog: 'Initial Phase 4B artifact prompt',
    systemPromptRef: 'src/lib/ai/artifact-prompts.ts',
  },
  {
    feature: 'custom',
    version: 'v1-toolkit',
    description: 'Custom artifact',
    changelog: 'Initial Phase 4B artifact prompt',
    systemPromptRef: 'src/lib/ai/artifact-prompts.ts',
  },
  {
    feature: 'gmail_classification',
    version: 'gmail-sync-v1',
    description: 'Hiring email classification',
    changelog: 'Initial Phase 4D classification prompt',
    systemPromptRef: 'supabase/functions/_shared/email-classify.ts',
  },
];

export function getActivePromptVersion(
  feature: AiFeatureId,
): PromptRegistryEntry | undefined {
  return PROMPT_REGISTRY.find((e) => e.feature === feature);
}

export function listPromptVersionsForFeature(
  feature: AiFeatureId,
): PromptRegistryEntry[] {
  return PROMPT_REGISTRY.filter((e) => e.feature === feature);
}

export function mapArtifactTypeToFeature(artifactType: string): AiFeatureId {
  if (artifactType === 'questionnaire_answer') return 'questionnaire';
  if ((AI_FEATURES as readonly string[]).includes(artifactType)) {
    return artifactType as AiFeatureId;
  }
  return 'custom';
}

export const EVAL_DIMENSIONS = [
  'factual_accuracy',
  'hallucination_risk',
  'usefulness',
  'tone',
  'structure',
  'completeness',
  'relevance',
] as const;

export type EvalDimension = (typeof EVAL_DIMENSIONS)[number];

export const EVAL_DIMENSION_LABELS: Record<EvalDimension, string> = {
  factual_accuracy: 'Factual accuracy',
  hallucination_risk: 'Hallucination risk (5 = lowest risk)',
  usefulness: 'Usefulness',
  tone: 'Tone',
  structure: 'Structure',
  completeness: 'Completeness',
  relevance: 'Relevance',
};

/** Soft-alert thresholds (in-app only). */
export const OBSERVABILITY_THRESHOLDS = {
  dailySpendUsd: 1.0,
  avgLatencyMs: 15_000,
  failureRatePct: 25,
  costTrendUpPct: 50,
  evalDeclinePoints: 0.5,
} as const;
