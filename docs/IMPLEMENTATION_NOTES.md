# Implementation notes — Architecture phase

## What changed

1. **Routing bugfixes** — Sidebar now uses `/dashboard` and `/assistant` (previously `/` and `/ai-assistant`, which broke active states and AI navigation).
2. **Shared domain utils** — Status, recommendation, score, and company-color helpers extracted from pages into `src/utils`.
3. **Constants** — `ROUTES`, job/application status labels centralized.
4. **Services layer** — Async read API over mock data; swap target without rewriting pages.
5. **Supabase readiness** — `lib/supabase/client.ts` + `.env.example`; no schema yet.
6. **Providers** — `ThemeProvider` + `ErrorBoundary` + Router in `AppProviders`.
7. **Resilience UI** — Error boundaries, loading/empty/skeleton components.
8. **Tooling** — Prettier, ESLint+Prettier, stricter unused checks, package rename to `jobpilot-ai`.
9. **Cleanup** — Removed empty `App.css`, Bolt OG tags, `lucide-react` optimizeDeps exclusion.

## Known limitations (intentional)

- Mock data still powers the UI; dashboard aggregate numbers do not match the 12 sample jobs.
- AI Assistant and Job Detail AI panels use canned/hardcoded content.
- Header search and notifications are non-functional chrome.
- Many shadcn UI packages remain unused (scaffold inventory).
- `Job.company` is a string, not `companyId` — join-by-name until schema exists.
- Dual visual systems for job status (list solid badges vs dashboard soft badges) preserved on purpose.

## Improvement suggestions (next phases)

### Phase 2 — Supabase foundation
1. Add `.env.local` with project URL + anon key.
2. Design schema: `profiles`, `jobs`, `companies`, `applications`, `activities`.
3. Migrations + RLS; generate TypeScript types into `src/types/database.ts`.
4. Replace mock implementations inside `src/services` only.

### Phase 3 — Auth & persistence
1. Supabase Auth (email/OAuth).
2. Persist Settings preferences per user.
3. Real CRUD for jobs/applications.

### Phase 4 — AI & automation
1. OpenAI for analysis, CV, cover letters, interview prep.
2. n8n for job discovery / enrichment pipelines.
3. Replace canned Assistant responses with streaming chat.

### Engineering hygiene
1. Add Vitest + React Testing Library for services and critical pages.
2. Introduce feature folders (`features/jobs`, …) if pages grow further.
3. Prune unused shadcn components/deps when the feature set stabilizes.
4. Add `companyId` FK and unify status enums across Job vs Application.
5. Wire global command palette (⌘K) and notifications.

## Do not proceed without approval

Stop here until product/engineering sign-off for Phase 2 (database).
