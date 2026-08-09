# Phase 5A — Database, Security, and RLS Audit

**Date:** 2026-08-09  
**Scope:** Existing JobPilot AI platform (Phases 1–4E)  
**Mode:** Read-only production-readiness audit — no redesign; no feature work  
**Live project:** `xzzoznhmezmaarcvavpr` (17 public tables; RLS enabled on all)

---

## 1. Architecture summary

JobPilot is a single-tenant-per-user SaaS on Supabase:

| Layer | Stack |
|-------|--------|
| Auth | Supabase Auth (JWT) |
| Data | PostgreSQL + RLS (`user_id = auth.uid()`) |
| AI | Edge Functions → OpenAI; metadata + `ai_generations` |
| Integrations | Google OAuth (encrypted tokens in `user_integrations`) |
| Automation | n8n → `ingest-job` (JWT or `INGESTION_SECRET`) |

**Tables (17):** `profiles`, `companies`, `contacts`, `jobs`, `job_analysis`, `applications`, `application_artifacts`, `activities`, `ai_conversations`, `ai_messages`, `user_integrations`, `job_emails`, `application_events`, `prompt_versions`, `ai_generations`, `ai_evaluations`, `ai_observability_alerts`

**Strengths**

- Consistent UUID PKs, `timestamptz`, `updated_at` triggers on core entities
- RLS enabled on every public table (live verified)
- No `SECURITY DEFINER` functions in `public`
- Strong ownership WITH CHECK on core children (`contacts`, `jobs`, `applications`, artifacts, `application_events`)
- Google tokens AES-GCM encrypted; Edge logging generally avoids secret values
- Indexes cover primary user-scoped query patterns for jobs, applications, activities, emails, AI generations

**Live integrity smoke (2026-08-09)**

| Check | Result |
|-------|--------|
| Jobs with dangling `company_id` | 0 |
| `job_emails` with foreign-owned `application_id` | 0 |
| Duplicate company name groups per user | 0 |
| Successful `ai_generations` missing cost | 0 |
| `SECURITY DEFINER` in public | none |

---

## 2. Database findings

| ID | Finding | Severity | Risk | Recommendation |
|----|---------|----------|------|----------------|
| D1 | No soft-delete (`deleted_at`) — hard deletes only | Medium | Accidental data loss; activity orphans | Decide Phase 5B: soft-delete for jobs/apps or accept hard delete + activity retention |
| D2 | `activities.entity_id` has no FK (polymorphic) | Medium | Orphan activity rows after entity delete | Document as intentional; optional periodic cleanup job |
| D3 | `jobs.company_name_snapshot` can diverge from `companies.name` | Low | Stale display labels | Accept for MVP; refresh on company rename if needed |
| D4 | `companies (user_id, lower(name))` indexed but not UNIQUE | Medium | Duplicate company rows | Add unique constraint when product requires one company per name |
| D5 | `application_artifacts (application_id, artifact_type, version)` indexed, not UNIQUE | Medium | Concurrent generate race → duplicate versions | Promote index to UNIQUE |
| D6 | `application_events` unique on `(user_id, provider, external_event_id)` allows many NULL externals | Medium | Duplicate calendar rows if `external_event_id` null | Prefer UNIQUE WHERE external_event_id IS NOT NULL + app-level idempotency key |
| D7 | No storage buckets / storage RLS | Medium | N/A until file uploads | Before CV upload: buckets + storage policies |
| D8 | Naming is mostly consistent (`*_own` policies, snake_case) | Low | — | Keep conventions; align AI conversation policies to `TO authenticated` |
| D9 | Cascade rules generally sound (`ON DELETE CASCADE` for user-owned trees; `SET NULL` for optional FKs) | Low | — | No change |

---

## 3. Index findings

### Coverage (verified live)

| Area | Indexes present | Assessment |
|------|-----------------|------------|
| users / profiles | `profiles_user_id_idx` + UNIQUE `user_id` | Adequate |
| jobs | user, status, discovered, title, source, composite user+status+discovered, ingestion, title/company norm | Strong; some single-column indexes may be redundant with composites at scale |
| applications | user, job, stage, user+stage, UNIQUE user+job | Strong |
| activities | user, user+created, entity | Adequate for feed |
| ai_generations | user+created, user+feature, user+status, user+model | Strong for analytics |
| ai_evaluations | generation, user+created | Adequate |
| job_emails | user+received, user+class, needs_action partial, thread, UNIQUE gmail id | Strong |
| application_events | user+app, starts_at | Adequate |
| user_integrations | user_id + UNIQUE (user_id, provider) | Adequate |

### Recommendations

| ID | Finding | Severity | Risk | Recommendation |
|----|---------|----------|------|----------------|
| I1 | Possible redundant indexes on `jobs` (`status`, `source` alone vs composites) | Low | Extra write cost | Measure with `pg_stat_user_indexes` before dropping |
| I2 | `ai_generations` analytics loads up to 500 rows client-side | Medium | Payload / CPU on large histories | Add server-side aggregate RPC or date-bounded queries in 5B |
| I3 | No BRIN/time partitioning for `ai_generations` / `activities` | Low | Growth cost later | Defer until volume warrants |

---

## 4. RLS findings

**All 17 tables have RLS enabled** (live). Core CRUD policies for profiles/companies/contacts/jobs/analysis/applications/artifacts/activities are coherent.

| ID | Finding | Severity | Risk | Recommendation |
|----|---------|----------|------|----------------|
| R1 | `user_integrations` SELECT allows cipher columns (`access_token_cipher`, `refresh_token_cipher`, `token_iv`) to authenticated owner | **High** | Malicious/compromised client can exfiltrate ciphertext + IV | Create `user_integrations_safe` view without ciphers; revoke SELECT on cipher columns from `authenticated`, or FORCE column grants |
| R2 | `job_emails` INSERT/UPDATE check `application_id` ownership but **not** `job_id` / `company_id` | **High** | Cross-user UUID attachment / integrity pollution | Extend WITH CHECK EXISTS for job/company ownership |
| R3 | `ai_conversations` INSERT/UPDATE do not validate `context_job_id` / `context_application_id` ownership | **High** | Cross-user context pointer pollution | Add EXISTS ownership checks |
| R4 | `ai_evaluations` INSERT does not require `generation_id` owned by caller | **High** | Cross-user generation FK pollution (eval row remains private via `user_id`) | WITH CHECK EXISTS on `ai_generations` |
| R5 | `ai_conversations` / `ai_messages` policies apply to `{public}` not `TO authenticated` | Medium | Policy surface wider than needed; anon still blocked by `auth.uid()` null | Recreate policies `TO authenticated` |
| R6 | `ai_messages` UPDATE WITH CHECK does not re-validate `conversation_id` | Medium | Conversation reassignment if column writable | Tighten WITH CHECK |
| R7 | `ai_generations` missing DELETE policy | Medium | Users cannot purge history via API | Add delete-own or intentional deny + document |
| R8 | `ai_evaluations` missing UPDATE policy | Medium | Cannot edit scores | Add update-own or intentional deny |
| R9 | `ai_observability_alerts` missing DELETE | Low | Ack-only lifecycle | OK for MVP; optional delete |
| R10 | `prompt_versions` SELECT for all authenticated; no user writes | Low | Catalog readable — intended | Keep; write via migrations only |
| R11 | `FORCE ROW LEVEL SECURITY` is false | Low | Table owners bypass RLS (Supabase normal) | Accept; never expose table owner to clients |
| R12 | No anonymous data access observed for owner-scoped tables | — | — | Maintain |

---

## 5. Security findings

| ID | Finding | Severity | Risk | Recommendation |
|----|---------|----------|------|----------------|
| S1 | `INGESTION_ALLOWED_USER_IDS` optional — secret alone can target any `user_id` via service role | **High** | Automation account takeover of arbitrary user data | Require allowlist in production; fail closed if unset |
| S2 | Google OAuth reconnect may overwrite `refresh_token_cipher` with NULL when Google omits refresh | **High** | Broken Google link until full reconnect | Preserve existing refresh cipher when new refresh absent |
| S3 | No `AbortSignal` timeouts on OpenAI/Google `fetch` | **High** | Hung Edge invocations; cost/DoS amplification (esp. gmail-sync) | Per-call timeouts (20–45s) + sync budget |
| S4 | Soft rate limits are check-then-act (TOCTOU) | **High** | Parallel requests bypass cooldowns | Atomic claim (row lock / upsert lease) or Edge concurrency limits |
| S5 | OAuth state HMAC uses padded/truncated secret; may share encryption key; not single-use | Medium | Replay until expiry; weaker key hygiene | Dedicated state secret; derive HMAC key; nonce store |
| S6 | `google-disconnect` does not revoke tokens at Google | Medium | Tokens valid until expiry | Call Google revoke endpoint |
| S7 | CORS `Access-Control-Allow-Origin: *` on functions | Medium | Broad browser surface | Restrict to `JOBPILOT_APP_URL` |
| S8 | Encryption key: raw strings truncated to 32 bytes (no KDF) | Medium | Weak passphrase handling | Require 64-hex or KDF |
| S9 | `ingest-job` no rate limit; batch ≤50 + optional auto-analyze | Medium | Cost spike | Quotas + lower batch when auto-analyze |
| S10 | Calendar create not idempotent / not rate-limited | Medium | Duplicate Google events | Client idempotency key + server dedupe |
| S11 | Frontend does not select cipher columns (good) but RLS still allows it | — | See R1 | — |
| S12 | No XSS sinks beyond shadcn chart `dangerouslySetInnerHTML` for CSS vars | Low | Low risk if chart config trusted | Keep config app-controlled |
| S13 | JWT validation on mutating functions (except OAuth callback) | — | Correct | Keep callback state-signed |
| S14 | Secrets in Edge env / `.env.local` gitignored; `.env.example` placeholders only | — | Good | Continue; rotate if leaked |
| S15 | SQL injection: PostgREST parameterized; Edge uses client builders | — | Good | Avoid raw SQL string concat |
| S16 | CSRF: Bearer token in header (not cookie session for API) | Low | SPA pattern OK | Keep; don’t switch to cookie-only without CSRF tokens |

---

## 6. Performance findings

| ID | Finding | Severity | Risk | Recommendation |
|----|---------|----------|------|----------------|
| P1 | Hiring Inbox loads emails + applications + jobs via parallel `useResource` (`select *`) | Medium | Over-fetch | Column projections; paginate emails |
| P2 | AI Analytics pulls up to 500 generations + aggregates in browser | Medium | Slow on heavy users | SQL aggregates / RPC |
| P3 | Dashboard / list pages often `select('*')` | Low | Bandwidth | Explicit columns |
| P4 | gmail-sync sequential classify up to 25 messages | Medium | Latency + OpenAI cost | Batch budget + timeouts (see S3) |
| P5 | Possible N+1 not severe — service layer batches by query | Low | — | Watch Application Detail artifact lists |
| P6 | Artifact version read-max then insert race | Medium | See D5 | UNIQUE + retry |

---

## 7. Migration findings

| Migration | Purpose |
|-----------|---------|
| `20260807120935_enums_helpers_and_core_schema.sql` | Core schema |
| `20260807120936_row_level_security.sql` | Core RLS |
| `20260807130532_job_analysis_metadata.sql` | Analysis metadata |
| `20260808123000_ai_conversations.sql` | Assistant |
| `20260808140000_job_ingestion_metadata.sql` | Ingest indexes/metadata |
| `20260808153000_google_gmail_calendar.sql` | Google + emails |
| `20260809160000_ai_observability.sql` | Observability |

| ID | Finding | Severity | Risk | Recommendation |
|----|---------|----------|------|----------------|
| M1 | No down/rollback migrations | Medium | Harder revert in prod | Document forward-fix; add down scripts for destructive changes |
| M2 | Order and naming are consistent (`YYYYMMDDHHMMSS_snake`) | — | — | Keep |
| M3 | No duplicate / unused migration files found | — | — | — |
| M4 | IPv6 blocks `supabase db push` on some networks; Management API used | Low | Ops friction | Prefer linked IPv4 / CI apply |
| M5 | Enum `ADD VALUE` in later migrations is forward-only | Low | Expected for PG enums | Document |

---

## 8. Edge Functions audit (summary)

| Function | JWT | Rate limit | Idempotency | Notes |
|----------|-----|------------|-------------|-------|
| analyze-job | yes (+ secret) | 30s soft | Multi-version OK | Ownership checked |
| generate-artifact | yes | 15s soft | Version race | Schema + 1 repair |
| chat-assistant | yes | 3s + daily cap | Append-only | Orphan user msg on stream fail |
| gmail-sync | yes | 120s soft | Unique gmail id | No timeouts — High |
| google-oauth-start | yes | none | — | State signed |
| google-oauth-callback | **false** | — | Upsert | Refresh-null risk — High |
| google-disconnect | yes | none | — | No Google revoke |
| hiring-email-action | yes | none | Calendar weak | Ownership checked |
| ingest-job | yes (+ secret) | **none** | URL unique | Allowlist optional — High |

Retries: artifact validation repair only; no general provider retry/backoff.

---

## 9. Recommended fixes (implementation plan)

### P0 — before broader production / multi-user launch

1. **R1** — Hide Google token cipher columns from `authenticated` (view or column privileges).
2. **S1** — Fail closed: require `INGESTION_ALLOWED_USER_IDS` when secret auth enabled.
3. **S2** — Preserve refresh token on OAuth upsert when Google omits it.
4. **S3** — Add outbound fetch timeouts; bound gmail-sync work.
5. **R2–R4** — Tighten WITH CHECK ownership for emails / conversations / evaluations.

### P1 — hardening sprint

6. **S4 / S9 / S10** — Stronger rate limits + calendar idempotency.
7. **S5 / S6 / S7** — OAuth state nonce, Google revoke on disconnect, CORS allowlist.
8. **D5** — UNIQUE on artifact version tuple.
9. **R5** — AI conversation policies `TO authenticated`.
10. **P1 / P2** — Trim selects; server-side analytics aggregates.

### P2 — scale / product maturity

11. Soft-delete strategy (D1) if product requires undo.
12. Storage policies when file uploads land (D7).
13. Index hygiene via `pg_stat_user_indexes` (I1).
14. Migration down-scripts for risky changes (M1).

**No code changes were applied in Phase 5A** (audit-only). None of the findings are “emergency patch now” for a closed beta with trusted users, but **P0 items should block public launch**.

---

## 10. Risk assessment

| Area | Residual risk | Notes |
|------|---------------|-------|
| Data isolation (happy path) | Low | RLS + Edge ownership checks work; E2E cross-user tests historically Pass |
| Data isolation (adversarial client) | Medium–High | Cipher SELECT (R1); FK pointer pollution (R2–R4) |
| Secrets / OAuth | Medium–High | Refresh wipe (S2); optional ingest allowlist (S1) |
| Availability / cost | Medium | No fetch timeouts; ingest/calendar unbounded |
| Schema integrity | Low–Medium | Live orphans 0; uniqueness gaps for artifacts/companies |
| Observability | Low | Phase 4E logging present; sanitize metadata OK |

**Overall residual risk for public production:** **Medium–High** until P0 remediations.

**Overall residual risk for closed beta / single trusted operator:** **Medium** (acceptable with monitoring).

---

## 11. Final verdict

**CONDITIONAL PASS — production-ready for closed beta; not yet hardened for open multi-tenant production.**

The platform’s core architecture (Auth → RLS → service layer → Edge Functions) is coherent, migrations are orderly, indexes cover primary workloads, and live integrity smoke checks are clean. Phase 4E observability improves operational visibility.

Blocking themes before open production:

1. Token ciphertext exposure via RLS SELECT  
2. Ingest secret fail-open allowlist  
3. OAuth refresh-token preservation  
4. Provider call timeouts  
5. FK ownership gaps in newer RLS policies  

**Phase 5A complete.** Do not implement remediations here unless explicitly approved as Phase 5B.

---

## Appendix A — Severity scale

| Level | Meaning |
|-------|---------|
| Critical | Exploitable breach or irreversible data loss under normal config |
| High | Significant security/integrity/availability risk; fix before public launch |
| Medium | Real risk or debt; schedule in next hardening sprint |
| Low | Hygiene / future-scale; track |

## Appendix B — Evidence sources

- Migrations under `supabase/migrations/`
- Edge Functions under `supabase/functions/`
- Live catalog queries via Supabase Management API (`information_schema`, `pg_policies`, `pg_indexes`, integrity counts)
- Frontend service patterns under `src/services/`
