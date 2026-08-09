import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { z } from 'npm:zod@3.23.8';
import {
  artifactTypeToFeature,
  recordAiGeneration,
} from '../_shared/ai-observability.ts';

const ARTIFACT_VERSION = 'v1-artifacts';
const DEFAULT_MODEL = Deno.env.get('OPENAI_ANALYSIS_MODEL') ?? 'gpt-4o-mini';
const RATE_LIMIT_SECONDS = 15;
const MIN_PROFILE_SIGNAL_CHARS = 40;

const ARTIFACT_TYPES = [
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

type ArtifactType = (typeof ARTIFACT_TYPES)[number];

const BASE_SYSTEM = `You are JobPilot AI's application materials writer.

ROLE
- Produce factual, role-tailored application artifacts for a job seeker.
- Prefer accuracy over persuasion.

ANTI-FABRICATION (MANDATORY)
- NEVER invent candidate experience, skills, years, projects, achievements, certifications, metrics, salary history, job titles, technologies, or domain depth.
- Use ONLY information in the labeled context sections.
- If evidence is missing, say so explicitly or frame as adjacent experience — never invent production experience.
- Do not upgrade weak signals into strong claims.
- Do not invent company facts.

STYLE
- Concise, professional, modern. No generic clichés. Evidence-based.

OUTPUT
- Return ONLY valid JSON matching the required schema.`;

const TYPE_INSTRUCTIONS: Record<ArtifactType, string> = {
  cv_recommendations: `TASK: CV tailoring recommendations for THIS role.
Guide ordering, phrasing, keyword alignment without inventing experience.
things_not_to_claim: things the job might imply but candidate must NOT claim.`,
  cv_summary: `TASK: Tailored CV summary (~70–120 words). ATS-friendly, natural, no keyword stuffing. Emphasize strongest fit from analysis when present.`,
  cover_letter: `TASK: Modern cover letter (~180–300 words). Structure: why role → why candidate → proof → closing. Direct, not overly formal. No invented company enthusiasm.`,
  questionnaire_answer: `TASK: Answer USER QUESTION for a job application. Stay factual; evidence_used only from materials. Acknowledge thin evidence honestly.`,
  linkedin_message: `TASK: Short LinkedIn outreach (~50–100 words). Specific, not spammy, no fake familiarity.`,
  follow_up: `TASK: Concise follow-up. Polite, not needy, no artificial urgency.`,
  interview_questions: `TASK: Realistic interview questions. Categories: product, technical, AI, behavioral, business, role-specific. Prioritize gaps/strengths. Include why_it_may_be_asked and difficulty.`,
  interview_answers: `TASK: Suggested interview answer. Only real experience; bridge gaps honestly. Never pretend production experience exists.`,
  company_research: `TASK: Research from SAVED data only. Do not invent facts. Note missing data in topics_to_research_manually.`,
  custom: `TASK: Follow USER INSTRUCTION under anti-fabrication rules. Return { "content": "..." }.`,
};

const schemas: Record<ArtifactType, z.ZodTypeAny> = {
  cv_recommendations: z.object({
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
  }),
  cv_summary: z.object({ summary: z.string().min(1) }),
  cover_letter: z.object({
    subject: z.string().nullable(),
    content: z.string().min(1),
  }),
  questionnaire_answer: z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    evidence_used: z.array(z.string().min(1)).max(12),
  }),
  linkedin_message: z.object({ message: z.string().min(1) }),
  follow_up: z.object({ message: z.string().min(1) }),
  interview_questions: z.object({
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
  }),
  interview_answers: z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    supporting_examples: z.array(z.string().min(1)).max(8),
  }),
  company_research: z.object({
    company_summary: z.string().min(1),
    why_role_is_relevant: z.string().min(1),
    topics_to_research_manually: z.array(z.string().min(1)).max(12),
    interview_angles: z.array(z.string().min(1)).max(12),
  }),
  custom: z.object({ content: z.string().min(1) }),
};

const jsonSchemas: Record<ArtifactType, Record<string, unknown>> = {
  cv_recommendations: {
    type: 'object',
    additionalProperties: false,
    required: [
      'headline_recommendation',
      'summary_recommendation',
      'skills_to_prioritize',
      'experience_changes',
      'projects_to_prioritize',
      'keywords_to_include',
      'things_not_to_claim',
    ],
    properties: {
      headline_recommendation: { type: ['string', 'null'] },
      summary_recommendation: { type: 'string' },
      skills_to_prioritize: { type: 'array', items: { type: 'string' } },
      experience_changes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'section',
            'current_focus',
            'recommended_focus',
            'reason',
          ],
          properties: {
            section: { type: 'string' },
            current_focus: { type: 'string' },
            recommended_focus: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
      projects_to_prioritize: { type: 'array', items: { type: 'string' } },
      keywords_to_include: { type: 'array', items: { type: 'string' } },
      things_not_to_claim: { type: 'array', items: { type: 'string' } },
    },
  },
  cv_summary: {
    type: 'object',
    additionalProperties: false,
    required: ['summary'],
    properties: { summary: { type: 'string' } },
  },
  cover_letter: {
    type: 'object',
    additionalProperties: false,
    required: ['subject', 'content'],
    properties: {
      subject: { type: ['string', 'null'] },
      content: { type: 'string' },
    },
  },
  questionnaire_answer: {
    type: 'object',
    additionalProperties: false,
    required: ['question', 'answer', 'evidence_used'],
    properties: {
      question: { type: 'string' },
      answer: { type: 'string' },
      evidence_used: { type: 'array', items: { type: 'string' } },
    },
  },
  linkedin_message: {
    type: 'object',
    additionalProperties: false,
    required: ['message'],
    properties: { message: { type: 'string' } },
  },
  follow_up: {
    type: 'object',
    additionalProperties: false,
    required: ['message'],
    properties: { message: { type: 'string' } },
  },
  interview_questions: {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'category',
            'question',
            'why_it_may_be_asked',
            'difficulty',
          ],
          properties: {
            category: { type: 'string' },
            question: { type: 'string' },
            why_it_may_be_asked: { type: 'string' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          },
        },
      },
    },
  },
  interview_answers: {
    type: 'object',
    additionalProperties: false,
    required: ['question', 'answer', 'supporting_examples'],
    properties: {
      question: { type: 'string' },
      answer: { type: 'string' },
      supporting_examples: { type: 'array', items: { type: 'string' } },
    },
  },
  company_research: {
    type: 'object',
    additionalProperties: false,
    required: [
      'company_summary',
      'why_role_is_relevant',
      'topics_to_research_manually',
      'interview_angles',
    ],
    properties: {
      company_summary: { type: 'string' },
      why_role_is_relevant: { type: 'string' },
      topics_to_research_manually: {
        type: 'array',
        items: { type: 'string' },
      },
      interview_angles: { type: 'array', items: { type: 'string' } },
    },
  },
  custom: {
    type: 'object',
    additionalProperties: false,
    required: ['content'],
    properties: { content: { type: 'string' } },
  },
};

const ACTIVITY_TITLES: Partial<Record<ArtifactType, string>> = {
  cv_recommendations: 'CV recommendations generated',
  cv_summary: 'CV summary generated',
  cover_letter: 'Cover letter generated',
  questionnaire_answer: 'Questionnaire answer generated',
  linkedin_message: 'LinkedIn message generated',
  follow_up: 'Follow-up message generated',
  interview_questions: 'Interview questions generated',
  interview_answers: 'Interview answers generated',
  company_research: 'Company research generated',
  custom: 'Custom artifact generated',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function estimateCostUsd(
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

function isArtifactType(value: unknown): value is ArtifactType {
  return (
    typeof value === 'string' &&
    (ARTIFACT_TYPES as readonly string[]).includes(value)
  );
}

function buildContext(sections: Record<string, string>): string {
  return Object.entries(sections)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}\n${v.trim()}`)
    .join('\n\n');
}

function contentFromResult(type: ArtifactType, result: Record<string, unknown>): string {
  switch (type) {
    case 'cv_summary':
      return String(result.summary ?? '');
    case 'cover_letter':
      return String(result.content ?? '');
    case 'questionnaire_answer':
    case 'interview_answers':
      return String(result.answer ?? '');
    case 'linkedin_message':
    case 'follow_up':
      return String(result.message ?? '');
    case 'custom':
      return String(result.content ?? '');
    case 'company_research':
      return String(result.company_summary ?? '');
    case 'cv_recommendations':
    case 'interview_questions':
      return JSON.stringify(result);
    default:
      return JSON.stringify(result);
  }
}

async function callOpenAi(args: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  artifactType: ArtifactType;
  repairHint?: string;
}): Promise<{
  parsed: unknown;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  duration_ms: number;
}> {
  const messages = [
    { role: 'system', content: args.system },
    { role: 'user', content: args.user },
  ];
  if (args.repairHint) {
    messages.push({
      role: 'user',
      content: `Previous output failed validation: ${args.repairHint}. Return corrected JSON only.`,
    });
  }

  const started = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.3,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: `artifact_${args.artifactType}`,
          strict: true,
          schema: jsonSchemas[args.artifactType],
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let providerCode = 'unknown';
    try {
      const parsedErr = JSON.parse(errText) as {
        error?: { code?: string; type?: string };
      };
      providerCode = parsedErr.error?.code ?? parsedErr.error?.type ?? 'unknown';
    } catch {
      providerCode = 'unparseable';
    }
    console.error('openai_error', { status: res.status, code: providerCode });
    const err = new Error(`openai_${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('empty_response');
  }
  const usage = json.usage ?? {};
  return {
    parsed: JSON.parse(content),
    usage: {
      prompt_tokens: Number(usage.prompt_tokens ?? 0),
      completion_tokens: Number(usage.completion_tokens ?? 0),
      total_tokens: Number(
        usage.total_tokens ??
          Number(usage.prompt_tokens ?? 0) + Number(usage.completion_tokens ?? 0),
      ),
    },
    duration_ms: Date.now() - started,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!openaiKey) {
      return jsonResponse(
        { error: 'AI generation is not configured.' },
        503,
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Supabase environment is incomplete.' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const body = await req.json().catch(() => null);
    const applicationId =
      typeof body?.applicationId === 'string' ? body.applicationId : null;
    const artifactType = body?.artifactType;
    const question =
      typeof body?.question === 'string' ? body.question.trim() : '';
    const userNotes =
      typeof body?.userNotes === 'string' ? body.userNotes.trim() : '';
    const userInstruction =
      typeof body?.userInstruction === 'string'
        ? body.userInstruction.trim()
        : '';
    const contactName =
      typeof body?.contactName === 'string' ? body.contactName.trim() : '';
    const contactRole =
      typeof body?.contactRole === 'string' ? body.contactRole.trim() : '';
    const daysSince =
      typeof body?.daysSinceApplication === 'number'
        ? body.daysSinceApplication
        : null;
    const preferredLength =
      typeof body?.preferredLength === 'string'
        ? body.preferredLength.trim()
        : '';

    if (!applicationId) {
      return jsonResponse({ error: 'applicationId is required.' }, 400);
    }
    if (!isArtifactType(artifactType)) {
      return jsonResponse({ error: 'Invalid artifactType.' }, 400);
    }

    if (
      (artifactType === 'questionnaire_answer' ||
        artifactType === 'interview_answers') &&
      question.length < 8
    ) {
      return jsonResponse(
        { error: 'Please provide a clear question (at least a few words).' },
        400,
      );
    }
    if (artifactType === 'custom' && userInstruction.length < 8) {
      return jsonResponse(
        { error: 'Please provide a custom instruction.' },
        400,
      );
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError) {
      console.error('app_fetch_error', appError.message);
      return jsonResponse({ error: 'Unable to load application.' }, 500);
    }
    if (!application) {
      return jsonResponse({ error: 'Application not found.' }, 404);
    }
    if (application.user_id !== user.id) {
      return jsonResponse(
        { error: 'You do not have access to this application.' },
        403,
      );
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', application.job_id)
      .maybeSingle();

    if (jobError || !job) {
      return jsonResponse({ error: 'Linked job not found.' }, 404);
    }
    if (job.user_id !== user.id) {
      return jsonResponse({ error: 'You do not have access to this job.' }, 403);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const profileSignal = [
      profile?.master_cv_text,
      profile?.portfolio_summary,
      profile?.headline,
      profile?.full_name,
    ]
      .filter((v) => typeof v === 'string')
      .join(' ')
      .trim();

    if (profileSignal.length < MIN_PROFILE_SIGNAL_CHARS) {
      return jsonResponse(
        {
          error:
            'Add more profile/CV context in Settings before generating artifacts.',
        },
        400,
      );
    }

    let company: Record<string, unknown> | null = null;
    if (job.company_id) {
      const { data: companyRow } = await supabase
        .from('companies')
        .select('*')
        .eq('id', job.company_id)
        .maybeSingle();
      company = companyRow;
    }

    const { data: analysis } = await supabase
      .from('job_analysis')
      .select('*')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: recent } = await supabase
      .from('application_artifacts')
      .select('id, created_at, version')
      .eq('application_id', applicationId)
      .eq('artifact_type', artifactType)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.created_at) {
      const ageMs = Date.now() - new Date(recent.created_at).getTime();
      if (ageMs < RATE_LIMIT_SECONDS * 1000) {
        return jsonResponse(
          {
            error: `Please wait ${RATE_LIMIT_SECONDS} seconds before regenerating this artifact.`,
          },
          429,
        );
      }
    }

    const nextVersion = (recent?.version ?? 0) + 1;

    const targetRoles = Array.isArray(profile?.target_roles)
      ? (profile!.target_roles as string[]).join(', ')
      : 'Not provided';

    const analysisBlock = analysis
      ? [
          `Overall score: ${analysis.overall_match_score}`,
          `Recommendation: ${analysis.recommendation}`,
          `Summary: ${analysis.reasoning_summary ?? 'N/A'}`,
          `Strengths: ${JSON.stringify(analysis.strengths)}`,
          `Gaps: ${JSON.stringify(analysis.gaps)}`,
          `Risks: ${JSON.stringify(analysis.risks)}`,
          `Metadata extras: ${JSON.stringify({
            cv_focus: (analysis.metadata as Record<string, unknown>)?.cv_focus,
            interview_focus: (analysis.metadata as Record<string, unknown>)
              ?.interview_focus,
            recommendation_reason: (analysis.metadata as Record<string, unknown>)
              ?.recommendation_reason,
          })}`,
        ].join('\n')
      : 'No job analysis available yet.';

    const companyBlock = company
      ? [
          `Name: ${company.name ?? job.company_name_snapshot}`,
          `Website: ${company.website ?? 'Not provided'}`,
          `Industry: ${company.industry ?? 'Not provided'}`,
          `Location: ${company.location ?? 'Not provided'}`,
          `Notes: ${company.notes ?? 'Not provided'}`,
        ].join('\n')
      : `Name snapshot: ${job.company_name_snapshot}\nNo additional company record.`;

    const userInputParts: string[] = [];
    if (question) userInputParts.push(`Question: ${question}`);
    if (userNotes) userInputParts.push(`Notes: ${userNotes}`);
    if (userInstruction) userInputParts.push(`Instruction: ${userInstruction}`);
    if (contactName) userInputParts.push(`Contact name: ${contactName}`);
    if (contactRole) userInputParts.push(`Contact role: ${contactRole}`);
    if (daysSince != null) {
      userInputParts.push(`Days since application: ${daysSince}`);
    }
    if (preferredLength) {
      userInputParts.push(`Preferred length: ${preferredLength}`);
    }
    userInputParts.push(`Application stage: ${application.stage}`);

    const userPayload = buildContext({
      'CANDIDATE PROFILE': [
        `Full name: ${profile?.full_name ?? 'Not provided'}`,
        `Headline: ${profile?.headline ?? 'Not provided'}`,
        `Location: ${profile?.location ?? 'Not provided'}`,
        `Target roles: ${targetRoles}`,
        `Salary minimum: ${profile?.salary_min ?? 'Not provided'} ${profile?.salary_currency ?? ''}`,
        `Remote preference: ${profile?.remote_preference ?? 'Not provided'}`,
      ].join('\n'),
      'MASTER CV':
        typeof profile?.master_cv_text === 'string' &&
        profile.master_cv_text.trim()
          ? profile.master_cv_text.trim()
          : 'Not provided',
      PORTFOLIO:
        typeof profile?.portfolio_summary === 'string' &&
        profile.portfolio_summary.trim()
          ? profile.portfolio_summary.trim()
          : 'Not provided',
      JOB: [
        `Title: ${job.job_title}`,
        `Company: ${job.company_name_snapshot}`,
        `Location: ${job.location ?? 'Not provided'}`,
        `Remote scope: ${job.remote_scope}`,
        `Employment: ${job.employment_type}`,
        `Salary: ${job.salary_min ?? '?'}–${job.salary_max ?? '?'} ${job.salary_currency}`,
        `Description:\n${String(job.job_description ?? '').trim() || 'Not provided'}`,
      ].join('\n'),
      'LATEST JOB ANALYSIS': analysisBlock,
      APPLICATION: [
        `Stage: ${application.stage}`,
        `Application date: ${application.application_date}`,
        `Notes: ${application.notes ?? 'None'}`,
        `Existing cover letter draft: ${application.cover_letter ?? 'None'}`,
        `Salary expectation: ${application.salary_expectation ?? 'Not set'} ${application.salary_currency}`,
      ].join('\n'),
      COMPANY: companyBlock,
      'USER INPUT': userInputParts.join('\n') || 'None',
    });

    const systemPrompt = `${BASE_SYSTEM}\n\n${TYPE_INSTRUCTIONS[artifactType]}`;
    const model = DEFAULT_MODEL;

    let openaiResult: Awaited<ReturnType<typeof callOpenAi>>;
    try {
      openaiResult = await callOpenAi({
        apiKey: openaiKey,
        model,
        system: systemPrompt,
        user: userPayload,
        artifactType,
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        return jsonResponse(
          {
            error:
              'AI provider authentication failed. Check OPENAI_API_KEY secret.',
          },
          502,
        );
      }
      if (status === 429) {
        return jsonResponse(
          {
            error: 'AI provider rate limit reached. Please try again shortly.',
          },
          502,
        );
      }
      return jsonResponse(
        { error: 'AI provider failed. Please try again shortly.' },
        502,
      );
    }

    let validated = schemas[artifactType].safeParse(openaiResult.parsed);
    if (!validated.success) {
      try {
        openaiResult = await callOpenAi({
          apiKey: openaiKey,
          model,
          system: systemPrompt,
          user: userPayload,
          artifactType,
          repairHint: validated.error.message.slice(0, 400),
        });
        validated = schemas[artifactType].safeParse(openaiResult.parsed);
      } catch {
        return jsonResponse(
          { error: 'AI response failed validation and was not saved.' },
          502,
        );
      }
    }

    if (!validated.success) {
      console.error('schema_error', validated.error.message);
      await recordAiGeneration(supabase, {
        userId: user.id,
        feature: artifactTypeToFeature(artifactType),
        model,
        promptVersion: ARTIFACT_VERSION,
        status: 'validation_failed',
        latencyMs: openaiResult.duration_ms,
        errorCode: 'schema_validation',
        errorMessage: 'AI response failed validation',
        metadata: { application_id: applicationId, artifact_type: artifactType },
      });
      return jsonResponse(
        { error: 'AI response failed validation and was not saved.' },
        502,
      );
    }

    const result = validated.data as Record<string, unknown>;
    const content = contentFromResult(artifactType, result).trim();
    if (!content) {
      return jsonResponse(
        { error: 'AI returned empty content and was not saved.' },
        502,
      );
    }

    const metadata = {
      provider: 'openai',
      model,
      artifact_version: ARTIFACT_VERSION,
      duration_ms: openaiResult.duration_ms,
      usage: openaiResult.usage,
      estimated_cost_usd: estimateCostUsd(
        model,
        openaiResult.usage.prompt_tokens,
        openaiResult.usage.completion_tokens,
      ),
      result,
      question: question || undefined,
      user_notes: userNotes || undefined,
      user_instruction: userInstruction || undefined,
      contact_name: contactName || undefined,
      contact_role: contactRole || undefined,
      days_since_application: daysSince ?? undefined,
      stage: application.stage,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('application_artifacts')
      .insert({
        user_id: user.id,
        application_id: applicationId,
        artifact_type: artifactType,
        content,
        version: nextVersion,
        metadata,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('insert_error', insertError.message);
      return jsonResponse({ error: 'Failed to save artifact.' }, 500);
    }

    await supabase.from('activities').insert({
      user_id: user.id,
      entity_type: 'application_artifact',
      entity_id: inserted.id,
      activity_type: 'artifact_created',
      title: ACTIVITY_TITLES[artifactType] ?? 'Artifact generated',
      description: `${job.job_title} · ${artifactType} v${nextVersion}`,
      metadata: {
        application_id: applicationId,
        job_id: job.id,
        artifact_type: artifactType,
        version: nextVersion,
        model,
        duration_ms: openaiResult.duration_ms,
      },
    });

    await recordAiGeneration(supabase, {
      userId: user.id,
      feature: artifactTypeToFeature(artifactType),
      model,
      promptVersion: ARTIFACT_VERSION,
      status: 'success',
      inputTokens: openaiResult.usage.prompt_tokens,
      outputTokens: openaiResult.usage.completion_tokens,
      totalTokens: openaiResult.usage.total_tokens,
      estimatedCostUsd: metadata.estimated_cost_usd,
      latencyMs: openaiResult.duration_ms,
      sourceTable: 'application_artifacts',
      sourceId: inserted.id,
      metadata: {
        application_id: applicationId,
        artifact_type: artifactType,
        artifact_row_version: nextVersion,
      },
    });

    return jsonResponse({
      artifact: inserted,
      meta: {
        duration_ms: openaiResult.duration_ms,
        model,
        usage: openaiResult.usage,
        estimated_cost_usd: metadata.estimated_cost_usd,
      },
    });
  } catch (error) {
    console.error('unhandled', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unexpected server error.' }, 500);
  }
});
