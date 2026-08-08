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
| Automation (planned) | n8n |

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
```

## Data flow

```
Page → @/services/app → requireUserId + Supabase client → Postgres (RLS)
Job Detail Analyze → requestJobAnalysis → analyze-job → job_analysis insert
Application Detail Toolkit → requestArtifactGeneration → generate-artifact → application_artifacts insert
Assistant → streamAssistantMessage → chat-assistant (SSE) → ai_messages insert
```

See [AUTH_AND_DATA_FLOW.md](./AUTH_AND_DATA_FLOW.md), [DATABASE.md](./DATABASE.md), [AI_ANALYSIS.md](./AI_ANALYSIS.md), and [AI_ARTIFACTS.md](./AI_ARTIFACTS.md).

## Phase status

| Phase | Status |
|-------|--------|
| 1 Architecture | Done |
| 2 Database / RLS / types | Done |
| 3 Auth + real CRUD | Done |
| 4A AI job analysis | Done |
| 4B Application artifacts | Done |
| 4C.1 Streaming assistant | Done |
| 4C.2+ n8n / scraping / integrations | Not started |

## Environment

Copy `.env.example` → `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never put the service role key or OpenAI API key in the frontend.

Edge secrets (Dashboard → Edge Functions → Secrets, or CLI):

- `OPENAI_API_KEY`
- optional `OPENAI_ANALYSIS_MODEL` (default `gpt-4o-mini`)

