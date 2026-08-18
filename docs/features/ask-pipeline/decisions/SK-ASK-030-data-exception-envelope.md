# SK-ASK-030 — PG data exceptions (SQLSTATE class 22) are a typed `invalid_value`, never `db_unreachable`

Parent feature: [`ask-pipeline/FEATURE.md`](../FEATURE.md). Fourth member of the
exec-classifier family, beside
[`SK-ASK-016`](./SK-ASK-016-schema-mismatch-envelope.md) /
[`SK-ASK-019`](./SK-ASK-019-schema-missing-mapping.md) (missing relation),
[`SK-ASK-022`](./SK-ASK-022-execution-guided-repair.md) (re-plannable shapes) and
[`SK-ASK-029`](./SK-ASK-029-write-constraint-envelope.md) (integrity constraints).

- **Decision:** An exec error in SQLSTATE class 22 (failed cast, numeric
  overflow, divide by zero, out-of-range date) is classified by
  `apps/api/src/ask/exec-classify.ts` as `Nonrecoverable` and returned as
  `409 invalid_value { pgCode }`. Only the SQLSTATE crosses the boundary.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Class 22 is the same argument as `SK-ASK-029`, one class over: the
  *value* is wrong, so replaying the identical statement replays the failure.
  Left in the catch-all it spent three backed-off `SK-ASK-013` attempts and then
  claimed the database was unreachable — and because `db_unreachable` is a 502,
  both `@nlqdb/sdk` and the `nlq` client re-sent it on top of that. A 409 is
  terminal on every surface. Naming the class also keeps the
  `db_unreachable` diagnostics honest: `SK-ASK-023`'s KV sink exists to find
  mislabeled classes, and every deterministic class we move out of the bucket
  makes the remainder more likely to be real connectivity.
  The driver's message quotes the offending value, so it stays on the span and
  the diag sink; the copy names the *kind* of problem and asks for values that
  match the column types.
- **Consequence in code:** `classifyDataException(err)` runs in the exec catch
  after `classifyWriteConstraint` and before `isReplannableExecError`, and again
  in the outer catch ahead of the `db_unreachable` fallback. A message fallback
  covers Neon's HTTP driver dropping `.code`, mirroring `write-constraint.ts`.
  Copy lives in the `@nlqdb/errors` registry (`SK-ERR-001`), so no surface edit
  was needed to ship it.
- **Alternatives rejected:**
  - **Fold class 22 into `write_constraint`.** It fires on reads too (a cast in a
    `WHERE`), and the recovery is different: change the value's *type*, not point
    at a different row.
  - **Add class 22 to `REPLANNABLE_SQLSTATE`.** Tempting — a bad cast often *is*
    a planner mistake — but a re-plan costs an LLM round-trip on a class that is
    usually the user's own literal. Revisit with quality-eval data.
  - **Leave it transient.** The measured cost is ≤ 900 ms of pure waste plus a
    wrong sentence, on a failure that is certain.
