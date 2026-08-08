# JobPilot AI — Streaming Assistant (Phase 4C.1)

## Purpose

Real contextual chat on the Assistant page using JobPilot data, with SSE streaming, conversation persistence, and the same anti-fabrication rules as Phases 4A/4B.

## Architecture

```
AssistantPage
  → createConversation / listMessages (Supabase RLS)
  → streamAssistantMessage (fetch SSE to Edge Function)
  → chat-assistant
       · JWT auth + conversation ownership
       · bounded JobPilot context (none | job | application)
       · recent N messages
       · OpenAI stream=true
       · persist assistant message only after complete text
       · metadata: model, latency, tokens, cost
```

| Layer | Path |
|-------|------|
| UI | `src/pages/AssistantPage.tsx` |
| Service | `src/services/app/assistant.ts` |
| Prompts | `src/lib/ai/assistant-prompts.ts` |
| Edge Function | `supabase/functions/chat-assistant/` |
| Schema | `supabase/migrations/20260808123000_ai_conversations.sql` |

## Conversation schema

**ai_conversations:** id, user_id, title, context_type (`none`|`job`|`application`), context_job_id, context_application_id, timestamps  

**ai_messages:** id, user_id, conversation_id, role (`user`|`assistant`|`system`), content, metadata, created_at  

RLS: owner-only CRUD; message insert requires parent conversation ownership.

## Streaming flow

1. Persist user message  
2. Open OpenAI chat completion with `stream: true`  
3. SSE events: `user_message` → `token*` → `done` (saved assistant row) or `error`  
4. Incomplete streams are **not** saved as successful assistant messages  

Frontend uses raw `fetch` (not `functions.invoke`) to avoid buffering.

## Context selection

User chooses:

- **none** — profile / CV / portfolio only  
- **job** — + job, company, latest analysis  
- **application** — + application, recent artifacts, linked job/analysis  

Context is clipped to ~14k characters. History window: last **20** messages.

## Spend / rate protection

- Concurrent UI send disabled while streaming (+ AbortController stop)  
- Server rejects a new turn when the latest message is an unanswered `user` within 90s (429)  
- 3s per-conversation cooldown after a completed assistant turn  
- Soft daily cap: `ASSISTANT_DAILY_MESSAGE_CAP` (default 80 assistant messages/user/day)  
- `max_tokens` = 1200  

## QA (2026-08-08)

| Flow | Result |
|------|--------|
| A — New conversation, no job context | Pass (stream + persist + metadata) |
| B — Job context | Pass |
| C — Gap question / no fabricated experience | Pass |
| D — Application-context interview prep | Pass |
| E — Refresh restores history | Pass |
| F — Cross-user conversation access | Pass (404) |
| G — Provider / bad-id failure handled | Pass |
| H — Concurrent / in-flight duplicate generation | Pass (429) |

lint / typecheck / build: Pass  


## Cost / latency metadata

Stored on assistant `ai_messages.metadata`:

- provider, model, assistant_version, duration_ms  
- usage tokens, estimated_cost_usd  
- context_type / ids used  

## Security

- OpenAI key server-side only  
- Ownership checks on conversation (+ job/application when loaded)  
- Sanitized client errors  
- Activity: `assistant_started` once per new conversation (not every message)  

## Known limitations

- No RAG / embeddings  
- No conversation auto-summary beyond recent-N window  
- Stop aborts the client stream; provider may still finish server-side (no half-saved assistant row if insert never runs)  
- Application picker labels depend on loaded jobs list  

## Deploy

```bash
.\scripts\supabase.ps1 functions deploy chat-assistant
```
