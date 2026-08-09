import { z } from 'npm:zod@3.23.8';
import { fetchWithTimeout, OPENAI_TIMEOUT_MS } from './fetch-timeout.ts';

function nullableString() {
  return z.preprocess((v) => {
    if (v == null || v === '') return null;
    return String(v);
  }, z.string().nullable());
}

export const emailClassificationSchema = z.object({
  classification: z.enum([
    'recruiter_outreach',
    'application_confirmation',
    'questionnaire',
    'assessment',
    'interview_invitation',
    'interview_followup',
    'rejection',
    'offer',
    'general_hiring_message',
    'unrelated',
  ]),
  confidence: z.preprocess((v) => {
    const n = typeof v === 'string' ? Number(v) : v;
    if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }, z.number().int().min(0).max(100)),
  company_name: nullableString(),
  job_title: nullableString(),
  application_match_reason: nullableString(),
  suggested_application_stage: z.preprocess((v) => {
    if (v == null || v === '' || v === 'null') return null;
    return v;
  }, z
    .enum([
      'preparing',
      'applied',
      'questionnaire',
      'interview',
      'assignment',
      'offer',
      'rejected',
    ])
    .nullable()),
  requires_user_action: z.preprocess((v) => {
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
    return Boolean(v);
  }, z.boolean()),
  suggested_action: nullableString(),
  interview: z.preprocess((v) => {
    if (v == null || typeof v !== 'object') {
      return {
        detected: false,
        date: null,
        start_time: null,
        end_time: null,
        timezone: null,
        meeting_url: null,
        timezone_ambiguous: true,
      };
    }
    return v;
  }, z.object({
    detected: z.preprocess((v) => Boolean(v), z.boolean()),
    date: nullableString(),
    start_time: nullableString(),
    end_time: nullableString(),
    timezone: nullableString(),
    meeting_url: nullableString(),
    timezone_ambiguous: z.preprocess((v) => {
      if (v == null) return undefined;
      return Boolean(v);
    }, z.boolean().optional()),
  })),
});

export type EmailClassification = z.infer<typeof emailClassificationSchema>;

export const CLASSIFY_SYSTEM = `You classify hiring-related emails for JobPilot AI.

Rules:
- Use ONLY the provided subject/snippet/body excerpt and candidate application context.
- Never invent companies, roles, or interview times not supported by the email text.
- If timezone is missing or ambiguous for an interview, set interview.timezone_ambiguous=true and interview.timezone=null.
- suggested_application_stage is a recommendation only — never imply it was applied.
- Prefer unrelated when the message is not about the candidate's job search.
- Return a single JSON object with keys:
  classification, confidence (0-100 integer), company_name, job_title,
  application_match_reason, suggested_application_stage, requires_user_action,
  suggested_action, interview { detected, date, start_time, end_time, timezone, meeting_url, timezone_ambiguous }.
- Use null for unknown strings/stages.`;

const HIRING_HINT =
  /\b(interview|recruiter|hiring|questionnaire|assessment|application|candidate|offer|position|role|cv|resume|talent|opportunity)\b/i;

export function looksHiringRelated(
  subject: string,
  snippet: string,
  from: string,
): boolean {
  const blob = `${subject}\n${snippet}\n${from}`;
  return HIRING_HINT.test(blob);
}

export async function classifyEmailWithAi(params: {
  openaiKey: string;
  model: string;
  subject: string;
  snippet: string;
  bodyExcerpt: string;
  sender: string;
  contextSummary: string;
}): Promise<{
  result: EmailClassification;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  duration_ms: number;
}> {
  const started = Date.now();
  const userContent = `SENDER: ${params.sender}
SUBJECT: ${params.subject}
SNIPPET: ${params.snippet}
BODY_EXCERPT:
${params.bodyExcerpt.slice(0, 6000)}

CANDIDATE_APPLICATION_CONTEXT:
${params.contextSummary.slice(0, 4000)}`;

  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        temperature: 0.1,
        messages: [
          { role: 'system', content: CLASSIFY_SYSTEM },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      }),
    },
    OPENAI_TIMEOUT_MS,
  );

  if (!res.ok) {
    // Log status only — never provider payloads or email content.
    console.error('classify_openai_error', { status: res.status });
    throw new Error('AI classification failed.');
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('AI returned empty classification.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI returned invalid JSON.');
  }
  const validated = emailClassificationSchema.safeParse(parsed);
  if (!validated.success) {
    console.error('classify_schema_error', {
      issues: validated.error.issues.slice(0, 8).map((i) => ({
        path: i.path.join('.'),
        code: i.code,
      })),
    });
    throw new Error('AI classification failed validation.');
  }

  const usage = json.usage ?? {};
  return {
    result: validated.data,
    usage: {
      prompt_tokens: Number(usage.prompt_tokens ?? 0),
      completion_tokens: Number(usage.completion_tokens ?? 0),
      total_tokens: Number(usage.total_tokens ?? 0),
    },
    duration_ms: Date.now() - started,
  };
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const inRate = 0.15 / 1_000_000;
  const outRate = 0.6 / 1_000_000;
  void model;
  return Number((promptTokens * inRate + completionTokens * outRate).toFixed(6));
}
