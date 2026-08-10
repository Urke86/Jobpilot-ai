# PHASE 5C — Frontend, UX, Accessibility & Client Reliability Audit

**Date:** 2026-08-10  
**Scope:** Audit-first client review. Minimal High fixes only. No redesign. No Phase 5D.

---

## 1. Route inventory

Source: `src/App.tsx`, `src/constants/routes.ts`.

| Path | Auth | Layout | Lazy |
|------|------|--------|------|
| `/login` | PublicOnly | none | yes |
| `/signup` | PublicOnly | none | yes |
| `/` | Protected | AppLayout | redirect → `/dashboard` |
| `/dashboard` | Protected | AppLayout | yes |
| `/jobs` | Protected | AppLayout | yes |
| `/jobs/import` | Protected | AppLayout | yes |
| `/jobs/:id` | Protected | AppLayout | yes |
| `/applications` | Protected | AppLayout | yes |
| `/applications/:id` | Protected | AppLayout | yes |
| `/companies` | Protected | AppLayout | yes |
| `/companies/:id` | Protected | AppLayout | yes |
| `/hiring-inbox` | Protected | AppLayout | yes |
| `/assistant` | Protected | AppLayout | yes |
| `/settings` | Protected | AppLayout | yes (`?tab=…`) |
| `*` | Protected | AppLayout | redirect → `/dashboard` |

**Settings tabs (query):** `profile` (default), `integrations`, `ai-analytics`, `preferences`, `notifications`, `appearance`.  
OAuth return: `?google=connected|error` forces Integrations tab.

**Sidebar omits** `/jobs/import` (reachable from Jobs → Import).

All protected page components are code-split. Suspense fallback: `PageSkeleton`.

---

## 2. Methodology

1. Static inventory of routes, layouts, forms, EmptyState/Loading, toasts, a11y hooks.  
2. Code review of async/error paths, AI/Hiring Inbox UX, dark mode, security hygiene.  
3. Production build inspection for bundle/lazy chunks.  
4. Minimal High fixes + lint/typecheck/build.  
5. No axe/Lighthouse CI dependency added (none present). Manual code review toward WCAG 2.1 AA practical bar.  
6. Live Chromium interactive pass not automated in this phase (local browser session not required for closed-beta audit); Firefox/Safari not exercised — reported honestly.

---

## 3. Navigation / IA

| Check | Result |
|-------|--------|
| Route correctness | Pass — `/jobs/import` before `:id` |
| Active nav | Pass — Sidebar path match |
| Deep links / reload | Pass for authenticated; **post-login restore fixed in 5C** |
| Invalid route | Redirect to dashboard (no dedicated 404) — Low |
| Protected / public-only | Pass |
| Settings tab deep-links | Pass |
| `AppRoute` type completeness | **Fixed** — includes inbox/import/details |

---

## 4. Responsive matrix (code + layout review)

| Breakpoint | Expected behavior | Risk |
|------------|-------------------|------|
| 320–430 | Sheet nav; stacked headers; tables may overflow horizontally | Medium — Jobs/Apps tables need horizontal scroll |
| 768 | Sidebar still sheet until `lg` | Info |
| 1024+ | Fixed sidebar `lg:pl-64` | Pass |
| Kanban | Horizontal column scroll likely on narrow | Medium usability |
| Assistant | Tall scroll region `calc(100vh-320px)` — cramped on short phones | Medium |
| Hiring Inbox | Split list/detail denser on mobile | Medium density |
| Modals | Radix dialogs generally OK | Pass |
| Charts | Recharts in Dashboard/Analytics — readable ≥768; squeezed on 320 | Medium |

No redesign performed. Flag: mobile Kanban + Assistant are responsive but effortful.

---

## 5. Accessibility results

### Strengths
- Radix Dialog/Select/Tabs primitives  
- LoadingState `role="status"` + `aria-live`  
- Many icon buttons labeled (theme, menu)  
- Dialog close includes sr-only “Close”  
- Login/Signup labels + `role="alert"` errors  

### Gaps (post-5C fixes noted)

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| A1 | Assistant Send/Stop unlabeled; composer unlabeled | High | **Fixed** — `aria-label` + `Label htmlFor` |
| A2 | Mobile Sheet missing Description | Medium | **Fixed** — `SheetDescription` |
| A3 | Job detail `h2` before `h1` | Medium | **Fixed** — company as `<p>` |
| A4 | EmptyState always `h3` | Low | Open |
| A5 | Some Labels without `htmlFor` (ArtifactToolkit, selects) | Medium | Open |
| A6 | Charts not fully SR-exposed | Medium | Open |
| A7 | No eslint-plugin-jsx-a11y / axe in CI | Info | Open |

Automated axe/Lighthouse: **not run** (tooling not in repo; not added per “no unnecessary deps”).

---

## 6. Keyboard results

| Surface | Assessment |
|---------|------------|
| Sidebar links | Tab-reachable |
| Mobile sheet | Escape closes (Radix) |
| Dialogs | Focus trap + Escape (Radix) |
| Forms | Standard tab order |
| Assistant composer | Enter sends; Shift+Enter newline |
| Kanban stage controls | Buttons focusable |
| Dead search/notifications | **Fixed** — disabled, not pretend-interactive |

Residual: focus return after some custom overlays not exhaustively verified live. No intentional keyboard traps found in code.

---

## 7. Forms

| Form | Labels | Validation | Dup-submit | Notes |
|------|--------|------------|------------|-------|
| Login | Yes | Zod + RHF | `isSubmitting` | autocomplete set; config banner if no Supabase |
| Signup | Yes | Zod + RHF | yes | confirm password refine |
| Job form | Labels | Soft required only | busy flag | Silent fail if empty — Medium |
| Company / Contact | Partial HTML required | Manual | saving flags | OK for closed beta |
| Application details | Labels | None | saving flag | OK |
| Settings profile | Labels | Loose Number parse | saving | OK |
| Settings prefs/notifications | Present | **Not persisted** | n/a | Medium UX honesty |
| Artifact / calendar | Labels | Ad-hoc | pending flags | Calendar timezone gate OK |

Destructive: Google disconnect uses confirm path in Settings; job/company deletes need confirmation where implemented — no accidental silent wipe found for Google.

---

## 8. Loading / empty / error

| Pattern | Coverage |
|---------|----------|
| Route Suspense | `PageSkeleton` |
| Data load | Mostly `LoadingState` |
| Empty | `EmptyState` on Jobs/Companies/Dashboard/Hiring Inbox; Assistant custom |
| Error vs empty | Jobs/Companies/Dashboard/Hiring Inbox good; **Applications + detail pages fixed in 5C** |

Assistant still lacks page-level LoadingState while conversation list loads (Medium).

---

## 9. Toast / feedback

- Live system: **Sonner** (`Toaster` in providers).  
- Dead: shadcn `use-toast` / `toaster.tsx` unused (cleanup candidate).  
- Mutations generally toast success/error; some EmptyState + toast pairs intentional.

---

## 10. Data freshness

`useResource` refetch after stage change, analyze, artifact generate, sync, calendar, settings saves — typical.  
No cross-tab sync (Medium for multi-tab).  
Assistant stream updates local state live.

---

## 11. Concurrent actions

- Analyze/artifact/assistant use local busy/`streaming` guards.  
- Server 409/429 surfaces via toast/error message from Edge.  
- Double-click on JobForm soft-gated by busy in places; not universal.

---

## 12. Tables / filters / search

- Jobs: status filter + empty “no match”.  
- Applications: kanban/table toggle; no global search.  
- Companies: simple list.  
- Hiring Inbox: classification filters.  
- **Global header search disabled** (coming soon) — no false capability claim.  
- Client loads full list via services (capped only by backend defaults) — UI does not claim infinite catalog; still no pagination (Medium at scale).

---

## 13. Charts / analytics

- Dashboard + AI Analytics use Recharts (`BarChart` ~358 kB chunk).  
- Empty/error states present on Dashboard sections and Analytics summary error.  
- Theme via CSS variables; dark mode class-based.  
- Residual: tooltip a11y and tiny-viewport crowding (Medium).

---

## 14. AI UX

| Surface | Notes |
|---------|-------|
| Job analysis | Loading + error + empty “run analysis”; scores/reasoning distinct from job text |
| Artifact Toolkit | Generate dialog, versions EmptyState, copy/edit, toast on fail |
| Assistant | Stream text, stop, retry, context selector; plain text (no markdown XSS surface) |
| AI Analytics | Refresh, eval, failure simulation; costs in panel |

Residual Medium: Assistant **always auto-scrolls** on stream (`scrollTop = scrollHeight`) — reading prior messages mid-stream is hard.

---

## 15. Hiring Inbox UX

- Sync + cooldown messaging via toasts/errors.  
- Classification filters; link/stage/calendar actions.  
- Disconnected Google → CTA to Settings Integrations.  
- Calendar timezone ambiguity blocked client-side.  
- Feels workflow-oriented (not Gmail clone). Density High on small screens (Medium).

---

## 16. Visual / dark mode

- shadcn + Tailwind tokens; `ThemeProvider` light/dark/system.  
- Login/Signup use explicit slate/blue gradients with dark variants.  
- No `dangerouslySetInnerHTML` of user content.  
- Residual: Settings “compact mode / show match scores” toggles do not affect UI (Medium honesty).  
- Header theme toggle skips restoring `system` (Low).

---

## 17. Client performance

| Metric / observation | Evidence |
|----------------------|----------|
| Main JS | `index-*.js` ≈ **472 kB** (gzip **146 kB**) |
| Charts | `BarChart-*.js` ≈ **358 kB** (gzip **100 kB**) — heavy |
| Lazy routes | All major pages split |
| Lists | No virtualization |
| Fetch cache | None — remount refetch via `useResource` |
| Web Vitals | Not measured in lab this phase |

Meaningful issue: chart chunk cost on Dashboard/Settings analytics routes. Acceptable for closed beta; optimize before open scale if LCP suffers.

---

## 18. Browser support

| Browser | Status |
|---------|--------|
| Chromium (expected Vite target) | Primary; build passes |
| Firefox | Not smoke-tested this phase |
| Safari / WebKit | Not smoke-tested this phase |

SSE/fetch streaming used by Assistant — Chromium-compatible; Safari needs live confirmation before open production.

---

## 19. Client security hygiene

| Check | Result |
|-------|--------|
| `dangerouslySetInnerHTML` | Chart theme CSS only |
| Markdown HTML | None |
| `target=_blank` | `rel="noopener noreferrer"` present |
| localStorage | Theme key only |
| OAuth | Server redirect; Settings reads query flags |
| Secrets in bundle | Anon key expected; no service role in Vite |

---

## 20. High fixes performed (5C)

| ID | Fix |
|----|-----|
| C1 | Login restores `location.state.from` deep link |
| C2 | Login shows clear error if Supabase env missing |
| C3 | Applications list distinguishes load error vs empty |
| C4 | Job / Application / Company detail distinguish error vs not-found |
| C5 | Assistant composer label + Send/Stop `aria-label` |
| C6 | Mobile nav `SheetDescription` |
| C7 | Job detail heading order (company → `<p>`) |
| C8 | Header search + notifications marked disabled “coming soon” (no fake badge) |
| C9 | `AppRoute` type covers all live routes |

---

## 21. Findings catalog

### Critical

*None remaining after 5C fixes.*

### High

*None remaining after 5C fixes.*

### Medium

| ID | Area | Page | Finding | Required before |
|----|------|------|---------|-----------------|
| M1 | UX | Settings | Preferences / notifications / display toggles do not persist or apply | Limited public (honesty) |
| M2 | Assistant | Assistant | Forced auto-scroll during stream | Limited public |
| M3 | Responsive | Apps/Jobs | Tables/Kanban awkward &lt;430px | Open prod polish |
| M4 | A11y | Various | Labels without `htmlFor`; chart a11y | Open prod AA |
| M5 | Perf | Dashboard/Analytics | Large Recharts chunk; no list virtualization | Open prod at scale |
| M6 | UX | App-wide | No cross-tab freshness | Open prod optional |
| M7 | Forms | JobForm | Silent validation when title/company empty | Limited public |
| M8 | Assistant | Assistant | No full-page loading EmptyState consistency | Limited public |
| M9 | IA | App | Unknown routes → dashboard (no 404) | Open prod optional |

### Low / Informational

| ID | Finding |
|----|---------|
| L1 | Dual toast systems (Sonner live, shadcn dead) |
| L2 | Import route not in sidebar |
| L3 | Theme toggle does not cycle back to `system` |
| I1 | Lazy routes in place |
| I2 | External links safe |
| I3 | Auth gates solid |

---

## 22. Quality gates

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |

---

## 23. Remaining risks

1. Settings “local preferences” copy oversells behavior.  
2. Assistant scroll UX during long streams.  
3. Mobile table/Kanban friction.  
4. Untested Firefox/Safari streaming.  
5. Chart bundle weight.  
6. Production Auth/CORS/SMTP/PITR still ops blockers from 5A/5B (not frontend defects).

---

## 24. Final readiness verdict

### CLOSED BETA: **PASS**

No Critical/High frontend blockers. Auth, core CRUD, AI, Hiring Inbox usable for trusted users.

### LIMITED PUBLIC BETA: **CONDITIONAL PASS**

Frontend blockers / required before widen:

1. **M1** — Persist or clearly disable non-functional Settings preference toggles.  
2. **M7** — Visible Job form validation errors.  
3. Recommend **M2** Assistant scroll fix.  
4. Still depends on production Auth/CORS/Google/SMTP config (non-frontend).

### OPEN MULTI-TENANT PRODUCTION: **CONDITIONAL PASS**

Additional frontend blockers:

1. Stronger WCAG pass (M4) + real axe/Lighthouse evidence.  
2. Mobile table/Kanban usability (M3).  
3. Safari/Firefox smoke for Assistant streaming.  
4. Performance budget for chart/list routes (M5).  
5. Plus prior ops items (PITR, domain, autoconfirm).

---

## Deliverables checklist

1. Route inventory — §1  
2. Findings by severity — §21  
3. Immediate Critical/High fixes — §20  
4. Accessibility — §5  
5. Keyboard — §6  
6. Responsive — §4  
7. Forms — §7  
8. Async/error recovery — §8–11  
9. AI UX — §14  
10. Hiring Inbox — §15  
11. Visual/dark mode — §16  
12. Client performance — §17  
13. Browser compatibility — §18  
14. Client security — §19  
15. lint/typecheck/build — §22 PASS  
16. Remaining risks — §23  
17. Verdict — §24  

**Phase 5C complete. Do not start Phase 5D.**
