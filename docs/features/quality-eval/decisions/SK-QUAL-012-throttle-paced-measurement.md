# SK-QUAL-012 — Inter-question throttle so a low-RPM free chain measures reasoning, not availability

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Parent decisions:
[`SK-QUAL-011`](./SK-QUAL-011-resumable-runner.md) (the budget-stop the
throttle complements — pacing avoids the stop, the stop catches what pacing
can't), [`SK-LLM-023`](../../llm-router/decisions/SK-LLM-023-cerebras-planner-tier.md)
(the ~5-RPM Cerebras planner head this paces around),
[`SK-LLM-030`](../../llm-router/decisions/SK-LLM-030-rate-limit-aware-failover.md)
(the failover the throttle gives time to recover).

- **Decision:** The runner accepts an optional `--throttle-ms <n>`
  (`RunOptions.throttleMs`, default **0** ⇒ no behavioural change) that
  sleeps `n` ms between questions. The workflows pass it **on** for real-key
  dispatches (`3000 ms`; a bigger value is needed the more big-DDL schemas
  saturate per-minute TPM) so the offered load stays under the chain's
  combined per-minute limits and the
  [`SK-LLM-030`](../../llm-router/decisions/SK-LLM-030-rate-limit-aware-failover.md)
  failover + the `SK-LLM-005` circuit breaker can recover between
  questions instead of all providers' breakers opening at once into a
  `no_sql` wall. The throttle is a **measurement-harness** knob only — it
  does not touch `apps/api/src/llm-router.ts` or production latency.

- **Core value:** Bullet-proof, Honest latency

- **Why:**
  - **An unpaced run on a ~5-RPM head measures availability, not
    reasoning.** With the Cerebras planner head at ~5 RPM
    ([`SK-LLM-023`](../../llm-router/decisions/SK-LLM-023-cerebras-planner-tier.md))
    a 500-question back-to-back run exhausts every free tier in seconds;
    the breakers open and stay open, and the report fills with `no_sql`
    (chain-exhaustion), which scores 0 EX regardless of how good the SQL
    *would* have been. That is exactly the §5 guardrail the tracker flagged
    against `SK-LLM-023` — verified true on the first post-fix run. The
    throttle separates the *capacity* axis from the *reasoning* axis so the
    EX we report is the reasoning number, not a free-tier rate-limit
    artifact.
  - **Default 0 keeps PR CI and the mocked-router unit tests unchanged.**
    The pacing only fires when an operator passes the flag on a real-key
    run; the `SK-QUAL-002` mocked CI path and the 177 eval unit tests run
    at full speed.
  - **Complements, not replaces, the budget-stop.** Pacing keeps a healthy
    chain alive; [`SK-QUAL-011`](./SK-QUAL-011-resumable-runner.md) still
    catches a genuine daily-cap exhaustion (all-`rate_limited`) and
    checkpoints. The two compose: throttle lowers how often the stop fires.

- **Consequence in code:** `tools/eval/src/runner.ts` — `RunOptions.throttleMs`
  + the `--throttle-ms` CLI flag + a single `await setTimeout` guarded by
  `throttleMs > 0` before each not-yet-scored question (the first scored
  question is not delayed). No change to `lanes.ts`, the router, or the
  report shape. The workflows pass it on real-key dispatches.

- **Alternatives rejected:**
  - **Raise the circuit-breaker threshold / shorten its cooldown in the
    eval lane.** Diverges the eval router from production
    (`lanes.ts` must mirror `llm-router.ts`, tracker §5) — it would measure
    a breaker config we don't ship.
  - **Drop the low-RPM head for the eval only.** Same divergence: the
    Cerebras head *is* the system under test; measuring without it measures
    a different engine.
  - **Per-question adaptive backoff in the runner.** More code for no extra
    measurement fidelity — the router already does rate-limit-aware
    failover; a fixed inter-question gap is the minimal primitive that
    spaces the *offered* load.
  - **A hard token-budget counter.** Already considered and parked in the
    feature's open questions; the reactive budget-stop (`SK-QUAL-011`) plus
    this proactive pacing cover the need without guessing each tier's true
    limit.
