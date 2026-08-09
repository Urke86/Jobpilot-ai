# JobPilot AI — Database

Phase 2 schema for multi-user job search and application tracking.

## Overview

| Table | Purpose |
|-------|---------|
| `profiles` | Candidate profile (1:1 with `auth.users`) |
| `companies` | Per-user company CRM |
| `contacts` | People linked to a company |
| `jobs` | Saved / tracked opportunities |
| `job_analysis` | Versioned AI analysis snapshots |
| `applications` | Application pipeline records |
| `application_artifacts` | CV/cover letter/Q&A materials |
| `ai_conversations` | Assistant chat threads (Phase 4C.1) |
| `ai_messages` | Assistant messages + AI run metadata |
| `user_integrations` | Connected providers (Google tokens encrypted) |
| `job_emails` | Hiring-related Gmail messages (Phase 4D) |
| `application_events` | Confirmed Calendar / interview events |
| `prompt_versions` | Append-only AI prompt registry (Phase 4E) |
| `ai_generations` | Central AI generation / spend / latency log |
| `ai_evaluations` | Quality scores for generations |
| `ai_observability_alerts` | Soft in-app spend/latency/quality alerts |
| `activities` | Dashboard feed / audit trail |

All tables use UUID PKs, `timestamptz` timestamps, and `user_id → auth.users(id)` ownership.

## Relationships

```
auth.users 1──1 profiles
auth.users 1──* companies 1──* contacts
auth.users 1──* jobs *──1 companies (optional)
jobs 1──* job_analysis
jobs 1──1 applications          (UNIQUE user_id + job_id)
applications 1──* application_artifacts
auth.users 1──* ai_conversations 1──* ai_messages
auth.users 1──* user_integrations
auth.users 1──* job_emails *──? applications
applications 1──* application_events
auth.users 1──* activities      (polymorphic entity_id, no FK)
```

## Enums

| Enum | Values |
|------|--------|
| `remote_preference` | onsite, hybrid, remote, flexible, unknown |
| `remote_scope` | onsite, hybrid, remote_country, remote_europe, remote_emea, remote_global, unknown |
| `employment_type` | full_time, part_time, contract, temporary, internship, unknown |
| `job_status` | new, analyzing, reviewed, shortlisted, skipped, applied, archived |
| `activity_type` | …, artifact_created, assistant_started, custom |
| `activity_entity_type` | …, application_artifact, ai_conversation, system |
| `ai_message_role` | user, assistant, system |
| `artifact_type` | cv_recommendations, cv_summary, cover_letter, questionnaire_answer, linkedin_message, follow_up, interview_questions, interview_answers, company_research, custom |
| `application_stage` | preparing, applied, questionnaire, interview, assignment, offer, rejected, withdrawn |
| `artifact_type` | cv_recommendations, cv_summary, cover_letter, questionnaire_answer, linkedin_message, follow_up, interview_questions, interview_answers, company_research, custom |
| `activity_entity_type` | profile, company, contact, job, job_analysis, application, application_artifact, system |
| `activity_type` | job_discovered, job_status_changed, application_created, application_stage_changed, analysis_completed, artifact_created, company_added, contact_added, note_added, custom |

## Important constraints & indexes

- **profiles.user_id** — `UNIQUE` (one profile per auth user)
- **jobs** — partial unique index on `(user_id, job_url)` where `job_url is not null`
- **applications** — `UNIQUE (user_id, job_id)` (one application per job)
- **job_analysis** scores — `CHECK` 0–100; strengths/gaps/risks must be JSON arrays
- **job_analysis.metadata** — jsonb object for model/tokens/cost/cv_focus/interview_focus (Phase 4A)
- **jobs.ingestion_metadata** — jsonb provenance for n8n / webhook / manual import (Phase 4C.2)
- **job_analysis (job_id, created_at DESC)** — latest analysis lookup
- **companies (user_id, lower(trim(name)))** — normalized name search (not globally unique)
- **jobs (user_id, lower(trim(job_title)), lower(trim(company_name_snapshot)))** — soft dedupe support
- Salary range check on jobs: `salary_max >= salary_min` when both set

## RLS ownership model

RLS is enabled on every user-owned table.

- `SELECT` / `UPDATE` / `DELETE`: `user_id = auth.uid()`
- `INSERT` / `UPDATE` `WITH CHECK`: `user_id = auth.uid()`
- Child tables additionally require parent ownership:
  - contacts → company owned by caller
  - jobs → company owned by caller (when `company_id` set)
  - job_analysis → job owned by caller
  - applications → job owned by caller
  - application_artifacts → application owned by caller

No policies for `anon`. Cross-user references are rejected by policy checks.

## Migrations

```
supabase/migrations/
  20260807120935_enums_helpers_and_core_schema.sql
  20260807120936_row_level_security.sql
```

Apply to the linked project:

```bash
# Preferred (IPv4 pooler after successful link)
supabase db push --linked

# Or with session pooler URL from Dashboard → Connect
supabase db push --db-url "postgresql://postgres.<ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

Local Docker is optional; this repo validates via remote push when Docker is unavailable.

## Generated types

Canonical types live at:

`src/types/database.ts`

Regenerate after schema changes (requires CLI auth on the JobPilot project):

```bash
npm run db:types
```

Helpers:

- `Tables<'jobs'>`, `TablesInsert<'jobs'>`, `TablesUpdate<'jobs'>`
- `Enums<'job_status'>`

The Supabase client is typed with `Database` (`src/lib/supabase/client.ts`).

## Service layer

| Path | Role |
|------|------|
| `src/services/mock/ui-adapters.ts` | Current page data source (preserves UI) |
| `src/services/contracts.ts` | Repository interfaces over DB shapes |
| `src/services/supabase/*` | Typed Supabase repositories (ready for Phase 3) |

Pages must not call `supabase.from(...)` directly.

## Seed data

`supabase/seed.dev.sql` is documentation-only (commented examples). Real seeds need an `auth.users` row and should never disable RLS.

## Application integration (Phase 3)

The frontend now uses authenticated browser clients only (anon key + user JWT).
All table access goes through `src/services/app/*` with `user_id` from `auth.getUser()`.
RLS remains the authority for isolation.

Profiles are created on signup via select-then-insert (`ensureProfile`) — existing rows are never overwritten.

## Future notes

1. Additional n8n source adapters (public RSS/APIs only).
2. Optional Storage buckets for CV uploads.
3. Gmail / Calendar / RAG only with explicit phase approval.
