# JobPilot AI — Architecture

## Purpose

JobPilot AI helps users discover jobs, track applications, manage companies/contacts, and (later) run AI-assisted analysis. Phases 1–3 deliver architecture, schema/RLS, and authenticated Supabase CRUD while preserving the Bolt UI language.

## Stack

| Layer | Technology |
|-------|------------|
| UI | React 18, TypeScript, Tailwind, shadcn/ui |
| Routing | React Router 7 |
| Backend | Supabase Auth + PostgreSQL (RLS) |
| AI (planned) | OpenAI |
| Automation (planned) | n8n |

## Directory highlights

```
src/
  components/auth/     ProtectedRoute, PublicOnlyRoute
  components/jobs/     JobFormDialog
  contexts/            Theme + Auth
  services/
    auth.ts            Sign in/up/out + profile ensure
    app/               Real CRUD facades (pages use these)
    supabase/          Low-level typed repositories
    mock/              Unused by pages (legacy reference)
  types/database.ts    Generated Supabase types
```

## Data flow

```
Page → @/services/app → requireUserId + Supabase client → Postgres (RLS)
```

See [AUTH_AND_DATA_FLOW.md](./AUTH_AND_DATA_FLOW.md) and [DATABASE.md](./DATABASE.md).

## Phase status

| Phase | Status |
|-------|--------|
| 1 Architecture | Done |
| 2 Database / RLS / types | Done |
| 3 Auth + real CRUD | Done |
| 4 AI / n8n | Not started |

## Environment

Copy `.env.example` → `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never put the service role key in the frontend.
