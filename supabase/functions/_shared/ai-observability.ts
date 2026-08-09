/**
 * Shared AI observability helpers for Edge Functions (Phase 4E).
 * Records generations without logging secrets, OAuth tokens, or full email bodies.
 */

export type AiFeature =
  | 'analyze_job'
  | 'assistant'
  | 'cv_recommendations'
  | 'cv_summary'
  | 'cover_letter'
  | 'questionnaire'
  | 'linkedin_message'
  | 'follow_up'
  | 'interview_questions'
  | 'interview_answers'
  | 'company_research'
  | 'gmail_classification'
  | 'custom';

export type AiGenerationStatus =
  | 'success'
  | 'error'
  | 'validation_failed'
  | 'rate_limited'
  | 'provider_error'
  | 'cancelled';

const RATES: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rates = RATES[model] ?? RATES['gpt-4o-mini'];
  return (
    (promptTokens / 1_000_000) * rates.input +
    (completionTokens / 1_000_000) * rates.output
  );
}

export function artifactTypeToFeature(artifactType: string): AiFeature {
  if (artifactType === 'questionnaire_answer') return 'questionnaire';
  const known: AiFeature[] = [
    'cv_recommendations',
    'cv_summary',
    'cover_letter',
    'linkedin_message',
    'follow_up',
    'interview_questions',
    'interview_answers',
    'company_research',
    'custom',
  ];
  return (known.includes(artifactType as AiFeature)
    ? artifactType
    : 'custom') as AiFeature;
}

export type RecordGenerationInput = {
  userId: string;
  feature: AiFeature;
  provider?: string;
  model?: string | null;
  promptVersion?: string | null;
  status: AiGenerationStatus;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Sanitize metadata: drop large/sensitive payloads. */
export function sanitizeGenerationMetadata(
  meta: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (
      /token|cipher|secret|authorization|password|api_key|body_text|email_body/i.test(
        k,
      )
    ) {
      continue;
    }
    if (typeof v === 'string' && v.length > 500) {
      out[k] = `${v.slice(0, 500)}…`;
      continue;
    }
    if (k === 'result' || k === 'content') continue;
    out[k] = v;
  }
  return out;
}

/** Persist one AI generation row. Failures are logged and never thrown. */
export async function recordAiGeneration(
  supabase: {
    from: (table: string) => {
      insert: (
        row: Record<string, unknown>,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  },
  input: RecordGenerationInput,
): Promise<void> {
  try {
    const promptTokens = input.inputTokens ?? null;
    const completionTokens = input.outputTokens ?? null;
    const total =
      input.totalTokens ??
      (promptTokens != null && completionTokens != null
        ? promptTokens + completionTokens
        : null);
    const cost =
      input.estimatedCostUsd ??
      (input.model && promptTokens != null && completionTokens != null
        ? estimateCostUsd(input.model, promptTokens, completionTokens)
        : null);

    const { error } = await supabase.from('ai_generations').insert({
      user_id: input.userId,
      feature: input.feature,
      provider: input.provider ?? 'openai',
      model: input.model ?? null,
      prompt_version: input.promptVersion ?? null,
      status: input.status,
      input_tokens: promptTokens,
      output_tokens: completionTokens,
      total_tokens: total,
      estimated_cost_usd: cost,
      latency_ms: input.latencyMs ?? null,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage
        ? String(input.errorMessage).slice(0, 400)
        : null,
      source_table: input.sourceTable ?? null,
      source_id: input.sourceId ?? null,
      metadata: sanitizeGenerationMetadata(input.metadata ?? {}),
    });
    if (error) {
      console.error('ai_generation_record_failed', error.message);
    }
  } catch (err) {
    console.error(
      'ai_generation_record_failed',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}
