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
**Status:** planned (Phase 1.5) — design locked in [`GLOBAL-023`](../../decisions/GLOBAL-023-trust-ux-baseline.md); implementation lands across `ask-pipeline`, `web-app`, `cli`, `elements`, and `mcp-server` features in the Phase 1.5 slice (see [`phase-plan.md` §3](../../phase-plan.md)).
**Owners (code):** cross-cutting — see touchpoints.
**Cross-refs:** [`docs/decisions/GLOBAL-023-trust-ux-baseline.md`](../../decisions/GLOBAL-023-trust-ux-baseline.md) (canonical) · [`docs/phase-plan.md §3`](../../phase-plan.md) (Phase 1.5 placement) · `ask-pipeline/FEATURE.md` (the pipeline that emits trace + confidence) · `sql-allowlist/FEATURE.md` (the parser-level guardrail that trust UX sits on top of — see [`research-receipts.md §1`](../../research-receipts.md) for the server-side guardrail rationale; the user-surface rationale lives in this feature)

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

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
  - *In this feature:* The `trace` block is the textual form of the live-trace promise; the live-trace WebSocket events are the visual form. Both must agree.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-015** — Power users always have an escape hatch (raw SQL).
  - *In this feature:* The `low_confidence` refusal response includes a `raw_sql_hint` field — the user can copy the partial plan to `/v1/run` and edit it themselves.
- **GLOBAL-022** — Recoverable failures retry to success — never surface a fixable error.
  - *In this feature:* `low_confidence` is *not* recoverable by retry — it's a user-clarification need, not a transient failure. Surfaces must distinguish the two.
- **GLOBAL-023** — Trust UX baseline. *(This feature is the implementation of `GLOBAL-023`.)*

## Open questions / known unknowns

- **Confidence-score calibration.** Floors need calibration against the `quality-eval` benchmark harness (BIRD / Spider) — see [`quality-eval/FEATURE.md`](../quality-eval/FEATURE.md). Pre-calibration, ship hand-picked placeholders and tighten when the harness has signal.
- **Diff for the read path — worth it?** Read queries that return >1k rows are also "silent-wrong-answer" risks. A "row count + sampled rows" preview before rendering the full result is similar in shape to the write diff. Defer to Phase 2 unless a P3-Priya user-test surfaces the issue earlier.
- **`<nlq-data>` template-level diff rendering.** Templates (`table`, `card-grid`) don't have a natural diff slot. Decide whether the trace pane is *outside* the template region or whether each template carries an optional diff slot. Most likely the former — keeps templates simple.
- **MCP `confirm_required` ergonomics.** Some MCP hosts render `confirm_required` as a one-button "Approve" without the diff body. Audit Claude Desktop, Cursor, Zed for this; if any host hides the diff, the surface fails the SK-TRUST-001 contract on that host until the host fixes it. Document the host audit in `mcp-server/FEATURE.md`.
