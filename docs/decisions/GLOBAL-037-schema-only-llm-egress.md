# GLOBAL-037 — Schema-only egress to third-party LLMs; never send user cell-values

- **Decision:** Only **schema** (table/column DDL, types, keys, and
  hand-authored evidence) leaves the system to a third-party LLM. Real
  **user cell-values are never sent** to any third-party LLM in the free
  or BYOLLM chains. The ask pipeline passes `db.schemaText`
  (`apps/api/src/ask/orchestrate.ts`) and nothing row-level. The
  `value-retrieval` engine lever — which would sample a few real
  cell-values per column into the prompt — is **not built**, and no future
  lever may add cell-values to third-party LLM egress without superseding
  this GLOBAL.
- **Core value:** Bullet-proof, Free
- **Why:** Sending cell-values is a new data-exposure posture with ~0
  measured benefit: the [`quality-eval`](../features/quality-eval/FEATURE.md)
  mismatch classifier (`SK-QUAL-014`, run 18) showed value-sampling flips
  **~0 BIRD rows standalone** — below every reasoning lever. Per
  [`GLOBAL-033`](./GLOBAL-033-resolution-defaults.md) this is a
  privacy/security trade-off, and the conservative default is to bias a
  data-egress path **closed**: schema is structural metadata a user
  reasonably expects to leave when they choose an LLM; row contents are
  the private payload. Zero benefit for a real exposure increase makes the
  choice value-decidable.
- **Consequence in code:** Prompt-assembly on the free / BYOLLM path
  (`apps/api/src/ask/**`, `packages/llm/**`) carries schema + evidence
  only. Any PR adding cell-values to an LLM prompt must first supersede
  this GLOBAL with the founder (`P1`) — it is a documented egress
  boundary, not an implementation detail. The hosted-premium lane obeys
  the same rule unless a future GLOBAL says otherwise.
- **Alternatives rejected:**
  - **Sample cell-values into the prompt (the `value-retrieval` lever)** —
    a new exposure posture for ~0 measured accuracy gain; fails the
    conservative default.
  - **Decide it per feature** — egress content governs the whole ask
    pipeline, not just eval; one boundary in one place (`P3`).
