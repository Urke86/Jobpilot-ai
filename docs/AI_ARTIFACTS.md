# JobPilot AI — Application Artifacts (Phase 4B)

## Purpose

Generate versioned, factual application materials from authoritative Supabase data (profile, CV, portfolio, job, latest analysis, application, company) via a secure Edge Function.

## Architecture

```
Application Detail (AI Application Toolkit)
  → services/app/artifacts.ts  (requestArtifactGeneration)
  → supabase.functions.invoke('generate-artifact')
  → Edge Function
       · JWT auth + ownership checks
       · Shared context builder (labeled sections)
       · Artifact-specific prompt + JSON schema
       · Zod validation (+ one repair retry)
       · INSERT application_artifacts (new version)
       · activity_type: artifact_created
  → UI refresh / version history
```

| Layer | Path |
|-------|------|
| UI | `src/components/artifacts/ArtifactToolkit.tsx` |
| App service | `src/services/app/artifacts.ts` |
| Shared schemas | `src/lib/ai/artifact-schemas.ts` |
| Shared prompts | `src/lib/ai/artifact-prompts.ts` |
| Edge Function | `supabase/functions/generate-artifact/` |

## Supported artifact types

| Type | Output |
|------|--------|
| `cv_recommendations` | Structured CV tailoring guidance |
| `cv_summary` | 70–120 word summary |
| `cover_letter` | Subject + body |
| `questionnaire_answer` | Question + answer + evidence_used |
| `linkedin_message` | Short outreach |
| `follow_up` | Follow-up message |
| `interview_questions` | Categorized questions |
| `interview_answers` | Honest answer + supporting examples |
| `company_research` | From saved data only |
| `custom` | User instruction → content |

## Context builder

Labeled sections only as needed:

- CANDIDATE PROFILE / MASTER CV / PORTFOLIO
- JOB / LATEST JOB ANALYSIS / APPLICATION / COMPANY
- USER INPUT (question, notes, instruction, contact, days since)

No tokens, secrets, or unnecessary IDs.

## Anti-fabrication

Same core rule as Phase 4A: never invent experience. Missing evidence must be stated or framed as adjacent — never upgraded into production claims.

## Versioning

Each generation inserts a **new** row. `version` increments per `(application_id, artifact_type)`. UI shows latest by default and lists prior versions. User edits update `content` in place (does not create a new AI version).

## Cost / latency

Stored in `application_artifacts.metadata`:

- `provider`, `model`, `artifact_version`, `duration_ms`
- `usage` tokens, `estimated_cost_usd`
- `result` (full structured object)
- input echoes (`question`, `user_instruction`, …)

Model defaults to `OPENAI_ANALYSIS_MODEL` or `gpt-4o-mini` (same secret family as Phase 4A).

## Security

- OpenAI key only in Edge secrets
- Ownership verified for application + job
- Profile/CV loaded server-side (not trusted from client)
- Provider errors sanitized
- Logs avoid dumping full CV / answers

## Known limitations

- No external web research for company_research
- No streaming UI
- No multi-model routing yet
- 15s regenerate rate limit per artifact type
- Eval cases B/C style qualitative checks documented in `docs/eval/artifact-cases.md`

## Deploy

```bash
.\scripts\supabase.ps1 functions deploy generate-artifact
```

Requires existing `OPENAI_API_KEY` secret.
