/**
 * Artifact AI result schemas (Zod) — shared with frontend display helpers.
 * Edge Function mirrors validation in Deno.
 */
import { z } from 'zod';

export const ARTIFACT_TYPES = [
  'cv_recommendations',
  'cv_summary',
  'cover_letter',
  'questionnaire_answer',
  'linkedin_message',
  'follow_up',
  'interview_questions',
  'interview_answers',
  'company_research',
  'custom',
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const cvRecommendationsSchema = z.object({
  headline_recommendation: z.string().nullable(),
  summary_recommendation: z.string().min(1),
  skills_to_prioritize: z.array(z.string().min(1)).max(20),
  experience_changes: z
    .array(
      z.object({
        section: z.string().min(1),
        current_focus: z.string().min(1),
        recommended_focus: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .max(12),
  projects_to_prioritize: z.array(z.string().min(1)).max(12),
  keywords_to_include: z.array(z.string().min(1)).max(30),
  things_not_to_claim: z.array(z.string().min(1)).max(20),
});

export const cvSummarySchema = z.object({
  summary: z.string().min(1),
});

export const coverLetterSchema = z.object({
  subject: z.string().nullable(),
  content: z.string().min(1),
});

export const questionnaireAnswerSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  evidence_used: z.array(z.string().min(1)).max(12),
});

export const linkedinMessageSchema = z.object({
  message: z.string().min(1),
});

export const followUpSchema = z.object({
  message: z.string().min(1),
});

export const interviewQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        category: z.string().min(1),
        question: z.string().min(1),
        why_it_may_be_asked: z.string().min(1),
        difficulty: z.enum(['easy', 'medium', 'hard']),
      }),
    )
    .min(1)
    .max(24),
});

export const interviewAnswersSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  supporting_examples: z.array(z.string().min(1)).max(8),
});

export const companyResearchSchema = z.object({
  company_summary: z.string().min(1),
  why_role_is_relevant: z.string().min(1),
  topics_to_research_manually: z.array(z.string().min(1)).max(12),
  interview_angles: z.array(z.string().min(1)).max(12),
});

export const customArtifactSchema = z.object({
  content: z.string().min(1),
});

export type CvRecommendations = z.infer<typeof cvRecommendationsSchema>;
export type CvSummary = z.infer<typeof cvSummarySchema>;
export type CoverLetter = z.infer<typeof coverLetterSchema>;
export type QuestionnaireAnswer = z.infer<typeof questionnaireAnswerSchema>;
export type LinkedinMessage = z.infer<typeof linkedinMessageSchema>;
export type FollowUpMessage = z.infer<typeof followUpSchema>;
export type InterviewQuestions = z.infer<typeof interviewQuestionsSchema>;
export type InterviewAnswers = z.infer<typeof interviewAnswersSchema>;
export type CompanyResearch = z.infer<typeof companyResearchSchema>;
export type CustomArtifact = z.infer<typeof customArtifactSchema>;

export interface ArtifactRunMetadata {
  provider?: string;
  model?: string;
  artifact_version?: string;
  duration_ms?: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  estimated_cost_usd?: number | null;
  result?: unknown;
  question?: string;
  user_notes?: string;
  user_instruction?: string;
  contact_name?: string;
  contact_role?: string;
  days_since_application?: number;
  stage?: string;
}

export const ARTIFACT_GENERATION_VERSION = 'v1-artifacts';
export const DEFAULT_ARTIFACT_MODEL = 'gpt-4o-mini';

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  cv_recommendations: 'CV Recommendations',
  cv_summary: 'CV Summary',
  cover_letter: 'Cover Letter',
  questionnaire_answer: 'Questionnaire Answer',
  linkedin_message: 'LinkedIn Message',
  follow_up: 'Follow-up Message',
  interview_questions: 'Interview Questions',
  interview_answers: 'Interview Answers',
  company_research: 'Company Research',
  custom: 'Custom',
};

/** Rough USD estimate for known models. */
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

/** Human-readable primary text for list/preview. */
export function artifactPreviewText(
  _artifactType: string,
  content: string,
  metadata?: ArtifactRunMetadata | null,
): string {
  const result = metadata?.result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r.summary === 'string') return r.summary;
    if (typeof r.content === 'string') return r.content;
    if (typeof r.message === 'string') return r.message;
    if (typeof r.answer === 'string') return r.answer;
    if (typeof r.summary_recommendation === 'string') {
      return r.summary_recommendation;
    }
    if (typeof r.company_summary === 'string') return r.company_summary;
  }
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.summary === 'string') return parsed.summary;
    if (typeof parsed.content === 'string') return parsed.content;
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.answer === 'string') return parsed.answer;
  } catch {
    // plain text
  }
  return content;
}
