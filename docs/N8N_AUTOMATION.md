# JobPilot AI — n8n Automation (Phase 4C.2)

## Role of n8n

n8n orchestrates **job ingestion** (webhook, schedule, public APIs/feeds). Supabase remains the source of truth. n8n must not hold the authoritative database or weaken RLS.

n8n is responsible for:

- workflow orchestration and schedules
- webhook / feed / public API fetch
- light transform before calling JobPilot
- calling `ingest-job` (and optionally `analyze-job`)
- per-item error handling and retries for transient failures

n8n must **not**:

- scrape LinkedIn / Indeed or run browser automation
- expose secrets to the JobPilot frontend
- use hardcoded end-user passwords
- write around ownership checks

## Architecture

```
Source (webhook | RSS/API | JSON test)
  → n8n normalize / validate
  → POST /functions/v1/ingest-job
       · auth: ingest secret + target_user_id  OR  user JWT
       · normalize + dedupe + company match
       · insert job + activity
       · optional analyze-job
  → Supabase jobs / companies / activities
  → JobPilot UI (Jobs + Import Jobs)
```

| Piece | Location |
|-------|----------|
| Edge Function | `supabase/functions/ingest-job/` |
| Analyze automation auth | `supabase/functions/analyze-job/` |
| UI | `src/pages/JobImportPage.tsx` (`/jobs/import`) |
| Client | `src/services/app/ingestion.ts` |
| Workflows | `automation/n8n/*.json` |
| Schema | `jobs.ingestion_metadata` jsonb |

## Authentication strategy

### A — User JWT (JobPilot UI manual import)

`Authorization: Bearer <user access token>`  
Jobs are always owned by `auth.uid()`. Any `target_user_id` in the body is ignored.

### B — Automation secret (n8n)

Headers:

- `Authorization: Bearer <ANON_KEY>` (satisfies gateway `verify_jwt`)
- `x-jobpilot-ingest-secret: <INGESTION_SECRET>`
- Body: `target_user_id` (UUID)

Server uses **service role** only after secret verification. Optional allowlist: `INGESTION_ALLOWED_USER_IDS`.

Never put `SUPABASE_SERVICE_ROLE_KEY` or `INGESTION_SECRET` in the browser / Vite env.

## Ingestion endpoint

`POST /functions/v1/ingest-job`

Payload shapes:

- flat job object
- `{ job: {...} }`
- `{ items: [...] }` / `{ jobs: [...] }` (max 50)

Minimum fields: `job_title`, `company_name`, `source`. Prefer `job_url`.

Response (single):

```json
{
  "status": "created | duplicate | potential_duplicate | rejected",
  "job_id": "...",
  "company_id": "...",
  "reason": null,
  "analyzed": false,
  "summary": { "total": 1, "created": 1, "...": "..." }
}
```

Batch returns `results[]` + `summary`.

## Normalization

- Trim / collapse whitespace on titles and company names
- Source lowercased
- URL: lowercase host, strip common tracking params, trim trailing slash
- Map free-text remote / employment / currency into JobPilot enums (fallback `unknown` / `EUR`)
- Preserve provenance in `ingestion_metadata` (workflow, external_id, original URL, automation_version)

Job descriptions are not aggressively rewritten.

## Deduplication

| Rule | Outcome |
|------|---------|
| Same user + normalized `job_url` | `duplicate` (no insert) |
| No URL + same normalized title+company within **30 days** | `potential_duplicate` (no auto-merge / no insert) |
| Unique constraint race on URL | `duplicate` |

Low-confidence matches are never silently merged.

## Company matching

Per-user only (`user_id` scoped): case-insensitive name match → reuse; else create + `company_added` activity.

## Auto-analysis

- Env default: `AUTO_ANALYZE_INGESTED_JOBS=false`
- Request override: `auto_analyze: true|false`
- Skips duplicates / rejected / short descriptions (&lt; 80 chars)
- Calls `analyze-job` (JWT path or secret + `target_user_id`)

## Retries (n8n)

Retry with backoff: network errors, 5xx, timeouts.  
Do **not** retry: 400 validation, duplicates, 401/403 ownership.

Batch nodes use `continueOnFail` so one bad item does not stop the run.

## Observability

- n8n execution history
- Response `summary` counts
- Activities: `job_discovered` (ingested), `company_added` when created
- `jobs.ingestion_metadata` for provenance

## UI

**Import Jobs** (`/jobs/import`): form + JSON paste, optional analyze checkbox, automation status panel (no secrets), recent ingested list.

## Security

- Secrets server-side / n8n env only
- Ownership enforced (JWT or allowlisted target)
- Sanitized errors; no secret logging
- RLS unchanged for normal users; service role only inside trusted Edge Function

## Known limitations

- Remotive sample is illustrative; RSS feeds need per-source mapping in n8n
- No LinkedIn/Indeed scraping
- Soft title+company dedupe window is heuristic
- Multi-user automation requires allowlist + per-workflow `target_user_id`
- n8n must be operated outside JobPilot (self-hosted or cloud)

## QA (2026-08-08)

| Flow | Result |
|------|--------|
| A Manual/webhook create | Pass |
| B Duplicate URL | Pass |
| C Title+company soft duplicate | Pass (`potential_duplicate`) |
| D Malformed | Pass (`rejected`) |
| E New company | Pass |
| F Reuse company | Pass |
| G Batch with one bad item | Pass (2 created / 1 rejected) |
| H Unauthorized | Pass (401) |
| I AUTO_ANALYZE false | Pass (`analyzed=false`) |
| J AUTO_ANALYZE true | Pass (analysis created) |

JWT path ignores `target_user_id` (ownership = auth user). lint / typecheck / build: Pass.