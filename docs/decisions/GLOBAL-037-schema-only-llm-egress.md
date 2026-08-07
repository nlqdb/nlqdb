# GLOBAL-037 — LLM egress is three enumerated lanes; planning is schema-only, and no lane widens without the founder

> **Amended 2026-08-07 (founder-approved, in-session).** The original
> headline — "only schema ever leaves the system" — was broader than the
> decision's own scope and was contradicted by shipped code (the `/v1/ask`
> narration step) and by the founder-approved interview path (`SK-EKP-007`).
> The Fable review of #918/#923 surfaced both; the founder approved this
> rewrite (F2) and the Option-B hardening (F1) the same day. Per the
> delete-on-supersede rule the text below is the only truth — the old
> headline survives in git history, not here.

- **Decision:** Exactly **three lanes** of egress to third-party LLMs
  exist; no fourth lane may be added and no lane may widen without amending
  this GLOBAL with the founder (`P1`).
  1. **Planning (NL→SQL prompt assembly)** — **schema only**: table/column
     DDL, types, keys, and hand-authored evidence/descriptions. Real user
     cell-values are **never** sent on this lane, in the free, BYOLLM, or
     hosted-premium chains. The ask pipeline passes `db.schemaText`
     (`apps/api/src/ask/orchestrate.ts`) and nothing row-level; the
     `value-retrieval` engine lever (sampling real cell-values into the
     prompt) stays **unbuilt**. *(Unchanged from the original decision.)*
  2. **Narration (`summarize`)** — the shipped answer-narration step sends
     the query's **returned rows** (≤50) to the LLM to phrase the answer;
     disclosed in `/privacy` ("Query text"), skipped on
     `Accept: application/json`. **Founder-chosen hardening (F1-B,
     2026-08-07):** knowledge-DB and granted-query paths **skip narration
     by default** once `EK-09` ships — buyer-facing marketplace queries
     become schema-only end-to-end, which is what unlocks the stronger
     trust copy staged in the EK-03 draft.
  3. **Interview/extraction (authoring)** — **founder-approved carve-out
     (2026-08-07):** an expert's interview answers, and read-back of that
     expert's **own** stored facts (contradiction-citing, session-open
     replay), reach the interview model — scoped to the interview/
     extraction module, the expert's own tenant, authoring only
     (`INV-EKP-037` in `SK-EKP-007`); pinned to a **no-training provider**
     under F1-B. Never a query path, never cross-tenant.
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** Sending cell-values on the *planning* lane is a new
  data-exposure posture with ~0 measured benefit (`SK-QUAL-014`, run 18:
  value-sampling flips ~0 BIRD rows) — the conservative default keeps that
  egress **closed**. But a boundary stated more broadly than the code it
  governs is worse than a modest one: the overbroad headline let a legal
  draft (#923) inherit a false "never" into signable text, and let a
  feature record (#918) carve an exception the GLOBAL's own terms reserved
  to the founder. Enumerated lanes make every egress path visible,
  auditable, and founder-gated — the honest floor the `SK-EKP-001` trust
  claim stands on.
- **Consequence in code:** Prompt-assembly on the planning lane
  (`apps/api/src/ask/**`, `packages/llm/**`) carries schema + evidence
  only; the existing egress test extends to knowledge-DB listings
  (`EK-04`). A reviewer rejects any PR putting cell-values into an LLM
  request outside lanes 2–3, any widening of lane 3 beyond the interview
  module / own tenant / authoring scope, and any weakening of lane 2's
  opt-out. `EK-09` implements the F1-B hardening (narration skip on
  knowledge/granted paths; no-training provider pin for the interview
  model). Trust copy may claim exactly what the lanes make true — no more
  (`SK-EKP-001`).
- **Alternatives rejected:**
  - **Sample cell-values into the planning prompt (`value-retrieval`)** —
    real exposure for ~0 measured gain; still rejected.
  - **Keep the absolute headline and treat narration/interview as
    unwritten exceptions** — a boundary that code contradicts falsifies
    every claim built on it; rejected by the 2026-08-07 review findings.
  - **Decide egress per feature** — one boundary in one place (`P3`).
