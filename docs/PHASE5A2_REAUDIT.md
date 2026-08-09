# Phase 5A.2 — Independent Re-Audit & Production Readiness Verification

**Date:** 2026-08-09  
**Project:** JobPilot AI (`xzzoznhmezmaarcvavpr`)  
**Auditor stance:** Do not trust 5A.1 claims; re-verify with live/controlled tests.  
**Quality gates (this pass):** `lint` ✅ · `typecheck` ✅ · `build` ✅

---

## Scope

Independent verification that Phase 5A.1 remediations actually hold under adversarial and production-like conditions. No feature work. One minimal High fix applied: record missing migration history rows after confirming objects already exist.

---

## Methodology

1. Two controlled users (`reaudit-a@jobpilot.test`, `reaudit-b@jobpilot.test`) via Auth Admin + anon JWT clients.
2. Live PostgREST privilege/RLS probes (select/update/delete/insert with forged FKs).
3. Live Edge probes (`ingest-job`, `analyze-job`, `chat-assistant`, `gmail-sync`, `google-oauth-start`, `google-disconnect`).
4. SQL integrity aggregates + `EXPLAIN (FORMAT JSON)` on high-value paths.
5. Dist bundle secret scan against known secret values from `.env.local` / service role.
6. Migration history vs repo files; object existence checks.
7. Observability row sampling by feature/status (no content dumped).
8. Google: OAuth start + disconnect verified; full interactive Google account cycle **not** available in this environment (no test Google credentials / browser OAuth).

Temporary harness scripts were used and removed after evidence capture.

---

## Prior findings verification

| ID | Claim | Independent result | Evidence |
|----|-------|--------------------|----------|
| **R1** | Client cannot access cipher columns | **VERIFIED** | JWT `SELECT` → `42501`; `information_schema.column_privileges` shows **0** grants to `authenticated`/`anon`/`PUBLIC` on cipher/`token_iv`. Public view returns metadata keys only. |
| **S1** | Allowlist fail-closed | **VERIFIED** | Secret `INGESTION_ALLOWED_USER_IDS` present. Random UUID → **403**. Allowlisted UUID passes allowlist gate. Missing-config **503** confirmed in 5A.1; not re-unset live (would break automation). |
| **S2** | Reconnect preserves refresh cipher | **VERIFIED (simulated)** | Seeded opaque refresh cipher → reconnect-without-refresh update preserved identical cipher + `refresh_preserved` metadata. Live Google omit-refresh reconnect **not** executed (see Google smoke). Callback code path reviewed. |
| **S3** | Outbound timeouts | **MOSTLY VERIFIED** | OpenAI/Google/Gmail/calendar paths use `fetchWithTimeout` (45s/30s + Gmail budget). Abort behavior live: abort ~200ms on delayed URL. **Gap (Medium):** `ingest-job` still uses raw `fetch` to call `analyze-job` (2 call sites) without AbortController. |
| **S4** | Atomic leases | **VERIFIED** | RPC parallel 8× → **1 win / 7 lose**. TTL recovery after 1s works. Invalid key → `false`. Edge `analyze-job` parallel with valid job → **1×200 + 4×429**. Edge `chat-assistant` → **1×200 + 3×429**. |
| **R2** | `job_emails` ownership | **VERIFIED** | Foreign job/company/application inserts → `42501`. Integrity: 0 bad owner rows. |
| **R3** | `ai_conversations` context ownership | **VERIFIED** | Foreign job/application context inserts → `42501`. |
| **R4** | `ai_evaluations` generation ownership | **VERIFIED** | Foreign generation insert → `42501`. Integrity: 0 mismatched owners. |
| **D5** | Artifact version uniqueness | **VERIFIED** | Concurrent duplicate inserts all rejected; DB unique constraint present; 0 duplicate groups. |
| **P2** | Analytics server-side | **VERIFIED with residual** | Live RPC returns spend/latency/usage/success fields. Client **still** fetches 100 generations + 50 evals for local merge (**Low** residual). |

---

## Adversarial multi-tenant tests

Users A vs B. Expected: no cross-tenant read/mutate.

| Vector | Result |
|--------|--------|
| Jobs SELECT/UPDATE/DELETE by foreign UUID | Blocked / empty |
| Applications SELECT foreign | Empty |
| Companies SELECT foreign | Empty |
| `job_emails` insert pointing at B’s job/company/application | `42501` |
| `ai_conversations` context → B’s job/application | `42501` |
| `ai_evaluations` → B’s generation | `42501` |
| `ai_generations` SELECT foreign | Empty |
| Activities SELECT `user_id=B` | Empty |
| `user_integrations_public` SELECT `user_id=B` | Empty |
| `application_artifacts` insert on B’s application | `42501` |
| `application_events` SELECT foreign / insert on B’s application | Empty / `42501` |

**Conclusion:** No cross-tenant leak observed on exercised vectors.

---

## Google smoke test (G1–G9)

| Flow | Result | Notes |
|------|--------|-------|
| **G1** Connect | **PARTIAL** | `google-oauth-start` → **200** with `url` + `scopes`. Interactive consent not completed (no test Google account in agent environment). |
| **G2** Refresh stored encrypted | **PARTIAL** | Cannot confirm real Google tokens. Privileges prevent client cipher reads. Service-role storage path exists. |
| **G3** Reconnect | **NOT RUN** | Requires live Google. |
| **G4** Preserve refresh if omitted | **SIMULATED PASS** | See S2. |
| **G5** Force access expiry | **PARTIAL** | Seeded expired `expires_at`; no live refresh against Google APIs. |
| **G6** Gmail sync + refresh | **NOT RUN** | Without connect: sync returns **400** “Connect Google…”. |
| **G7** Calendar event | **NOT RUN** | Requires connected Google + explicit confirm. |
| **G8** Disconnect | **PASS** | `google-disconnect` → **200** `{status:"disconnected"}`. |
| **G9** Ciphertext removed | **PASS** | Row count for user/provider google: **1 → 0** after disconnect. Client cipher select still `42501`. |

**Cleanup:** Disconnect deletes integration row; opaque smoke ciphers removed.

---

## Rate limit / concurrency

| Test | Result |
|------|--------|
| RPC parallel lease | 1 acquire / rest deny |
| Lease TTL recovery | Reacquire after expiry |
| Invalid lease key | Fail-closed `false` |
| `analyze-job` ×5 | 1 success, 4×429 |
| `chat-assistant` ×4 | 1 success (SSE), 3×429 |
| `gmail-sync` ×3 | 400 (not connected) — lease path not reached |
| Ingestion allowlist deny | 403 |

**RPC failure fail-closed:** Edge helper returns deny on RPC error (code review). Invalid args return `false` live.

**Stale locks:** TTL recovery verified at 1s.

---

## Timeout / failure testing

| Case | Result |
|------|--------|
| AbortController timeout | Live abort ~200ms |
| Provider path timeouts | Code+deploy verified on OpenAI/Google/Gmail/calendar |
| Provider 429/5xx / malformed JSON | Not injected against live OpenAI in this pass; paths return sanitized JSON errors and record non-success observability statuses historically (`provider_error` rows present) |
| Partial success | Analyze lease before OpenAI reduces duplicate spend; chat persists user message then streams (pre-existing pattern — not newly broken) |
| `ingest-job` → `analyze-job` fetch | **Unbounded** (Medium) |

---

## Database integrity

Live counts (approx at probe time): jobs 26, applications 7, companies 14, job_emails 6, ai_generations 11, ai_evaluations 1, user_integrations 2.

| Check | Result |
|-------|--------|
| Duplicate artifact versions | **0** |
| Orphan applications/jobs FK | **0** |
| `job_emails` ownership mismatches | **0** |
| `ai_evaluations` vs generation owner mismatch | **0** |
| Success gens missing cost/tokens | **0** |

---

## Query-plan review

| Path | Plan note |
|------|-----------|
| Jobs list by `user_id` ORDER BY `created_at` | Seq scan in EXPLAIN on empty/tiny cardinality for probe UUID; **`jobs_user_id_idx` / composite indexes exist** — acceptable at current scale; watch as rows grow. |
| Applications list | Index scan (`applications_user_stage_idx`) |
| Hiring inbox (`job_emails`) | Index scan (`job_emails_user_received_idx`) |
| Latest `job_analysis` | Index scan (`job_analysis_job_created_desc_idx`) |
| AI Analytics RPC | Cheap Result node wrapping function |
| Artifact history | Sort over app-scoped index |
| Generations by user | Index-backed |

**No new indexes added** (no measured pain at current row counts). Redundant-looking artifact indexes (btree + unique on similar keys) are Low/Informational only.

---

## Secrets / client exposure

| Surface | Result |
|---------|--------|
| Built `dist` JS vs ingestion secret / Google client secret / encryption key / OAuth state / service role | **No hits** |
| Anon key in bundle | Present (expected) |
| Client env usage | Only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
| localStorage | Theme only (no tokens) |
| Cipher columns via REST | Blocked |
| Edge secret names | Present: OpenAI, Google*, ingestion*, encryption key, service role (server-side only) |

---

## Migration consistency

| Check | Result |
|-------|--------|
| Repo migrations | 8 SQL files through `20260809180000` |
| Remote `schema_migrations` (initial) | Stopped at `20260808153000` despite objects from later migrations existing |
| Severity | **High** — Management API apply without history |
| Remediation applied | Inserted `20260809160000` (`ai_observability`) and `20260809180000` (`phase5a1_hardening`) into `schema_migrations` |
| Post-fix | Remote history matches repo versions |
| Objects | `rate_limit_leases`, `user_integrations_public`, `try_acquire_rate_limit`, `ai_analytics_summary`, artifact unique — present |

`PHASE5A_REMEDIATION.md` updated with this correction.

---

## Observability validation

Sampled `ai_generations` by feature/status:

- `analyze_job` / success — prompt_version, model, latency present  
- `assistant` / success + `provider_error`  
- `cover_letter` / success  
- `gmail_classification` / success  
- Shared helper avoids logging full email/CV bodies  

Central writes exist for main AI paths. Residual `custom`/`provider_error` rows consistent with failure recording (not false success).

---

## Production configuration

| Item | Classification | Notes |
|------|----------------|-------|
| Live interactive Google OAuth smoke (G1–G7 full) | **BLOCKER** for open production confidence; **REQUIRED BEFORE OPEN BETA** for Gmail/Calendar features | Not completed here |
| Email confirmation (`mailer_autoconfirm: true`) | **REQUIRED BEFORE OPEN BETA** | Auto-confirm OK for closed beta; disable for public |
| Password reset / site URL / redirect allow-list | **REQUIRED BEFORE OPEN BETA** | Auth config readable; harden production URLs |
| Google OAuth app verification / production status | **REQUIRED BEFORE OPEN BETA** if non-test users | Not inspected in Google Cloud console |
| `INGESTION_ALLOWED_USER_IDS` maintained | **REQUIRED BEFORE OPEN BETA** for automation | Present; fail-closed if removed |
| CORS via `JOBPILOT_APP_URL` | **REQUIRED BEFORE OPEN BETA** | Prefer explicit origin over `*` |
| Frontend production URL | **REQUIRED BEFORE OPEN BETA** | Confirm deploy env |
| Rate-limit defaults / AI daily caps | **RECOMMENDED LATER** | Working; tune with traffic |
| Log retention / PITR / backups | **REQUIRED BEFORE OPEN BETA** | Confirm in Supabase dashboard (not fully API-verified here) |
| `ingest-job` outbound timeout | **RECOMMENDED LATER** (Medium) | Bound internal fetch |
| Residual client analytics fetch (100 gens) | **RECOMMENDED LATER** (Low) | Move remaining merge server-side |

---

## Remaining findings

| ID | Severity | Finding |
|----|----------|---------|
| G-SMOKE | **High** (feature readiness) | Full Google connect/reconnect/refresh/sync/calendar not live-verified |
| MIG-DRIFT | **High** → **Mitigated** | History rows missing; recorded during this audit |
| S3-INGEST | **Medium** → **Mitigated in 5A.3** | `ingest-job` now uses `fetchWithTimeout` (50s) for analyze-job proxy |
| AUTH-AUTOCONFIRM | **Medium** (open) | `mailer_autoconfirm: true` |
| P2-RESIDUAL | **Low** | Client still loads 100 gens + 50 evals after RPC |
| JOBS-SEQ | **Informational** | Jobs list EXPLAIN seq-scan at tiny scale; indexes exist |

No **Critical** issues conclusively found in this re-audit.

---

## Readiness verdicts

### CLOSED BETA — **PASS**

P0/P1 remediations hold under live RLS/privilege/lease/allowlist tests. Secrets not in client bundle. Integrity clean. Suitable for trusted closed beta with known users, provided operators keep allowlist/secrets configured.

**Blockers:** none for closed beta core app (non-Google). Google features remain best-effort until G1–G7 completed manually.

### LIMITED PUBLIC BETA — **CONDITIONAL PASS**

**Blockers / required before launch:**

1. Complete manual Google smoke G1–G7 with a real test account (if Gmail/Calendar marketed).  
2. Turn off auth auto-confirm; configure production site URL + redirect URLs + password reset.  
3. Confirm CORS origin, backups/PITR, and production frontend env.  
4. Keep migration discipline (`db push` / repair) — history now aligned.

### OPEN MULTI-TENANT PRODUCTION — **CONDITIONAL PASS** (effectively **not ready** until conditions cleared)

Same as limited public beta, plus:

1. Google OAuth production verification / branding for unverified apps.  
2. Sustained load + timeout chaos against OpenAI/Google.  
3. Ops runbooks for allowlist, key rotation, lease/TTL incidents.  
4. Prefer fixing Medium `ingest-job` timeout gap before wide automation traffic.

---

## Final statement

5A.1 remediations for R1, S1, S4, R2–R4, D5, and P2 (primary path) are **independently confirmed live**. S2/S3 are confirmed by simulation + code/deploy, with Google live cycle and ingest internal fetch as residual gaps. Migration history drift was real and **mitigated**.  

**Do not start Phase 5B** until product owners accept the limited-public conditions above (especially Google smoke if integrations are in scope).
