---
name: trust-ux
description: User-surface trust rules — diff preview on writes, visible SQL trace on every response, refuse-on-low-confidence on plans.
when-to-load:
  globs:
    - apps/api/src/ask/**
    - apps/web/src/components/**
    - packages/elements/**
    - packages/mcp/**
    - cli/**
  topics: [trust, diff, confidence, refuse, low-confidence]
---

# Feature: Trust UX

**One-liner:** User-surface trust rules — diff preview on writes, visible SQL trace on every response, refuse-on-low-confidence on plans.
**Status:** partial (Phase 1.5) — SK-TRUST-001 + SK-TRUST-002 shipped end-to-end on `/v1/ask` + `@nlqdb/sdk` + `apps/web` chat. SK-TRUST-001 covers the `/v1/ask` write path (INSERT/UPDATE/DELETE): preview hop returns `requires_confirm: true` + a diff, the confirm hop commits. DDL preview via `db-create` is deferred — the create flow provisions atomically today; adding a confirm step is its own slice (see Open Questions). SK-TRUST-003 (confidence floor) remains placeholder until `quality-eval` lands. Cross-surface gap (SK-TRUST-001 write-preview only): the MCP `confirm_required` shape and the `nlq` CLI diff render are deferred; SK-TRUST-002 trace parity is now closed on every shipped surface, including `<nlq-data>` `el.trace`. **Phase 1.5 telemetry slice:** `GLOBAL-024` demand-signal events are now wired end-to-end — `SK-EVENTS-010` (implicit emits: `feature.requested.ddl_via_ask`, `feature.requested.heavier_tier`, `nlqdb.surface` OTel attribute) and `SK-EVENTS-011` (`home.surface_wishlist` from the marketing CodePanel) together close the Phase 1.5 capture-pipe exit gate. `SK-TRUST-004`'s destructive-op retry-rate instrument is shipped; `SK-TRUST-006` closes the honest-preview gap the 2026-08 write incident exposed. Design locked in [`GLOBAL-023`](../../decisions/GLOBAL-023-trust-ux-baseline.md); implementation lands across `ask-pipeline`, `web-app`, `cli`, `elements`, and `mcp-server` features in the Phase 1.5 slice (see [`phase-plan.md` §3](../../phase-plan.md)).
**Owners (code):** cross-cutting — see touchpoints.
**Cross-refs:** [`docs/decisions/GLOBAL-023-trust-ux-baseline.md`](../../decisions/GLOBAL-023-trust-ux-baseline.md) (canonical) · [`docs/phase-plan.md §3`](../../phase-plan.md) (Phase 1.5 placement) · `ask-pipeline/FEATURE.md` (the pipeline that emits trace + confidence) · `sql-allowlist/FEATURE.md` (the parser-level guardrail that trust UX sits on top of — see [`research-receipts.md §1`](../../research-receipts.md) for the server-side guardrail rationale; the user-surface rationale lives in this feature)

**Contribution to north-star:** Seamless UX — this feature IS the third [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) pillar's surface. `SK-TRUST-004` wires the destructive-op retry rate, refuse-vs-hallucinate ratio, and recoverable-failure recovery rate KPIs.

## Touchpoints — read this feature before editing

- `apps/api/src/ask/**` — response shape (trace + confidence + diff blocks)
- `apps/api/src/db-create/**` — diff for DDL paths
- `apps/web/src/components/**` — diff-preview component and SQL-trace pane
- `packages/elements/**` — `<nlq-data>` and `<nlq-action>` render-before-commit gating
- `packages/mcp/**` — MCP `confirm_required` shape for diff-bearing tools
- `cli/**` — `nlq` shows diff in TTY, JSON in `--json` mode

## Decisions

### SK-TRUST-001 — Diff preview is render-before-commit, not commit-then-undo

- **Decision:** Every write or DDL path returns a `diff` block in its response (or in a `confirm` sub-step for MCP). The surface MUST render the diff and require an explicit user action before committing. There is no "undo" path; the commit is the user action.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Undo is bullet-proof only when every downstream system supports it (webhooks, external sinks, replicated reads). A render-before-commit gate works by construction at the boundary the user controls. The user already typed an intent in NL; the diff is the *negotiation* between intent and effect, not a confirmation modal.
- **Consequence in code:** `/v1/ask` write responses ship a `diff` block before the row-effect lands. For DDL via the hosted-db-create path, the `diff` summarises structural change (tables added/columns added/FK added). The web chat renders the diff inline; `<nlq-action>` blocks `on-success` until the user clicks "apply"; `nlq` prints the diff and prompts; MCP returns a `confirm_required` content type with the diff. Any code path that commits a write without a diff-render-then-confirm fails review.
- **Alternatives rejected:**
  - Commit + show-undo button — depends on every downstream supporting compensation; brittle in practice.
  - Diff only on destructive verbs (DELETE / DROP / TRUNCATE) — misses the silent-wrong-update on a benign `UPDATE` that touches the wrong rows.
  - Server-side approval queue — kills the goal-first 60-second flow; adds a second surface.
- **Status note (Phase 1.5):** Shipped for the `/v1/ask` write path. `apps/api/src/ask/orchestrate.ts` detects a write after plan+validate via `containsWriteVerb` (from `sql-validate.ts`) — a write-anywhere check that catches a data-modifying CTE (`WITH x AS (INSERT/UPDATE/DELETE … RETURNING *) SELECT …`, leading verb `with`), not just the leading verb, so a CTE write can't commit past the gate. On such a write without `confirm: true` in the request, `apps/api/src/ask/diff.ts` builds the diff (AST-counted INSERT tuples, pre-flight `SELECT COUNT(*)` for UPDATE/DELETE and INSERT-from-SELECT; it unwraps the inner write of a data-modifying CTE so the CTE form previews too) and the orchestrator returns `{requires_confirm: true, diff, trace}` without running the write. The surface re-sends with `confirm: true` to commit — and the confirm hop runs the *stashed* preview SQL, never a re-plan of the goal (`SK-TRUST-005`), so the committed statement is exactly the previewed one. There is no server-side bypass on `/v1/ask` — power-user raw SQL lives on `/v1/run` (GLOBAL-015). The diff must also be *true* before it is approvable — see `SK-TRUST-006`. DDL preview via `db-create` is deferred (see Open Questions).

### SK-TRUST-002 — Compiled SQL (or plan) is in `trace` on every response, always

- **Decision:** Every `/v1/ask` response includes the compiled SQL (read path) or compiled DDL (create path) in a top-level `trace` block. No `?trace=1` opt-in. No tier gate. Always emitted, always rendered.
- **Core value:** Honest latency, Bullet-proof
- **Why:** Opt-in honesty is the same as no honesty — users don't toggle flags when they need them most. The `trace` makes the silent-wrong-answer impossible by construction: the user can see *what ran* and catch a semantically-wrong query before trusting its output. The cost is one extra field in every response; the win is the trust that lets a user paste an `nlqdb`-produced number into a Slack to their CEO.
- **Consequence in code:** Response shape has `trace: { sql: string, plan_id: string, confidence: number, model: string, cache_hit: boolean }` on every response. The web chat renders the trace pane below the answer (collapsed by default but always present). `<nlq-data>` exposes it as a JS property `el.trace`. CLI prints it in `human` format under a `─ trace ─` separator; in `--json` mode it's a field. Removing or hiding the trace is a regression. **Per-step honesty (`GLOBAL-011`, `SK-ERR-001`):** on a failure exactly one step is marked `error` — the one that was in flight — and the steps after it render `skipped`. Stamping every pending step with the error code (what shipped until 2026-08-18) claims five failures where there was one and hides where the pipeline actually stopped; `markStepsFailed` in `apps/web/src/components/chat/trace-steps.ts` owns the rule.
- **Alternatives rejected:**
  - `?trace=1` query parameter — opt-in honesty; nobody flips it.
  - Trace only on cache-miss — cache-hit answers are exactly the ones users trust most; the case for showing what ran is *stronger* on cached paths.
  - Trace gated to Pro tier — contradicts [`GLOBAL-019`](../../decisions/GLOBAL-019-apache2-open-source-core.md) (free + open core) and the bullet-proof value.

### SK-TRUST-003 — Confidence floor per tier; refuse rather than guess

- **Decision:** The LLM router emits a `confidence` score on every plan. `ask-pipeline` rejects plans below a per-tier floor with `low_confidence`, suggesting a clarification or escalation. Refusal is a typed error, not a 5xx. Floor values are calibrated against the [`quality-eval`](../quality-eval/FEATURE.md) harness; until that's running, placeholders ship.
- **Core value:** Bullet-proof, Goal-first, Honest latency
- **Why:** Executing a low-confidence plan and silently returning a wrong row is the worst possible UX. Forcing a re-prompt is slow; failing the call with a structured error that names what was ambiguous (the candidate dbs, the candidate columns, the missing filter) lets the surface ask the user *one* sharp question. Per-tier floors (rather than one global floor) let us be loose on cheap-tier classify and strict on Opus-tier hard plans.
- **Consequence in code:** `packages/llm/src/router.ts` returns `{ plan, confidence, alternatives? }` on every plan call. `apps/api/src/ask/orchestrate.ts` short-circuits to `low_confidence` before `db.execute` when `confidence < floor[tier]`. The error body follows [`GLOBAL-012`](../../decisions/GLOBAL-012-one-sentence-errors.md): one sentence, one next action (e.g. "Two databases match — say `orders` or `inventory`"). The web chat surfaces the alternatives as click-to-disambiguate chips; CLI prints them with arrow-key selection; MCP returns them as elicitation choices.
- **Alternatives rejected:**
  - Always execute, mark with a warning — silent-wrong-answer is the failure mode this rule exists to prevent.
  - Single global floor (0.7) — under-serves Tier 1 (forces unnecessary refusals on cheap-tier classify) and over-serves Tier 3 (lets bad Opus plans through).
  - Re-prompt the LLM at lower temperature — the bad-plan rate is dominated by ambiguity in the user goal, not LLM stochasticity; re-rolling rarely helps.

### SK-TRUST-004 — Instrument the three UX KPIs in [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md); baseline by 2026-06-01

**Body:** [`decisions/SK-TRUST-004-ux-kpi-instruments.md`](./decisions/SK-TRUST-004-ux-kpi-instruments.md).
Destructive-op retry rate (`feature.destructive.preview_rendered` /
`.committed`, per surface), refuse-vs-hallucinate ratio, and recoverable-failure
recovery rate — the smallest set that separates the orthogonal UX failure modes.
Shipped; reads a number once destructive-op traffic arrives.

### SK-TRUST-005 — The committed statement IS the previewed statement (bind preview→commit server-side)

- **Decision:** The `/v1/ask` confirm hop runs the exact SQL that was validated and shown in the preview diff — it MUST NOT re-plan the goal. The preview hop stashes its validated write SQL under a per-`(tenant, db, query_hash)` key; the confirm hop loads and runs that, re-validating as defense-in-depth.
- **Core value:** Bullet-proof, Honest latency
- **Why:** `SK-TRUST-001` calls the diff "the negotiation between intent and effect" — but preview and commit were two independent LLM calls. The plan cache is exec-gated (`SK-ASK-015`), so a previewed write is never cached; the confirm hop cache-missed and re-planned. The planner is non-deterministic, so it could commit *different* SQL than the diff showed — or emit an allowlist-rejected variant (`DROP`/`TRUNCATE` for a goal like "clear db"), dead-ending an already-approved write on `sql_rejected` ("approve → That query was rejected"). Both defeat the render-before-commit guarantee.
- **Consequence in code:** `apps/api/src/ask/confirm-stash.ts` (`makeConfirmStash`, 300 s KV TTL). `orchestrateAsk` writes the stash in the `SK-TRUST-001` preview branch and, when `req.confirm` finds a stash, uses it verbatim — skipping the plan cache lookup, the LLM plan, and the trailing shared-cache write (a write plan must never enter the cross-tenant `(schema_hash, query_hash)` cache, `SK-ASK-025`). A missing stash (expired / legacy client) falls back to the re-plan path, so the change is additive.
- **Alternatives rejected:**
  - Cache the previewed plan in the shared plan cache — cross-tenant key (`SK-ASK-025`) + exec-gate (`SK-ASK-015`); one tenant's write would leak into another's identical goal.
  - Client echoes the approved SQL back on confirm — creates a raw-SQL execution path on `/v1/ask`; raw SQL is `/v1/run`'s job (`GLOBAL-015`), and `SK-TRUST-001` forbids a server-side bypass here.
  - Delete the stash on commit — breaks a legitimate transient exec-retry; TTL + the `GLOBAL-005` idempotency layer already bound double-submit.

### SK-TRUST-006 — Approval is only ever asked for a write with a truthful, non-zero effect; a zero-effect write is a typed outcome

**Body:** [`decisions/SK-TRUST-006-zero-effect-writes.md`](./decisions/SK-TRUST-006-zero-effect-writes.md).
The founder approved "insert a row" and got "No rows returned." — the preview's
number was fabricated (a failed pre-flight count degraded to `0`, and a
`0`-effect write was still offered for approval), and a 0-row write reported like
a benign empty read. Now: no approvable diff for a proven-zero or uncomputable
effect (`sql_rejected: preview_unavailable`), and `409 write_no_rows { phase }`
whenever a write affects nothing — before the plan-cache write and the
`SK-TRUST-004` committed signal.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
  - *In this feature:* The `trace` block is the textual form of the live-trace promise; the live-trace WebSocket events are the visual form. Both must agree.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-015** — Power users always have an escape hatch (raw SQL/Mongo/connection string).
  - *In this feature:* The `low_confidence` refusal response includes a `raw_sql_hint` field — the user can copy the partial plan to `/v1/run` and edit it themselves.
- **GLOBAL-022** — Recoverable failures retry to success — never surface a fixable error.
  - *In this feature:* `low_confidence` is *not* recoverable by retry — it's a user-clarification need, not a transient failure. Surfaces must distinguish the two.
- **GLOBAL-023** — Trust UX baseline. *(This feature is the implementation of `GLOBAL-023`.)*
- **GLOBAL-025** — North-star: engine quality, onboarding, UX — each with explicit KPIs.
  - *In this feature:* the UX north-star pillar lives here. KPI floors (destructive-op retry rate, Sean-Ellis "very disappointed" share, session retention, recoverable-failure recovery rate) are the Phase 2 / Phase 3 exit gates; `SK-TRUST-004` ships the instrumentation.

## Open questions / known unknowns

- **Confidence-score calibration — Parked until `quality-eval` Phase 2 has signal** (`GLOBAL-033`, genuinely-deferred). Providers return a placeholder `confidence: 1.0` today (`packages/llm/src/providers/_chat-provider.ts`); the trace block carries it on the wire so surfaces never learn a second shape, and per-tier floors (`SK-TRUST-003`) calibrate against the BIRD/Spider harness when it produces scores.
- **SK-TRUST-001 DDL preview deferral — Parked until a P3-persona destructive-DDL test requests it; interim, the trace block's compiled DDL (SK-TRUST-002) is the create preview.** The `/v1/ask` write path ships preview→confirm. The `db-create` flow (DDL: tables, columns, FK) still provisions atomically — adding a preview hop requires splitting `db-create/neon-provision.ts` into plan-and-stash + apply phases, with a confirm token for the apply step. Anon's per-device 1-create cap (`SK-ANON-012`) is unaffected by the current PR, but when DDL preview lands the cap MUST commit on the **apply** hop, not the preview hop — preview is read-only and consumes no resource. Promote into the implementation slice when a P3-persona destructive-DDL test requests it; until then, the trace block's compiled DDL (SK-TRUST-002) is the user's preview window for create.
- **SK-TRUST-002 surface parity — closed across every shipped surface, including the create path (2026-07-12).** The trace block ships on `/v1/ask` + `@nlqdb/sdk` + `apps/web`'s chat, the `nlq` CLI (`─ trace ─` render), the MCP server (`trace` in the tool's structured output via `traceOf`), and `<nlq-data>` — which now exposes it as the `el.trace` JS property **and** on the `nlq-data:load` event detail (`packages/elements`). The `kind=create` response previously shipped **no** trace at all (the 2026-05-24 regression FLOW-001 step 6 walked into): it now carries `trace` with `sql` = the provisioned DDL, `plan_id` = `create:<dbId>` (creates are never plan-cached, so no GLOBAL-006 content address), `model` from the `schema_infer` call (`preset:<id>` on preset creates), and `cache_hit: false` — rendered collapsed-by-default by `CreateResultView`, the CLI create render, and passed through by MCP's `nlqdb_query` create branch (which had fabricated an empty trace). Per GLOBAL-003 the capability is present on every surface that has landed; no ship-gap remains.
- **Diff for the read path — Parked until a P3-Priya user-test surfaces it** (`GLOBAL-033`, speculative-scope → never build a mode on spec). Read queries returning >1k rows are also silent-wrong-answer risks; a "row count + sampled rows" preview is the same shape as the write diff, wired only when a user-test shows the need.
- **`<nlq-data>` template-level diff rendering — Resolved** (`GLOBAL-033`, Simple → one way; keep templates simple): the trace/diff pane sits *outside* the template region, not as an optional per-template slot. Templates (`table`, `card-grid`) render data only; a per-template diff slot would fork every template for a concern the trace block already owns.
