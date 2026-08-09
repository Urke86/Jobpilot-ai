# Implementation notes

## Phase 1–2

See earlier notes for architecture foundation and database schema.

## Phase 3 — Auth & CRUD

### What shipped

- Email/password auth with session persistence and protected routes
- Profile ensure-on-signup (no overwrite) + Settings profile persistence
- Real CRUD for companies, contacts, jobs, applications
- Dashboard aggregates from live user data
- Activity logging for meaningful actions
- Job analysis UI reads `job_analysis` (empty until AI runs)
- Application artifacts list (empty until content exists / Phase 4B)

### Ownership

All inserts set `user_id` from `auth.getUser()` in services. RLS remains the enforcement layer.

### Mock data

`src/data/mock.ts` and `src/services/mock/ui-adapters.ts` are **not imported by pages**. Kept only as historical fixtures.

### Auth config note

Project auth `mailer_autoconfirm` was enabled for MVP local testing. Revisit before production launch.

### Validation (Phase 3)

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run build` — pass

## Phase 4A — AI Job Analysis Engine

### What shipped (code)

- Edge Function `supabase/functions/analyze-job` (OpenAI structured output + Zod)
- Frontend facade `requestJobAnalysis` (no provider details in UI)
- Job Detail states: empty / analyzing / completed / failed + Re-analyze
- Shared schema/prompts under `src/lib/ai/`
- Migration adding `job_analysis.metadata` for cost/latency/model/cv_focus
- Docs: `docs/AI_ANALYSIS.md`, eval cases in `docs/eval/job-analysis-cases.md`

### Deploy checklist

1. ~~Apply `job_analysis.metadata` migration~~ (done remotely + migration history)
2. ~~CLI auth via `.env.local` `SUPABASE_ACCESS_TOKEN`~~ (`npm run supabase -- …`)
3. ~~`OPENAI_API_KEY` secret~~ (set in Supabase dashboard by operator; never in repo)
4. ~~`functions deploy analyze-job`~~ (ACTIVE; redeployed for safer provider error mapping)
5. ~~E2E guards + live analyze~~ (2026-08-08: pass after OpenAI credits). Optional: still run eval cases B/C when convenient.

### Boundaries (explicit)

Not in 4A: artifact generation, streaming assistant, n8n, scraping, RAG, multi-agent.

## Phase 4B — Application Artifacts Engine

### What shipped

- Edge Function `generate-artifact` (shared context builder + per-type schemas/prompts)
- Frontend `requestArtifactGeneration` + `ArtifactToolkit` on Application Detail
- Versioned `application_artifacts` rows with cost/latency metadata
- Activity logging (`artifact_created`)
- Docs: `docs/AI_ARTIFACTS.md`, `docs/eval/artifact-cases.md`

### Boundaries (explicit)

Not in 4B: streaming assistant, n8n, scraping, Gmail/Calendar, RAG, agents, external company web research.

## Phase 4C.1 — Streaming AI Assistant

### What shipped

- Tables `ai_conversations` / `ai_messages` with RLS
- Edge Function `chat-assistant` (SSE streaming + persistence after completion)
- Assistant page: real conversations, context picker, streaming UI, stop/retry/copy
- Bounded context + recent-20 history; rate limit + daily soft cap
- Docs: `docs/AI_ASSISTANT.md`

### Boundaries (explicit)

Not in 4C.1: n8n, scraping, Gmail/Calendar, RAG, embeddings, agents.

### Phase 4C.2 recommendations

1. Optional n8n job ingestion (service role, server-side only)
2. Conversation summarization for long threads
3. Deeper interview practice mode
4. Global AI spend dashboards
5. Vitest for assistant streaming client + ownership helpers
6. Harden email confirmation / password reset

## Phase 4C.2 — n8n Job Ingestion

### What shipped

- `jobs.ingestion_metadata` jsonb + indexes
- Edge Function `ingest-job` (JWT or `INGESTION_SECRET` + `target_user_id`)
- Normalize / validate / URL+title dedupe / company match / activity log
- Optional `auto_analyze` → `analyze-job` (automation auth extended)
- Import Jobs UI at `/jobs/import`
- n8n exports in `automation/n8n/`
- Docs: `docs/N8N_AUTOMATION.md`

### Boundaries (explicit)

Not in 4C.2: LinkedIn/Indeed scraping, browser automation, Gmail/Calendar, RAG, embeddings, agents.

### Next phase recommendations

1. Additional public RSS/API source adapters in n8n
2. Conversation summarization for long assistant threads
3. Gmail / Calendar integrations (explicit approval)
4. Global AI spend dashboards
5. Vitest for ingest normalize/dedupe helpers
6. Harden email confirmation / password reset

## Phase 4D — Gmail + Google Calendar

### What shipped

- `user_integrations` (AES-GCM encrypted Google tokens), `job_emails`, `application_events`
- `profiles.timezone`
- Edge: `google-oauth-start`, `google-oauth-callback`, `google-disconnect`, `gmail-sync`, `hiring-email-action`
- Settings → Integrations (connect/disconnect/status)
- Hiring Inbox UI with human-approved stage + calendar flows
- Docs: `docs/GOOGLE_INTEGRATION.md`

### Boundaries (explicit)

Not in 4D: auto-send email, auto-accept interviews, auto calendar without confirm, LinkedIn automation, browser automation, RAG, agents.

### Phase 4E recommendations

1. Optional draft-only Gmail compose helpers (still no auto-send) if product needs it
2. Retention / purge policy for `job_emails`
3. Conversation summarization for long assistant threads
4. Global AI spend dashboards
5. Vitest for classify schema + OAuth state helpers
6. Harden email confirmation / password reset
