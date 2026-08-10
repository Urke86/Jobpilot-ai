# JobPilot AI — Final Architecture

**Date:** 2026-08-10  
**Phase:** 5E  
**Project:** `xzzoznhmezmaarcvavpr` (eu-west-1)

This document is the current production architecture map. It supersedes informal stack notes for readiness reviews. See also [ARCHITECTURE.md](./ARCHITECTURE.md) (living summary).

---

## 1. System context

```text
┌─────────────┐     HTTPS      ┌──────────────────────────────┐
│ Browser SPA │ ──────────────►│ Frontend host (TBD / Vite)   │
│ React/TS    │                └──────────────┬───────────────┘
└─────────────┘                               │ VITE_SUPABASE_*
                                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     TRUST BOUNDARY: Supabase                 │
│  Auth │ Postgres+RLS │ Edge Functions │ Storage(unused)      │
└───┬───────────┬───────────────┬──────────────────────────────┘
    │           │               │
    │           │               ├──► OpenAI (AI features)
    │           │               ├──► Google OAuth / Gmail / Calendar
    │           │               └──► (service role only inside Edge)
    │           │
    │           └──── RLS enforces user_id = auth.uid()
    │
┌───▼──────────┐
│ n8n runtime  │── secret + allowlist ──► Edge ingest-job
└──────────────┘
```

---

## 2. Frontend

| Concern | Choice |
|---------|--------|
| Framework | React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix) |
| Routing | React Router (lazy route chunks) |
| Auth UI | Email/password via Supabase Auth client |
| Data access | `@/services/app/*` → anon key + user JWT |
| AI UX | Analyze, Artifact Toolkit, Assistant SSE, AI Analytics |
| Google UX | Settings connect/disconnect; Hiring Inbox; Calendar actions |

**Never in browser:** service role key, OpenAI key, Google client secret, token encryption key, ingestion secret.

---

## 3. Backend (Supabase)

| Component | Role |
|-----------|------|
| Auth | Email/password sessions; JWT for PostgREST + Edge |
| Postgres | System of record for jobs, apps, AI, Google-derived rows |
| RLS | Tenant isolation on all user-owned tables |
| Edge Functions | Privileged orchestration, provider calls, encryption |
| RPCs | e.g. `ai_analytics_summary`, rate-limit leases, URL normalize |

### Active Edge Functions

| Function | Auth model | External calls |
|----------|------------|----------------|
| `analyze-job` | User JWT (+ optional ingest secret automation) | OpenAI |
| `generate-artifact` | User JWT | OpenAI |
| `chat-assistant` | User JWT (SSE) | OpenAI |
| `ingest-job` | Anon + `INGESTION_SECRET` + allowlist | optional analyze |
| `google-oauth-start` | User JWT | Google authorize URL |
| `google-oauth-callback` | OAuth redirect | Google token endpoint |
| `google-disconnect` | User JWT | Google revoke (best effort) |
| `gmail-sync` | User JWT | Gmail API + OpenAI classify |
| `hiring-email-action` | User JWT | optional Calendar API |

Shared: CORS allowlist, fetch timeouts, rate leases, AI observability writer.

---

## 4. AI subsystem

```text
Feature request → Edge auth + rate lease → build clipped context
  → OpenAI (gpt-4o-mini default) → validate → persist domain row
  → write ai_generations (+ optional evaluations / soft alerts)
```

| Feature | Persistence |
|---------|-------------|
| Job analysis | `job_analysis` + activity |
| Artifacts | `application_artifacts` (versioned) |
| Assistant | `ai_messages` / `ai_conversations` |
| Gmail classify | `job_emails.classification` + generation row |
| Prompt registry | `prompt_versions` (append-only) |

---

## 5. Automation (n8n)

| Workflow export | Path |
|-----------------|------|
| Manual ingest | `automation/n8n/manual-ingestion.json` |
| Scheduled sample | `automation/n8n/scheduled-ingestion.json` |
| Auto-analysis | `automation/n8n/auto-analysis.json` |

Trust: shared `INGESTION_SECRET`, optional `INGESTION_ALLOWED_USER_IDS`. Secrets must not live in exported JSON.

---

## 6. Google integration

```text
User → oauth-start → Google consent → oauth-callback
  → encrypt refresh/access → user_integrations
Gmail sync → list/filter → prefilter → AI classify → job_emails
Hiring action → link / stage / create Calendar event (idempotent)
Disconnect → delete local tokens (+ best-effort revoke)
```

Scopes: Gmail readonly + Calendar events (as configured). Tokens encrypted at rest with `GOOGLE_TOKEN_ENCRYPTION_KEY`.

---

## 7. Observability

| Store | Purpose |
|-------|---------|
| `ai_generations` | tokens, cost, latency, status, model, feature |
| `ai_evaluations` | manual quality scores |
| `ai_observability_alerts` | soft in-app thresholds |
| `prompt_versions` | version identity / changelog |
| Settings → AI Analytics | RPC-backed dashboards |

No external APM required for closed beta; Edge/platform logs via Supabase dashboard.

---

## 8. Trust boundaries & data flow

| Boundary | Crossing data | Controls |
|----------|---------------|----------|
| Browser ↔ Supabase | User JWT, CRUD payloads | RLS, anon key only |
| Edge ↔ OpenAI | CV/JD/portfolio/email snippets | TLS, key in Edge secrets, clipped context |
| Edge ↔ Google | OAuth codes, mail metadata/bodies, calendar | Encrypted tokens, user-approved actions |
| n8n ↔ Edge | Job payload + target_user_id | Shared secret + allowlist |
| Operator ↔ project | PAT / dashboard | Least privilege; no secrets in git |

---

## 9. Deployment topology (current)

| Layer | Verified state |
|-------|----------------|
| Database | Hosted Supabase Postgres `eu-west-1` |
| Edge | Supabase Edge (Deno) on same project |
| Frontend | Local/Vite today; **production host not finalized** |
| n8n | Operator-hosted instance (external to Supabase) |
| Secrets | Supabase Edge secrets + `.env.local` (gitignored) for CLI |

---

## 10. Explicit non-goals (still out of architecture)

RAG, multi-agent orchestration, LinkedIn automation, outbound email send, new third-party ATS connectors.
