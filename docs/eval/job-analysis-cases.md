# Job analysis evaluation cases (Phase 4A)

Shared candidate used for A/B/C. Paste into Settings / profile for manual runs, or feed the Edge Function payload sections.

## Shared candidate

**Profile**

- Headline: AI Product Builder / Technical Product Manager
- Location: Belgrade, Serbia (open to EU remote)
- Target roles: AI Product Builder, Technical Product Manager, Product Lead (AI tools)
- Remote preference: remote_first
- Salary min: 70000 EUR

**Master CV (excerpt — use as-is; do not invent beyond this)**

```
Product builder with 6+ years shipping B2B SaaS products.
Led discovery, prioritization, and delivery for AI-assisted workflows (LLM prompt flows, evaluation dashboards, human-in-the-loop review).
Comfortable writing PRDs, running stakeholder workshops, and pairing with engineers on API/UX tradeoffs.
Hands-on with Figma, SQL basics, Notion, Linear; has shipped features that call OpenAI/Anthropic APIs via product specs (not as a research scientist).
Built internal tooling that reduced support ticket volume ~30% by clarifying AI answer confidence to agents.
Portfolio: case studies on AI onboarding assistant, CRM enrichment workflow, and job-search ops dashboard.
No PhD; no production ML model training or MLOps pipeline ownership demonstrated.
```

**Portfolio summary**

```
Three case studies: (1) AI onboarding assistant for SMB SaaS — discovery → MVP → eval loop;
(2) CRM enrichment workflow using LLM classification with human review;
(3) personal JobPilot-style ops dashboard for tracking applications.
Emphasizes product sense, AI tooling literacy, and shipping speed — not model research.
```

---

## CASE A — Very strong fit: AI Product Builder

**Job title:** AI Product Builder  
**Remote:** remote · EU-friendly  
**Description (minimum content):**

```
We need an AI Product Builder to own discovery and delivery of LLM-powered product experiences.
You will define use cases, write specs, partner with engineers, design evaluation loops,
and ship human-in-the-loop workflows. Experience shipping AI features in B2B SaaS is required.
Nice to have: familiarity with OpenAI/Anthropic APIs from a product perspective,
SQL/analytics literacy, and strong stakeholder communication.
Not looking for a research scientist or someone whose primary job is training models.
```

**Expected qualitative outcome**

- Highest overall among A/B/C (typically 80+)
- Strong product / AI-tools / experience scores
- Recommendation: `apply` (or strong `consider`)
- Strengths cite CV AI shipping evidence
- Gaps are minor (e.g. specific domain) — not fabricated skills
- Must not invent certifications or years beyond CV

---

## CASE B — Partial fit: Technical Product Manager

**Job title:** Technical Product Manager (Platform)  
**Remote:** hybrid Berlin  
**Description:**

```
Technical PM for our developer platform. Own roadmap for APIs, SDKs, and reliability.
Deep partnership with engineering on system design tradeoffs. Prefer 5+ years PM
with strong technical depth (can read architecture docs, write technical RFCs).
Experience with event-driven systems and observability is important.
AI experience is a plus but not the core of the role. German language helpful.
On-site collaboration in Berlin several days per week.
```

**Expected qualitative outcome**

- Mid overall (typically below Case A; often 60–75)
- Product fit OK; remote/location likely a gap vs Belgrade remote-first
- Gaps: Berlin hybrid, German, deep platform/observability evidence not demonstrated
- Recommendation: often `consider`
- Must not invent event-driven / observability experience

---

## CASE C — Low fit: ML Engineer

**Job title:** Machine Learning Engineer  
**Remote:** remote  
**Description:**

```
ML Engineer to design, train, and productionize models. Required: PyTorch/TensorFlow,
feature stores, experiment tracking, MLOps (Kubeflow/Vertex), and production inference
at scale. You will own model performance, drift monitoring, and GPU cost optimization.
PhD or equivalent research experience preferred. This is not a product management role.
```

**Expected qualitative outcome**

- Lowest overall (meaningfully below A and B; often <60)
- Large technical / experience gaps (training, MLOps, PhD)
- CV should be treated as product/AI-tools evidence, not ML engineering depth
- Recommendation: lean `skip` (or weak `consider` only if model is overly generous)
- Must not invent PyTorch, Kubeflow, or research credentials

---

## Scoring checklist (all cases)

- [ ] Case A overall > Case B overall > Case C overall
- [ ] Missing experience appears as gaps with “not demonstrated…” language
- [ ] No invented tools/years/projects
- [ ] Recommendation aligns with evidence and scores
- [ ] New `job_analysis` row created (history preserved on re-analyze)
- [ ] `metadata` contains model, duration_ms, usage when available

## Results log

| Date | Model | A overall | B overall | C overall | Notes |
|------|-------|-----------|-----------|-----------|-------|
| 2026-08-08 | gpt-4o-mini | 85 (`apply`) | — | — | Full E2E pass after credit top-up: persist, metadata, refresh, re-analyze history, guards. Cases B/C not re-run in this pass. |
| 2026-08-07 | gpt-4o-mini (configured) | blocked | blocked | blocked | Secret present & readable; OpenAI HTTP 429 blocked live generation. |

