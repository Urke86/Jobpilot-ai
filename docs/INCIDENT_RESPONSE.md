# Incident Response — JobPilot AI

---

## 1. Severity levels

| Severity | Definition | Examples | Response target |
|----------|------------|----------|-----------------|
| **SEV-1** | Safety, privacy, or irreversible data integrity | Cross-user data leak; credential exposure; confirmed data loss/corruption; RLS bypass | Immediate contain; all-hands ops |
| **SEV-2** | Major product capability down | Auth outage; AI generation outage; Gmail sync broken for all; ingest pipeline down | Same business day |
| **SEV-3** | Degraded non-critical feature | Single artifact type failing; chart load slow; soft alert noise | Next planned window |

---

## 2. Roles

| Role | Responsibility |
|------|----------------|
| Incident lead | Severity, communications, go/no-go restore |
| Tech | Containment, logs, deploys, DB investigation |
| Operator | Secrets, Supabase dashboard, n8n pause |

(Closed beta: often the same person — still record timeline.)

---

## 3. Detection sources

- User reports
- Settings → AI Analytics / soft alerts (`ai_observability_alerts`)
- Supabase Edge logs / Auth logs
- OpenAI billing anomalies
- n8n failed executions
- `npm`/CI failures on deploy

---

## 4. Response phases

### 4.1 Detection

1. Timestamp (UTC).
2. Symptom + scope (one user / all users).
3. Tentative severity.

### 4.2 Containment

| Scenario | Containment |
|----------|-------------|
| Suspected cross-tenant leak | Take SPA offline; disable signup; pause n8n; rotate anon if needed after fix |
| Secret leak | Rotate per [SECRET_ROTATION.md](./SECRET_ROTATION.md); revoke provider keys |
| Bad Edge deploy | Redeploy previous known-good function bundle |
| Runaway AI spend | Remove/rotate `OPENAI_API_KEY` temporarily; disable auto-analyze |
| Bad migration | Freeze writes; follow [RESTORE_RUNBOOK.md](./RESTORE_RUNBOOK.md) |

### 4.3 Investigation

1. Edge logs for status codes / error codes.
2. `ai_generations` failure rates by feature.
3. Auth config (`mailer_autoconfirm`, redirect URLs).
4. Recent migrations / deploys / secret changes.
5. Preserve evidence (do not DROP tables to “clean”).

### 4.4 Mitigation

Apply least-destructive fix: config patch, redeploy, forward-fix migration, key rotation.

### 4.5 Recovery

1. Smoke tests from [PRE_DEPLOY_CHECKLIST.md](./PRE_DEPLOY_CHECKLIST.md) / post-deploy list.
2. Re-enable paused systems.
3. Confirm soft alerts clear.

### 4.6 Postmortem

Within 5 business days for SEV-1/2:

- Timeline
- Root cause
- Impact (users, data, spend)
- What worked / failed
- Action items with owners
- Whether PITR / monitoring gaps contributed

---

## 5. Communication templates (internal)

**SEV-1 open:** “SEV-1 investigating possible {leak|loss}. SPA/n8n paused. Next update in 30m.”  
**SEV-1 close:** “Contained. Root cause {x}. User action required: {reconnect Google|reset password|none}.”

Do not disclose secret values or raw PII in chat logs.

---

## 6. SEV-1 special cases

### Cross-user data leak

1. Offline + pause automation.
2. Identify query/policy gap; patch RLS/WITH CHECK.
3. Assess exposure window; notify affected users as required by your process.
4. Rotate keys if tokens may have been accessed.

### Credential exposure (git, screenshot, log)

1. Rotate immediately.
2. Audit git history; purge if committed (offline process).
3. Check OpenAI/Google usage for abuse.

### Data loss

1. Stop writes.
2. Restore runbook — prefer new project cutover.
3. Measure achieved RPO vs target.
