# JobPilot AI — Architecture

## Purpose

JobPilot AI is an AI-powered job search and application platform. UI design from the Bolt scaffold is preserved. Architecture Phases 1–2 establish a scalable frontend and Postgres schema with RLS.

## Stack

| Layer | Technology |
|-------|------------|
| UI | React 18, TypeScript, Tailwind, shadcn/ui |
| Routing | React Router 7 |
| Backend | Supabase (PostgreSQL) — schema + RLS ready |
| AI (planned) | OpenAI |
| Automation (planned) | n8n |

## Directory structure

```
src/
  components/
    common/          # ErrorBoundary, EmptyState, LoadingState, skeletons
    ui/              # shadcn primitives
  pages/             # Route-level screens
  layouts/           # App shell
  hooks/
  services/
    mock/            # Active UI adapters (preserve current screens)
    supabase/        # Typed repositories (ready for Phase 3)
    contracts.ts     # Repository interfaces over DB types
  lib/
    env.ts
    supabase/        # Typed createClient<Database>
  utils/
  data/              # Mock fixtures (temporary)
  types/
    index.ts         # UI domain types
    database.ts      # Generated / schema-aligned Supabase types
  constants/
  contexts/
  providers/

supabase/
  migrations/        # Source of truth for schema + RLS
  seed.dev.sql       # Optional commented seed examples
```

## Data flow

```
Page → useResource → services/mock (today)
                   → services/supabase/* (Phase 3, after Auth)

Database access never happens inside pages.
```

## Database

See [DATABASE.md](./DATABASE.md) for tables, enums, indexes, RLS, and migrations.

Summary: multi-user ownership via `user_id`, eight core tables, mandatory RLS, typed client.

## Routing

Canonical paths live in `src/constants/routes.ts` (`ROUTES`).

| Path | Page |
|------|------|
| `/dashboard` | Dashboard |
| `/jobs`, `/jobs/:id` | Jobs |
| `/applications`, `/applications/:id` | Applications |
| `/companies`, `/companies/:id` | Companies |
| `/assistant` | AI Assistant |
| `/settings` | Settings |

## Environment

See `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`getSupabaseClient()` returns `null` until both are set.

## Tooling

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run db:types    # regenerate src/types/database.ts from linked project
```

## Phase status

| Phase | Status |
|-------|--------|
| 1 Architecture foundation | Done |
| 2 Database / migrations / RLS / types | Done (apply migrations to remote when CLI auth is on JobPilot account) |
| 3 Auth & CRUD | Not started — needs approval |
| 4 AI / n8n | Not started |

## Explicit non-goals (current)

- UI redesign
- Auth screens
- OpenAI / scraping / n8n
- Wiring pages directly to Supabase CRUD
