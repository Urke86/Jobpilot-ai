# Privacy Data Map — JobPilot AI

**Technical documentation only. Not legal advice. Not a privacy policy.**

---

## 1. Categories

### Profile & identity

| Field | Source | Purpose | Storage | External processor | Retention (proposal) | Deletion |
|-------|--------|---------|---------|--------------------|----------------------|----------|
| Email | Auth signup | Login | `auth.users` | Supabase Auth | Account lifetime | Auth user delete |
| Name, headline, location, salary prefs | Settings | Personalization | `profiles` | — | Account lifetime | CASCADE with user |
| `master_cv_text` | Settings | AI fit/artifacts | `profiles` | OpenAI when AI runs | Account lifetime; review minimization | CASCADE |
| `portfolio_summary` | Settings | AI context | `profiles` | OpenAI when AI runs | Account lifetime | CASCADE |

### Job search CRM

| Category | Source | Purpose | Storage | External | Retention proposal | Deletion |
|----------|--------|---------|---------|----------|--------------------|----------|
| Companies / contacts | User | CRM | `companies`, `contacts` | — | Account lifetime | CASCADE |
| Jobs (+ JD) | User / n8n | Tracking | `jobs` | OpenAI on analyze | Account lifetime | CASCADE |
| Applications / notes / cover fields | User | Pipeline | `applications` | OpenAI on artifacts | Account lifetime | CASCADE |
| Artifacts | AI + user | Application materials | `application_artifacts` | OpenAI on generate | Account lifetime | CASCADE |
| Activities | App events | Timeline | `activities` | — | 12–24 months then purge optional | CASCADE |

### AI assistant & observability

| Category | Source | Purpose | Storage | External | Retention proposal | Deletion |
|----------|--------|---------|---------|----------|--------------------|----------|
| Conversations / messages | User + AI | Copilot | `ai_conversations`, `ai_messages` | OpenAI | 12 months or user delete | CASCADE |
| Generations metadata | Edge | Cost/latency | `ai_generations` | — (no full prompt body required) | 12–24 months metadata | CASCADE |
| Evaluations | User | Quality | `ai_evaluations` | — | 24 months | CASCADE |
| Prompt versions | Operator | Registry | `prompt_versions` | — | Indefinite (append-only) | N/A global |

### Google / Hiring Inbox

| Category | Source | Purpose | Storage | External | Retention proposal | Deletion |
|----------|--------|---------|---------|----------|--------------------|----------|
| OAuth tokens (encrypted) | Google | Sync/calendar | `user_integrations` | Google | Until disconnect | Row delete + best-effort revoke |
| Email subject/snippet/body | Gmail sync | Hiring triage | `job_emails` | OpenAI classify (candidates) | **90–180 days** (privacy-sensitive) | CASCADE / manual purge |
| Calendar events | User-approved | Interviews | Google Calendar + `application_events` | Google | Event lifetime | DB CASCADE; **Calendar copy may remain on Google** |

### Automation

| Category | Source | Purpose | Storage | External | Notes |
|----------|--------|---------|---------|----------|-------|
| Ingest payloads | n8n | Create jobs | Transient + `jobs` | — | n8n execution logs may retain payloads — configure n8n retention |

---

## 2. Logging surfaces

| Log | Risk | Recommendation |
|-----|------|----------------|
| Supabase Edge logs | May include error strings | Avoid logging CV/email bodies; retain ≤14–30 days (platform default) |
| n8n execution logs | Job payloads | Short retention; no secrets in nodes |
| AI observability | Tokens/cost — OK; avoid storing raw prompts in generations if added later | Metadata-first |
| Browser console | Client errors | No tokens |

---

## 3. User-visible controls (current)

| Control | Exists? |
|---------|---------|
| Edit/delete profile fields | Yes |
| Disconnect Google | Yes |
| Delete conversation | Yes |
| Delete job/application (UI) | Yes (entity CRUD) |
| Full account self-service delete | **No** (see Phase 5E findings) |
| Export all data | **No** |

---

## 4. Transmission to OpenAI

Sent when user/automation invokes AI:

- Clipped job description, CV, portfolio, notes, questions
- Email subject/body snippets for classification candidates
- Assistant message + selected JobPilot context

Not sent: Google refresh tokens, Supabase service role, ingestion secret.
