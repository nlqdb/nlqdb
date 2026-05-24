---
name: stranger-test
description: Agent-runnable headless Playwright primitive that walks the deployed FLOW-001/002/003 acquisition surfaces with seeded persona prompts; closes the impl-vs-verify gap §1.1 of automated-icp-validation-plan.md exists to detect.
when-to-load:
  globs:
    - tools/stranger-test/**
    - scripts/stranger-test.sh
  topics: [acquisition, verification, stranger-test, playwright, anti-self-deception]
---

# Feature: Stranger-test

**One-liner:** `bash scripts/stranger-test.sh` launches a headless Chromium, walks FLOW-001 (homepage hero), FLOW-002 (`/solve/<slug>`), and FLOW-003 (`/vs/<slug>`) against the deployed surface with seeded prompts rotated across P1/P2/P3/P6, and emits one JSON outcome — pass / fail / blocked per run, TTFV p50/p95, plus per-step detail — to `tools/stranger-test/results/walk-<utc>.json`.
**Status:** implemented (SK-STRG-001 — primitive shipped; FLOW-001/002/003 covered; daily-cron + R2 archive + diff-against-prior-run are open questions).
**Owners (code):** `tools/stranger-test/src/`, `scripts/stranger-test.sh`.
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §1.1`](../../research/automated-icp-validation-plan.md) · [`docs/research/automated-icp-validation-plan-verification.md`](../../research/automated-icp-validation-plan-verification.md) · [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) · [`GLOBAL-028`](../../decisions/GLOBAL-028-acquisition-progress-tracker.md) · [`GLOBAL-030`](../../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

## Touchpoints — read this feature before editing

- `tools/stranger-test/src/runner.ts` — CLI entry; `--base-url`, `--flows`, `--prompts`, `--out`, `--quiet`
- `tools/stranger-test/src/browser.ts` — `launchBrowser`, `openSession` (shared browser, per-walk context), `withDeadline`, `percentile`
- `tools/stranger-test/src/flows/flow-00{1,2,3}.ts` — one walker per FLOW-NNN; assertions mirror the verification file step-for-step
- `tools/stranger-test/src/personas.ts` — 25 seeded prompts pinned to the §1.1 paragraph (P1×10, P2×8, P3×4, P6×3)
- `tools/stranger-test/src/types.ts` — `WalkResult` / `FlowResult` / `FlowRun` / `StepResult` (the JSON shape downstream tiles consume)
- `scripts/stranger-test.sh` — bash wrapper that resolves the repo root and stamps the output path

## Decisions

### SK-STRG-001 — One shared headless Chromium per run; per-walk context + 180 s deadline; no notifications

- **Decision:** A single `bash scripts/stranger-test.sh` invocation launches Chromium once via `@playwright/test`'s `chromium.launch({ headless: true })`, then opens one fresh `BrowserContext` per walk (`ignoreHTTPSErrors: true`, 1280×800 viewport, persona-named user-agent). Each `walkFlowNNN` runs inside `withDeadline(label, 180_000, fn)`; a hung CDN or `waitForResponse` is caught and surfaced as `failed step 0 walk deadline`. The runner writes a single `WalkResult` JSON to `tools/stranger-test/results/walk-<utc>.json` (gitignored except for `.gitkeep`) and exits non-zero if any walked run is `failed` or `blocked`. No LogSnag, no email, no webhook: the operator runs the agent prompt, the agent runs the walker, the JSON output is the alert.
- **Core value:** Goal-first, Simple, Bullet-proof
- **Why:** §1.1 of `automated-icp-validation-plan.md` calls for a Playwright stranger-test as the anti-self-deception primitive — every other §3 acquisition surface's KPI is suspect until a tool exists that observes "a stranger lands and either gets first-value or bounces" on the real deployed surface. Per-walk browsers were the obvious first cut but spawn N Chromium processes (≈100 MB each) and serialise the launch+teardown cost into every prompt; one shared browser + per-context isolation cut the 3-flow × 3-prompt wall time from a flaky ≈30 s to a deterministic ≈7 s in the live probe. The 180 s deadline guarantees a stalled walk never blocks the whole run beyond the budget. No founder-facing notification channel: `GLOBAL-028` and the impl plan preamble both state the operator loop is "founder runs one prompt; everything else routes back through the next agent's pick-list."
- **Consequence in code:** `walkFlow001 / walkFlow002 / walkFlow003` accept `(prompt, baseUrl, userAgent, browser): Promise<FlowRun>` and never launch their own browser. The runner exits 0 only when every run is `passed`. Adding a new flow = new `walkFlowNNN` (same signature), new `runFlowNNN` dispatcher in `runner.ts`, new entry in `personas.FLOW_PERSONA`, new `FlowId` in `types.ts`, and matching `FLOW-NNN` block in [`automated-icp-validation-plan.md §8`](../../research/automated-icp-validation-plan.md) and the verification mirror.
- **Alternatives rejected:**
  - **Per-walk browser launches.** Slower (≈3-4 s per launch), flakier under load (the earlier probe hit "Target page, context or browser has been closed" on the 3rd run), and no isolation benefit over per-context — Chromium contexts already share no cookies, localStorage, or session storage by default.
  - **GitHub Actions cron firing the walker on every `apps/web` / `apps/api` PR.** Creates a founder-facing notification channel through commit-status pings; violates the operator loop. The next-slice promotion path (under "Open questions") is a Cloudflare cron triggering this script from a non-Worker IP and storing the JSON in R2 — not a CI status check.
  - **Embedding inside `apps/api`'s Workers runtime.** Workers can't run a full browser; even with `@cloudflare/playwright` the egress IP is a CF Worker — exactly the IP the impl plan §1.1 requires the walker to NOT use ("the stranger IP requirement").
  - **A typed `playwright/test` test suite under `tests/e2e/stranger-test/`.** `playwright test` runs are CI-shaped and emit a HTML report by default — the walker output we need is one structured JSON object the §1.2 KPI dashboard can ingest, not a per-test report tree. The CLI runner shape matches the `tools/eval/` precedent the founder already uses (`tools/eval/src/runner.ts` is the canonical reference).

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

## Open questions / known unknowns

- **Daily cron + R2 archive.** The impl plan §1.1 spec says "daily JSON to R2 + LogSnag ping on regression." The primitive ships; the cron does not. A Cloudflare cron Worker triggering `bash scripts/stranger-test.sh` from a non-Worker IP (or a free-tier Browserless endpoint, since CF Workers can't host Chromium themselves) is the next slice. LogSnag-on-regression intentionally NOT shipped — the operator loop is "next agent picks the failure," not "founder gets pinged."
- **TTFV semantics under the gate.** Today every walk records `ttfvMs` as "time from submit to first `/v1/ask` response" — when the gate returns 403, that's "time to gate-block" (≈150 ms), not "time to value." The §1.2 KPI dashboard ([`SK-ONBOARD-005`](../onboarding/FEATURE.md)) is the canonical TTFV source; the walker's `ttfvMs` is best-read as "p50/p95 time to first /v1/ask response," and the dashboard's split-by-status is the honest cut. Renaming the field would help; deferred until the §1.4 anonymous-mode gate-bypass debate resolves.
- **Invite-bearing mode for FLOW-004.** Once a test invite code / Resend webhook capture is available, the walker can be extended with `--invite-code <c>` to set `localStorage["nlqdb_invite"]` before the FLOW-001/002/003 walks and exercise the full SK-GATE-007 happy path. The verification mirror's FLOW-004 block already names this requirement.
- **`@cloudflare/playwright` evaluation.** If CF ever exposes a Workers-runtime Playwright, the cron could be a single Worker invocation rather than a Worker → external runner hop. The egress-IP constraint (`§1.1` stranger-IP rule) still applies — a CF Worker is not a stranger; the Worker would have to call out to a remote browser. The current shape (script runs anywhere with `bun` + Chromium installed) sidesteps the dependency entirely.
