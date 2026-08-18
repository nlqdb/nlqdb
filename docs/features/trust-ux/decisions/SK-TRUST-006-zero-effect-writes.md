# SK-TRUST-006 — Approval is only ever asked for a write with a truthful, non-zero effect; a zero-effect write is a typed outcome

Parent feature: [`trust-ux/FEATURE.md`](../FEATURE.md). Closes the gap between
[`SK-TRUST-001`](../FEATURE.md#sk-trust-001) (render-before-commit) and
[`SK-TRUST-005`](../FEATURE.md#sk-trust-005) (preview→commit binding): both
assumed the previewed *number* was true. Pairs with
[`SK-ASK-028`](../../ask-pipeline/decisions/SK-ASK-028-write-outcomes-narrated-from-facts.md)
(write narration) and
[`SK-ASK-029`](../../ask-pipeline/decisions/SK-ASK-029-write-constraint-envelope.md)
(constraint violations).

- **Decision:** Three rules on the `/v1/ask` write path:
  1. **No approval for a proven no-op.** When the pre-flight count says the
     write affects **0** rows, the preview hop returns
     `409 write_no_rows { phase: "preview", verb, table }` — it does not render
     an approvable diff and does not stash a plan.
  2. **No approval for an effect we can't compute.** `buildDiff` throws
     `PreviewUnavailableError` (unparseable plan, unidentifiable target,
     uncountable INSERT shape, failed pre-flight count) and the orchestrator
     returns `400 sql_rejected { reason: "preview_unavailable" }`. It previously
     reported `affectedRows: 0` on a failed count, and returned `null` on a
     parse failure — which fell **through** the gate and committed the write
     with no diff at all.
  3. **No silent no-op after approval.** After exec, a write whose engine
     affected-row count is 0 (and returned no rows) is
     `409 write_no_rows { phase: "commit", verb, table }` — returned before the
     plan-cache write and before `feature.destructive.committed`, because
     nothing committed.
- **Core value:** Bullet-proof, Honest latency, Effortless UX
- **Why:** The diff is *"the negotiation between intent and effect"*
  (`SK-TRUST-001`) — a fabricated or unverified number makes the negotiation a
  formality. Production, 2026-08-17/18: the founder was asked to approve
  inserting a row, approved, and got *"No rows returned."* — the write was an
  `INSERT … SELECT … FROM "users" WHERE …` whose source matched nothing, so it
  affected 0 rows and reported like a benign empty read. **"Approved, then
  nothing happened, and we told you it was fine" is the worst outcome the write
  path can produce**, and it was reachable through a *success* response. Rows
  *returned* and rows *affected* are different facts: Postgres reports the
  affected count for INSERT/UPDATE/DELETE, and the orchestrator now reads it as
  the write's outcome. `phase` distinguishes "we never ran it" from "it ran and
  changed nothing", which are different next actions for the user.
- **Consequence in code:** `apps/api/src/ask/diff.ts` no longer returns `null`
  or a fabricated `0`; `orchestrateAsk` short-circuits on
  `diff.affectedRows === 0` and, post-exec, on
  `written && rowCount === 0 && rows.length === 0`. The zero-rows envelope is
  Postgres-only (`db.engine === "postgres"`) — ClickHouse's insert response
  carries no affected count, and guessing there would invent a failure.
  Cross-surface copy (`GLOBAL-003`, `GLOBAL-012`): `apps/web`
  `error-message.ts`, the `nlq` CLI, the MCP error table, and the SDK
  `ApiErrorCode` union.
- **Alternatives rejected:**
  - **Keep the 0-row preview and let the user approve it.** Approving a no-op
    teaches the user their approval is meaningless, and the incident shows it is
    read as a completed write.
  - **Return `200 ok` with `rowCount: 0` and let each surface phrase it.** Every
    surface would re-derive "was this a write?" from the SQL; one of them will
    get it wrong, which is exactly how the chat came to print empty-read copy.
  - **Auto re-plan a 0-row write.** The planner has no new information (the
    goal did not name the row), so the retry produces another guess — and
    `SK-TRUST-005` forbids committing SQL the user never saw.
  - **Pre-check foreign keys / constraints during the preview.** A query per FK
    per preview, still racy; the `SK-ASK-029` post-exec envelope is honest at
    zero preview cost.
