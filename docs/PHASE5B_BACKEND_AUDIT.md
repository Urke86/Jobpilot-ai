# PHASE 5B — Backend & Edge Functions Audit

**Date:** 2026-08-10  
**Project:** JobPilot AI (`xzzoznhmezmaarcvavpr`)  
**Scope:** Audit + minimal High hardening only. No new product features. No Phase 5C.

---

## 1. Function inventory

### Repository (`supabase/functions/`)

| Function | Entry | Shared deps |
|----------|-------|-------------|
| `analyze-job` | `analyze-job/index.ts` | cors, fetch-timeout, rate-limit, ai-observability |
| `generate-artifact` | `generate-artifact/index.ts` | cors, fetch-timeout, rate-limit, ai-observability |
| `chat-assistant` | `chat-assistant/index.ts` | cors, fetch-timeout, rate-limit, ai-observability |
| `ingest-job` | `ingest-job/index.ts` | cors, fetch-timeout, rate-limit |
| `gmail-sync` | `gmail-sync/index.ts` | cors, fetch-timeout, rate-limit, google-auth, google-crypto, email-classify, ai-observability |
| `google-oauth-start` | `google-oauth-start/index.ts` | google-auth, cors |
| `google-oauth-callback` | `google-oauth-callback/index.ts` | google-auth, google-crypto, cors |
| `google-disconnect` | `google-disconnect/index.ts` | google-auth, google-crypto, cors |
| `hiring-email-action` | `hiring-email-action/index.ts` | google-auth, fetch-timeout, rate-limit, cors |

**Shared helpers:** `_shared/cors.ts`, `fetch-timeout.ts`, `rate-limit.ts`, `ai-observability.ts`, `google-auth.ts`, `google-crypto.ts`, `email-classify.ts`

**No other Edge Function directories** in the repo. Calendar creation lives only in `hiring-email-action` (`create_calendar_event`).

### Live deployed (Management API, post-5B redeploy)

| name | status | version | verify_jwt |
|------|--------|---------|------------|
| analyze-job | ACTIVE | 15 | true |
| generate-artifact | ACTIVE | 10 | true |
| chat-assistant | ACTIVE | 12 | true |
| ingest-job | ACTIVE | 8 | true |
| google-oauth-start | ACTIVE | 7 | true |
| google-oauth-callback | ACTIVE | 8 | **false** (browser redirect + signed state) |
| google-disconnect | ACTIVE | 10 | true |
| gmail-sync | ACTIVE | 12 | true |
| hiring-email-action | ACTIVE | 9 | true |

**Inventory match:** repo ↔ deployed is 1:1. No stale orphan functions. All nine redeployed after 5B High fixes.

### Edge secrets present (names only)

`OPENAI_API_KEY`, `INGESTION_SECRET`, `INGESTION_ALLOWED_USER_IDS`, `AUTO_ANALYZE_INGESTED_JOBS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, `GOOGLE_OAUTH_STATE_SECRET`, `JOBPILOT_APP_URL`, plus platform Supabase keys.

Local hygiene (lengths only): `GOOGLE_OAUTH_STATE_SECRET` and `GOOGLE_TOKEN_ENCRYPTION_KEY` are 64-char hex; distinct secrets configured.

---

## 2. Methodology

1. Exact inventory from filesystem + Supabase Management API.  
2. Static review of every function/helper against auth, ownership, validation, AI boundaries, rate limits, idempotency, timeouts, retries, partial failure, observability, sanitization, secrets, service-role, performance, cost, CORS.  
3. Cross-check with Phase 5A docs and prior Google smoke results.  
4. Minimal High fixes applied + static regression script `scripts/verify-5b-hardening.cjs`.  
5. Redeploy all functions; run lint / typecheck / build + prior ingest-timeout script.  
6. Medium/Low left as catalog only (no redesign).

---

## 3. Auth / ownership review

| Function | Auth | Identity source | Trusts body `user_id`? | Ownership |
|----------|------|-----------------|------------------------|-----------|
| analyze-job | JWT **or** ingest secret | `auth.getUser()` / allowlisted `target_user_id` | JWT: **no**. Secret: only allowlisted target | `job.user_id === actingUserId` |
| generate-artifact | JWT | `getUser()` | **no** | application + linked job `user_id` |
| chat-assistant | JWT | `getUser()` | **no** | conversation; context IDs filtered by owner |
| ingest-job | JWT **or** ingest secret | `getUser()` / allowlisted UUID | JWT ignores body ids. Secret: UUID + allowlist | all writes scoped to resolved user |
| gmail-sync | JWT | `requireUserClient` → `getUser()` | n/a | integration/emails/apps by `user_id` |
| google-oauth-start | JWT | `getUser()` | n/a | state binds `uid` |
| google-oauth-callback | signed OAuth `state` | HMAC-verified `uid` | n/a | upsert `user_id,provider` |
| google-disconnect | JWT | `getUser()` | n/a | delete by `user_id` |
| hiring-email-action | JWT | `getUser()` | n/a | email/application checks before mutate |

**Exceptions (documented, gated):** automation paths use service role + `x-jobpilot-ingest-secret` + `INGESTION_ALLOWED_USER_IDS` fail-closed. This is intentional for n8n/ingest→analyze.

**Result:** No Critical auth bypass. Protected functions do not trust browser-supplied identity on the JWT path.

---

## 4. Validation review

| Function | Validation posture |
|----------|-------------------|
| analyze-job | `jobId` required; min description 80; AI output Zod; **prompt input clipped** (5B); `max_tokens` set |
| generate-artifact | `applicationId` + enum type; min lengths; output Zod; **user notes/instruction/JD/CV clipped** (5B); `max_tokens` |
| chat-assistant | message 1–8000; history 20; context budget 14k; `max_tokens` 1200; daily soft cap |
| ingest-job | Zod job payload; batch ≤50; UUID for automation target; enums/URLs normalized |
| gmail-sync | no body schema; hard caps messages/lookback/body chars |
| oauth-start/callback/disconnect | method + required query/code/state |
| hiring-email-action | action enum; stage allowlist; calendar fields required; weak ISO/length checks remain |

---

## 5. AI boundary review

| Path | Separation | Residual risk |
|------|------------|---------------|
| analyze-job | Fixed system prompt; labeled user payload | Job/CV text can attempt instruction override; schema + anti-hallucination rules constrain output |
| generate-artifact | System + type instructions; labeled sections | `custom` + `userInstruction` is highest injection surface |
| chat-assistant | Product system + second system context block | Job text in system-context channel is residual |
| email-classify | System “use only provided”; Zod enums | Email body can skew classification/auto-match; destructive stage/calendar still user-confirmed |

**Provider secrets never enter prompts.** No tool/agent execution from untrusted text.

---

## 6. Rate / idempotency review

| Function | Rate limit | Idempotency |
|----------|------------|-------------|
| analyze-job | lease `analyze-job:{jobId}` 30s | Re-run creates new analysis rows |
| generate-artifact | lease `generate-artifact:{app}:{type}` 15s | Versioned inserts (intentional) |
| chat-assistant | lease 3s + soft gaps + daily cap ~80 | Not request-idempotent |
| ingest-job | **lease `ingest-job:{userId}` 15s (5B)** | URL dedupe + unique races; soft title/company window |
| gmail-sync | lease `gmail-sync` 120s | `gmail_message_id` unique / skip classified |
| calendar | lease 30s soft key | **Not durable** across TTL; new Google IDs bypass uniqueness |
| oauth-callback | none | Upsert by user+provider; state nonce not consumed |
| oauth-start / disconnect / most hiring actions | none | disconnect is idempotent-ish |

---

## 7. Timeout / retry matrix

| Outbound | Timeout | Used by |
|----------|---------|---------|
| OpenAI | 45s (`OPENAI_TIMEOUT_MS`) | analyze, generate, chat (stream start), email-classify |
| Analyze proxy | 50s (`ANALYZE_PROXY_TIMEOUT_MS`) | ingest → analyze |
| Google APIs | 30s (`GOOGLE_TIMEOUT_MS`) | token, userinfo, revoke, Gmail, Calendar |
| Gmail sync wall | 90s (`GMAIL_SYNC_BUDGET_MS`) | gmail-sync loop |

**Retries:** essentially none for provider HTTP (fail/skip). generate-artifact has one schema **repair** call. analyze-job has metadata-column insert fallback. No exponential backoff storms observed.

**Gap (Medium):** chat stream body has no idle timeout after headers; no transient 429/5xx retry with backoff (acceptable for cost control; availability tradeoff).

---

## 8. Partial-failure matrix

| Workflow | Failure mode | Behavior |
|----------|--------------|----------|
| ingest: company→job→activity→analyze | analyze timeout/fail | Job kept; `analysis_error`; batch continues |
| analyze: status analyzing→OpenAI→insert | timeout/unhandled | **Fixed 5B:** catch resets to `reviewed` |
| generate: OpenAI→validate→insert | AI fail | Nothing persisted (repair may spend twice) |
| chat: persist user→OpenAI | provider fail | **Fixed 5B:** delete orphaned user message |
| gmail-sync | per-message fail | Best-effort; budget stop; metadata updated |
| calendar: Google→DB | DB fail | **Fixed 5B:** HTTP 500 + `calendar_persist_failed` + google event id for reconciliation (orphan Google event possible) |
| OAuth: exchange→encrypt→upsert | persist fail | Redirect error; no token leakage |

**Still needed for open prod:** durable calendar idempotency / compensating delete of orphan Google events.

---

## 9. Observability review

AI paths record `ai_generations` (feature, model, prompt version, status, latency, tokens, cost, sanitized metadata). Console logs use status/codes — not CV/email bodies/tokens/API keys.

Gaps (Low/Medium): 429 paths often skip `ai_generations`; ingest has summary counts only.

---

## 10. Secret / service-role review

| Secret | Handling |
|--------|----------|
| OPENAI_API_KEY | Edge only; not in Vite bundle; errors sanitized |
| GOOGLE_CLIENT_SECRET | Edge only |
| GOOGLE_TOKEN_ENCRYPTION_KEY | Edge only; AES-GCM |
| GOOGLE_OAUTH_STATE_SECRET | Edge only; **required** (5B removed encryption-key fallback) |
| INGESTION_SECRET | Edge header; timing-safe compare |
| SERVICE_ROLE | Edge automation / cipher paths only |

`.env.example` lists names/placeholders only. Tracked env file is `.env.example` only.

### Service-role inventory

| Use | Justification | Gate |
|-----|---------------|------|
| ingest automation writes | n8n without user JWT | secret + allowlist |
| analyze automation | ingest proxy | secret + allowlist + ownership |
| OAuth callback upsert ciphers | cipher columns revoked from authenticated | signed state uid |
| Token refresh / disconnect cipher access | R1 lockdown | JWT user first |
| gmail-sync metadata cipher updates | refresh writeback | JWT user first |

No unnecessary client-side service role.

---

## 11. Performance findings

Meaningful only:

1. **ingest-job** sequential batch + optional sync analyze (up to 50 × 50s) — edge runtime risk.  
2. **URL dedupe** loads ≤200 URL jobs into memory — can miss duplicates for heavy users (unique constraint still races safely).  
3. AI functions: sequential fixed lookups (not N+1 loops) — acceptable.

No blind micro-optimizations applied.

---

## 12. Cost-control findings

| Control | Status |
|---------|--------|
| analyze/generate `max_tokens` | **Added 5B** (2500 / 3000) |
| Prompt size caps analyze/generate | **Added 5B** |
| chat max_tokens + context + daily cap | Strong |
| Gmail prefilter + body cap + AI classify | Present |
| ingest rate lease | **Added 5B** |
| Cross-feature daily $ cap | Absent (open-prod gap) |
| Artifact repair second call | Cost double on validation fail |

---

## 13. Provider-failure posture

| Provider case | Expected behavior |
|---------------|-------------------|
| OpenAI 401/403/429/5xx | Generic 502; no raw payload to client; analyze resets status |
| OpenAI timeout | AbortError → catch → status reset (5B) |
| OpenAI malformed JSON/schema | 502; not saved; observability validation_failed |
| Google invalid_grant / revoked refresh | Token helper fails; sync/action error; no cipher wipe unless disconnect |
| Google 429/5xx/timeout | 502 / skip message; no infinite wait |
| Analyze proxy timeout | Job kept; sanitized analysis_error |

Live adversarial provider simulation was not re-run end-to-end in 5B; posture verified by code path review + prior 5A.3 Google smoke (G5–G9).

---

## 14. CORS audit

Allowlist helper (`cors.ts`): `JOBPILOT_APP_URL` + localhost/127.0.0.1 Vite ports; unknown origins not reflected; `Vary: Origin`.

| Function family | Preflight | JSON Origin bind |
|-----------------|-----------|------------------|
| Google functions | pass `req` | pass `req` |
| AI + ingest (pre-5B) | OPTIONS OK | **bug:** omitted `req` → first allowlist origin |
| AI + ingest (post-5B) | OPTIONS OK | **`createJsonResponse(req)`** |

Both `localhost` and `127.0.0.1` covered when present in allowlist.

Residual Medium: no explicit `Access-Control-Allow-Methods`.

---

## 15. Deployment consistency

After 5B redeploy: all ACTIVE versions bumped; sources include shared CORS/timeout/rate-limit/google-auth updates. **No redeploy debt remaining for audited functions.**

`google-oauth-callback` `verify_jwt=false` is intentional and documented.

---

## 16. Test coverage gaps

| Area | Coverage |
|------|----------|
| ingest→analyze timeout | `scripts/verify-5a3-ingest-timeout.cjs` |
| 5B High static regressions | `scripts/verify-5b-hardening.cjs` **(new)** |
| Ownership forged IDs | Manual/prior 5A adversarial; no automated suite |
| Rate lease concurrency | RPC exists; no parallel harness |
| OAuth refresh preserve | Prior smoke; no unit test |
| Structured AI Zod | Runtime only |
| Calendar durable idempotency | `scripts/verify-5b1-remediation.cjs` + live unique-index checks (5B.1) |
| CORS Origin matrix live | Static helper test only |

High-value missing tests listed above; no large suite created during audit.

---

## 17. Dead code / cleanup candidates

- Soft metadata cooldowns superseded by `rate_limit_leases` (confirm no leftover dead branches in older docs).  
- n8n docs may still imply broader automation than allowlisted secret path.  
- No obsolete Edge function directories found.  
- Do not delete without separate cleanup PR.

---

## 18. Documentation drift

| Doc | Drift |
|-----|-------|
| PHASE5A\* | Still accurate for 5A; 5B supersedes residual CORS/ingest-rate/cost notes |
| GOOGLE_INTEGRATION.md | Mostly aligned; calendar persist-fail semantics updated in code |
| AI_ANALYSIS / AI_ARTIFACTS | Should note max_tokens + input clipping (now in code) |
| N8N_AUTOMATION.md | Must emphasize allowlist fail-closed + ingest rate lease |
| ARCHITECTURE / DATABASE | No major contradiction found |
| AI_OBSERVABILITY | Aligned; 429 gap minor |

---

## 19. High fixes performed in 5B

| ID | Fix | Functions |
|----|-----|-----------|
| B1 | Bind CORS `Origin` via `createJsonResponse(req)` | analyze, generate, chat, ingest |
| B2 | Reset job `analyzing` → `reviewed` on unhandled/timeout | analyze-job |
| B3 | Prompt clipping + `max_tokens` | analyze-job, generate-artifact |
| B4 | Rollback orphaned user message on OpenAI fail | chat-assistant |
| B5 | Per-user ingest rate lease (15s) | ingest-job |
| B6 | Calendar DB persist failure returns 500 + reconciliation ids | hiring-email-action |
| B7 | Require dedicated `GOOGLE_OAUTH_STATE_SECRET` (≥32); remove encryption-key fallback | google-auth |

Regression: `node scripts/verify-5b-hardening.cjs` — PASS.  
Redeploy: all 9 functions — ACTIVE.

---

## 20. Findings catalog

### Critical

*None.*

### High (open / residual after fixes)

**None remaining after Phase 5B.1.** See `docs/PHASE5B1_REMEDIATION.md`.

| ID | Area | Status |
|----|------|--------|
| H1 | Calendar durable idempotency | **Closed** — deterministic Google event id + `application_events.idempotency_key` unique |
| H2 | Ingest URL dedupe scalability | **Closed** — `jobs.normalized_job_url` + partial unique index; indexed lookup |

### Medium

| ID | Area | Finding | Gate impact |
|----|------|---------|-------------|
| M1 | AI | Residual prompt injection (custom artifacts, email classify, job text in chat system context) | Open prod hardening / monitoring |
| M2 | OAuth | State nonce not single-use; no PKCE | Limited public+ |
| M3 | Rate limit | Leases TTL-only (no early release) | Reliability |
| M4 | Chat | Stream body lacks idle timeout | Reliability |
| M5 | CORS | Missing `Access-Control-Allow-Methods` | Low browser friction |
| M6 | Hiring | Non-calendar actions unthrottled; weak datetime/length validation | Limited public+ |
| M7 | Cost | No global daily AI $ cap across features | Open prod |
| M8 | Ingest | Sequential batch + sync analyze can hit edge time limits | Limited public+ |
| M9 | Observability | Many 429 paths skip `ai_generations` | Ops |
| M10 | gmail-sync | Admin metadata update by integration `id` without redundant `user_id` filter | Defense-in-depth |

### Low

| ID | Finding |
|----|---------|
| L1 | OAuth reconnect inserts activity each time |
| L2 | analyze automation `target_user_id` not UUID-validated (ingest is) |
| L3 | No provider retry/backoff for transient 5xx |
| L4 | Disconnect does not purge historical emails/events (likely intentional) |

### Informational

| ID | Note |
|----|------|
| I1 | chat-assistant has strongest cost posture of AI trio |
| I2 | Cipher columns remain revoked from authenticated clients (5A R1) |
| I3 | callback `verify_jwt=false` is correct with HMAC state |
| I4 | Artifact versioning is intentional non-idempotency |

---

## 21. Quality gates

| Gate | Result |
|------|--------|
| `node scripts/verify-5b-hardening.cjs` | PASS |
| `node scripts/verify-5a3-ingest-timeout.cjs` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |

---

## 22. Remaining risks (summary)

1. Production domain not finalized (Auth redirect / CORS / Google OAuth console).  
2. PITR still off (from 5A.3).  
3. `mailer_autoconfirm` may still be enabled for closed-beta DX — must disable before public.  
4. Prompt-injection residual on untrusted job/email/custom text.  
5. No cross-feature AI spend ceiling.  
6. Calendar/ingest Highs (H1/H2) remediated in 5B.1.

---

## 23. Final readiness verdict

### CLOSED BETA: **PASS**

Blockers: none. Auth/ownership, CORS bind, timeouts, allowlist, and Google smoke posture are sufficient for trusted closed users. H1/H2 closed in 5B.1.

### LIMITED PUBLIC BETA: **CONDITIONAL PASS**

Blockers / required before widening beyond closed cohort:

1. Set production `JOBPILOT_APP_URL`, Auth site URL/redirects, Google OAuth redirect URIs.  
2. Re-disable `mailer_autoconfirm` + real SMTP if public email signup is offered.  
3. Keep `INGESTION_ALLOWED_USER_IDS` populated for any automation.

### OPEN MULTI-TENANT PRODUCTION: **CONDITIONAL PASS**

Blockers before open multi-tenant (ops / Medium — **no High/Critical left from 5B/5B.1**):

1. Production Auth/CORS/Google console finalized.  
2. PITR enabled.  
3. Autoconfirm off + SMTP.  
4. Recommended: global AI spend/daily caps (M7); OAuth state single-use or PKCE (M2).

---

## 24. Deliverables checklist

1. Live inventory — §1  
2. Findings by severity — §20  
3. Critical/High fixes — §19 (B1–B7); residual H1–H2  
4. Security results — §§3,10,14  
5. Reliability results — §§7,8  
6. AI-boundary results — §5  
7. Rate/idempotency — §6  
8. Timeout/retry matrix — §7  
9. Partial-failure — §8  
10. Cost-control — §12  
11. Provider-failure — §13  
12. CORS — §14  
13. Deployment drift — §15 (cleared by redeploy)  
14. Test gaps — §16  
15. Doc drift — §18  
16. lint/typecheck/build — §21 PASS  
17. Remaining risks — §22  
18. Verdict — §23  

**Phase 5B complete. Do not start Phase 5C until requested.**
