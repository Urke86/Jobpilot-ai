# Phase 5A.3 — Final Production Gate Closure

**Date:** 2026-08-09  
**Project:** JobPilot AI (`xzzoznhmezmaarcvavpr`)  
**Quality gates:** `lint` ✅ · `typecheck` ✅ · `build` ✅ · `scripts/verify-5a3-ingest-timeout.cjs` ✅

---

## 1. Google G1–G7 smoke

### Status: **BLOCKED — requires interactive browser OAuth**

No test Google account credentials are available to the agent. Interactive consent cannot be completed without your clicks. Prior Phase 4D E2E and 5A.2 disconnect/preserve simulations remain supporting evidence only.

### What was verified without interactive OAuth

| Step | Result |
|------|--------|
| OAuth start returns URL | Pass (5A.2) |
| Refresh preserve on omit (simulation) | Pass (5A.2 / S2) |
| Disconnect deletes integration row | Pass (5A.2) |
| Client cannot read cipher columns | Pass (5A.3 smoke) |

### Operator steps (do exactly this)

Prerequisites: app running at `http://localhost:5174`, signed in as a test user, Edge secrets already set (`JOBPILOT_APP_URL=http://localhost:5174`).

1. **G1 Connect**  
   - Open **Settings → Integrations**.  
   - Click **Connect Google**.  
   - In Google consent, choose the **test Google account**.  
   - Approve Gmail readonly + Calendar events.  
   - Confirm redirect lands on Settings with connected status (email shown, no tokens).

2. **G2 Encrypted refresh stored**  
   - Do **not** look at tokens in the browser.  
   - In Supabase SQL (service role / dashboard):  
     `SELECT (refresh_token_cipher IS NOT NULL AND length(refresh_token_cipher) > 20) AS has_refresh, (access_token_cipher IS NOT NULL) AS has_access FROM user_integrations WHERE provider='google' AND user_id = '<your-user-id>';`  
   - Expect `has_refresh=true`, `has_access=true`. Never `SELECT` the cipher values into chat/logs.

3. **G3 Reconnect**  
   - Click **Connect Google** / reconnect again for the same account.  
   - Complete consent (Google may omit refresh_token).

4. **G4 Preserve refresh**  
   - Re-run the G2 boolean SQL.  
   - Optionally check `metadata->>'refresh_preserved'` is `true` when Google omitted refresh.  
   - Cipher length should remain non-null (do not print ciphertext).

5. **G5 Expire access safely**  
   - SQL (service role):  
     `UPDATE user_integrations SET expires_at = timezone('utc', now()) - interval '1 hour' WHERE provider='google' AND user_id='<your-user-id>';`

6. **G6 Gmail sync + refresh**  
   - Open **Hiring Inbox**.  
   - Click **Sync Gmail**.  
   - Expect success (or empty hiring set), not auth/refresh failure.  
   - `expires_at` should move into the future after refresh.

7. **G7 Calendar preview confirm**  
   - On a hiring email with interview suggestion, open calendar preview.  
   - Explicitly confirm create.  
   - Verify one test event appears in Google Calendar.  
   - Delete the test event in Google Calendar.

8. **Cleanup**  
   - Settings → **Disconnect Google**.  
   - Confirm UI shows disconnected.  
   - SQL: `SELECT count(*) FROM user_integrations WHERE user_id='…' AND provider='google';` → `0`.

Record pass/fail in this doc’s “Operator confirmation” section when done.

**Operator confirmation:** G3 live click not completed in session; G4 preserve branch **simulated** (natural Google reconnect returned new refresh). G5–G9 **PASS** (expire → sync refresh → calendar create → disconnect row removed). Calendar smoke event may remain in Google Calendar titled “JobPilot Smoke Test Interview” — delete manually if still present.

---

## 2. Auth production hardening

### Changes applied (Supabase Auth config)

| Setting | Before | After |
|---------|--------|-------|
| `mailer_autoconfirm` | `true` | **`false`** |
| `site_url` | `http://localhost:3000` | **`http://localhost:5174`** (matches `JOBPILOT_APP_URL`) |
| `uri_allow_list` | (prior / empty) | `http://localhost:5174/**`, `/login`, plus `5173` and `127.0.0.1` variants |

### Code

- Added `requestPasswordReset(email)` in `src/services/auth.ts` with `redirectTo = origin/login`.  
- Existing `mapAuthError` keeps signup/login messages sanitized (invalid credentials, unconfirmed email, etc.).  
- **No new forgot-password UI** (would be a feature). Recovery is API/config-ready; UI can call `requestPasswordReset` later.

### Verification notes

- `resetPasswordForEmail` against `*.jobpilot.test` was rejected by Supabase mailer as invalid address — expected for synthetic domains.  
- Redirect allowlist includes `/login` for recovery links.  
- With autoconfirm off, new public signups require email confirmation before session (existing admin-confirmed users unaffected).

### Deploy-time (when production domain exists)

1. Set Auth `site_url` to the production HTTPS origin.  
2. Add `https://<prod>/**` and `https://<prod>/login` to `uri_allow_list`.  
3. Keep `mailer_autoconfirm=false`.  
4. Configure custom SMTP if using production email delivery.

---

## 3. Production URL / CORS / redirects

### Current known URLs (no production domain invented)

| Item | Value |
|------|-------|
| `JOBPILOT_APP_URL` | `http://localhost:5174` |
| `GOOGLE_REDIRECT_URI` | `https://xzzoznhmezmaarcvavpr.supabase.co/functions/v1/google-oauth-callback` |
| Auth site URL | `http://localhost:5174` |
| Vite app | localhost (dev) |

### Code hardening completed now

- New `supabase/functions/_shared/cors.ts`: explicit allowlist from `JOBPILOT_APP_URL` + optional `JOBPILOT_ALLOWED_ORIGINS` + localhost/127.0.0.1 Vite ports.  
- Unknown `Origin` is **not** reflected (`evil.example` → primary app origin / `null`, not echo).  
- Removed unrestricted `*` fallback used by AI Edge functions when allowlist exists.  
- Live smoke: allowed `http://localhost:5174` echoed; unknown origin not echoed as itself.

### Must set at deployment time

1. Production frontend HTTPS URL → `JOBPILOT_APP_URL` Edge secret.  
2. Optional comma-separated extras → `JOBPILOT_ALLOWED_ORIGINS`.  
3. Auth `site_url` + `uri_allow_list` for that domain.  
4. Google Cloud OAuth authorized redirect remains the Supabase callback URL (already).  
5. Google OAuth authorized JavaScript origins / branding as required by Google.

---

## 4. ingest-job → analyze-job timeout

### Fix

- `ANALYZE_PROXY_TIMEOUT_MS = 50_000` in `_shared/fetch-timeout.ts`.  
- Both automation and JWT auto-analyze paths in `ingest-job` use `fetchWithTimeout`.  
- On timeout: job ingest **remains successful**; `analyzed=false`; sanitized error *"Analysis timed out. Job was saved; retry analysis later."*  
- No retry loop. No false success analysis id. Logs only `timeout`/`error` metadata.

### Regression

`node scripts/verify-5a3-ingest-timeout.cjs` — asserts no raw `fetch(` in ingest-job, timeout constant present, AbortController behavior.

Deployed: `ingest-job` (and related CORS updates).

---

## 5. Backup / PITR readiness

### Verified via Management API `GET /database/backups`

| Field | Value |
|-------|-------|
| `pitr_enabled` | **`false`** |
| `walg_enabled` | **`true`** |
| `backups` array | empty in API response |
| Region | `eu-west-1` |

**Cannot verify automatically:** dashboard “daily backups” UI retention days, exact WAL schedule, restore drill success, organization plan entitlements beyond addons list.

### Production backup policy (recommendation)

| Metric | Target |
|--------|--------|
| **RPO** | ≤ 24h on current plan without PITR; **≤ 15 min** if PITR enabled before open production |
| **RTO** | ≤ 4h for project restore from latest backup |
| **Pre-migration** | Confirm healthy project status; prefer PITR window or manual backup snapshot before risky DDL |
| **Restore verification cadence** | Quarterly restore to a **scratch** project (never destructive restore on production) |
| **Open production gate** | Enable **PITR** (paid add-on) before open multi-tenant launch |

---

## 6. Focused security retest (5A.3)

| Check | Result |
|-------|--------|
| Cross-user job read | Pass (empty) |
| Cross-user integration metadata | Pass (empty) |
| Foreign `job_emails` relationship insert | Pass (`42501`) |
| Ingestion invalid allowlist user | Pass (`403`) |
| Integration public status / no cipher | Pass |
| Cipher column select | Pass (`42501`) |
| Parallel analyze | Pass (`429`×3 + `200`×1) |
| CORS unknown origin | Pass |
| CORS allowed origin | Pass |

---

## 7. Quality gates

- `npm run lint` — pass (0 errors)  
- `npm run typecheck` — pass  
- `npm run build` — pass  
- `node scripts/verify-5a3-ingest-timeout.cjs` — pass  

---

## 8. Remaining risks / exact conditions

1. **Google G1–G7 interactive smoke not operator-confirmed** (required for limited/open if Gmail/Calendar marketed).  
2. **No production frontend domain yet** — Auth/CORS still localhost; must be updated at deploy.  
3. **PITR disabled** — enable before open multi-tenant.  
4. **Password reset UI** not shipped — API helper + redirects configured; product may want a Forgot password link later.  
5. Email delivery for confirmation/reset depends on Supabase mail / custom SMTP in production.

---

## 9. Final readiness verdicts

### CLOSED BETA — **PASS**

Gates closed for trusted closed beta on localhost with known users. Autoconfirm disabled (safer). Gmail optional until operator completes G1–G7.

### LIMITED PUBLIC BETA — **CONDITIONAL PASS**

Exact remaining conditions:

1. Operator completes and records Google G1–G7 (if integrations are in the beta scope).  
2. Production (or staging HTTPS) URL configured in Auth + `JOBPILOT_APP_URL` + redirect allowlist.  
3. Confirm email delivery (confirmation + recovery) for real addresses.  

### OPEN MULTI-TENANT PRODUCTION — **CONDITIONAL PASS**

Exact remaining conditions:

1. All limited-public conditions above.  
2. Enable **PITR** (currently `pitr_enabled=false`).  
3. Production domain + CORS/Auth/Google OAuth console settings finalized.  
4. Google OAuth app verification status acceptable for non-test users.
