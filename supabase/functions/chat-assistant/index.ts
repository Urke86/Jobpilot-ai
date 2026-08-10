import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { recordAiGeneration } from '../_shared/ai-observability.ts';
import { corsHeadersFor } from '../_shared/cors.ts';
import { fetchWithTimeout, OPENAI_TIMEOUT_MS } from '../_shared/fetch-timeout.ts';
import { tryAcquireRateLimit } from '../_shared/rate-limit.ts';

const DEFAULT_MODEL = Deno.env.get('OPENAI_ANALYSIS_MODEL') ?? 'gpt-4o-mini';
const GENERATION_VERSION = 'v1-assistant';
const RECENT_MESSAGE_LIMIT = 20;
const MAX_OUTPUT_TOKENS = 1200;
const CONTEXT_CHAR_BUDGET = 14000;
const RATE_LIMIT_SECONDS = 3;
const DAILY_SOFT_CAP = Number(Deno.env.get('ASSISTANT_DAILY_MESSAGE_CAP') ?? '80');

const SYSTEM_PROMPT = `You are JobPilot AI Assistant — a job-search and application copilot.

ROLE
- Help the user analyze jobs, understand fit/gaps, prepare applications, improve CV positioning, draft questionnaire answers, and prepare for interviews.
- Be concise unless the user asks for depth.
- Prefer actionable recommendations grounded in available context.

ANTI-FABRICATION (MANDATORY)
- NEVER invent candidate experience, skills, years, projects, achievements, certifications, metrics, technologies, or domain depth.
- Use ONLY information present in the provided JobPilot context sections (profile, CV, portfolio, job, analysis, application, artifacts).
- Distinguish demonstrated experience from gaps. If evidence is missing, say so explicitly.
- Never silently convert lack of evidence into positive experience.
- Do not invent company facts beyond the provided context.

PRODUCT BOUNDARIES
- When a structured artifact would be better (CV recommendations, cover letter, questionnaire answer, interview Q&A), recommend using the Application Detail AI Application Toolkit rather than inventing a parallel long-form artifact here.
- You may still give short drafts and guidance in chat.

STYLE
- Professional, direct, helpful.
- Use short sections or bullets when useful.
- Label assumptions clearly.`;

function createJsonResponse(req: Request) {
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
    });
}

function sseHeaders(req?: Request) {
  return {
    ...corsHeadersFor(req),
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
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

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

function buildLabeled(sections: Record<string, string>): string {
  let remaining = CONTEXT_CHAR_BUDGET;
  const parts: string[] = [];
  for (const [label, value] of Object.entries(sections)) {
    if (!value?.trim() || remaining <= 0) continue;
    const block = `${label}\n${clip(value.trim(), remaining)}`;
    parts.push(block);
    remaining -= block.length + 2;
  }
  return parts.join('\n\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }

  const jsonResponse = createJsonResponse(req);

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!openaiKey) {
      return jsonResponse({ error: 'AI assistant is not configured.' }, 503);
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
    const conversationId =
      typeof body?.conversationId === 'string' ? body.conversationId : null;
    const message =
      typeof body?.message === 'string' ? body.message.trim() : '';

    if (!conversationId) {
      return jsonResponse({ error: 'conversationId is required.' }, 400);
    }
    if (message.length < 1) {
      return jsonResponse({ error: 'Message is required.' }, 400);
    }
    if (message.length > 8000) {
      return jsonResponse({ error: 'Message is too long.' }, 400);
    }

    const { data: conversation, error: convError } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (convError) {
      console.error('conv_fetch_error', convError.message);
      return jsonResponse({ error: 'Unable to load conversation.' }, 500);
    }
    if (!conversation) {
      return jsonResponse({ error: 'Conversation not found.' }, 404);
    }
    if (conversation.user_id !== user.id) {
      return jsonResponse(
        { error: 'You do not have access to this conversation.' },
        403,
      );
    }

    // Block concurrent generation: latest message is still an unanswered user turn
    const { data: latestMsg } = await supabase
      .from('ai_messages')
      .select('role, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestMsg?.role === 'user') {
      const ageMs = Date.now() - new Date(latestMsg.created_at).getTime();
      if (ageMs < 90_000) {
        return jsonResponse(
          {
            error:
              'A response is already being generated for this conversation. Please wait.',
          },
          429,
        );
      }
    }

    // Rate limit between completed turns
    if (latestMsg?.role === 'assistant' && latestMsg.created_at) {
      const ageMs = Date.now() - new Date(latestMsg.created_at).getTime();
      if (ageMs < RATE_LIMIT_SECONDS * 1000) {
        return jsonResponse(
          {
            error: `Please wait ${RATE_LIMIT_SECONDS} seconds before sending another message.`,
          },
          429,
        );
      }
    }

    // Atomic lease — blocks concurrent + rapid duplicate turns
    const leaseOk = await tryAcquireRateLimit(
      supabase,
      `chat-assistant:${conversationId}`,
      Math.max(RATE_LIMIT_SECONDS, 3),
    );
    if (!leaseOk) {
      return jsonResponse(
        {
          error:
            'Please wait a moment before sending another message.',
        },
        429,
      );
    }

    // Soft daily cap (assistant messages today)
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count: dayCount } = await supabase
      .from('ai_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'assistant')
      .gte('created_at', dayStart.toISOString());

    if ((dayCount ?? 0) >= DAILY_SOFT_CAP) {
      return jsonResponse(
        {
          error:
            'Daily assistant usage limit reached. Try again tomorrow or raise ASSISTANT_DAILY_MESSAGE_CAP.',
        },
        429,
      );
    }

    // Persist user message first
    const { data: userMessage, error: userMsgError } = await supabase
      .from('ai_messages')
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        role: 'user',
        content: message,
        metadata: {},
      })
      .select('*')
      .single();

    if (userMsgError || !userMessage) {
      console.error('user_msg_insert', userMsgError?.message);
      return jsonResponse({ error: 'Failed to save message.' }, 500);
    }

    // Auto-title from first user message
    if (
      conversation.title === 'New conversation' ||
      !conversation.title?.trim()
    ) {
      const title = message.slice(0, 60).trim() || 'New conversation';
      await supabase
        .from('ai_conversations')
        .update({ title })
        .eq('id', conversationId);
    }

    // Load profile + history in parallel (independent reads).
    const profilePromise = supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    const historyPromise = supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(RECENT_MESSAGE_LIMIT);

    const [{ data: profile }, { data: history }] = await Promise.all([
      profilePromise,
      historyPromise,
    ]);

    const sections: Record<string, string> = {
      'CANDIDATE PROFILE': [
        `Full name: ${profile?.full_name ?? 'Not provided'}`,
        `Headline: ${profile?.headline ?? 'Not provided'}`,
        `Location: ${profile?.location ?? 'Not provided'}`,
        `Target roles: ${
          Array.isArray(profile?.target_roles)
            ? (profile!.target_roles as string[]).join(', ')
            : 'Not provided'
        }`,
        `Remote preference: ${profile?.remote_preference ?? 'Not provided'}`,
        `Salary minimum: ${profile?.salary_min ?? 'Not provided'} ${profile?.salary_currency ?? ''}`,
      ].join('\n'),
      'MASTER CV':
        typeof profile?.master_cv_text === 'string' && profile.master_cv_text.trim()
          ? profile.master_cv_text.trim()
          : 'Not provided',
      PORTFOLIO:
        typeof profile?.portfolio_summary === 'string' &&
        profile.portfolio_summary.trim()
          ? profile.portfolio_summary.trim()
          : 'Not provided',
    };

    // Job / application context
    let jobId: string | null = conversation.context_job_id ?? null;
    let applicationId: string | null =
      conversation.context_application_id ?? null;

    if (conversation.context_type === 'application' && applicationId) {
      const { data: application } = await supabase
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .maybeSingle();
      if (application && application.user_id === user.id) {
        jobId = application.job_id;
        sections['APPLICATION'] = [
          `Stage: ${application.stage}`,
          `Application date: ${application.application_date}`,
          `Notes: ${application.notes ?? 'None'}`,
          `Salary expectation: ${application.salary_expectation ?? 'Not set'}`,
        ].join('\n');

        const { data: artifacts } = await supabase
          .from('application_artifacts')
          .select('artifact_type, version, content, created_at')
          .eq('application_id', applicationId)
          .order('created_at', { ascending: false })
          .limit(6);

        if (artifacts?.length) {
          sections['RECENT ARTIFACTS'] = artifacts
            .map(
              (a) =>
                `${a.artifact_type} v${a.version}: ${clip(String(a.content), 400)}`,
            )
            .join('\n\n');
        }
      } else {
        applicationId = null;
      }
    }

    if (
      (conversation.context_type === 'job' ||
        conversation.context_type === 'application') &&
      jobId
    ) {
      const { data: job } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();
      if (job && job.user_id === user.id) {
        sections['JOB'] = [
          `Title: ${job.job_title}`,
          `Company: ${job.company_name_snapshot}`,
          `Location: ${job.location ?? 'Not provided'}`,
          `Remote: ${job.remote_scope}`,
          `Employment: ${job.employment_type}`,
          `Description:\n${String(job.job_description ?? '').trim() || 'Not provided'}`,
        ].join('\n');

        const companyPromise = job.company_id
          ? supabase
              .from('companies')
              .select('*')
              .eq('id', job.company_id)
              .maybeSingle()
          : Promise.resolve({ data: null as Record<string, unknown> | null });
        const [{ data: company }, { data: analysis }] = await Promise.all([
          companyPromise,
          supabase
            .from('job_analysis')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (company) {
          sections['COMPANY'] = [
            `Name: ${company.name}`,
            `Website: ${company.website ?? 'Not provided'}`,
            `Industry: ${company.industry ?? 'Not provided'}`,
            `Notes: ${company.notes ?? 'Not provided'}`,
          ].join('\n');
        }
        if (analysis) {
          sections['LATEST JOB ANALYSIS'] = [
            `Overall score: ${analysis.overall_match_score}`,
            `Recommendation: ${analysis.recommendation}`,
            `Summary: ${analysis.reasoning_summary ?? 'N/A'}`,
            `Strengths: ${JSON.stringify(analysis.strengths)}`,
            `Gaps: ${JSON.stringify(analysis.gaps)}`,
            `Risks: ${JSON.stringify(analysis.risks)}`,
          ].join('\n');
        }
      }
    }

    const contextBlock = buildLabeled(sections);

    const recent = (history ?? []).reverse();

    const openaiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'system',
        content: `JOBPILOT CONTEXT\n${contextBlock || 'No extra JobPilot context selected.'}`,
      },
      ...recent.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ];

    const model = DEFAULT_MODEL;
    const started = Date.now();

    const openaiRes = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: MAX_OUTPUT_TOKENS,
          stream: true,
          stream_options: { include_usage: true },
          messages: openaiMessages,
        }),
      },
      OPENAI_TIMEOUT_MS,
    );

    if (!openaiRes.ok || !openaiRes.body) {
      const status = openaiRes.status;
      console.error('openai_error', { status });
      // Roll back the user turn so failed provider calls do not lock the thread.
      await supabase.from('ai_messages').delete().eq('id', userMessage.id);
      if (status === 429) {
        return jsonResponse(
          {
            error: 'AI provider rate limit reached. Please try again shortly.',
          },
          502,
        );
      }
      if (status === 401 || status === 403) {
        return jsonResponse(
          {
            error:
              'AI provider authentication failed. Check OPENAI_API_KEY secret.',
          },
          502,
        );
      }
      return jsonResponse(
        { error: 'AI provider failed. Please try again shortly.' },
        502,
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullText = '';
    let usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        };

        try {
          send({ type: 'user_message', message: userMessage });

          const reader = openaiRes.body!.getReader();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed?.choices?.[0]?.delta?.content;
                if (typeof delta === 'string' && delta.length) {
                  fullText += delta;
                  send({ type: 'token', content: delta });
                }
                if (parsed?.usage) {
                  usage = {
                    prompt_tokens: Number(parsed.usage.prompt_tokens ?? 0),
                    completion_tokens: Number(
                      parsed.usage.completion_tokens ?? 0,
                    ),
                    total_tokens: Number(
                      parsed.usage.total_tokens ??
                        Number(parsed.usage.prompt_tokens ?? 0) +
                          Number(parsed.usage.completion_tokens ?? 0),
                    ),
                  };
                }
              } catch {
                // ignore partial JSON
              }
            }
          }

          const content = fullText.trim();
          if (!content) {
            send({
              type: 'error',
              error: 'AI returned an empty response.',
            });
            controller.close();
            return;
          }

          const durationMs = Date.now() - started;
          const metadata = {
            provider: 'openai',
            model,
            assistant_version: GENERATION_VERSION,
            duration_ms: durationMs,
            usage,
            estimated_cost_usd: estimateCostUsd(
              model,
              usage.prompt_tokens,
              usage.completion_tokens,
            ),
            context_type: conversation.context_type,
            context_job_id: jobId,
            context_application_id: applicationId,
          };

          const { data: assistantMessage, error: insertError } = await supabase
            .from('ai_messages')
            .insert({
              user_id: user.id,
              conversation_id: conversationId,
              role: 'assistant',
              content,
              metadata,
            })
            .select('*')
            .single();

          if (insertError || !assistantMessage) {
            console.error('assistant_insert', insertError?.message);
            await recordAiGeneration(supabase, {
              userId: user.id,
              feature: 'assistant',
              model,
              promptVersion: GENERATION_VERSION,
              status: 'error',
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
              latencyMs: durationMs,
              errorCode: 'persist_failed',
              errorMessage: insertError?.message ?? 'Failed to save',
              metadata: { conversation_id: conversationId },
            });
            send({
              type: 'error',
              error: 'Failed to save assistant response.',
            });
            controller.close();
            return;
          }

          await supabase
            .from('ai_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);

          await recordAiGeneration(supabase, {
            userId: user.id,
            feature: 'assistant',
            model,
            promptVersion: GENERATION_VERSION,
            status: 'success',
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            estimatedCostUsd: metadata.estimated_cost_usd,
            latencyMs: durationMs,
            sourceTable: 'ai_messages',
            sourceId: assistantMessage.id,
            metadata: {
              conversation_id: conversationId,
              context_type: conversation.context_type,
            },
          });

          send({
            type: 'done',
            message: assistantMessage,
            meta: {
              duration_ms: durationMs,
              model,
              usage,
              estimated_cost_usd: metadata.estimated_cost_usd,
            },
          });
          controller.close();
        } catch (err) {
          console.error(
            'stream_error',
            err instanceof Error ? err.message : err,
          );
          await recordAiGeneration(supabase, {
            userId: user.id,
            feature: 'assistant',
            model,
            promptVersion: GENERATION_VERSION,
            status: 'provider_error',
            errorCode: 'stream_error',
            errorMessage:
              err instanceof Error ? err.message : 'Streaming interrupted',
            metadata: { conversation_id: conversationId },
          });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: 'Streaming interrupted. Please try again.',
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: sseHeaders(req) });
  } catch (error) {
    console.error('unhandled', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unexpected server error.' }, 500);
  }
});
