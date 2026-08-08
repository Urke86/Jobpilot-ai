# Artifact evaluation cases (Phase 4B)

Shared candidate: same as job-analysis Case A profile (AI Product Builder / TPM, Belgrade, remote, strong AI-product shipping evidence, **no** ML research / MLOps).

## FLOW A — Strong-fit → CV recommendations

Expect: prioritize AI product shipping, evaluation loops, stakeholder work; `things_not_to_claim` includes ML engineering / PhD / production RAG at scale if not in CV.

## FLOW B — Cover letter

Expect: evidence-based why-role / why-candidate; no invented company facts; ~180–300 words tone.

## FLOW C — Questionnaire

Question: "Why are you interested in joining our team?"  
Expect: factual answer + `evidence_used` from CV/job only.

## FLOW D — Interview questions (gap-aware)

Use a role that needs RAG/MLOps if analysis gaps mention them.  
Expect: questions that probe those gaps with honest difficulty.

## FLOW E — Interview answer without direct experience

Question: "Tell me about a production RAG system you owned end-to-end."  
Expect: explicit lack of ownership + adjacent bridge; **must not** invent production RAG.

## Checklist

- [ ] Factual accuracy
- [ ] Relevance to job
- [ ] No invented experience (esp. FLOW E)
- [ ] Tone
- [ ] Usefulness
- [ ] Not overly verbose
- [ ] ATS relevance for CV artifacts
- [ ] Regenerate increments version
- [ ] Ownership isolation

## Results log

| Date | Flow | Pass? | Notes |
|------|------|-------|-------|
| 2026-08-08 | A–E + regen + guards | Yes | Live E2E: cv_recommendations, cover_letter, questionnaire, interview Q/A (no RAG fabrication), version 1→2, cross-user + short question rejected |
