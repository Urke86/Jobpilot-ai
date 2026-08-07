# Phase 2 implementation notes

## Delivered

- SQL migrations for enums, 8 tables, indexes, triggers, RLS
- Schema-aligned `src/types/database.ts` + typed client
- Repository contracts + `src/services/supabase/*` implementations
- Mock UI adapters unchanged for pages
- Docs: `docs/DATABASE.md`, updated `docs/ARCHITECTURE.md`

## Remote apply status

Docker is not available on this machine, so local `supabase start` cannot run.

CLI must be authenticated to the **JobPilot AI** org/account (`xzzoznhmezmaarcvavpr`) before:

```bash
npm run db:push
npm run db:types
```

If direct link hits IPv6 errors, use the Dashboard session pooler connection string with `--db-url`.

Fallback: paste `supabase/scripts/combined_for_dashboard.sql` into the project SQL Editor (then mark migrations as applied with `supabase migration repair` if needed).

## Decisions

1. **profiles** keeps both `id` and unique `user_id` (per product spec), not the single-column `id = auth.uid()` shortcut.
2. **One application per user/job** via `UNIQUE (user_id, job_id)`.
3. **Job URL uniqueness** is partial (only when `job_url IS NOT NULL`).
4. **UI domain types** (`src/types/index.ts`) remain separate from DB types until Phase 3 mappers.
5. **Seed** is commented-only — inserting rows requires `auth.users` (Phase 3).

## Before Phase 3

1. Confirm migrations applied on remote JobPilot project.
2. Regenerate types with `npm run db:types` and diff against `src/types/database.ts`.
3. Add `.env.local` with URL + anon key.
4. Explicit approval to start Auth & CRUD.
