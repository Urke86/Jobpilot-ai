# JobPilot AI — n8n automation (Phase 4C.2)

Import these workflows into your n8n instance. **Do not store secrets in the JSON files.**

## Prerequisites

1. Deploy Edge Function `ingest-job` (and keep `analyze-job` available for Workflow C).
2. Set Supabase Edge secrets:
   - `INGESTION_SECRET` — long random string shared with n8n only
   - optional `INGESTION_ALLOWED_USER_IDS` — comma-separated UUIDs automation may target
   - optional `AUTO_ANALYZE_INGESTED_JOBS` — default `false`
3. In n8n credentials / env:
   - `JOBPILOT_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `JOBPILOT_ANON_KEY` = project anon key (gateway JWT)
   - `JOBPILOT_INGEST_SECRET` = same as `INGESTION_SECRET`
   - `JOBPILOT_TARGET_USER_ID` = your JobPilot user UUID

## Auth model

n8n calls:

```
POST {SUPABASE_URL}/functions/v1/ingest-job
Authorization: Bearer {ANON_KEY}
apikey: {ANON_KEY}
x-jobpilot-ingest-secret: {INGESTION_SECRET}
Content-Type: application/json
```

Body must include `target_user_id` (UUID). The function uses the **service role** server-side after verifying the secret. Arbitrary callers without the secret cannot assign jobs to other users.

## Workflows

| File | Purpose |
|------|---------|
| `manual-ingestion.json` | Webhook → normalize → ingest-job |
| `scheduled-ingestion.json` | Cron → fetch Remotive public API sample → loop → ingest |
| `auto-analysis.json` | Webhook/created job → analyze-job when enabled |

Replace placeholder credential names after import. Set `auto_analyze: false` unless you intentionally want spend.

## Supported MVP sources

- Manual / test webhook (structured JSON)
- Public Remotive API (example in scheduled workflow — legal public API)
- RSS/Atom can be added with n8n RSS Feed Read node pointing at public feeds

**Not included:** LinkedIn/Indeed scraping, browser automation, CAPTCHA bypass.
