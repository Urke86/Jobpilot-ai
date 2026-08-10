# PHASE 5E — Architecture, Backup, DR & Final Production Readiness

**Date:** 2026-08-10  
**Project:** JobPilot AI (`xzzoznhmezmaarcvavpr`, `eu-west-1`)  
**Scope:** Final hardening assessment + operational documentation. No product features. No RAG/agents/LinkedIn. PITR not enabled (paid; needs explicit approval).

---

## 1. Final architecture summary

See [ARCHITECTURE_FINAL.md](./ARCHITECTURE_FINAL.md).

**Stack:** React/TS/Tailwind/shadcn → Supabase Auth + Postgres RLS + Edge Functions → OpenAI + Google + n8n. Observability via `ai_generations` / evaluations / soft alerts.

**Trust boundaries:** Browser never holds privileged secrets; RLS isolates tenants; Edge holds provider keys and encryption; n8n authenticates with shared ingestion secret + allowlist.

---

## 2. SPOF analysis

| SPOF | Impact | Likelihood | Current mitigation | Recovery |
|------|--------|------------|--------------------|----------|
| Supabase project | Total outage / data loss | Low–med | Hosted HA; `walg_enabled=true`; RLS backups via platform | Restore runbook; enable PITR before open prod |
| OpenAI | AI features fail | Med | Timeouts; errors surfaced; data CRUD still works | Wait/retry; rotate key; optional model env |
| Google APIs | Gmail/Calendar fail | Med | Disconnect/reconnect; local CRM independent | Status checks; user reconnect |
| n8n runtime | Ingest automation stops | Med | Manual job create / Import UI still works | Restart n8n; secret check |
| Frontend hosting | App unreachable | Med (host TBD) | SPA static; API still up | Redeploy prior build; status page |
| Email delivery (Auth) | Signup/reset broken | Med | `external_email_enabled=true`; autoconfirm fixed false | Configure SMTP; test reset |
| OAuth client config | Google connect broken | Low–med | Documented redirect/secrets | Fix console + Edge secrets |

---

## 3. Backup / PITR status (live verified 2026-08-10)

| Field | Value |
|-------|-------|
| `pitr_enabled` | **`false`** |
| `walg_enabled` | **`true`** |
| Management `backups` array | **Empty** |
| `physical_backup_data` | Present but **empty fields** via API |
| Billing addons list | **Empty** (no PITR addon selected) |

**Cannot verify via API alone:** exact daily backup retention days shown only in Dashboard UI, successful restore drill, plan entitlement nuance.

### Backup policy (defined)

| Asset | Policy |
|-------|--------|
| Database | Rely on Supabase physical/WAL backups; **enable PITR before open multi-tenant** (paid, approval required) |
| Migrations | Git `supabase/migrations/` = source of truth |
| Edge source | Git `supabase/functions/` |
| n8n workflows | Git `automation/n8n/*.json` (no secrets) |
| Frontend | Git + hosting release artifacts |
| Secrets inventory | Names in docs; **values only in password manager / Edge secrets** — never in repo backups |
| Prompt versions | DB table + git prompt sources |

---

## 4. RPO / RTO

| Stage | RPO | RTO | Notes |
|-------|-----|-----|-------|
| Closed beta | ≤ 24h | ≤ 8h | Trusted users; PITR off acceptable with ops awareness |
| Limited public beta | ≤ 24h (≤ 1h if PITR) | ≤ 4h | Prefer PITR if budget allows |
| Open multi-tenant | **≤ 15 min (PITR mandatory)** | ≤ 2–4h | Gate: enable PITR add-on |

---

## 5. Restore strategy

Documented in [RESTORE_RUNBOOK.md](./RESTORE_RUNBOOK.md). Prefer new-project restore + cutover. No destructive restore executed in 5E.

---

## 6. Migration policy

**Verified:** Remote history matches 9 repo migrations through `20260810010000_phase5b1_idempotency_url_dedupe` (no drift detected).

### Rules

1. Never alter live schema manually in Dashboard.
2. Migration-first; deterministic `YYYYMMDDHHMMSS_name.sql`.
3. Backup/PITR checkpoint before destructive DDL.
4. Prefer expand → backfill → contract; staged rollout.
5. If apply fails mid-way: fix forward; do not “rollback” destructive changes casually.
6. Regenerate types after schema changes (`npm run db:types`).

---

## 7. Secrets inventory & rotation

Names + rotation procedures: [SECRET_ROTATION.md](./SECRET_ROTATION.md).

**Encryption key rotation:** old Google token ciphertext becomes unreadable → users must reconnect Google.

---

## 8. Provider failure strategy

| Provider | User-visible | Consistency | Retry | Ops |
|----------|--------------|-------------|-------|-----|
| OpenAI down | Analyze/artifact/assistant/classify errors | Domain rows unchanged or sticky analyzing reset | Client retry; Edge timeouts | Check status/billing; rotate key |
| Google down | Connect/sync/calendar fail | Local jobs/apps OK; tokens kept | User retry later | Status page; reconnect if revoked |
| Supabase degraded | Login/CRUD/Edge fail | Risk of partial writes | Backoff | Incident SEV-1/2; restore if data loss |
| n8n down | Auto-ingest stops | No corruption | Resume schedule | Manual import path |
| Frontend host down | App blank | Backend intact | — | Redeploy prior build |

---

## 9. Incident response readiness

[INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) — SEV-1/2/3, containment, postmortem.

---

## 10. Monitoring readiness

| Signal | Source | Action |
|--------|--------|--------|
| AI error rate / spend / latency | `ai_generations` + AI Analytics | Soft alerts; lower `avgLatencyMs` to 8s (5D rec) |
| Edge errors | Supabase logs | SEV-2 if sustained |
| Auth failures | Auth logs | Check autoconfirm/SMTP/redirects |
| Ingest failures | Edge + n8n | Secret/allowlist |
| Gmail/Calendar | Edge logs + UI toasts | Google status / tokens |
| DB health | Supabase status + Dashboard | SEV-1 if storage failure |

No new external APM added (not required for current stage).

---

## 11. Production configuration checklist

Canonical list: [PRE_DEPLOY_CHECKLIST.md](./PRE_DEPLOY_CHECKLIST.md).

### Live config notes (5E)

| Item | Status |
|------|--------|
| `mailer_autoconfirm` | Was **`true`** (regression) → **patched to `false`** on 2026-08-10 |
| `external_email_enabled` | `true` |
| PITR | **Off** — open-prod gate |
| Migrations | In sync |
| Frontend production host | **Not finalized** |

---

## 12. Retention / privacy

See [PRIVACY_DATA_MAP.md](./PRIVACY_DATA_MAP.md).

**Recommendations (do not auto-delete in 5E):**

| Data | Proposal |
|------|----------|
| `job_emails` | 90–180 days (highest privacy sensitivity) |
| `ai_messages` | 12 months or user delete |
| `ai_generations` | 12–24 months metadata; avoid storing raw prompts |
| CRM (jobs/apps) | Account lifetime |
| Edge/n8n logs | Short (14–30 days) |

---

## 13. Account deletion assessment

| Check | Result |
|-------|--------|
| Self-service “Delete account” UI | **Not implemented** |
| Schema `ON DELETE CASCADE` from `auth.users` | Present on user-owned tables (profiles, jobs, apps, AI, integrations, emails, etc.) |
| Admin deletes Auth user | Expected to cascade public rows |
| Google tokens | Removed with `user_integrations`; disconnect also best-effort revokes |
| Google Calendar events already created | **May remain on Google Calendar** (external) |
| OpenAI | No JobPilot-controlled deletion of provider logs |
| n8n | May retain historical execution payloads until n8n retention purge |

**Finding M-DEL:** Complete productized account deletion + calendar cleanup guidance not implemented — **required before open multi-tenant** (privacy readiness). Not implemented in 5E (not Critical for closed beta; High gate for open prod).

---

## 14. Dependency audit

| Scope | Critical | High | Moderate | Low |
|-------|----------|------|----------|-----|
| Full `npm audit` | 0 | 13 | 5 | 2 |
| `--omit=dev` | 0 | 9 | 2 | 0 |

Notable production-tree High (transitive / build): `postcss` (direct via CSS toolchain), `nanoid` (via postcss), `lodash` (via recharts), `ws` (via supabase realtime), `minimatch`/`glob`/`picomatch`/`brace-expansion`/`cross-spawn` (tooling).

**Action in 5E:** Document only — **no mass upgrades** (risk of break). Exploitability for static SPA production is mostly build-time or dependency-local; track for next maintenance window. No Critical.

---

## 15. Deployment / rollback readiness

| Doc | Purpose |
|-----|---------|
| [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) | Migrate → types → Edge → build → smoke |
| [PRE_DEPLOY_CHECKLIST.md](./PRE_DEPLOY_CHECKLIST.md) | Gate checklist |
| Rollback | Frontend/Edge/n8n revert; DB **forward-fix** preferred |

### Frontend hosting readiness

| Item | State |
|------|-------|
| Build | `npm run build` (`tsc -b && vite build`) |
| Env | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| SPA routing | Host must fallback to `index.html` |
| HTTPS | Required for production OAuth/cookies |
| Provider | **Not finalized** — document assumptions only |

---

## 16. Final system limits

| Limit | Value |
|-------|-------|
| Jobs/apps/companies list | 500 |
| Hiring Inbox list default | 50 |
| Assistant conversations | 100 |
| Messages / conversation | 200 |
| Assistant history to model | 20 msgs; context budget 14k chars |
| Assistant daily soft cap | 80 msgs (env override) |
| Gmail sync | max 25 messages; body ≤8k |
| AI max_tokens | analyze 2500; artifact 3000; chat 1200; classify 500 |
| Rate leases | Per-user Edge leases (5A/5B) |
| Analytics generations fetch | capped in client (e.g. 100–500) |
| n8n | Sequential sample ingest; not high-throughput designed |

---

## 17. Risk register

| ID | Area | Severity | Risk | Likelihood | Impact | Mitigation | Owner | Before public? |
|----|------|----------|------|------------|--------|------------|-------|----------------|
| R1 | DR | High | PITR disabled | Certain | Worse RPO | Enable PITR (paid approval) | Ops | Open prod **Yes** |
| R2 | Auth | High | Autoconfirm regression | Happened | Unverified signups | Patched false; monitor | Ops | Limited+ **Yes** |
| R3 | Privacy | High | No self-service account deletion | High | Compliance/trust | Admin delete cascade today; productize later | Product | Open **Yes** |
| R4 | Hosting | Medium | Frontend host TBD | High | Launch block | Choose host + SPA fallback | Ops | Limited+ **Yes** |
| R5 | Email | Medium | SMTP/reset not fully proven | Med | Auth UX | Test reset in prod mailer | Ops | Limited+ **Yes** |
| R6 | Google | Medium | OAuth verification / consent | Med | Connect fails | Consent + scopes review | Ops | Limited+ **Yes** |
| R7 | Perf | Medium | Dashboard client aggregates | Med | Slow at scale | SQL RPC later | Eng | Open at scale |
| R8 | Deps | Medium | npm High advisories | Med | Supply chain | Planned bump window | Eng | Track |
| R9 | Privacy | Medium | `job_emails` unbounded retention | Med | PII hold | Retention job later | Eng | Open recommended |
| R10 | UX | Medium | 5C Settings prefs / mobile | Med | Trust/UX | Fix from 5C list | Eng | Limited |
| R11 | Monitor | Low | Soft latency alert 15s | Low | Miss slowdowns | Lower to 8s | Eng | Nice |
| R12 | Calendar | Low | Events remain on Google after DB delete | Med | Orphan events | Document + optional manual delete | Ops | Disclose |

---

## 18. Production readiness scorecard

| Dimension | Grade | Explanation |
|-----------|-------|-------------|
| Architecture | **A** | Clear boundaries; documented final map |
| Security | **B** | RLS/hardening strong; autoconfirm regression caught; npm High backlog |
| Reliability | **B** | Timeouts/leases/idempotency; PITR still off |
| Performance | **B** | 5D optimizations; chart weight + dashboard aggregates remain |
| Cost control | **A** | Caps, observability, tiny measured unit costs |
| Observability | **B** | Solid AI telemetry; no full APM/uptime stack |
| UX | **B** | Usable closed beta; 5C Medium leftovers |
| Accessibility | **C** | Partial AA; deeper pass deferred |
| Operations | **B** | Runbooks added; hosting/email gates remain |
| Disaster recovery | **C** | WAL on, PITR off, restore undrilled |
| Privacy | **C** | Data map exists; deletion/retention product gaps |
| Maintainability | **B** | Migrations clean; docs extensive; dep churn risk |

---

## 19. Findings by severity

### Critical

None.

### High

| ID | Finding | Status |
|----|---------|--------|
| H1 | `mailer_autoconfirm` had regressed to `true` | **Fixed** → `false` (2026-08-10) |
| H2 | PITR disabled for open multi-tenant | **Gate** — do not enable without approval |
| H3 | No productized account deletion / privacy deletion UX | **Gate for open prod** — schema CASCADE helps admin delete |

### Medium

| ID | Finding |
|----|---------|
| M1 | Frontend production hosting not finalized |
| M2 | Auth email/password-reset not fully proven on production SMTP |
| M3 | Google production consent/verification |
| M4 | npm audit High (no Critical); no mass upgrade this phase |
| M5 | job_emails / AI retention not enforced |
| M6 | Prior 5C/5D Medium UX/perf items |
| M7 | Restore drill never executed |

### Low / Informational

| ID | Finding |
|----|---------|
| L1 | Soft alert latency threshold still 15s |
| L2 | Calendar orphans on Google after user delete |
| I1 | Migration history in sync |
| I2 | walg_enabled true |
| I3 | Runbooks published |

---

## 20. Post-deploy smoke (do not run on prod without authorization)

1. Signup/login (confirm email path if autoconfirm false)
2. Create job
3. Analyze job
4. Create application
5. Generate artifact
6. Assistant response (stream)
7. Gmail connect/sync
8. Calendar preview/create
9. AI Analytics update
10. Logout/login persistence

---

## 21. Quality gates (5E)

| Gate | Result |
|------|--------|
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** |
| `npm audit` | **0 Critical**; High present (documented, not mass-fixed) |
| `verify-5b-hardening.cjs` | **PASS** |
| `verify-5b1-remediation.cjs` | **PASS** |
| Live PITR probe | `pitr=false`, `walg=true` |
| Autoconfirm patch | **Applied** |

---

## 22. Final readiness verdict

### CLOSED BETA: **PASS**

Critical 0. Autoconfirm regression fixed. Architecture/DR docs complete. Trusted users OK with PITR-off awareness.

### LIMITED PUBLIC BETA: **CONDITIONAL PASS**

Remaining blockers:

1. Finalize **frontend hosting** (HTTPS, SPA fallback, env).
2. Prove **email delivery / password reset** with autoconfirm false.
3. Confirm **CORS + Auth site URL/redirects** for real HTTPS origin.
4. Google **production OAuth consent** readiness.
5. Address or explicitly accept 5C Medium UX items (Settings prefs honesty, Job form validation).
6. Triage npm High advisories on a maintenance schedule.

### OPEN MULTI-TENANT PRODUCTION: **CONDITIONAL PASS** / effectively **not ready** until gates clear

Exact blockers:

1. **Enable PITR** (paid — explicit approval) — mandatory for open-prod RPO.
2. **Execute restore drill** (non-prod or approved window).
3. **Account deletion** product path + document Calendar residual data.
4. Retention for `job_emails` / AI message metadata.
5. Production Web Vitals evidence (from 5D).
6. Auth’d AI concurrency soak (from 5D).
7. Deeper a11y/mobile/Safari (from 5C).
8. All Limited Public blockers above.

---

## 23. Documentation deliverables

| Doc | Status |
|-----|--------|
| `docs/ARCHITECTURE_FINAL.md` | Created |
| `docs/RESTORE_RUNBOOK.md` | Created |
| `docs/SECRET_ROTATION.md` | Created |
| `docs/INCIDENT_RESPONSE.md` | Created |
| `docs/DEPLOYMENT_RUNBOOK.md` | Created |
| `docs/PRE_DEPLOY_CHECKLIST.md` | Created |
| `docs/PRIVACY_DATA_MAP.md` | Created |
| `docs/PHASE5E_FINAL_READINESS.md` | This file |
| `docs/ARCHITECTURE.md` | Updated |
| `docs/DATABASE.md` | Updated |
| `docs/IMPLEMENTATION_NOTES.md` | Updated |

**Phase 5E complete. Do not start a new product phase.**
