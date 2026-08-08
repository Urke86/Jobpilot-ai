# JobPilot AI — AI Job Analysis (Phase 4A)

## Purpose

Secure, evidence-based fit analysis for a saved job against the authenticated user’s profile, master CV, portfolio, and preferences. Results are versioned in `job_analysis` and shown on Job Detail.

## Architecture

```
Job Detail (Analyze Job)
  → services/app/job-analysis.ts  (requestJobAnalysis)
  → supabase.functions.invoke('analyze-job')
  → Edge Function (Deno)
       · JWT auth (caller’s session)
       · ownership checks (job.user_id === auth.uid())
       · profile load (same user)
       · description length guard
       · 30s re-analyze rate limit
       · OpenAI Chat Completions + structured JSON schema
       · Zod validation
       · INSERT job_analysis (new row; history preserved)
       · activity log + job status analyzing → reviewed
  → UI refresh (latest by created_at desc)
```

Frontend never sees the OpenAI API key. Provider details stay inside the Edge Function.

| Layer | Path |
|-------|------|
| UI | `src/pages/JobDetailPage.tsx` |
| App service | `src/services/app/job-analysis.ts` |
| Shared schema | `src/lib/ai/job-analysis-schema.ts` |
| Shared prompts | `src/lib/ai/prompts.ts` |
| Edge Function | `supabase/functions/analyze-job/` |

## Prompt design

**System prompt** defines evaluator role, anti-hallucination rules, scoring bands, recommendation rules, and structured evidence requirements.

**User payload** is labeled sections (not a single blob):

1. `CANDIDATE PROFILE`
2. `MASTER CV`
3. `PORTFOLIO`
4. `JOB METADATA`
5. `JOB DESCRIPTION`

## Structured output schema

Validated with Zod before persistence:

- Scores (0–100 int): overall, product, technical, AI tools, remote, experience
- `strengths[]`: `{ title, evidence }`
- `gaps[]`: `{ title, evidence, severity }`
- `risks[]`: `{ title, reason }`
- `recommendation`: `apply` | `consider` | `skip`
- `recommendation_reason`, `reasoning_summary`
- `cv_focus[]`, `interview_focus[]` (stored in `metadata` jsonb)

Malformed responses are **not** saved.

## Anti-hallucination rules

- Use only explicit profile / CV / portfolio / saved candidate data
- Never invent tools, years, projects, certifications, salary history, or depth
- Missing evidence → gap phrased as “not demonstrated…”, not “candidate cannot”
- Distinguish absence of evidence from contradiction

## Cost & latency tracking

Stored in `job_analysis.metadata`:

- `provider`, `model`, `analysis_version`
- `duration_ms` (OpenAI round-trip)
- `usage.prompt_tokens` / `completion_tokens` / `total_tokens`
- `estimated_cost_usd` (approx for known models)
- `cv_focus`, `interview_focus`, `recommendation_reason`

## Security model

- OpenAI key only in Supabase Edge secrets (`OPENAI_API_KEY`)
- Optional `OPENAI_ANALYSIS_MODEL` (default `gpt-4o-mini`)
- No service role key in the browser
- Function uses the caller JWT + anon key so RLS still applies
- Ownership re-checked in function code
- Provider errors sanitized for the UI
- Logs avoid dumping full CV / job description

## Evaluation methodology

Dev fixtures live in `docs/eval/job-analysis-cases.md`.

Qualitative expectations:

| Case | Role | Expected |
|------|------|----------|
| A | AI Product Builder | Highest overall; `apply` / strong `consider` |
| B | Technical PM | Mid scores; meaningful gaps; `consider` |
| C | ML Engineer | Lowest; deep tech gaps; lean `skip` / weak `consider` |

Verify: score ordering A > B > C, missing skills as gaps, no invented experience, recommendation aligns with evidence.

## Known limitations

- Single-shot JSON completion (no streaming UI)
- English-centric prompts
- Cost estimates are approximate and model-specific
- Rate limit is per-job last-analysis timestamp (30s), not global quota
- Profile emptiness reduces score quality (by design — evidence-only)
- Artifact generation / assistant / scraping / n8n are out of scope for 4A

## Deploy notes

```bash
# After CLI is logged into the JobPilot account:
supabase secrets set OPENAI_API_KEY=sk-... --project-ref xzzoznhmezmaarcvavpr
supabase functions deploy analyze-job --project-ref xzzoznhmezmaarcvavpr
```

Apply migration `20260807130532_job_analysis_metadata.sql` before first successful save with metadata.
