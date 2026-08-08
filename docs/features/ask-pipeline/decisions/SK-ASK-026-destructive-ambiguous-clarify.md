# SK-ASK-026 — Destructive-ambiguous rejections become a `clarify_required` with re-sendable options

- **Decision:** When the read/write allowlist rejects an LLM-emitted plan
  for a *destructive-ambiguous* reason — `drop_statement`,
  `truncate_statement`, or `delete_without_where` — the orchestrator returns
  a `clarify_required` envelope (`clarification: "destructive_ambiguous"`)
  carrying a short `reason` sentence and 2–4 **re-sendable `options`**, instead
  of the flat `sql_rejected` error. Each option is `{ label, goal, forceNoPin? }`:
  the surface re-sends `goal` (dropping the DB pin when `forceNoPin`) using the
  same re-send path the `SK-ASK-009` picker and `SK-ASK-014` create chip already
  use — no new privileged action is introduced. Options are built
  deterministically from the DB's own tables (`tablesFromSchemaText(db.schemaText)`,
  capped at 3): one `"Empty the <t> table"` per table plus one
  `"Start fresh with a new, empty database"` (`forceNoPin`). Every **other**
  reject reason keeps `sql_rejected` but surfaces carry `body.reason` into
  specific, honest copy (never the flat "That query was rejected").
- **Core value:** Effortless UX, Goal-first, Bullet-proof, Honest latency
- **Why:** "clear db" / "reset" / "wipe everything" is the canonical dead-end
  (`SK-TRUST-005` names it): the planner emits `TRUNCATE`/`DROP`/bare-`DELETE`,
  the allowlist rejects it (the Replit-incident guardrail, `SK-ASK-004` /
  `research-receipts §1` — deliberately not relaxed), and the user reads a
  generic "try rephrasing" with no idea what to do. The ambiguity is real
  ("clear" = empty the data, drop the whole thing, or start clean), and the
  cheapest fix is to name the interpretations as one-click choices. This is the
  clarification arm of `SK-TRUST-003` shipped early, decoupled from the
  confidence-floor calibration (still parked on `quality-eval`): the trigger is
  the deterministic reject reason, not a calibrated float, so it needs no eval
  signal to be correct.
- **Performance:** Zero added LLM hops. The conversion happens at the existing
  plan-loop reject catch in `orchestrate.ts` — the plan call already ran; we
  reshape its rejection. The `"Empty the <t>"` options ride the normal
  planner + `SK-ASK-013` validator-feedback retry (which appends a `WHERE`
  clause) into the `SK-TRUST-001` preview→confirm gate, so an intentional
  full-table clear is expressible and previewed while the accidental one stays
  blocked. `forceNoPin` create is deterministic.
- **Consequence in code:** `apps/api/src/ask/destructive-clarify.ts`
  (`DESTRUCTIVE_CLARIFY_REASONS`, `destructiveClarify(reason, db)`); the
  plan-loop `PlanValidationError` catch returns the clarify when the reason
  qualifies, else `sql_rejected`. `ClarifyRequired` gains
  `clarification: "…" | "destructive_ambiguous"` and `options?: ClarifyOption[]`
  (`types.ts`). `demand-signal.ts` emits `feature.requested.ddl_via_ask` on the
  destructive clarify too (`GLOBAL-024` — the "not yet" path is unchanged in
  intent). Cross-surface (`GLOBAL-003`): `@nlqdb/sdk` exports `ClarifyOption` +
  `body.options`; `apps/web` renders one chip per option; `nlq` prints a
  numbered, re-runnable list; MCP returns the options as structured content.
  `<nlq-data>` is a declarative data-binding element with no clarification
  interaction model — tracked as the one deferred surface, not built.
- **Alternatives rejected:**
  - Relax the allowlist so "clear db" just runs — reopens the exact
    mass-destruction class `SK-ASK-004` exists to prevent.
  - LLM-authored options via a widened `routeAsk` (the classify call) — more
    flexible wording but touches the router output schema + prompts and partially
    duplicates `SK-TRUST-003`; deferred until a deterministic reason-mapping
    proves insufficient.
  - A privileged "empty table" / "drop database" action bound to each option —
    a new server action per surface; re-sendable goals reuse existing plumbing
    (`P5`). Whole-database drop stays in the DB menu / `DELETE /v1/databases/:id`.
  - Keep `sql_rejected` and only fix the copy — the honest sentence is shipped
    for every *other* reason, but the destructive family has genuinely distinct
    interpretations that one sentence can't disambiguate; chips can.

## Known tradeoff

An `"Empty the <t> table"` re-send depends on `SK-ASK-013`'s feedback loop
turning a bare `DELETE FROM <t>` into `DELETE FROM <t> WHERE true`. If all three
plan attempts still emit a bare DELETE the request re-surfaces the same
`destructive_ambiguous` clarify (bounded, no worse than today's dead-end). If
telemetry shows this recurs, promote the option to a server-built previewed
`DELETE … WHERE true` (the privileged-action alternative above).
