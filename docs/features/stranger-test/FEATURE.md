---
name: stranger-test
description: Agent-runnable acquisition-flow verification — Playwright walker for FLOW-001/002/003 + bash/curl/mail.tm walker for FLOW-004 (invite-valve end-to-end). Closes the impl-vs-verify gap §1.1 / §1.4 of automated-icp-validation-plan.md exists to detect.
when-to-load:
  globs:
    - tools/stranger-test/**
    - scripts/stranger-test.sh
    - scripts/flow-004-walk.sh
    - scripts/flow-004-seed-quality.sh
    - scripts/flow-005-walk.sh
    - scripts/flow-005-stdio-walk.sh
  topics: [acquisition, verification, stranger-test, playwright, anti-self-deception, invite-valve]
---

# Feature: Stranger-test

**One-liner:** `bash scripts/stranger-test.sh` launches a headless Chromium, walks FLOW-001 (homepage hero), FLOW-002 (`/solve/<slug>`), and FLOW-003 (`/vs/<slug>`) against the deployed surface with seeded prompts rotated across P1/P2/P3/P6, and emits one JSON outcome — pass / fail / blocked per run, TTFV p50/p95, plus per-step detail — to `tools/stranger-test/results/walk-<utc>.json`. `bash scripts/flow-004-walk.sh` is the curl-only sibling that walks SK-GATE-007 end-to-end via a throwaway mail.tm inbox.
**Status:** implemented — one walker per canonical-five flow: SK-STRG-001 (Playwright FLOW-001/002/003), SK-STRG-002 (FLOW-004 mail.tm invite-valve), SK-STRG-004 (`stranger-test-invited.sh` browser composer — first HTTP 200 on `/v1/ask` end-to-end), SK-STRG-005 (`flow-005-walk.sh` MCP discovery + RFC 9728 auth-wall), all re-run daily by SK-STRG-003 (`acquisition-health.yml` cron). SK-STRG-006 — FLOW-004 walker grades first-value *quality* (seeded-DB / SELECT-backed), not just HTTP 200; SK-STRG-007 — a degraded `create` records `state:"passed_degraded"` (exit code unchanged); SK-STRG-008 — `flow-004-seed-quality.sh` measures the `seeded_ok_ratio` across a goal set on one invite (first run 2026-06-10: 0.25, 1/4 goals seeded); SK-STRG-009 — `flow-005-stdio-walk.sh` walks the FLOW-005 local-stdio transport (spawns the real `@nlqdb/mcp` binary, asserts the `initialize` + `tools/list` catalog an npm-fallback install discovers). R2 archive + diff-against-prior-run remain open.
**Owners (code):** `tools/stranger-test/src/`, `scripts/stranger-test.sh`, `scripts/flow-004-walk.sh`.
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §1.1`](../../research/automated-icp-validation-plan.md) · [`docs/research/automated-icp-validation-plan-verification.md`](../../research/automated-icp-validation-plan-verification.md) · [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) · [`GLOBAL-028`](../../decisions/GLOBAL-028-acquisition-progress-tracker.md) · [`GLOBAL-030`](../../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

## Touchpoints — read this feature before editing

- `tools/stranger-test/src/runner.ts` — CLI entry; `--base-url`, `--flows`, `--prompts`, `--out`, `--quiet`
- `tools/stranger-test/src/browser.ts` — `launchBrowser`, `openSession` (shared browser, per-walk context), `withDeadline`, `percentile`
- `tools/stranger-test/src/flows/flow-00{1,2,3}.ts` — one walker per FLOW-NNN; assertions mirror the verification file step-for-step
- `tools/stranger-test/src/personas.ts` — 25 seeded prompts pinned to the §1.1 paragraph (P1×10, P2×8, P3×4, P6×3)
- `tools/stranger-test/src/types.ts` — `WalkResult` / `FlowResult` / `FlowRun` / `StepResult` (the JSON shape downstream tiles consume)
- `scripts/stranger-test.sh` — bash wrapper that resolves the repo root and stamps the output path
- `scripts/flow-004-walk.sh` — bash/curl/jq FLOW-004 walker; mints a throwaway mail.tm inbox per run, walks waitlist → Resend invite → `X-Invite-Code` → `/v1/ask`, writes outcome to `tools/stranger-test/results/flow-004-<utc>.json`
- `scripts/stranger-test-invited.sh` — SK-STRG-004 composer: invokes `flow-004-walk.sh` with `FLOW_004_INVITE_OUT=<sidecar>`, reads-and-wipes the code, then drives `stranger-test.sh --invite-code <c>` so FLOW-001/002/003 walks exercise the browser-side `captureInviteFromUrl` + `X-Invite-Code` happy path
- `scripts/flow-005-walk.sh` — SK-STRG-005 FLOW-005 MCP discovery + auth-wall walker; HTTP-only (curl + jq), no credentials, exercises RFC 9728 protected-resource (root + scoped) + RFC 8414 AS metadata + unauthenticated `initialize`/`tools/list` returning 401 with a `WWW-Authenticate: Bearer realm=*, resource_metadata=*` challenge whose URL matches the scoped discovery; outcome to `tools/stranger-test/results/flow-005-<utc>.json`
- `scripts/flow-004-seed-quality.sh` — SK-STRG-008 first-value seed-quality probe; composes `flow-004-walk.sh` (one minted invite via `FLOW_004_INVITE_OUT`) then re-uses the code to issue a `create` ask per goal across a small set, grading each with the SK-STRG-006 rubric and reporting `seeded_ok_ratio` to `tools/stranger-test/results/flow-004-seed-quality-<utc>.json`; agent-on-demand (not in the daily cron — provisions 1+N throwaway DBs)
- `scripts/flow-005-stdio-walk.sh` + `tools/stranger-test/src/flow-005-stdio.ts` — SK-STRG-009 FLOW-005 local-stdio-transport walker; spawns the real `@nlqdb/mcp` binary and asserts the `initialize` + `tools/list` catalog (3 tools, trust-annotation hints, input-schema keys, no `create_database` tool) over OS pipes — no network; outcome to `tools/stranger-test/results/flow-005-stdio-<utc>.json`
- `.github/workflows/acquisition-health.yml` — SK-STRG-003 daily cron that runs `verify-flows.sh + stranger-test.sh + flow-004-walk.sh + flow-005-walk.sh + flow-005-stdio-walk.sh` against the deployed surface and uploads `tools/stranger-test/results/*` as a 90-day artifact

## Decisions

### SK-STRG-001 — One shared headless Chromium per run; per-walk context + 180 s deadline; no notifications

- **Decision:** A single `bash scripts/stranger-test.sh` invocation launches Chromium once via `@playwright/test`'s `chromium.launch({ headless: true })`, then opens one fresh `BrowserContext` per walk (`ignoreHTTPSErrors: true`, 1280×800 viewport, persona-named user-agent). Each `walkFlowNNN` runs inside `withDeadline(label, 180_000, fn)`; a hung CDN or `waitForResponse` is caught and surfaced as `failed step 0 walk deadline`. The runner writes a single `WalkResult` JSON to `tools/stranger-test/results/walk-<utc>.json` (gitignored except for `.gitkeep`) and exits non-zero if any walked run is `failed` or `blocked`. No LogSnag, no email, no webhook: the operator runs the agent prompt, the agent runs the walker, the JSON output is the alert.
- **Core value:** Goal-first, Simple, Bullet-proof
- **Why:** §1.1 of `automated-icp-validation-plan.md` calls for the anti-self-deception primitive — every other §3 acquisition surface's KPI is suspect until a tool observes "a stranger lands and either gets first-value or bounces" on the real deployed surface. Per-walk browsers spawn N Chromium processes (≈100 MB each) and serialise launch+teardown into every prompt; one shared browser + per-context isolation cut the 3×3 wall time from a flaky ≈30 s to a deterministic ≈7 s. The 180 s deadline guarantees a stalled walk never blocks beyond budget. No founder-facing notification channel: `GLOBAL-028` and the impl plan preamble both state the operator loop is "founder runs one prompt; everything else routes back through the next agent's pick-list."
- **Consequence in code:** `walkFlow001 / walkFlow002 / walkFlow003` accept `(prompt, baseUrl, userAgent, browser): Promise<FlowRun>` and never launch their own browser. The runner exits 0 only when every run is `passed`. Adding a new flow = new `walkFlowNNN` (same signature), new `runFlowNNN` dispatcher in `runner.ts`, new entry in `personas.FLOW_PERSONA`, new `FlowId` in `types.ts`, and matching `FLOW-NNN` block in [`automated-icp-validation-plan.md §8`](../../research/automated-icp-validation-plan.md) and the verification mirror.
- **Alternatives rejected:**
  - **Per-walk browser launches.** Slower (≈3-4 s/launch), no isolation benefit over per-context (Chromium contexts share nothing by default), and flakier — the earlier probe hit "Target page, context or browser has been closed" on the 3rd run.
  - **Cron-on-PR.** Founder-facing notification channel via commit-status pings — operator-loop violation. Daily cron (SK-STRG-003) sidesteps it.
  - **Embedding inside `apps/api`'s Workers runtime.** Workers can't host a full browser; even `@cloudflare/playwright` egresses from a CF Worker IP — exactly what `§1.1` says the walker must NOT use.
  - **A typed `playwright/test` suite under `tests/e2e/`.** Emits a HTML report; we want one structured JSON the §1.2 KPI dashboard ingests. The CLI shape matches the `tools/eval/` precedent.

### SK-STRG-002 — FLOW-004 invite-valve walker uses a throwaway mail.tm inbox via curl+jq, no browser, no shared inbox; control + invite probes prove gate state

Body: [`decisions/SK-STRG-002-flow-004-walker.md`](./decisions/SK-STRG-002-flow-004-walker.md). `scripts/flow-004-walk.sh` exercises SK-GATE-007 end-to-end with zero pre-provisioned credentials: it mints a throwaway mail.tm inbox (curl + jq, no signup), `POST /v1/waitlist`, polls for the Resend invite, extracts `?invite=<code>`, then runs a **control probe** (no header → must be `feature_gated`) and an **invite probe** (with `X-Invite-Code` → must not be `feature_gated`). The control × invite pair is what makes it a regression detector, not a static uptime check; `passed` / `failed step 5` / `partial` / `inconclusive` cover the matrix. Uniform outcome JSON; `redact()` is the contract for any log touching codes/JWTs/addresses. Per-run cost: one of 200/week SK-GATE-007 invites + one Resend send.

### SK-STRG-004 — Invite-bearing composer drives FLOW-001/002/003 through the browser-side `?invite=` capture path

Body: [`decisions/SK-STRG-004-invite-bearing-composer.md`](./decisions/SK-STRG-004-invite-bearing-composer.md). Composes `flow-004-walk.sh` (mints invite via mail.tm sidecar) + `stranger-test.sh --invite-code <c>` (Playwright navigation with `?invite=`, asserts `localStorage["nlqdb_invite"]` capture, expects HTTP 200 instead of `feature_gated`). First live walk caught a missing `captureInviteFromUrl()` on `/solve/` + `/vs/` (fixed same PR) and recorded the first-ever HTTP 200 on `/v1/ask` through the browser.

### SK-STRG-005 — FLOW-005 MCP discovery + auth-wall walker; HTTP-only, no credentials, asserts RFC 9728 challenge metadata matches scoped discovery

Body: [`decisions/SK-STRG-005-flow-005-walker.md`](./decisions/SK-STRG-005-flow-005-walker.md). `scripts/flow-005-walk.sh` exercises the five preconditions every MCP client hits before asking the user for an `sk_mcp_*` key — RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, unauthenticated `initialize` + `tools/list` returning 401 with `WWW-Authenticate: Bearer realm=*, resource_metadata=*` whose URL matches the scoped discovery. Pass = 6/6 in ≤ 4 s; outcome JSON `{state, discovery_ok, auth_wall_ok, challenge_url_matches, …}`. Closes the [`GLOBAL-032`](../../decisions/GLOBAL-032-top-5-user-flows-canonical.md) "every canonical-five flow has an agent-runnable walker" gap for FLOW-005. Walks daily in `acquisition-health.yml`.

### SK-STRG-003 — Daily GH Actions cron walks all walkers at 06:00 UTC; exits 0 unconditionally so no founder-facing email channel is created

Body: [`decisions/SK-STRG-003-daily-acquisition-health-cron.md`](./decisions/SK-STRG-003-daily-acquisition-health-cron.md). `.github/workflows/acquisition-health.yml` schedules every walker (`verify-flows.sh + stranger-test.sh + flow-004-walk.sh + flow-005-walk.sh`) daily at `0 6 * * *` UTC under `continue-on-error: true`; outputs upload as a 90-day artifact (`acquisition-health-<run_id>`); workflow exits 0 unconditionally so no founder-facing email channel is created. Adding a new walker = one `continue-on-error: true` step + one row in the summary table. `workflow_dispatch` accepts `base_url`, `mcp_url`, and `skip_flow_004` overrides. Daily cadence + [`GLOBAL-032`](../../decisions/GLOBAL-032-top-5-user-flows-canonical.md) freshness rule satisfied by default.

### SK-STRG-006 — FLOW-004 walker grades first-value quality on the HTTP 200, not just reachability

Body: [`decisions/SK-STRG-006-flow-004-first-value-quality.md`](./decisions/SK-STRG-006-flow-004-first-value-quality.md). On a 200 the walker grades the invited stranger's first-value: a `create` is `ok` with a real `db` + `schemaName` and ≥ 1 seeded row; a `query` is `ok` when SELECT-backed. Quality is recorded, never fatal — the SK-STRG-002 control×invite pass/fail is unchanged; the cron summary surfaces `first_value_quality`. First live grade (2026-06-07): create — 6 tables / 13 rows / postgres. Refined by [`SK-STRG-007`](#sk-strg-007--flow-004-degraded-create-records-statepassed_degraded): a degraded `create` records `state:"passed_degraded"` (exit code unchanged).

### SK-STRG-007 — FLOW-004 degraded `create` records `state:"passed_degraded"`

Body: [`decisions/SK-STRG-007-flow-004-degraded-create-state.md`](./decisions/SK-STRG-007-flow-004-degraded-create-state.md). A `create` first-value that seeded 0 rows (the [`SK-HDC-018`](../hosted-db-create/decisions/SK-HDC-018-sample-insert-graceful-degradation.md) un-seeded fallback) records `state:"passed_degraded"`, not a bare `passed`, so the §0.5 / cron dashboards stay honest. Exit code stays 0 (the SK-STRG-002 gate-bypass invariant held — composer/cron contract intact); a 0-row *query* stays `passed`. First live `passed_degraded`: 2026-06-09 ("a meal planner for couples", 0/0).

### SK-STRG-008 — FLOW-004 first-value seed-quality probe: one invite, many goals, a measured `seeded_ok_ratio`

Body: [`decisions/SK-STRG-008-flow-004-seed-quality-probe.md`](./decisions/SK-STRG-008-flow-004-seed-quality-probe.md). `scripts/flow-004-seed-quality.sh` composes `flow-004-walk.sh` to mint + validate ONE invite (control 403 + invite 200), then re-uses the code (invite codes are existence-checked in `gate/bypass.ts`, not consumed) to issue a `create` ask per goal across a small P1 set — each on a fresh `anon_<uuid>` — and grades first-value with the SK-STRG-006 rubric, reporting `seeded_ok_ratio` over classified creates. It exits 0 whenever it produced a ratio (measurement, not a gate) and is agent-on-demand, not in the daily cron (1+N throwaway DBs per run). Converts the SK-STRG-006/007 anecdote into a number: first run 2026-06-10 measured **0.25** (1/4 — only "a habit tracker" seeded; "a tiny CRM", previously `ok`, degraded), sizing the open SK-LLM-033 / engine-quality lift.

### SK-STRG-009 — FLOW-005 local-stdio-transport walker: spawns the real `@nlqdb/mcp` binary and asserts the `initialize` + `tools/list` catalog

Body: [`decisions/SK-STRG-009-flow-005-stdio-walker.md`](./decisions/SK-STRG-009-flow-005-stdio-walker.md). `scripts/flow-005-stdio-walk.sh` (over `tools/stranger-test/src/flow-005-stdio.ts`) walks the FLOW-005 **local-stdio** transport — the [`SK-MCP-001`](../mcp-server/decisions/SK-MCP-001-two-transports.md) npm-fallback install path that `flow-005-walk.sh` (hosted) never covered. It spawns the real `@nlqdb/mcp` binary and drives a real MCP `initialize` + `tools/list` handshake over OS pipes (no mocking, no network — both served from the in-memory registry, so the `NLQDB_API_KEY` prefix-gate is met with a throwaway token that never authenticates), asserting the catalog an MCP host discovers: `nlqdb_query` (destructive) + `nlqdb_list_databases` + `nlqdb_describe` (read-only) + `nlqdb_remember` (additive E-02 memory write) with their input-schema keys, and **no `create_database`/`ask`/`run` tool** (create is implicit via `nlqdb_query`, [`SK-MCP-002`](../mcp-server/decisions/SK-MCP-002-three-tools.md)). Pass = `protocol_ok` AND `catalog_ok`; pure `assessHandshake()` unit-tested. Walks daily in `acquisition-health.yml`. Authenticated tool *invocation* stays in the credentialed mirror.

## GLOBALs governing this feature

- **GLOBAL-013** — Free-tier bundle budget.
  - *In this feature:* one Chromium per run; `withDeadline` caps wall-clock; results JSON ≤ a few KB per walk. Even the planned daily cron stays inside CF Workers free-tier (the Worker fires the script; the JSON is written to R2 free-tier).
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* the deployed surface is the system under test; the walker itself is not a Worker, so no OTel spans land here. The walker exercises the spans the Worker emits (`nlqdb.gate.check`, `nlqdb.ask.*`).
- **GLOBAL-025** — Quartet north-star.
  - *In this feature:* the §1.1 anti-self-deception primitive directly serves the "onboarding" pillar — TTFV / first-query success / stranger-test passes are the three KPIs the impl plan's `Current status` table calls out as "not measured" without this walker.
- **GLOBAL-028** — Acquisition progress tracker.
  - *In this feature:* every walk that lands a §1.1 deliverable appends a row to `automated-icp-validation-plan.md` `## Progress log`; per-flow outcome rows go to the verification mirror.
- **GLOBAL-029** — Acquisition verification tracker.
  - *In this feature:* the walker IS the agent that fills the verification mirror's outcome logs; impl-vs-verify drift is the regression the mirror exists to surface.
- **GLOBAL-030** — Evidence-grade acquisition tracker edits.
  - *In this feature:* outcome rows must cite the walk-<utc>.json artifact and the agent-VM that ran it; unsupported claims stay marked unverified.
- **GLOBAL-032** — Top-5 user flows canonical.
  - *In this feature:* the canonical-five (FLOW-001/002/003/004/005) each map to a walker owned by this feature — FLOW-001/002/003 to `stranger-test.sh` (+ `stranger-test-invited.sh` for the invite-bearing variant), FLOW-004 to `flow-004-walk.sh`, FLOW-005 to `flow-005-walk.sh` (hosted transport, SK-STRG-005) **and** `flow-005-stdio-walk.sh` (local-stdio transport, SK-STRG-009). The daily `acquisition-health.yml` cron re-runs each walker every 24 h, satisfying the GLOBAL's seven-day freshness rule by default. Demoting a canonical flow or adding a sixth requires editing GLOBAL-032 and updating both trackers in the same PR.

## Open questions / known unknowns

- **R2 archive + diff-against-prior-run.** Cron landed via [`SK-STRG-003`](#sk-strg-003--daily-gh-actions-cron-walks-all-walkers-at-0600-utc-exits-0-unconditionally-so-no-founder-facing-email-channel-is-created); current artifact shelf-life is 90 days on GitHub. R2 archive would extend retention and enable `diff-against-prior-run` as a follow-up agent step (today the agent re-fetches the latest two runs from the workflow's artifact history). Deferred until either the 90-day window proves too short or a real `diff` consumer exists.
- **TTFV semantics under the gate.** `ttfvMs` is "submit → first `/v1/ask` response"; under a 403 that's "time to gate-block" (≈150 ms), not time-to-value. The §1.2 KPI dashboard ([`SK-ONBOARD-005`](../onboarding/FEATURE.md)) is the canonical TTFV source with split-by-status; renaming the walker field is deferred until the §1.4 gate-bypass debate resolves.
- **Resolved.** Invite-bearing Playwright mode → SK-STRG-004 (`stranger-test-invited.sh`, full browser SK-GATE-007 path); continuous FLOW-004 regression watch → SK-STRG-003 (daily cron, ≤7/week of the 200/week cap); FLOW-004 first-value-quality grading → SK-STRG-006.
- **`@cloudflare/playwright` evaluation.** If CF exposes a Workers-runtime Playwright the cron could collapse to one Worker hop — but the §1.1 stranger-IP rule still bars a Worker from being the stranger, so the current "runs anywhere with `bun` + Chromium" shape sidesteps it.
