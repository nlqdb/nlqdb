# SK-QUAL-017 — Self-consistency majority vote: cluster N sampled plans by the result set, vote the answer

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Implements the
deterministic core of the §4 #3 reasoning lever
([`quality-score-source-of-truth.md`](../../../progress/quality-score-source-of-truth.md)
§4 #3), the top remaining free-chain lever now that the prompt-directive
levers (T13–T22) have saturated on BIRD and the [`SK-QUAL-014`](./SK-QUAL-014-mismatch-error-class-classifier.md)
literal/date axes falsified value-retrieval standalone.

- **Decision:** Ship a pure `majorityVote(candidates, { ordered })` primitive
  (`tools/eval/src/self-consistency.ts`) + the reusable `fingerprintRows`
  helper (`tools/eval/src/score.ts`). Given N candidate plans, each already
  executed to a result set (or carrying `rows: null` when its SQL failed),
  it clusters the *executable* candidates by a canonical result-set
  fingerprint, returns the SQL of the modal cluster, and reports the
  agreement share (`clusterSize / executable`). Voting is on the **answer
  (the rows), not the SQL string** — distinct queries that return the same
  rows agree. Deterministic: ties break to the cluster holding the earliest
  candidate, and the winning SQL is that earliest candidate's, so the outcome
  is stable regardless of the order N samples return in. `fingerprintRows` is
  multiset by default (order-irrelevant queries agree) and sequence-strict
  under `ordered`, matching `rowsMatch` equality so a vote can never cluster
  two answers the scorer would call unequal.

- **Core value:** Honest

- **Why:**
  - **It is the top free-chain lever left.** The residual loss after the
    directive levers is structural-reasoning mass (grain/shape), and the
    literal/date axes proved value-retrieval flips ~0 rows standalone.
    Self-consistency (Wang et al. 2022, [arXiv:2203.11171](https://arxiv.org/abs/2203.11171))
    attacks reasoning variance directly: sample N paths, marginalise by
    majority over the answer. On the free chain the marginal cost is quota,
    not money.
  - **Vote on rows, not SQL.** Text-to-SQL has many correct phrasings; a
    string vote would scatter equivalent answers across singleton clusters
    and never reach consensus. Clustering on the executed result set (the EX
    metric's own unit) is the only vote that tracks correctness.
  - **Stage the deterministic core first.** Voting/tie-break edge cases
    (empty result sets as a valid answer, all-failed candidates, multiset vs
    ordered, modal-not-first) are where bugs hide and are fully unit-testable
    offline — no LLM, no quota, no dispatch. This is the same
    ship-and-prove-the-primitive pattern as [`SK-QUAL-014`](./SK-QUAL-014-mismatch-error-class-classifier.md)
    and [`SK-QUAL-015`](./SK-QUAL-015-column-coverage-harness.md); the
    expensive half (sampling + dispatch) builds on a proven base.

- **Consequence in code:** `tools/eval/src/self-consistency.ts` —
  `majorityVote` primitive + the `voteOverSamples(samples, execute, { ordered })`
  **execution-half orchestration** (executes each sampled plan via an *injected*
  executor, then votes — pure, so it unit-tests offline) + the
  `bun self-consistency <candidates.json>` CLI; `tools/eval/src/score.ts` —
  `fingerprintRows` (reused by the vote) + `executeRows(dbPath, sql, timeoutMs)`
  (predicted SQL → positional-tuple rows, `null` on empty/exec-error — the
  no-vote signal `majorityVote` consumes; shares `scoreOne`'s SQLite
  loader / busy-timeout / `normalizeSql` path so a sampled candidate executes
  byte-identically to how the winner is scored); `tools/eval/test/self-consistency.test.ts`
  (21 unit cases incl. an `executeRows` + `voteOverSamples` end-to-end against
  a real SQLite fixture, plus the `samplePlans` draws below). The orchestration
  is the "separate code path" the source-of-truth §5 guardrail reserves for
  §4 #3 — it never touches the greedy `scoreOne`/`withExecRetry` path. **The
  *sampling* half now ships too:** an optional `temperature?` on `PlanRequest`
  (`packages/llm/src/types.ts`) is plumbed through every plan-capable provider
  (the shared `ChatCallArgs.temperature` + each `callChat` forwarding
  `temperature ?? 0`) — **default unset ⇒ greedy**, so the
  [`SK-LLM-024`](../../llm-router/decisions/SK-LLM-024-greedy-decoding-parity.md)
  baseline stays byte-identical and only the sampler ever sets it > 0
  (the per-request override SK-LLM-024 reserved for this code path) — and
  `self-consistency.ts::samplePlans(plan, req, { samples, temperature })` draws
  N plans at that temperature (injected `plan` ⇒ pure/offline-tested; a draw
  that throws is recorded as a no-vote empty sample so N-1 good draws still
  reach consensus). **The runner main-loop path now ships too:** the
  `--self-consistency N` / `--sc-temperature T` flags → `RunOptions.selfConsistency`
  → a `runOneQuestion` branch (gated on `samples >= 2`, a *separate path* from
  `withExecRetry`) that calls `samplePlans` → `voteOverSamples`
  (executor = `executeRows`) → scores the modal cluster's SQL exactly as the
  greedy path scores its single plan — the vote clusters under the *same*
  order-sensitivity the scorer applies to the winner (`hasOrderBy(gold)` for
  BIRD, `!ignore_order` for Spider) so an unordered cluster never elects a
  mis-ordered member the strict scorer then rejects. (Caveat: `fingerprintRows`
  clustering is exact-tuple, so against the Spider2 scorer's `1e-2` numeric
  tolerance + `condition_cols` subset the vote can *under*-cluster near-equal
  answers — it never mis-scores a winner, only potentially understates the
  Spider2 EX gain; revisit if Spider2 SC accuracy matters.) It folds into the existing machinery: an
  all-empty vote records `no_sql` (the greedy empty-plan outcome), a chain that
  is capacity-exhausted (SK-LLM-030) on **every** draw honours the same one
  bounded `--capacity-wait-ms` wait-and-retry then raises `BudgetStopError` →
  checkpoint + resume (SK-QUAL-013, the greedy path's contract), each row carries
  `attempts: N` so `total_attempts` reflects the N× quota cost, and the
  checkpoint variant keys on `.scN` so a greedy run's scores never replay into
  an `--self-consistency N` resume. Four runner tests (modal-vote-scores-match,
  all-broken → no_sql, all-rate-limited → resumable, wait-once-then-recover)
  cover it offline. **Follow-on
  (named, not built):** passing the flag through a `workflow_dispatch` input on
  the BIRD/Spider smoke jobs (the sampled, no-emit, baseline-safe vehicle). The
  EX delta is measured by the **next canonical dispatch**
  ([`SK-QUAL-002`](./SK-QUAL-002-weekly-cron.md) forbids a back-to-back dispatch
  while the BIRD/Spider baselines are < 7 days old).

- **Alternatives rejected:**
  - **Vote on the SQL string (exact or normalised).** Equivalent queries
    differ textually; the vote would never converge. Rejected — vote on the
    answer.
  - **Build the full sampling + runner wiring + dispatch in one run.** It is
    quota-bound (no dispatch is allowed while the baselines are fresh), wide
    (touches every plan-capable provider), and unmeasurable this run; bundling
    it with the primitive risks the primitive's edge-case bugs hiding inside
    an unmeasured prod-chain change. Stage it (P5).
  - **Drop the `ordered` parameter and always fingerprint as a multiset.**
    Order-sensitive questions (`ORDER BY … LIMIT`) have a real sequence
    answer; a multiset-only vote would cluster a correct ordering with a wrong
    one. Keep the parameter, defaulting to multiset.
