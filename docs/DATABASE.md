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
auth.users 1──* activities      (polymorphic entity_id, no FK)
```

## Enums

| Enum | Values |
|------|--------|
| `remote_preference` | onsite, hybrid, remote, flexible, unknown |
| `remote_scope` | onsite, hybrid, remote_country, remote_europe, remote_emea, remote_global, unknown |
| `employment_type` | full_time, part_time, contract, temporary, internship, unknown |
| `job_status` | new, analyzing, reviewed, shortlisted, skipped, applied, archived |
| `analysis_recommendation` | apply, consider, skip |
| `application_stage` | preparing, applied, questionnaire, interview, assignment, offer, rejected, withdrawn |
| `artifact_type` | cv_recommendations, cv_summary, cover_letter, questionnaire_answer, linkedin_message, follow_up, interview_questions, interview_answers, company_research, custom |
| `activity_entity_type` | profile, company, contact, job, job_analysis, application, application_artifact, system |
| `activity_type` | job_discovered, job_status_changed, application_created, application_stage_changed, analysis_completed, artifact_created, company_added, contact_added, note_added, custom |

## Important constraints & indexes

- **profiles.user_id** — `UNIQUE` (one profile per auth user)
- **jobs** — partial unique index on `(user_id, job_url)` where `job_url is not null`
- **applications** — `UNIQUE (user_id, job_id)` (one application per job)
- **job_analysis** scores — `CHECK` 0–100; strengths/gaps/risks must be JSON arrays
- **job_analysis (job_id, created_at DESC)** — latest analysis lookup
- **companies (user_id, lower(trim(name)))** — normalized name search (not globally unique)
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

## Future notes (Phase 3+)

1. Auth UI + auto-create `profiles` row on signup (`handle_new_user` trigger optional).
2. Swap page adapters from mock → Supabase repositories + domain mappers.
3. Wire `.env.local` with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
4. Optional: `storage` buckets for CV uploads; keep out of MVP schema for now.
