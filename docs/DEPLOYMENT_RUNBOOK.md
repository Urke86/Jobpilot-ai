# Deployment Runbook — JobPilot AI

---

## 1. Prerequisites

- `SUPABASE_ACCESS_TOKEN` in `.env.local` (never commit)
- Linked project `xzzoznhmezmaarcvavpr`
- Edge secrets already present for the environment
- Clean git working tree for the release commit (recommended)

---

## 2. Pre-deploy

Complete [PRE_DEPLOY_CHECKLIST.md](./PRE_DEPLOY_CHECKLIST.md).

Especially:

- Confirm `mailer_autoconfirm=false` for non-local public environments
- CORS allowlist includes production HTTPS origin
- PITR decision recorded for this launch tier

---

## 3. Migration apply

```bash
# Preferred when network allows:
npm run db:push

# If IPv6/CLI blocked, apply via Management API in ordered chunks
# (historical pattern used in Phase 5B.1) — never edit live schema by hand
```

Verify:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Must match repo migration filenames/versions.

---

## 4. Types regeneration

```bash
npm run db:types
npm run typecheck
```

Only commit `src/types/database.ts` when schema intentionally changed.

---

## 5. Edge deploy

Deploy changed functions (or all nine if unsure):

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

Use `npm run supabase -- …` wrapper when you need the JobPilot-scoped PAT loader.

---

## 6. Frontend build

```bash
npm run lint
npm run typecheck
npm run build
```

Hosting env:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

SPA fallback: all routes → `index.html`.

Source maps: prefer disabled or restricted access in public production.

---

## 7. n8n (if changed)

1. Import updated JSON from `automation/n8n/` (no secrets in file).
2. Re-bind credentials.
3. Disable schedules until smoke passes.

---

## 8. Smoke tests

Run the post-deploy smoke list in [PHASE5E_FINAL_READINESS.md](./PHASE5E_FINAL_READINESS.md) § Post-deploy smoke (against the intended environment only with authorization).

Minimum:

1. Login
2. Create job
3. Analyze job
4. Artifact generate
5. Assistant stream
6. Logout / login persistence

---

## 9. Rollback decision tree

| Layer | Rollback |
|-------|----------|
| Frontend | Redeploy previous static build / prior hosting release |
| Edge Function | Redeploy previous git revision of that function |
| Prompt version | Do not delete history; point code at prior prompt constant / registry version |
| n8n | Re-import prior workflow JSON; disable broken schedule |
| Migration | **Prefer forward-fix** migration. Destructive down-migrations are unsafe if data written under new schema |

If data corruption: [RESTORE_RUNBOOK.md](./RESTORE_RUNBOOK.md).

---

## 10. After deploy

1. Watch Edge error rate 30–60 minutes.
2. Check AI Analytics spend spike.
3. Confirm soft alerts not flapping.
4. Record release notes (migrations, functions, frontend hash).
