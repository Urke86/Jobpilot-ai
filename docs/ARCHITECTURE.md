# JobPilot AI — Architecture

## Purpose

JobPilot AI helps users discover jobs, track applications, manage companies/contacts, and (later) run AI-assisted analysis. Phases 1–3 deliver architecture, schema/RLS, and authenticated Supabase CRUD while preserving the Bolt UI language.

## Stack

| Layer | Technology |
|-------|------------|
| UI | React 18, TypeScript, Tailwind, shadcn/ui |
| Routing | React Router 7 |
| Backend | Supabase Auth + PostgreSQL (RLS) |
| AI | OpenAI via Edge Functions `analyze-job`, `generate-artifact`, `chat-assistant` |
| Automation | n8n → Edge Function `ingest-job` (secret + target user) |

## Directory highlights

```
src/
  components/auth/     ProtectedRoute, PublicOnlyRoute
  components/jobs/     JobFormDialog
  contexts/            Theme + Auth
  lib/ai/              Shared analysis schema + prompts
  services/
    auth.ts            Sign in/up/out + profile ensure
    app/               Real CRUD facades (pages use these)
    supabase/          Low-level typed repositories
    mock/              Unused by pages (legacy reference)
  types/database.ts    Generated Supabase types
supabase/functions/
  analyze-job/         Server-side OpenAI job analysis
  generate-artifact/   Server-side application artifact generation
  chat-assistant/      Streaming contextual AI assistant
  ingest-job/          n8n / manual job ingestion + dedupe
automation/n8n/        Exported n8n workflow JSON (no secrets)
```

## Data flow

```
Page → @/services/app → requireUserId + Supabase client → Postgres (RLS)
Job Detail Analyze → requestJobAnalysis → analyze-job → job_analysis insert
Application Detail Toolkit → requestArtifactGeneration → generate-artifact → application_artifacts insert
Assistant → streamAssistantMessage → chat-assistant (SSE) → ai_messages insert
n8n / Import UI → ingest-job → jobs + companies + activities (+ optional analyze-job)
```

See [AUTH_AND_DATA_FLOW.md](./AUTH_AND_DATA_FLOW.md), [DATABASE.md](./DATABASE.md), [AI_ANALYSIS.md](./AI_ANALYSIS.md), [AI_ARTIFACTS.md](./AI_ARTIFACTS.md), [AI_ASSISTANT.md](./AI_ASSISTANT.md), and [N8N_AUTOMATION.md](./N8N_AUTOMATION.md).

## Phase status

| Phase | Status |
|-------|--------|
| 1 Architecture | Done |
| 2 Database / RLS / types | Done |
| 3 Auth + real CRUD | Done |
| 4A AI job analysis | Done |
| 4B Application artifacts | Done |
| 4C.1 Streaming assistant | Done |
| 4C.2 n8n job ingestion | Done |
| 4C.3+ Gmail / Calendar / RAG / agents | Not started |

## Environment

Copy `.env.example` → `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never put the service role key or OpenAI API key in the frontend.

Edge secrets (Dashboard → Edge Functions → Secrets, or CLI):

- `OPENAI_API_KEY`
- optional `OPENAI_ANALYSIS_MODEL` (default `gpt-4o-mini`)
- `INGESTION_SECRET` (n8n ↔ ingest-job / analyze-job automation)
- optional `INGESTION_ALLOWED_USER_IDS`
- optional `AUTO_ANALYZE_INGESTED_JOBS` (default false)
