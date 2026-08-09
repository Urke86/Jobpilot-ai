# Phase 5A.1 — P0/P1 Remediation

**Date:** 2026-08-09  
**Project:** JobPilot AI (`xzzoznhmezmaarcvavpr`)  
**Scope:** Hardening only — no new product features, no architecture redesign, no new infrastructure beyond minimal DB objects required for locks/views/RPCs.

**Quality gates:** `lint` ✅ · `typecheck` ✅ · `build` ✅

---

## 1. Implemented fixes

| ID | Fix |
|----|-----|
| **R1** | Column-level `REVOKE`/`GRANT` on `user_integrations` so `authenticated` cannot `SELECT`/`INSERT`/`UPDATE` cipher columns. Added `user_integrations_public` (security invoker) with metadata only. Frontend status reads the public view. `google-disconnect` reads ciphers via service role only. |
| **S1** | `INGESTION_ALLOWED_USER_IDS` is **fail-closed** for automation auth in `ingest-job` and `analyze-job`: missing/empty → **503**; not listed → **403**. Secret set in Edge: primary user UUID. |
| **S2** | `google-oauth-callback` preserves existing `refresh_token_cipher` when Google omits `refresh_token` on reconnect; fails closed if no refresh is available. |
| **S3** | Shared `fetchWithTimeout` + `AbortController`: OpenAI **45s**, Google **30s**, Gmail sync budget **90s**. Applied across OpenAI, Google token/API, Gmail sync, and calendar create paths. |
| **S4** | Table `rate_limit_leases` + atomic RPC `try_acquire_rate_limit`. Edge functions use leases instead of soft TOCTOU metadata cooldowns (`analyze-job`, `generate-artifact`, `chat-assistant`, `gmail-sync`, calendar create). |
| **R2** | `job_emails` INSERT/UPDATE `WITH CHECK` validates application, job, and company ownership. |
| **R3** | `ai_conversations` INSERT/UPDATE require owned `context_job_id` / `context_application_id`; policies scoped `TO authenticated`. `ai_messages` require owned conversation. |
| **R4** | `ai_evaluations` INSERT/UPDATE require owned `generation_id`. |
| **R5 / D5** | AI chat policies `TO authenticated`. Unique `(application_id, artifact_type, version)` after dedupe. |
| **P2** | RPC `ai_analytics_summary()` (SECURITY INVOKER) aggregates spend/latency/usage/success; frontend prefers RPC. |

**Deployed Edge functions:** `analyze-job`, `generate-artifact`, `chat-assistant`, `gmail-sync`, `google-oauth-callback`, `google-disconnect`, `hiring-email-action`, `ingest-job`.

**Migration applied remotely:** `supabase/migrations/20260809180000_phase5a1_hardening.sql`.

> **5A.2 note:** Objects were present, but `supabase_migrations.schema_migrations` initially lacked `20260809160000` and `20260809180000` (Management API apply without history rows). Re-audit recorded those versions. Prefer `supabase db push` / migration repair going forward.

---

## 2. Schema changes

- **Privileges:** `user_integrations` cipher columns (`access_token_cipher`, `refresh_token_cipher`, `token_iv`) granted only to owner/`service_role` (not `authenticated`/`anon`).
- **View:** `public.user_integrations_public` — connection metadata only.
- **Table:** `public.rate_limit_leases` (`user_id`, `lease_key`, `expires_at`, unique `(user_id, lease_key)`), RLS own-row.
- **Functions:**
  - `try_acquire_rate_limit(p_lease_key, p_ttl_seconds, p_user_id default null)` — SECURITY DEFINER, atomic upsert/expire.
  - `ai_analytics_summary()` — SECURITY INVOKER, returns jsonb metrics for `auth.uid()`.
- **Policies:** tightened `job_emails`, `ai_conversations`, `ai_messages`, `ai_evaluations`; `ai_generations` DELETE own.
- **Constraint:** `application_artifacts_app_type_version_unique`.

---

## 3. Security changes

- Ciphertext no longer readable by browser JWT clients (PostgREST privilege error `42501` on cipher `SELECT`).
- Automation ingest/analyze require configured allowlist (no fail-open).
- OAuth reconnect cannot wipe refresh cipher when Google returns access-only tokens.
- Outbound HTTP bounded by timeouts; Gmail sync stops at budget.
- Concurrent soft limits replaced with DB leases (duplicate acquire → deny).
- Cross-entity RLS WITH CHECK closes ownership gaps on emails, conversations, evaluations.
- Disconnect/revoke still decrypts tokens server-side only; logs remain metadata-oriented (no secret dumps).

**Ops note:** `INGESTION_ALLOWED_USER_IDS` must stay set in Edge secrets for any automation path. JWT-authenticated user ingest/analyze does not use the allowlist.

**5A.3 follow-ups:** ingest→analyze timeout fixed; Auth `mailer_autoconfirm=false`; CORS allowlist; PITR still off — see `docs/PHASE5A3_PRODUCTION_GATE.md`.

---

## 4. Performance changes

- Heavy AI analytics aggregations moved server-side via `ai_analytics_summary()` (daily/monthly/weekly spend, latency, feature/model usage, success rate, etc.).
- Client still may merge a limited local generation sample for slowest/failures UX if needed; primary totals come from RPC.

---

## 5. Regression results

| Flow | Result | Notes |
|------|--------|-------|
| **A** Google connect | SKIP | No `user_integrations` Google rows in DB at test time; requires live OAuth UI. |
| **B** Reconnect | SKIP | Code path verified (preserve cipher); live reconnect needs Google. |
| **C** Force expiration | SKIP | Refresh path + preserve logic reviewed; live expiry needs connected account. |
| **D** Gmail sync | SKIP | Requires connected Google. |
| **E** Timeouts | PASS (code/deploy) | `fetchWithTimeout` deployed; live hang not simulated against OpenAI/Google. |
| **F** Duplicate execution | PASS | Lease acquire then deny on same key. |
| **G** AI analytics | PASS | RPC returns spend/latency/usage/success keys. |
| **H** Evaluation persistence | PASS | Foreign `generation_id` → `42501`; own generation eval insert OK. |
| **I** Prompt version tracking | PASS | Seeded `prompt_version` readable under RLS. |
| **J** Cross-user isolation | PASS | `ai_generations` SELECT returns only caller rows. |
| **K** Browser payload sanitization | PASS | Cipher select blocked; public view has no cipher columns. |

**S1 probes:** missing allowlist → **503**; invalid UUID → **403**; allowlisted UUID passes allowlist (continues into normal validation).

**JWT validation:** sign-in session OK for probe user.

---

## 6. Remaining risks

1. **Google Flows A–D not live-exercised** in this pass (no connected Google integration). Recommend one manual connect → reconnect → expire → sync cycle before public launch.
2. **Timeout hang tests** are structural (AbortController), not full chaos against stalled upstreams.
3. **Lease fail-closed on RPC error** returns deny (`429` path) — correct for safety; transient DB errors may briefly throttle users.
4. **`INGESTION_ALLOWED_USER_IDS` is a hard dependency** for secret-based automation; empty config correctly disables automation.
5. **Authenticated users can still mutate non-cipher integration columns** (email/scopes/metadata) under RLS; token writes remain service-role. Acceptable; further lockdown would be P2.
6. **Service-role bypass** still exists by design for Edge workers — protect `SUPABASE_SERVICE_ROLE_KEY` and Edge secrets.

---

## 7. Final verdict

**PASS for public multi-tenant readiness on audited P0/P1 items**, with the operational caveat that Google connect/reconnect/sync should be manually smoke-tested once an account is linked.

Prior Phase 5A “Conditional PASS” blockers (cipher exposure, allowlist fail-open, refresh loss, missing timeouts, rate-limit races, RLS WITH CHECK gaps, client-side analytics) are remediated in schema + Edge + client.

---

## File index

| Area | Paths |
|------|--------|
| Migration | `supabase/migrations/20260809180000_phase5a1_hardening.sql` |
| Shared | `supabase/functions/_shared/fetch-timeout.ts`, `rate-limit.ts`, `google-auth.ts`, `email-classify.ts` |
| Edge | `google-oauth-callback`, `google-disconnect`, `ingest-job`, `analyze-job`, `generate-artifact`, `chat-assistant`, `gmail-sync`, `hiring-email-action` |
| Client | `src/services/app/google-integration.ts`, `src/services/app/ai-observability.ts`, `src/types/database.ts` |
