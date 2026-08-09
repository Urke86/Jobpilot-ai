# JobPilot AI — AI Observability (Phase 4E)

## Purpose

Make every AI action measurable: spend, tokens, latency, models, prompt versions, failures, evaluations, and soft regression alerts.

## Schema

| Table | Role |
|-------|------|
| `prompt_versions` | Append-only prompt registry (feature + version unique) |
| `ai_generations` | Central generation log (complements per-feature `metadata`) |
| `ai_evaluations` | 1–5 quality scores + dimension breakdown |
| `ai_observability_alerts` | Soft in-app alerts (no external channels) |

Existing feature tables (`job_analysis`, `application_artifacts`, `ai_messages`, `job_emails`) still store run metadata; Edge Functions also write `ai_generations`.

## Feature taxonomy

`analyze_job`, `assistant`, artifact features (`cv_recommendations`, …), `questionnaire` (maps from `questionnaire_answer`), `gmail_classification`, `custom`.

## Prompt versioning

- Client: `src/lib/ai/prompt-registry.ts`
- DB seed: `prompt_versions` rows
- Each generation stores `prompt_version` + `model`
- Never overwrite historical versions — insert a new version row

## Metrics

- Spend: daily / weekly / monthly / total; by feature; by model; avg / max / cumulative
- Tokens: avg input/output, median total, top consumers
- Latency: avg, median, p95, slowest
- Models: usage count, avg cost, avg latency, success rate
- Failures: validation / provider / rate limit statuses on `ai_generations`

## Evaluation

Dimensions (1–5): factual accuracy, hallucination risk, usefulness, tone, structure, completeness, relevance.

UI: Settings → AI Analytics → Evaluate a generation.

## Regression & alerts

Client computes week-over-week warnings (latency, cost, failure rate, eval decline).

Soft alerts (`refreshSoftAlerts`) for:

- daily spend exceeded
- latency elevated
- failure rate elevated
- cost trend up
- eval score declining

Thresholds: `OBSERVABILITY_THRESHOLDS` in prompt-registry.

No email/Slack/webhook in 4E.

## Dashboard

Settings → **AI Analytics** (`?tab=ai-analytics`)

Cards + Recharts: spend/latency over time, feature/model usage, failures, prompt registry.

## Privacy

- Generation metadata sanitized (no tokens, ciphers, full email bodies, full artifact `result`)
- RLS on all observability tables
- Prompt registry readable by authenticated users; writes via migrations/service

## Instrumentation

Edge helper: `supabase/functions/_shared/ai-observability.ts` → `recordAiGeneration`

Wired into: `analyze-job`, `generate-artifact`, `chat-assistant`, `gmail-sync`.

## Limitations

- Historical rows before 4E are not auto-backfilled
- Soft alerts only (no push notifications)
- Eval is manual (no LLM-as-judge yet)
- Cost estimates use static OpenAI rate cards

## Next (not started)

- Optional LLM-as-judge eval jobs
- Retention policies for `ai_generations`
- Org-level rollups / budgets
- External notification channels
