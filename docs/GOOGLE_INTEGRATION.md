# JobPilot AI — Google Gmail + Calendar (Phase 4D)

## Purpose

Connect the user’s Gmail and Google Calendar as a **JobPilot integration** (not a replacement for Supabase Auth). Detect hiring-related messages, classify them with AI, suggest application actions, and create Calendar events **only after explicit user confirmation**.

Human-in-the-loop is mandatory. JobPilot never auto-sends email, never auto-changes Gmail state, and never auto-creates calendar events.

## OAuth architecture

```
Settings → Connect Google
  → google-oauth-start (JWT) → Google consent
  → google-oauth-callback (no JWT; signed state)
  → encrypt tokens (AES-GCM) → user_integrations
  → redirect /settings?tab=integrations&google=connected

Hiring Inbox → Sync Gmail
  → gmail-sync decrypts token server-side → Gmail API
  → filter → classify → job_emails

User confirms action
  → hiring-email-action (link / accept_stage / calendar)
```

Tokens are **never** returned to the browser. Frontend status selects only metadata columns (email, scopes, expires_at, metadata).

### Token storage rationale

Supabase Vault/pgsodium is not required for MVP. Tokens are stored as **AES-256-GCM ciphertext** in `user_integrations` (`access_token_cipher`, `refresh_token_cipher`, `token_iv`) using Edge secret `GOOGLE_TOKEN_ENCRYPTION_KEY`. Decryption happens only inside Edge Functions with the service role after JWT ownership checks.

## Scopes

| Scope | Why |
|-------|-----|
| `openid` / `email` | Identify Google account email |
| `gmail.readonly` | Fetch recent messages for hiring inbox |
| `calendar.events` | Create interview events **after user confirm** |

No `gmail.send`, no `gmail.modify`, no full calendar wipe permissions.

## Database

| Table | Role |
|-------|------|
| `user_integrations` | Per-user Google connection + encrypted tokens |
| `job_emails` | Bounded hiring-related messages + classification |
| `application_events` | Minimal Calendar event association |
| `profiles.timezone` | IANA timezone for display / defaults |

Unique: `(user_id, gmail_message_id)`. RLS: owner-only on all three tables.

## Gmail sync model

- Manual **Sync Gmail** (MVP)
- Lookback: **14 days**, max **~25** messages per sync
- Cooldown: **120s** between syncs
- Relevance prefilter (`looksHiringRelated`) before OpenAI
- Unrelated / non-hiring: skip expensive classify or store as `unrelated`
- Body truncated (~8k chars); **no attachments**
- Incremental: existing `gmail_message_id` skipped

Scheduled n8n sync is **prepared but not enabled by default**.

## Classification

Server-side OpenAI structured JSON (`email-classify.ts`):

- Categories: recruiter_outreach, application_confirmation, questionnaire, assessment, interview_invitation, interview_followup, rejection, offer, general_hiring_message, unrelated
- Includes suggested stage, interview extraction, confidence
- **Never** applies stage automatically

Operational metadata (model, tokens, cost, latency) stored in `job_emails.metadata` when classified.

## Application matching

Signals: thread already linked, company name, job title, sender vs contacts, existing applications.

Statuses: `matched` | `suggested_match` | `unmatched`

Manual link propagates to other messages in the same Gmail thread.

## Hiring Inbox UI

Route: `/hiring-inbox`

- Filters: needs action, interview, questionnaire, rejection, offer, unmatched
- Detail: content, classification, link application, accept stage, ignore, open Artifact Toolkit, calendar preview/confirm
- Replies: deep-link to existing Application Artifacts Engine (no duplicate writer, no auto-send)

## Calendar flow

1. User opens “Create interview event”
2. Preview title / times / timezone / meeting URL
3. If timezone ambiguous → **blocked** until user confirms IANA timezone
4. On confirm → durable idempotent create (Phase 5B.1):
   - Derive `idempotency_key` (+ optional client key) from application + schedule + title
   - Use a deterministic Google Calendar event `id` (base32hex)
   - If local row already exists for the key → return `already_created`
   - `POST` Calendar; on **409** → `GET` existing event (safe retry)
   - Persist `application_events` with `idempotency_key` (unique per user)
   - Activity logged on first successful persist

## Privacy model

| Read | Stored | Sent to AI |
|------|--------|------------|
| Bounded recent Gmail query | Subject, snippet, truncated body, headers needed for UX | Only hiring-related candidates after prefilter |
| Not full mailbox | No attachments | Not unrelated bulk mail |

Retention: user can disconnect (revokes JobPilot token row). No automatic purge job in 4D (document limitation).

Never log OAuth tokens or full mailbox dumps.

## Rate / cost controls

- Sync cooldown + message cap
- Keyword prefilter before AI
- Calendar create only on explicit confirm
- OpenAI classification metadata tracked

## Security

- JWT on all mutating functions except OAuth callback (signed state + short TTL)
- Cross-user RLS on integrations / emails / events
- Ownership checks on application link and stage/calendar actions
- Status API never selects cipher columns

## Known limitations

- Requires Google Cloud OAuth client + Edge secrets configured
- Live Connect/Sync/Calendar E2E needs real Google credentials in the project
- No automated email send / Gmail label changes
- No background polling by default
- Soft matching can leave emails unmatched (by design)

## Edge secrets

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://<ref>.supabase.co/functions/v1/google-oauth-callback
GOOGLE_TOKEN_ENCRYPTION_KEY=  # 32+ bytes or 64 hex chars
GOOGLE_OAUTH_STATE_SECRET=    # optional; falls back to encryption key
JOBPILOT_APP_URL=https://your-app-origin
```

## QA (2026-08-09) — Phase 4D live E2E complete

### Configuration

| Item | Status |
|------|--------|
| Edge secret names set | Pass (`GOOGLE_*`, `JOBPILOT_APP_URL`) |
| `JOBPILOT_APP_URL` | `http://localhost:5174` |
| Google functions redeployed | Pass |
| `google-oauth-start` → accounts.google.com + offline/consent | Pass |
| Test user on OAuth consent screen | Pass (Connect succeeded) |

### Live E2E (FLOW A–M)

| Flow | Result |
|------|--------|
| A Connect Google | Pass |
| Refresh-token stored (encrypted cipher + IV; never in UI) | Pass |
| Refresh-token validation (forced expiry → sync renews access) | Pass |
| B Sync recent Gmail | Pass (e.g. fetched 25, cooldown/cap enforced) |
| C Relevant hiring email imported | Pass (classified hiring rows in Hiring Inbox) |
| D Unrelated excluded | Pass (live sync `imported: 0`; unrelated not persisted) |
| E Questionnaire linked + stage accept | Pass (stage → `questionnaire` only after confirm) |
| F Rejection does not auto-change stage | Pass |
| G Interview email with date/time/meet link | Pass |
| H Calendar preview | Pass (UI preview + confirm gate) |
| I Confirm → Google Calendar event created | Pass (`google_event_id` + `application_events` row) |
| J Ambiguous timezone blocked | Pass (`timezone_ambiguous`) |
| K Cross-user isolation | Pass (404 Email not found) |
| L Disconnect Google | Pass (integration row removed; ciphers gone) |
| M Relogin without exposing tokens | Pass (connected state preserved pre-disconnect; disconnected after; DOM has no tokens) |
| UI status select excludes cipher columns | Pass |
| lint / typecheck / build | Pass |

### Notes

- Real mailbox mail in this account was mostly prefilter/unrelated; hiring rows for C/E/G were validated with controlled inbox fixtures plus live sync/classification path.
- After Disconnect, reconnect via Settings → Integrations → **Connect Google** when needed.
- No OAuth tokens, ciphertexts, or secrets were logged during QA.

## Phase 5A.3 gate note

Interactive G1–G7 must be re-confirmed on a controlled Google test account before limited/open launch that markets Gmail/Calendar. Exact click path: `docs/PHASE5A3_PRODUCTION_GATE.md` §1.

Hardening since 4D:

- Refresh token preserved on reconnect when Google omits a new refresh (S2).
- Client cipher columns revoked; status via `user_integrations_public`.
- CORS allowlist (no `*` echo of unknown origins).
- Disconnect removes integration row and attempts token revoke.
