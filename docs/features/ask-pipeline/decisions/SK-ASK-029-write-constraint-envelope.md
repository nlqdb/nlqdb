# SK-ASK-029 — PG constraint violations (SQLSTATE class 23) are a typed `write_constraint`, never `db_unreachable`

Parent feature: [`ask-pipeline/FEATURE.md`](../FEATURE.md). Third member of the
exec-classifier family beside
[`SK-ASK-016`](./SK-ASK-016-schema-mismatch-envelope.md) /
[`SK-ASK-019`](./SK-ASK-019-schema-missing-mapping.md) (missing relation) and
[`SK-ASK-022`](./SK-ASK-022-execution-guided-repair.md) (re-plannable shapes).

- **Decision:** An exec error in SQLSTATE class 23 (`23502` not-null, `23503`
  foreign key, `23505` unique, `23514` check, `23P01` exclusion) is classified
  by `apps/api/src/ask/write-constraint.ts` as `Nonrecoverable` and returned as
  `409 write_constraint { kind, table?, column?, constraint? }`. Identifiers
  only — the offending values never leave the server.
- **Core value:** Bullet-proof, Honest latency, Effortless UX
- **Why:** These are the *statement's values* being wrong, which retrying
  cannot fix. The exec catch-all bucketed them as `db_unreachable`: three
  backed-off replays (≤ 900 ms of pure waste, `SK-ASK-013`) and then
  *"Couldn't reach the database — try again"* — a transient story for a certain
  failure, sending the user to re-run something that can never succeed.
  Production, 2026-08-18 (KV diag row, `SK-ASK-023`): `23503`
  `violates foreign key constraint "fk_ideas__user_id"` after an **approved**
  insert, surfaced to the user as a connectivity error. `write_constraint` names
  the column that has to hold a real value, which is the one thing the user's
  next message can supply. Not re-plannable (`SK-ASK-022` is reads-only — a
  repaired write would bypass the `SK-TRUST-001` approval), so the honest
  surface *is* the fix. The status code matters too: `db_unreachable` is a
  **502**, and both `@nlqdb/sdk` and the `nlq` client retry 5xx — so the doomed
  write was re-sent by the client on top of the server-side replays. A 409 is
  terminal on every surface.
- **Consequence in code:** `classifyWriteConstraint(err)` runs in the exec catch
  between `classifySchemaError` and `isReplannableExecError`; the outer catch maps
  `WriteConstraintError` to the envelope before `recordExecUnreachable`, so the
  class no longer pollutes the `db_unreachable` diagnostics. Cross-surface copy
  (`GLOBAL-003`, `GLOBAL-012`): `apps/web` `error-message.ts`, the `nlq` CLI, and
  the MCP error table each name the constraint kind and one next action; the SDK
  `ApiErrorCode` union carries the code.
- **Alternatives rejected:**
  - **Add class 23 to `REPLANNABLE_SQLSTATE`.** Writes are not repaired by
    design — a re-planned write would commit SQL the user never approved.
  - **Pass the PG message through verbatim.** It embeds the offending values
    (`Key (user_id)=(…)`), i.e. user data in an error body.
  - **Pre-check foreign keys during the diff.** A per-FK existence query per
    preview, and it still can't cover unique/check races — the honest
    post-exec envelope covers every class at zero preview cost.
