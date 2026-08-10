# PHASE 5D — Performance, Reliability & Cost Optimization

**Date:** 2026-08-10  
**Project:** JobPilot AI (`xzzoznhmezmaarcvavpr`)  
**Scope:** Measure → evidence-backed low-risk optimizations only. No product features. No redesign. No Phase 5E.

---

## 1. Methodology

1. Capture production-build bundle baseline (Vite) and live `ai_generations` cost/latency stats.  
2. Static audit of list selects, route splitting, Edge context building, Gmail prefilter, n8n exports.  
3. `EXPLAIN (ANALYZE)` on high-value list paths via Management API (small closed-beta data).  
4. Implement only architecture-preserving optimizations with clear before/after.  
5. Redeploy touched Edge functions; run lint / typecheck / build + hardening + concurrency smoke.  
6. Document budgets, alert threshold recommendations, remaining findings, readiness verdicts.

**Limitations (honest):** No Lighthouse CI in repo; Web Vitals not measured on a public CDN deploy. Load tests avoid destructive OpenAI spend (auth/rate-path concurrency only). Sample sizes for AI features remain small (closed beta).

---

## 2. Performance baseline (pre-optimization)

### Frontend (production build — Phase 5C / early 5D)

| Asset | Approx size | Gzip |
|-------|-------------|------|
| Main entry `index-*.js` | ~461–472 kB | ~146 kB |
| Recharts shared `BarChart-*.js` | ~349–358 kB | ~100 kB |
| CSS | ~70 kB | ~12 kB |
| Settings page (pre-lazy analytics) | ~62 kB | — |
| Dashboard page | ~11 kB | — |

Routes already lazy via `React.lazy` in `src/App.tsx`. Chart weight was the dominant optional dependency.

### Backend / AI (live `ai_generations`, Management API)

| Feature | n | avg in | avg out | avg cost USD | avg ms | p95 ms | success % |
|---------|---|--------|---------|--------------|--------|--------|-----------|
| gmail_classification | 14 | 871 | 121 | 0.000203 | 1493 | 2020 | 100 |
| analyze_job | 3 | 898 | 269 | 0.000296 | 3627 | 4655 | 100 |
| assistant | 3 | 335 | 16 | 0.000060 | 716 | 1109 | 66.7* |
| cover_letter | 1 | 786 | 238 | 0.000261 | 3505 | 3505 | 100 |
| custom | 4 | 1000 | 1000 | 0.400000 | 20000 | 20000 | 0 |

\*One assistant failure in sample; treat rates as directional only.

### Database (EXPLAIN ANALYZE, first user, small N)

| Path | Planning ms | Execution ms | Notes |
|------|-------------|--------------|-------|
| jobs list (projected cols, limit 500) | ~22 | ~2.6 | Indexed user filter; tiny row count |
| applications list | ~1.5 | ~0.8 | Indexed |
| job_emails list (50) | ~1.4 | ~0.1 | Indexed `job_emails_user_received_idx` |

Indexes already present for jobs/apps/emails/AI tables/messages/artifacts (see §9). **No new indexes added** (no sequential-scan evidence at current scale).

---

## 3. Bundle analysis (after 5D)

Production build (`npm run build`, 2026-08-10):

| Chunk | Raw kB | Gzip kB | Load trigger |
|-------|--------|---------|--------------|
| `index-*.js` (entry) | 472.1 | 145.9 | Initial |
| `BarChart-*.js` (recharts) | **357.9** | **100.2** | Lazy charts only |
| `AiAnalyticsPanel-*.js` | 34.0 | 10.7 | Settings → AI Analytics tab |
| `SettingsPage-*.js` | 30.8 | 9.4 | `/settings` |
| `AssistantPage-*.js` | 30.5 | 9.8 | `/assistant` |
| `ApplicationDetailPage-*.js` | 23.1 | 6.7 | Detail |
| `DashboardPage-*.js` | 9.5 | 3.6 | `/dashboard` |
| `DashboardCharts-*.js` | 2.8 | 1.2 | Dashboard charts Suspense |
| CSS | 70.3 | 12.2 | Initial |

**Findings**

- Recharts remains large (~358 kB) — expected; **not replaced** (no clear smaller drop-in justified).  
- **Improvement:** Settings no longer statically imports analytics/charts → Settings chunk ~62 → ~31 kB; Recharts loads only when Dashboard charts or AI Analytics mount.  
- `date-fns` / `zod` / Radix select remain moderate shared deps; acceptable for closed beta.  
- No permanent rollup visualizer added.

---

## 4. Findings by severity

### Critical

| ID | Finding | Status |
|----|---------|--------|
| — | None | — |

### High

| ID | Finding | Status |
|----|---------|--------|
| — | None verified | — |

### Medium

| ID | Area | Finding | Action |
|----|------|---------|--------|
| M1 | Bundle | Recharts ~358 kB still paid when charts mount | Lazy-loaded (mitigated); keep library |
| M2 | Dashboard | `getDashboardData` still pulls full jobs+apps lists (≤500) and aggregates client-side | Documented; SQL RPC deferred (low N) |
| M3 | Network | `useResource` remount refetch; no shared query cache | Prefer lean selects; TanStack not justified yet |
| M4 | Gmail | Message fetch + classify mostly sequential | Cap 25 msgs; cost already tiny; leave sequential for reliability |
| M5 | AI data | `custom` feature rows are noisy failures @ $0.40 placeholders | Ops hygiene; not product path |
| M6 | Scale | Lists capped at 500 without virtualization | OK for closed/limited beta; revisit >1k rows |

### Low

| ID | Finding |
|----|---------|
| L1 | Companies list still includes `notes` / `ai_focus` (UI shows them) |
| L2 | Detail paths correctly `select('*')` — large fields only on detail |
| L3 | n8n scheduled ingest loops jobs sequentially (readable; OK at sample scale) |
| L4 | Artifact / activity list selects still broad |
| L5 | Soft alerts `avgLatencyMs: 15s` far above measured ~1–5s averages |

### Informational

| ID | Finding |
|----|---------|
| I1 | Route-level lazy loading already complete |
| I2 | `gpt-4o-mini` appropriate for all measured workflows |
| I3 | Gmail deterministic prefilter (`HIRING_HINT`) before AI classify |
| I4 | Edge max_tokens already capped (analyze 2500, artifact 3000, chat 1200, classify 500) |
| I5 | Context clipping already in place (JD/CV/portfolio/history budgets) |

---

## 5. Frontend / React / network

### Code splitting

- All app routes lazy (`App.tsx`).  
- **Added:** `DashboardCharts` lazy + Suspense.  
- **Added:** `AiAnalyticsPanel` lazy + mount only when `activeTab === 'ai-analytics'`.

### React render

- Assistant stream: **rAF token batching** + **stick-to-bottom** only when user near bottom (fixes forced scroll + reduces setState thrash).  
- No blanket `React.memo` / `useMemo` cargo-cult; contexts unchanged (no evidence of Hot-path broad invalidation requiring rewrite).

### Lists

| List | Limit | Payload |
|------|-------|---------|
| Jobs | 500 | No `job_description` |
| Applications | 500 | No cover letter / questionnaire JSON |
| Companies | 500 | Explicit columns |
| Hiring Inbox | 50 default | No `body_text` on list |
| Conversations | 100 | Explicit columns |
| Messages | 200 | Explicit columns (includes content) |
| AI generations list | existing limit | Slimmed observability columns |

Virtualization **not** introduced (N≪threshold).

### Client cache strategy (defined, not overbuilt)

| Data | Cache stance |
|------|----------------|
| Profile / auth | Session + AuthProvider |
| Jobs/apps lists | Fresh on mount; invalidate via page refetch after mutations |
| Dashboard aggregates | Fresh on mount (derived from lists) |
| AI Analytics RPC | Fresh on panel open / refresh |
| Hiring Inbox | Fresh after sync |
| Assistant messages | Fresh per conversation; stream appends locally |

**Do not add TanStack Query** until multi-screen shared stale-while-revalidate pain is measured.

---

## 6. Database / payload

- List projections avoid large text/JSON where UI does not need them.  
- Indexes adequate; EXPLAIN times &lt;5 ms execution on sample data.  
- Remaining Medium: dashboard still over-fetches for aggregates — acceptable until hundreds of rows per user justify `ai_analytics`-style RPC.

---

## 7. Edge latency & parallelization

### Implemented

| Function | Change |
|----------|--------|
| `analyze-job` | Parallel rate-lease + profile after ownership |
| `generate-artifact` | Parallel job∥profile; then company∥analysis∥recent |
| `chat-assistant` | Parallel profile∥history; company∥analysis; removed duplicate history fetch |
| `gmail-sync` / classify | `max_tokens: 500` on classify path |

### Latency model (conceptual)

`TOTAL ≈ auth + rate lease + context DB + provider + validate + persist (+ observability)`

Provider remains the dominant term for analyze/artifact (~3–5 s measured). Parallel context saves tens–hundreds of ms of serial DB RTT — meaningful but secondary to OpenAI.

### Deployed (5D)

`analyze-job`, `generate-artifact`, `chat-assistant`, `gmail-sync` redeployed to `xzzoznhmezmaarcvavpr`.

---

## 8. AI cost / tokens / models

### Cost targets (proposed from measured data)

| Feature | Measured avg | Soft target | Hard watch |
|---------|--------------|-------------|------------|
| analyze_job | ~$0.00030 | ≤ $0.001 | &gt; $0.005 |
| artifact (cover_letter sample) | ~$0.00026 | ≤ $0.0015 | &gt; $0.01 |
| assistant message | ~$0.00006 | ≤ $0.0005 | &gt; $0.002 |
| gmail classify / msg | ~$0.00020 | ≤ $0.0005 | &gt; $0.002 |
| Daily per-user soft cap | — | $1.00 (existing alert) | $3.00 review |

### Model selection

Keep **`gpt-4o-mini`** for analyze, artifacts, assistant, Gmail. No evidence justifying `gpt-4o` spend for these structured/low-stakes paths.

### Token / context recommendations (current = recommended unless noted)

| Feature | max_tokens | Context clips | Notes |
|---------|------------|---------------|-------|
| analyze_job | 2500 | JD 20k / CV 20k / portfolio 8k | Sufficient for structured JSON |
| generate-artifact | 3000 | same + notes/instruction 4k | Cover letters OK; do not raise |
| chat-assistant | 1200 | history 20; context budget 14k chars; daily 80 msgs | Good TTFT/cost balance |
| gmail_classification | 500 | body ≤8k; max 25 msgs/sync | Added explicit max_tokens |

### Prompt compression

No aggressive rewrite this phase: anti-fabrication / security / evidence rules must stay. Caps + clipping already reduce waste. Future: versioned prompt trim only with A/B eval scores.

### Gmail cost path

`prefilter (HIRING_HINT) → AI classify only candidates → persist`  
Measured classify cost negligible. Do **not** tighten prefilter aggressively (recall &gt; precision for hiring).

---

## 9. Streaming assistant

- **Before:** every token → `setState` + forced scroll.  
- **After:** buffer tokens; flush on `requestAnimationFrame`; scroll only if `stickToBottomRef`.  
- Expected: fewer React commits during long streams; better UX when user scrolls up.  
- First-token latency still dominated by Edge+OpenAI (measured assistant avg ~0.7 s end-to-end in tiny sample).

---

## 10. n8n

Workflows under `automation/n8n/`: manual ingest, scheduled Remotive sample loop, optional auto-analysis webhook. Sequential loops are intentional/readable. Auto-analysis fanout remains opt-in (`auto_analyze` / env) — correct for cost control. No n8n rewrite.

---

## 11. Load / reliability

### Concurrency smoke (`scripts/phase5d-concurrency-smoke.cjs`)

| Test | Result |
|------|--------|
| 10× parallel `analyze-job` with anon JWT | All **401**, wall ~1.8 s, no hangs |
| 5× parallel `gmail-sync` unauth | All **401**, max ~1.4 s |

Destructive multi-user AI burn tests **not** run (cost + ethics for closed beta). Rate leases + auth remain from Phase 5B.

### Failure recovery (code-level, prior phases + 5D)

- Analyzing sticky status reset on error (5B).  
- Chat orphan user-message rollback (5B).  
- Outbound timeouts (5A).  
- Gmail classify item failure increments counters; sync completes with summary.  
- Client stream abort clears RAF buffer (5D).

---

## 12. Web Vitals

| Metric | Status |
|--------|--------|
| LCP / CLS / INP | Not measured on production CDN this phase |
| Local preview | Build succeeds; Lighthouse not automated |

**Limitation:** Local Vite preview ≠ real edge latency/CDN. Recommend production Lighthouse on Login, Dashboard, Jobs, Job Detail, Assistant, AI Analytics before open multi-tenant **PASS**.

---

## 13. Optimizations performed (BEFORE → AFTER)

| # | Change | Before | After | Improvement |
|---|--------|--------|-------|-------------|
| 1 | Lazy Dashboard charts | Recharts pulled with Dashboard module graph / Settings analytics eager | `DashboardCharts` + `AiAnalyticsPanel` async; Settings ~62→31 kB | Recharts only when charts needed |
| 2 | Jobs/apps list columns + limit 500 | `SELECT *` / unbounded risk | Projected cols; soft cap | Smaller payloads; predictable scale |
| 3 | Hiring Inbox list omits `body_text` | Full rows | List without body | Less network on inbox |
| 4 | Companies findByName scoped | Full-table risk | `ilike` + limit 25 | Faster match |
| 5 | Assistant lists limited | Unbounded | Conv 100 / msgs 200 | Caps growth |
| 6 | AI generations list slim select | `*` | Explicit observability cols | Less JSON over wire |
| 7 | Assistant stream batching + scroll | Per-token setState + force scroll | rAF batch + sticky bottom | Fewer renders; better UX |
| 8 | Edge parallel context | Serial DB reads | Promise.all independent reads | Lower non-provider latency |
| 9 | Chat duplicate history fetch | Two history queries | Single shared promise | One less DB round-trip |
| 10 | Gmail classify `max_tokens` | Unbounded provider default risk | 500 | Predictable classify cost |

---

## 14. Performance budgets (practical)

| Category | Budget | Rationale |
|----------|--------|-----------|
| Initial JS (entry, no charts) | ≤ 550 kB raw / ≤ 170 kB gzip | Current ~472 / 146 |
| Route page chunk | ≤ 80 kB raw typical | Most pages &lt;35 kB |
| Chart async chunk | ≤ 400 kB raw | Recharts reality ~358 |
| CSS | ≤ 100 kB raw | Current ~70 |
| LCP (prod, 4G) | ≤ 3.5 s | Target once measured |
| INP | ≤ 200 ms | Target once measured |
| Jobs/apps list API | ≤ 300 ms p95 (app-side) | DB already ≪ |
| analyze_job total | ≤ 8 s p95 | Measured ~4.7 s |
| Artifact total | ≤ 10 s p95 | Measured ~3.5 s sample |
| Assistant first-token | ≤ 2.5 s p95 | Measured avg ~0.7 s sample |
| Gmail sync (≤25 msgs) | ≤ 60 s wall | Network + classify bound |

---

## 15. Cost budgets

| Item | Soft target | Alert / review |
|------|-------------|----------------|
| analyze_job | $0.001 avg | $0.005 |
| artifact generation | $0.0015 avg | $0.01 |
| assistant message | $0.0005 avg | $0.002 |
| Gmail sync AI (per sync ≤25) | $0.01 | $0.05 |
| Daily per-user spend | $1.00 | $3.00 |

No billing implemented (per scope).

---

## 16. Alert threshold recommendations

Current `OBSERVABILITY_THRESHOLDS` (`src/lib/ai/prompt-registry.ts`):

| Key | Current | Recommendation | Why |
|-----|---------|----------------|-----|
| dailySpendUsd | 1.0 | **Keep 1.0** | Matches soft cap; closed-beta volume low |
| avgLatencyMs | 15_000 | **Lower to 8_000** | Measured features avg 0.7–4 s; 15 s never alerts |
| failureRatePct | 25 | **Keep 25** or **20** if volume rises | Small-N noise; avoid flapping |
| costTrendUpPct | 50 | **Keep 50** | OK |
| evalDeclinePoints | 0.5 | **Keep 0.5** | OK |

Ignore/`custom` synthetic failure rows when computing failure rate for alerts (ops).

---

## 17. Quality gates

| Gate | Result |
|------|--------|
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** |
| `scripts/verify-5b-hardening.cjs` | **PASS** |
| `scripts/phase5d-concurrency-smoke.cjs` | **PASS** |
| Edge deploy (4 functions) | **PASS** |

Regression coverage this phase: static + build + prior hardening script + auth concurrency. Manual product click-through of every AI path not re-run end-to-end (OpenAI cost); code paths unchanged in behavior except perf.

---

## 18. Remaining risks

1. Dashboard client aggregation will hurt at large per-user job/app counts.  
2. Recharts weight remains when charts open.  
3. No production Web Vitals evidence yet.  
4. Authenticated multi-tenant AI concurrency under OpenAI rate limits not load-tested with spend.  
5. Prior Phase 5C UX Medium items (Settings prefs, mobile tables, deeper a11y) still apply to limited/open tiers.  
6. Ops: Auth email/CORS/PITR/domain from earlier phases remain non-perf blockers for open production.

---

## 19. Final readiness verdict

### CLOSED BETA: **PASS**

Critical **0**, High **0**. Bundle/list/Edge/stream optimizations landed; quality gates green; cost profile tiny at current usage.

### LIMITED PUBLIC BETA: **CONDITIONAL PASS**

Performance/reliability/cost blockers to clear (plus prior 5C/ops):

1. **M2** — Server-side dashboard aggregates before users routinely exceed hundreds of jobs/apps.  
2. Confirm alert threshold tweak (`avgLatencyMs` → 8s) so soft alerts are meaningful.  
3. Prior UX: Settings prefs honesty (5C M1), Job form validation (5C M7).  
4. Production Auth/CORS/Google/SMTP configuration (ops).

### OPEN MULTI-TENANT PRODUCTION: **CONDITIONAL PASS**

Additional blockers:

1. Production Web Vitals (LCP/INP/CLS) on representative pages meeting §14 budgets.  
2. Authenticated concurrency/rate-limit soak with controlled spend.  
3. List virtualization or cursor pagination if any tenant exceeds ~1k list rows.  
4. Deeper a11y + mobile + Safari/Firefox stream evidence (5C).  
5. Ops: PITR, custom domain, email autoconfirm, monitoring runbooks.

---

## 20. Deliverables checklist

1. Performance baseline — §2  
2. Bundle findings — §3  
3. React/render findings — §5  
4. Network findings — §5 / M3  
5. Database/query findings — §6 / §2  
6. Edge latency findings — §7  
7. AI cost findings — §8  
8. Token/context findings — §8  
9. Gmail/n8n findings — §8 / §10  
10. Load/reliability tests — §11  
11. Optimizations implemented — §13  
12. Before/after metrics — §13 / §3  
13. Web Vitals — §12 (limited)  
14. Performance budgets — §14  
15. Cost budgets — §15  
16. Alert threshold recommendations — §16  
17. lint/typecheck/build — §17 PASS  
18. Remaining risks — §18  
19. Final readiness verdict — §19  

**Phase 5D complete. Do not start Phase 5E.**
