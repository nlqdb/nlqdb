# SK-QUAL-022 — Frontier eval lanes run a capability `plan` budget, not the production hot-path clamp

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Parent decisions:
[`SK-QUAL-004`](./SK-QUAL-004-free-vs-frontier-delta.md) (the ~77-82% SOTA
intent this budget serves),
[`SK-QUAL-009`](./SK-QUAL-009-exec-retry-agentic-lane.md) (the
`agentic-frontier` lane this also covers),
[`SK-QUAL-020`](./SK-QUAL-020-transport-collapse-guard.md) (the
`NON_ENGINE_REASONS` set the paired `timeout` reclassification feeds).
`SK-ASK-009` (the 5 s production `plan` clamp — see `llm-router/FEATURE.md`).

- **Decision:** The `frontier` and `agentic-frontier` eval lanes build their
  router with `timeouts: { plan: 30_000 }` (`FRONTIER_PLAN_TIMEOUT_MS`), not
  the inherited `DEFAULT_TIMEOUTS_MS.plan` of 5 s. The **free** lane keeps the
  production 5 s clamp (`PROD_PLAN_TIMEOUT_MS`) so it still measures what
  ships. Each lane carries its budget as `Lane.planTimeoutMs`.

- **Core value:** Correct

- **Why:**
  - **The 5 s clamp measures the production hot-path budget, not frontier
    capability — the opposite of what this lane exists for.** `SK-QUAL-004`
    defines the `agentic-frontier` lane as the ~77-82% SOTA reference. A
    reasoning frontier model (Claude Sonnet 4.6) needs more than 5 s on hard
    BIRD questions; clamping it to the hot-path budget measures the clamp, not
    the model. The free lane is the "what ships" reference and keeps 5 s; the
    frontier lanes are the "what the model can do" reference and must not.
  - **Run 14 (2026-07-06) diagnosed the clamp as a silent score suppressor.**
    The 5 s `plan` timeout aborted Sonnet 4.6 mid-body-read at 5000–5004 ms;
    the abort surfaced as `openrouter:parse` `no_sql` — an *answer-signal*
    reason scored as an engine miss (7 on `frontier`, 5 on `agentic-frontier`).
    The frontier lanes carried a floor they never earned.
  - **Paired with the `openai-compatible.ts` abort reclassification.** An
    abort during `res.json()` now throws `timeout`, not `parse`, so any
    residual timeout at the larger budget lands in `SK-QUAL-020`'s
    `NON_ENGINE_REASONS` (excluded from the engine signal) instead of a
    spurious `no_sql`. Budget + label together make the lane read competence.

- **Consequence in code:** `tools/eval/src/lanes.ts` —
  `FRONTIER_PLAN_TIMEOUT_MS` / `PROD_PLAN_TIMEOUT_MS` consts; both frontier
  builders pass `timeouts: { plan: FRONTIER_PLAN_TIMEOUT_MS }`; `Lane` gains
  `planTimeoutMs` (both consts exported via `_testing`).
  `packages/llm/src/providers/openai-compatible.ts` — the `res.json()` catch
  classifies an `AbortError` / aborted-signal body read as `timeout`, not
  `parse`. Tests: `tools/eval/test/lanes.test.ts`,
  `packages/llm/test/providers/openai-compatible.test.ts`.

- **Alternatives rejected:**
  - **Raise `DEFAULT_TIMEOUTS_MS.plan` for everyone.** That is a production
    hot-path budget (`SK-ASK-009`) tuned to the Worker wall-clock; loosening
    it to serve the ablation would ship a slower free path to users. The
    budget split is the point.
  - **Leave the clamp; treat the 5 timeouts as an engine miss (status quo).**
    Records a harness config choice as model incompetence — the same
    self-deception `SK-QUAL-013`/`020` exist to prevent, one rung up: not an
    outage, but a lane measuring the wrong thing.
  - **Reclassify abort→timeout without raising the budget.** Honest labelling
    but the frontier model still never answers the hard questions — the
    NON_ENGINE exclusion just shrinks the denominator instead of measuring
    capability. The budget is what lets the model actually finish.
  - **Make the budget env-tunable.** Adds a knob no operator would set
    differently; a single generous ablation constant is simpler (P5) and the
    per-lane `planTimeoutMs` keeps each lane's budget assertable in tests.
