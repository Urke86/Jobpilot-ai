# Restore Runbook — JobPilot AI

**Scope:** Operational guide for database / project recovery.  
**Do not** run destructive restores against the live production project without an explicit incident decision and stakeholder approval.

Project ref: `xzzoznhmezmaarcvavpr`

---

## 1. Identify the incident

1. Classify severity ([INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)).
2. Confirm symptoms: data loss, corruption, bad migration, ransomware-class wipe, accidental delete.
3. Record approximate **bad change time** (UTC) and last known good user report.
4. Capture: who noticed, what changed recently (deploy, migration, n8n job, Google sync).

---

## 2. Freeze writes (if needed)

When continued writes would worsen corruption:

1. Disable public signup / temporarily take frontend offline (hosting maintenance page).
2. Pause n8n schedules (scheduled ingestion / auto-analysis).
3. Optionally revoke/rotate `INGESTION_SECRET` to stop automation writes.
4. Communicate to operators: no Dashboard SQL edits, no Edge deploys mid-restore.

---

## 3. Identify recovery point

| Capability | Verified (2026-08-10) | Use |
|------------|----------------------|-----|
| PITR | **`pitr_enabled=false`** | Not available until paid add-on enabled |
| WAL / physical | **`walg_enabled=true`** | Platform physical backups (details sparse in API) |
| `backups` array | Empty in Management API | Confirm snapshot list in Dashboard → Database → Backups |
| Git | Full source + migrations | Rebuild app/Edge; not a DB substitute |

**Actions**

1. Open Supabase Dashboard → Project → Database → Backups.
2. Note latest available backup timestamp and retention shown in UI.
3. If PITR still disabled, recovery is **nearest daily/physical backup**, not arbitrary timestamp.
4. Choose restore target: **in-place** (destructive) vs **new project** (preferred for forensics).

Prefer restoring to a **new project** and cutting over DNS/env when possible.

---

## 4. Restore database

### Option A — Dashboard restore (platform UI)

1. Follow current Supabase docs for restore from backup for your plan.
2. If restoring in place: expect downtime; confirm operator approval.
3. If restoring to new project: create project in same region (`eu-west-1` preferred).

### Option B — Logical dump (if available)

Only if you already maintain `pg_dump` replicas outside Supabase (not currently required by JobPilot). Restore with `psql` into a staging DB first.

**This runbook does not execute restore steps against live.**

---

## 5. Verify migrations

1. Compare remote history:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

2. Compare to repo files under `supabase/migrations/` (expected 9 migrations through `20260810010000_phase5b1_idempotency_url_dedupe`).
3. If history missing but objects exist: repair history carefully (see Phase 5A.2 notes) — do **not** re-run destructive DDL blindly.
4. If schema behind repo: `npm run db:push` / Management apply **only** after backup confirmation.

---

## 6. Regenerate types

```bash
npm run db:types
```

Commit only if intentional schema change; for pure restore, types should match existing `src/types/database.ts`.

---

## 7. Redeploy Edge Functions

With `SUPABASE_ACCESS_TOKEN` in `.env.local`:

```bash
npx supabase functions deploy analyze-job --project-ref xzzoznhmezmaarcvavpr
npx supabase functions deploy generate-artifact --project-ref xzzoznhmezmaarcvavpr
npx supabase functions deploy chat-assistant --project-ref xzzoznhmezmaarcvavpr
npx supabase functions deploy ingest-job --project-ref xzzoznhmezmaarcvavpr
npx supabase functions deploy gmail-sync --project-ref xzzoznhmezmaarcvavpr
npx supabase functions deploy hiring-email-action --project-ref xzzoznhmezmaarcvavpr
npx supabase functions deploy google-oauth-start --project-ref xzzoznhmezmaarcvavpr
npx supabase functions deploy google-oauth-callback --project-ref xzzoznhmezmaarcvavpr
npx supabase functions deploy google-disconnect --project-ref xzzoznhmezmaarcvavpr
```

Re-confirm Edge secrets exist (names only checklist in [SECRET_ROTATION.md](./SECRET_ROTATION.md)).

---

## 8. Verify RLS

1. Spot-check policies still enabled on public tables.
2. Run a two-user isolation smoke (or reuse Phase 5A.2 harness patterns): user A cannot read user B rows.
3. Confirm service role remains Edge-only.

---

## 9. Smoke-test auth

1. Login existing known account.
2. Signup path respects `mailer_autoconfirm=false` (confirmation required for new public users).
3. Password reset email path (requires production mailer).
4. Session persists across reload.

---

## 10. Smoke-test AI

1. Analyze one job (expect `job_analysis` + `ai_generations` row).
2. Generate one artifact.
3. Send one assistant message (stream completes).
4. Open Settings → AI Analytics (RPC returns).

If OpenAI key invalid after restore of unrelated systems, rotate per Secret Rotation runbook.

---

## 11. Smoke-test Google

1. Integration status endpoint / Settings Integrations.
2. If tokens undecryptable (encryption key changed): user must reconnect.
3. Gmail sync (bounded).
4. Calendar create on a test application (idempotent).

---

## 12. Smoke-test n8n ingestion

1. Restore n8n credentials pointing at correct URL/anon/secret.
2. Manual webhook ingest one job.
3. Confirm dedupe on normalized URL.
4. Keep `auto_analyze` off unless spend approved.

---

## 13. Unfreeze & postmortem

1. Re-enable frontend / n8n schedules.
2. Monitor AI spend and Edge errors for 24h.
3. Write incident postmortem (detection, impact, RPO achieved, follow-ups).
4. If PITR was missing and hurt RPO: escalate enabling PITR (paid; needs approval).
