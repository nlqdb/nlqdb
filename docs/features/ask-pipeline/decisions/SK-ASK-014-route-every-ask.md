# SK-ASK-014 — `routeAsk` runs on every `/v1/ask`, even when `dbId` is pinned

- **Decision:** `routeAsk` runs on every `/v1/ask` regardless of `dbId` pin.
  `kind=query|write + pinned` → pin honoured; `kind=create + no pin` → create.
  `kind=create + pinned` splits on the goal's shape:
  - a **row write** (an `insert`/`update`/`delete`/`add`/`remove` verb, and the
    goal does not say "database") routes as `kind=write` against the pin
    (`reason: "pinned_write"`, confidence 1, no second LLM hop);
  - anything else → `409 clarify_required` with `pinned_db:{id,slug}`, so the
    surface offers "create new / query *<slug>*?" instead of the cryptic
    `sql_rejected` the allowlist emits on a `CREATE TABLE`.

  Refines SK-ASK-009. Per SK-ANON-013, anon principals without a pinned `dbId`
  short-circuit ahead of this.
- **Core value:** Effortless UX, Goal-first, Bullet-proof
- **Why:** "new table" against a pinned DB dead-ends — the allowlist rejects it.
  Classify-every-send turns that into a typed forward action. The write carve-out
  is this decision's own "typed-plan extend pipeline — right long-term answer"
  arriving: the classifier's rule is *unknown table → create*, and an unknown
  table is exactly what a **first insert** names, so every first insert against a
  pinned DB came back as the clarify (prod, 2026-09-15) and widen-on-write
  (`SK-SCHEMA-008`) was unreachable — `forceQuery` (`SK-ASK-032`) is the only way
  past it and no SDK / CLI / MCP write path sets it. `END_GOAL.md` is explicit
  that a write naming a table that never existed is a **diff, not an error**, so
  with a pin there is nothing left for the user to resolve: the engine creates
  the table, and the `SK-TRUST-001` preview names it before anything commits.
- **Consequence in code:** the routeAsk prelude runs unconditionally (not just
  when `dbId` is absent) and `RouteAskInput.pinnedDbId` makes the pin a
  *classification* input; `apps/api/src/ask/route-ask.ts` owns the carve-out
  (reusing `pickVerbKind`, the same verb list the recent-table fast-path uses).
  The `clarify_required` AskError still drives the `ChatPanel` "Create new
  database" chip, which re-sends without `dbId`.
- **Alternatives rejected:** Silent pin override on **every** `kind=create` —
  a bare "a table for incidents" has no row to infer a shape from, so
  widen-on-write cannot absorb it and the planner would dead-end on the
  allowlist; the clarify is still the honest answer there. Teaching the route
  prompt about the pin — a per-request LLM behaviour where a deterministic
  verb test decides it. Convert only post-allowlist — burns a planner-tier hop
  first.
