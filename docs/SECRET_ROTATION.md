# Secret Rotation — JobPilot AI

**Rule:** Never print secret values. Never commit secrets. Rotate via Dashboard/CLI only.

---

## 1. Inventory (names only)

| Secret | Owner | Scope | Storage |
|--------|-------|-------|---------|
| `OPENAI_API_KEY` | Operator | Edge AI calls | Supabase Edge secrets |
| `OPENAI_ANALYSIS_MODEL` | Operator | Optional model override | Edge secrets |
| `GOOGLE_CLIENT_ID` | Operator | OAuth public id | Edge secrets (+ Google Cloud console) |
| `GOOGLE_CLIENT_SECRET` | Operator | OAuth confidential | Edge secrets + Google Cloud |
| `GOOGLE_REDIRECT_URI` | Operator | OAuth callback URL | Edge secrets |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Operator | Encrypts Google tokens at rest | Edge secrets |
| `GOOGLE_OAUTH_STATE_SECRET` | Operator | OAuth state HMAC | Edge secrets |
| `INGESTION_SECRET` | Operator | n8n ↔ `ingest-job` | Edge secrets + n8n credential store |
| `INGESTION_ALLOWED_USER_IDS` | Operator | Ingest allowlist | Edge secrets |
| `AUTO_ANALYZE_INGESTED_JOBS` | Operator | Feature flag | Edge secrets |
| `JOBPILOT_APP_URL` | Operator | Post-OAuth app return | Edge secrets |
| `ASSISTANT_DAILY_MESSAGE_CAP` | Operator | Soft chat cap | Edge secrets (optional) |
| `SUPABASE_SERVICE_ROLE_KEY` | Platform | Edge runtime / privileged DB | Injected by Supabase (not in Vite) |
| `VITE_SUPABASE_URL` | Operator | Browser | Hosting env / `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | Operator | Browser (public) | Hosting env / `.env.local` |
| `SUPABASE_ACCESS_TOKEN` | Operator | CLI / Management API | `.env.local` only (gitignored) |

CORS allowlist origins are configuration, not secrets, but treat production URL changes as change-controlled.

---

## 2. General rotation process

1. Generate new secret offline (password manager / `openssl rand`).
2. Update upstream provider first when required (OpenAI, Google Cloud).
3. Update Supabase Edge secret.
4. Update dependent systems (n8n, hosting) in the same change window.
5. Smoke-test affected path.
6. Revoke old provider credential.
7. Record rotation in ops log (timestamp, who, which secret **name**).

---

## 3. OpenAI API key

1. Create new key in OpenAI dashboard; leave old key active briefly.
2. Set Edge `OPENAI_API_KEY` to new value.
3. Smoke: analyze-job + one assistant message.
4. Revoke old OpenAI key.
5. Impact if wrong: AI features fail; data remains consistent.

---

## 4. Google client secret

1. In Google Cloud Console, rotate client secret for the OAuth client.
2. Update `GOOGLE_CLIENT_SECRET` Edge secret.
3. Smoke: OAuth start → callback → Settings shows connected.
4. Existing refresh tokens usually remain valid; if Google invalidates, users reconnect.
5. Update any local `.env.local` copies used for docs/testing (never commit).

---

## 5. Google token encryption key

**Critical:** `GOOGLE_TOKEN_ENCRYPTION_KEY` encrypts tokens in `user_integrations`.

| Action | Effect |
|--------|--------|
| Change key without re-encrypt | **Existing ciphertext becomes unreadable** |
| User impact | Gmail sync / Calendar fail until reconnect |
| Recovery | Users must **Disconnect** (or admin delete integration row) and **Connect Google** again |

### Recommended rotation procedure

1. Announce maintenance (Google features offline briefly).
2. Optionally disconnect all Google integrations (Edge `google-disconnect` per user or SQL under incident control).
3. Set new `GOOGLE_TOKEN_ENCRYPTION_KEY`.
4. Keep `GOOGLE_OAUTH_STATE_SECRET` stable unless also rotating OAuth state (can rotate independently).
5. Ask users to reconnect Google.
6. Verify sync + calendar on one account.

**Do not** store plaintext tokens in git, tickets, or backups of `.env`.

---

## 6. OAuth state secret

1. Set new `GOOGLE_OAUTH_STATE_SECRET`.
2. In-flight OAuth attempts with old state fail → user retries Connect.
3. No need to wipe encrypted tokens.

---

## 7. Ingestion secret

1. Generate new `INGESTION_SECRET`.
2. Update Edge secret **and** n8n credential in the same window.
3. Old n8n jobs get 401 until updated.
4. Smoke manual ingest webhook.
5. Optionally rotate allowlist membership review.

---

## 8. Supabase service role

- Not shipped in frontend.
- Platform-managed for Edge; if Dashboard shows a service role key for manual use, treat as break-glass.
- Rotation: via Supabase project settings if exposed keys were leaked; redeploy not always required but revoke leaked copies immediately.
- Leak = **SEV-1** ([INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)).

---

## 9. Anon key / URL

- Anon key is public by design but tied to RLS.
- If leaked with a critical RLS bug: rotate anon key after fixing RLS; update frontend env; redeploy SPA.
- Always fix the authorization bug first.

---

## 10. Management PAT (`SUPABASE_ACCESS_TOKEN`)

1. Revoke old PAT in Supabase account tokens.
2. Create new PAT; update `.env.local`.
3. No Edge redeploy required.
