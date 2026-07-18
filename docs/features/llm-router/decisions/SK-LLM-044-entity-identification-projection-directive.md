# SK-LLM-044 — Entity-identification projection directive — REVERTED (regressed BIRD)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the `PLAN_DIRECTIVES`
block). **Status: reverted 2026-07-18** — the `PLAN_DIRECTIVES` bullet and its
`prompts.test.ts` assertion are removed; the block reverts to the
[`SK-LLM-043`](./SK-LLM-043-single-column-projection-directive.md) →
[`SK-LLM-035`](./SK-LLM-035-numeric-text-cast-directive.md) ordering.

- **What it was:** one `PLAN_DIRECTIVES` bullet telling the planner, on a
  "which/who/top-N `<entity>`" goal, to project the column that *names* the
  entity — JOINing to its naming table when the queried table carries only a
  surrogate id — and to answer every attribute a multi-part goal asks for.
  Prompt-only, ≈85 input tokens/`plan` call.
- **Why reverted:** the directive was evidence-picked on Spider 2.0-lite and
  claimed BIRD-safe ("BIRD's positional scorer follows the goal's literal
  ask, which the bullet defers to"). Its **first-ever BIRD measurement**
  (2026-07-18 canonical, main `8f254c9`, 500 q, `no_sql` 0) **falsified that
  claim**: BIRD free EA **0.546 → 0.514** (−3.21 pp, 272 → 256 match),
  McNemar **b=46 / c=30, p=0.043** — a `SK-QUAL-006` regression trigger on the
  Phase-2 gate-binding benchmark (BIRD ≥ 0.60 free). Meanwhile the Spider
  "gain" that justified it was itself **statistically flat** (2026-07-11 run:
  raw +2.2 pp but McNemar b=10 / c=13, p≈0.68). Mechanism: "return the column
  that names the entity, JOINing to its naming table" adds a name column / JOIN
  where BIRD gold expects the id or metric alone — exactly the extra-column
  class [`SK-LLM-027`](./SK-LLM-027-result-shape-directives.md) bounds, which
  this bullet overrode in practice. A directive that never significantly helped
  its own target and significantly harms the gate constraint has not earned its
  place ([`SK-QUAL-005`](../../quality-eval/FEATURE.md#sk-qual-005): never
  ratchet a regression into the baseline).
- **Do not re-add** without a paired (same-provider-draw) BIRD+Spider A/B that
  shows a net gain — a single raw-number bump inside BIRD's ±2–3 pp
  provider-mix band is not sufficient evidence.
