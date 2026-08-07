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
- Job analysis UI reads `job_analysis` (empty state until Phase 4 AI)
- Application artifacts list (empty until content exists / Phase 4)

### Ownership

All inserts set `user_id` from `auth.getUser()` in services. RLS remains the enforcement layer.

### Mock data

`src/data/mock.ts` and `src/services/mock/ui-adapters.ts` are **not imported by pages**. Kept only as historical fixtures.

### Auth config note

Project auth `mailer_autoconfirm` was enabled for MVP local testing. Revisit before production launch.

### Validation

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run build` — pass

### Phase 4 recommendations

1. OpenAI job analysis + artifact generation behind the existing services
2. Streaming assistant replacing canned chat
3. Optional n8n ingestion writing into `jobs` via service role (server-side only)
4. Harden email confirmation / password reset flows
5. Add Vitest coverage for auth + ownership helpers
