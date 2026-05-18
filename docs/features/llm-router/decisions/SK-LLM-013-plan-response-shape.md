# SK-LLM-013 — `PlanResponse` carries `model` + `confidence` for SK-TRUST-002

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Sharded out
unchanged to keep that doc under the 20 KB cap per `CLAUDE.md` §2 D4 —
this body is verbatim, only the location moved.

- **Decision:** `PlanResponse` is `{ sql, model, confidence }`. Providers populate `model` from their per-operation model name (`impl.models.plan`); `confidence` is a placeholder `1.0` until the [`quality-eval`](../../quality-eval/FEATURE.md) harness (Phase 3) calibrates per-stage floors per [`SK-TRUST-003`](../../trust-ux/FEATURE.md). The orchestrator threads both into the response `trace` block.
- **Core value:** Honest latency, Bullet-proof
- **Why:** [`SK-TRUST-002`](../../trust-ux/FEATURE.md) requires the response trace to name the model that emitted the plan. The router already knows the model (it picked it); making that public is a one-field addition. Carrying `confidence` now — even as a placeholder — keeps the wire contract stable so SK-TRUST-003's later calibration is a value change, not a shape change.
- **Consequence in code:** `packages/llm/src/types.ts` widens `PlanResponse`; `packages/llm/src/providers/_chat-provider.ts` wraps the parsed `{sql}` from the provider JSON with `{ model: impl.models.plan, confidence: 1.0 }`. Per-provider files (`gemini.ts`, `groq.ts`, etc.) need no change — they go through the shared chat-provider. `nlqdb.cache.plan.write` stores both fields (see [`SK-PLAN-009`](../../plan-cache/FEATURE.md)) so cache-hits return the same `model` + `confidence` the original miss recorded.
- **Alternatives rejected:**
  - Extend the LLM JSON output schema to ask the model for its own confidence — adds an unbounded variable (model-reported confidence isn't calibrated) and a fragile prompt dependency before SK-TRUST-003 has any way to use the number.
  - Skip `confidence` on `PlanResponse` until SK-TRUST-003 lands — forces a second wire-shape change later, breaking SDK consumers twice for one feature.
