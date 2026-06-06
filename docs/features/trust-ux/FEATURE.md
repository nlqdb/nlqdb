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
**Status:** partial (Phase 1.5) — SK-TRUST-001 + SK-TRUST-002 shipped end-to-end on `/v1/ask` + `@nlqdb/sdk` + `apps/web` chat. SK-TRUST-001 covers the `/v1/ask` write path (INSERT/UPDATE/DELETE): preview hop returns `requires_confirm: true` + a diff, the confirm hop commits. DDL preview via `db-create` is deferred — the create flow provisions atomically today; adding a confirm step is its own slice (see Open Questions). SK-TRUST-003 (confidence floor) remains placeholder until `quality-eval` lands. Cross-surface gap: `<nlq-data>` `el.trace`, MCP `confirm_required` shape, and the `nlq` CLI diff render are deferred (those surfaces don't exist yet). **Phase 1.5 telemetry slice:** `GLOBAL-024` demand-signal events are now wired end-to-end — `SK-EVENTS-010` (implicit emits: `feature.requested.ddl_via_ask`, `feature.requested.heavier_tier`, `nlqdb.surface` OTel attribute) and `SK-EVENTS-011` (`home.surface_wishlist` from the marketing CodePanel) together close the Phase 1.5 capture-pipe exit gate. Design locked in [`GLOBAL-023`](../../decisions/GLOBAL-023-trust-ux-baseline.md); implementation lands across `ask-pipeline`, `web-app`, `cli`, `elements`, and `mcp-server` features in the Phase 1.5 slice (see [`phase-plan.md` §3](../../phase-plan.md)).
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
- **Status note (Phase 1.5):** Shipped for the `/v1/ask` write path. `apps/api/src/ask/orchestrate.ts` checks the leading verb after plan+validate; on INSERT/UPDATE/DELETE without `confirm: true` in the request, `apps/api/src/ask/diff.ts` builds the diff (AST-counted INSERT tuples, pre-flight `SELECT COUNT(*)` for UPDATE/DELETE and INSERT-from-SELECT) and the orchestrator returns `{requires_confirm: true, diff, trace}` without running the write. The surface re-sends with `confirm: true` to commit. There is no server-side bypass on `/v1/ask` — power-user raw SQL lives on `/v1/run` (GLOBAL-015). DDL preview via `db-create` is deferred (see Open Questions).

### SK-TRUST-002 — Compiled SQL (or plan) is in `trace` on every response, always

- **Decision:** Every `/v1/ask` response includes the compiled SQL (read path) or compiled DDL (create path) in a top-level `trace` block. No `?trace=1` opt-in. No tier gate. Always emitted, always rendered.
- **Core value:** Honest latency, Bullet-proof
- **Why:** Opt-in honesty is the same as no honesty — users don't toggle flags when they need them most. The `trace` makes the silent-wrong-answer impossible by construction: the user can see *what ran* and catch a semantically-wrong query before trusting its output. The cost is one extra field in every response; the win is the trust that lets a user paste an `nlqdb`-produced number into a Slack to their CEO.
- **Consequence in code:** Response shape has `trace: { sql: string, plan_id: string, confidence: number, model: string, cache_hit: boolean }` on every response. The web chat renders the trace pane below the answer (collapsed by default but always present). `<nlq-data>` exposes it as a JS property `el.trace`. CLI prints it in `human` format under a `─ trace ─` separator; in `--json` mode it's a field. Removing or hiding the trace is a regression.
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

- **Decision:** Add three explicit instruments. (1) **Destructive-op retry rate** — `feature.destructive.preview_rendered` and `feature.destructive.committed` events fire per `SK-TRUST-001` preview hop and commit hop; retry rate is `1 − (committed / preview_rendered)`. Captured per surface (`nlqdb.surface` label per [`phase-plan.md §3`](../../phase-plan.md)). (2) **Refuse-vs-hallucinate ratio** — every `low_confidence` refusal emits `feature.plan.refused`; every "answer looked plausible but was wrong" caught by `quality-eval` (`SK-QUAL-003` internal eval) labels the plan `nlqdb.plan.hallucinated = true` post-hoc. Ratio = `refused / hallucinated` per week. (3) **Recoverable-failure recovery rate** — derived from existing [`GLOBAL-022`](../../decisions/GLOBAL-022-recoverable-failures-retry-to-success.md) spans; new metric `nlqdb.recovery.rate{surface}` = `recovered / (recovered + surfaced_to_user)`. Baselines for all three by **2026-06-01** (same date as `SK-ONBOARD-005` and `SK-QUAL-005`).
- **Core value:** Bullet-proof, Honest latency
- **Why:** [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) names trust-UX as one of four north-star pillars. The three KPIs above are the smallest set that distinguishes the orthogonal UX failure modes: "user mass-deleted by accident" (retry rate captures whether the preview prevented it), "system answered confidently and wrong" (refuse-vs-hallucinate captures whether `SK-TRUST-003` is calibrated right), and "system surfaced a fixable error to the user" (recovery rate captures the `GLOBAL-022` promise). Without explicit emissions, the Phase 1.5 exit-gate language "measurably reduces the destructive-op retry rate" is unprovable.
- **Consequence in code:** `apps/api/src/ask/` emits `feature.destructive.*` on the preview/commit boundary already established by `SK-TRUST-001`; one-line addition. The `nlqdb.plan.hallucinated` label is written by the `quality-eval` post-hoc grader (`SK-QUAL-003` internal eval flow). The recovery-rate metric is derived in `tools/eval/cron.ts` from existing OTel spans; no new emission needed. Grafana panel `trust-ux-kpis` is the canonical view; weekly cron summarizes into LogSnag `#north-star`. The Phase 1.5 exit-gate language in [`phase-plan.md §3`](../../phase-plan.md) is closed when the first weekly snapshot lands a non-null number for all three.
- **Alternatives rejected:** Per-PR regression gate (already rejected by `SK-QUAL-002` for the same gameable-benchmark reason). Survey-based UX measurement (response rate <5% on free-tier; Sean-Ellis stays the qualitative spine per [`founder-playbook.md §2`](../../founder-playbook.md), but the three KPIs above are the quantitative spine). Skip the refuse-vs-hallucinate ratio (the dangerous metric to skip — a model that refuses too little but is also wrong less often looks "good" on naive accuracy alone).

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

- **Confidence-score calibration.** Floors need calibration against the `quality-eval` benchmark harness (BIRD / Spider) — see [`quality-eval/FEATURE.md`](../quality-eval/FEATURE.md). Pre-calibration, providers return a placeholder `confidence: 1.0` on every plan (`packages/llm/src/providers/_chat-provider.ts`); the trace block carries it on the wire so surfaces don't have to learn a second shape later, but per-tier floors (SK-TRUST-003) stay deferred until the harness has signal.
- **SK-TRUST-001 DDL preview deferral.** The `/v1/ask` write path ships preview→confirm. The `db-create` flow (DDL: tables, columns, FK) still provisions atomically — adding a preview hop requires splitting `db-create/neon-provision.ts` into plan-and-stash + apply phases, with a confirm token for the apply step. Anon's per-device 1-create cap (`SK-ANON-012`) is unaffected by the current PR, but when DDL preview lands the cap MUST commit on the **apply** hop, not the preview hop — preview is read-only and consumes no resource. Promote into the implementation slice when a P3-persona destructive-DDL test requests it; until then, the trace block's compiled DDL (SK-TRUST-002) is the user's preview window for create.
- **SK-TRUST-002 surface gap — `<nlq-data>`, MCP, CLI.** The trace block ships on `/v1/ask` + `@nlqdb/sdk` + `apps/web`'s chat. `<nlq-data>` does not yet expose `el.trace` as a JS property; the MCP server does not yet return the trace block as a `content` part on tool responses; the `nlq` CLI does not exist yet. Per GLOBAL-003 these are an explicit ship-gap, tracked here. Promote each into its feature when those surfaces land.
- **Diff for the read path — Parked until a P3-Priya user-test surfaces it** (`GLOBAL-033`, speculative-scope → never build a mode on spec). Read queries returning >1k rows are also silent-wrong-answer risks; a "row count + sampled rows" preview is the same shape as the write diff, wired only when a user-test shows the need.
- **`<nlq-data>` template-level diff rendering — Resolved** (`GLOBAL-033`, Simple → one way; keep templates simple): the trace/diff pane sits *outside* the template region, not as an optional per-template slot. Templates (`table`, `card-grid`) render data only; a per-template diff slot would fork every template for a concern the trace block already owns.
- **MCP `confirm_required` ergonomics.** Some MCP hosts render `confirm_required` as a one-button "Approve" without the diff body. Audit Claude Desktop, Cursor, Zed for this; if any host hides the diff, the surface fails the SK-TRUST-001 contract on that host until the host fixes it. Document the host audit in `mcp-server/FEATURE.md`.
