# Pre-Deploy Checklist — JobPilot AI

Use before any environment promotion (staging → limited beta → open production).

---

## Database

- [ ] Repo migrations match remote `supabase_migrations.schema_migrations`
- [ ] No manual Dashboard schema drift
- [ ] Backup / PITR status reviewed (`pitr_enabled` documented)
- [ ] Destructive migration has explicit backup checkpoint
- [ ] RLS enabled on all user-owned tables

## Auth

- [ ] `mailer_autoconfirm=false` for public-facing environments
- [ ] Email delivery / SMTP configured and tested
- [ ] Password reset tested
- [ ] Production `site_url` set
- [ ] Redirect allowlist includes production + local only as needed
- [ ] Signup policy intentional (`disable_signup` if invite-only)

## Edge

- [ ] All required functions ACTIVE
- [ ] Secrets present (names): OpenAI, Google*, ingestion, app URL
- [ ] CORS allowlist includes production HTTPS origin (no `*`)
- [ ] Rate leases / timeouts unchanged or intentionally updated
- [ ] Regression scripts: `verify-5b-hardening.cjs`, `verify-5b1-remediation.cjs`

## Google

- [ ] OAuth consent status appropriate for audience
- [ ] Scopes reviewed (Gmail readonly, Calendar events)
- [ ] Production callback = Edge `google-oauth-callback`
- [ ] `JOBPILOT_APP_URL` points at production SPA
- [ ] Encryption key backed up offline (password manager)
- [ ] App verification plan if Google requires it for production users

## AI

- [ ] OpenAI billing / spend limits reviewed
- [ ] Soft alert thresholds sane (see Phase 5D: consider `avgLatencyMs` 8s)
- [ ] Auto-analyze ingest remains off unless approved
- [ ] Prompt registry versions recorded

## n8n

- [ ] Credentials in n8n vault (not workflow JSON)
- [ ] `INGESTION_SECRET` matches Edge
- [ ] Allowlist user IDs correct
- [ ] Schedules disabled until smoke OK

## Frontend

- [ ] `npm run lint` / `typecheck` / `build` pass
- [ ] Production env vars set
- [ ] HTTPS hosting
- [ ] SPA fallback routes configured
- [ ] Source map policy decided

## Security

- [ ] No secrets in git (`git status` clean of `.env*`)
- [ ] `npm audit` reviewed (no untriaged Critical; High documented)
- [ ] Service role not in Vite bundle

## QA

- [ ] Smoke plan prepared ([PHASE5E_FINAL_READINESS.md](./PHASE5E_FINAL_READINESS.md))
- [ ] Rollback owner identified
- [ ] Incident lead identified for launch window
