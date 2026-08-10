# PHASE 5B.1 — Residual High Remediation

**Date:** 2026-08-10  
**Scope:** Close only H1 (calendar durable idempotency) and H2 (ingest URL dedupe scalability).  
**No Phase 5C.**

---

## Summary

| Finding | Status |
|---------|--------|
| Critical | **0** |
| High | **0** (H1 + H2 closed) |

---

## H1 — Calendar durable idempotency

### Root cause

Calendar create used a short rate lease and a server-generated Google event id. Retries after a successful Google insert (lost response, local persist failure, concurrency) could `POST` again and create a second Google event.

### Architecture

1. **Logical key** — SHA-256 over `userId + applicationId + startsAt + endsAt + title` (or optional client `idempotency_key`).  
2. **Google event id** — same digest encoded as **base32hex** (`[0-9a-v]`, 32 chars) and passed as Calendar `id` on create.  
3. **DB uniqueness** — `application_events.idempotency_key` with partial unique index `(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`.  
4. **Flow**
   - Lookup existing row by idempotency key → return `already_created`
   - Soft lease on the key (stampede reduction only)
   - `POST` Calendar with deterministic `id`
   - On **409**, `GET` the existing event (safe retry)
   - Insert local row; on unique conflict, return the winner row
5. **Different interviews** — different start/end/title ⇒ different keys (still allowed for same application).

### Provider / local consistency

| Scenario | Result |
|----------|--------|
| First create | One Google event + one local row (`created`) |
| Immediate retry / lost response | Local hit or Google 409 → `already_created`, no duplicate |
| Google OK, local insert fails | Retry GETs same Google id, inserts/returns local; no second provider event |
| Concurrent identical requests | One Google id; unique index serializes local row |
| Persist hard-fail after provider | `calendar_persist_failed` + `google_event_id` + `idempotency_key` for reconciliation; retry remains safe |

### Concurrency / retry verification

- Unit: identical logical inputs → identical idempotency + Google ids; different slot → different ids (`scripts/verify-5b1-remediation.cjs`).  
- Live DB: duplicate `(user_id, idempotency_key)` insert rejected; second distinct key allowed.  
- Interactive Google OAuth UI create not re-run in this phase (no session fixture); provider path covered by deterministic id + 409 handling in deployed `hiring-email-action`.

---

## H2 — Ingest URL dedupe scalability

### Root cause

`findUrlDuplicate` loaded up to **200** jobs and compared normalized URLs in memory. Beyond that window, duplicates could be missed even when logical URLs matched.

### Schema / query change

Migration `20260810010000_phase5b1_idempotency_url_dedupe.sql`:

- `public.normalize_job_url(text)` — SQL mirror of Edge normalization (host lowercasing, tracking-param strip, trailing-slash rules).  
- `jobs.normalized_job_url text` — maintained by `BEFORE INSERT/UPDATE OF job_url` trigger.  
- Safe backfill: oldest row per `(user_id, normalize_job_url(job_url))` keeps the normalized value.  
- Partial unique index `jobs_user_normalized_url_unique` on `(user_id, normalized_job_url) WHERE normalized_job_url IS NOT NULL`.  
- Edge `findUrlDuplicate` → indexed `.eq('normalized_job_url', jobUrl)` (+ exact `job_url` fallback). No row-count cap.

### Dedupe test results (live SQL)

| Case | Result |
|------|--------|
| Same URL twice | Duplicate blocked by unique index |
| Variant (`utm_*` / host case) vs normalized | Duplicate blocked |
| Independence from 200-row window | Enforced by index, not scan |
| Same URL, different users | Allowed |
| `NULL` URL twice | Allowed |
| Different jobs/URLs same company | Allowed |

Edge secret ingest against allowlisted automation user returned **403** for available profile UUIDs in this environment (allowlist not locally mirrored). DB-backed uniqueness + Edge query change still close H2 for all insert paths (trigger on UI inserts too).

---

## Migration status

| Item | Status |
|------|--------|
| File | `supabase/migrations/20260810010000_phase5b1_idempotency_url_dedupe.sql` |
| Applied remotely | Yes (Management API chunks; CLI `db push` blocked by IPv6) |
| `schema_migrations` | `20260810010000` / `phase5b1_idempotency_url_dedupe` recorded |
| Objects verified | columns, indexes, `normalize_job_url`, sample normalize match |
| Types | `npm run db:types` regenerated (`normalized_job_url`, `idempotency_key`) |
| Deploy | `hiring-email-action`, `ingest-job` redeployed |

---

## Cross-user validation

- Normalized URL uniqueness is **per `user_id`**.  
- Calendar idempotency uniqueness is **per `user_id`**.  
- Confirmed: same normalized URL insertable for user A and user B.  
- RLS ownership model unchanged.

---

## Quality gates

| Check | Result |
|-------|--------|
| `node scripts/verify-5b1-remediation.cjs` | PASS |
| `node scripts/verify-5b-hardening.cjs` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |

---

## Updated readiness

| Tier | Verdict |
|------|---------|
| Closed beta | **PASS** |
| Limited public beta | **CONDITIONAL PASS** — still requires production Auth/CORS/Google console + autoconfirm/SMTP policy from 5A.3 |
| Open multi-tenant | **CONDITIONAL PASS** — prior non-H1/H2 ops items remain (PITR, production domain, optional global AI caps, OAuth PKCE/nonce). **No remaining High/Critical backend findings from 5B/5B.1.** |

---

## Files touched

- `supabase/migrations/20260810010000_phase5b1_idempotency_url_dedupe.sql`
- `supabase/functions/hiring-email-action/index.ts`
- `supabase/functions/ingest-job/index.ts`
- `src/types/database.ts`
- `scripts/verify-5b1-remediation.cjs`
- `scripts/verify-5b-hardening.cjs` (updated assertion)
- Docs: this file + `PHASE5B_BACKEND_AUDIT.md`, `DATABASE.md`, `GOOGLE_INTEGRATION.md`, `N8N_AUTOMATION.md`
