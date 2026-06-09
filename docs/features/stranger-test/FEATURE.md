---
name: stranger-test
description: Agent-runnable acquisition-flow verification — Playwright walker for FLOW-001/002/003 + bash/curl/mail.tm walker for FLOW-004 (invite-valve end-to-end). Closes the impl-vs-verify gap §1.1 / §1.4 of automated-icp-validation-plan.md exists to detect.
when-to-load:
  globs:
    - tools/stranger-test/**
    - scripts/stranger-test.sh
    - scripts/flow-004-walk.sh
    - scripts/flow-005-walk.sh
  topics: [acquisition, verification, stranger-test, playwright, anti-self-deception, invite-valve]
---

# Feature: Stranger-test

**One-liner:** `bash scripts/stranger-test.sh` launches a headless Chromium, walks FLOW-001 (homepage hero), FLOW-002 (`/solve/<slug>`), and FLOW-003 (`/vs/<slug>`) against the deployed surface with seeded prompts rotated across P1/P2/P3/P6, and emits one JSON outcome — pass / fail / blocked per run, TTFV p50/p95, plus per-step detail — to `tools/stranger-test/results/walk-<utc>.json`. `bash scripts/flow-004-walk.sh` is the curl-only sibling that walks SK-GATE-007 end-to-end via a throwaway mail.tm inbox.
**Status:** implemented — one walker per canonical-five flow: SK-STRG-001 (Playwright FLOW-001/002/003), SK-STRG-002 (FLOW-004 mail.tm invite-valve), SK-STRG-004 (`stranger-test-invited.sh` browser composer — first HTTP 200 on `/v1/ask` end-to-end), SK-STRG-005 (`flow-005-walk.sh` MCP discovery + RFC 9728 auth-wall), all re-run daily by SK-STRG-003 (`acquisition-health.yml` cron). SK-STRG-006 — FLOW-004 walker grades first-value *quality* (seeded-DB / SELECT-backed), not just HTTP 200; SK-STRG-007 — a degraded `create` records `state:"passed_degraded"` (exit code unchanged). R2 archive + diff-against-prior-run remain open.
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
- `.github/workflows/acquisition-health.yml` — SK-STRG-003 daily cron that runs `verify-flows.sh + stranger-test.sh + flow-004-walk.sh + flow-005-walk.sh` against the deployed surface and uploads `tools/stranger-test/results/*` as a 90-day artifact

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

- **Decision:** `scripts/flow-004-walk.sh` is a single bash script that exercises [`SK-GATE-007`](../pre-alpha-gate/FEATURE.md) end-to-end with zero pre-provisioned credentials. Per invocation it (1) `GET api.mail.tm/domains` to pick an active public domain, (2) `POST /accounts` to mint a throwaway inbox + `POST /token` for a bearer JWT, (3) `POST $NLQDB_BASE_URL/v1/waitlist` with the throwaway address (`source: "flow-004-walker"`, `persona: "solo-builder"`), (4) polls `GET api.mail.tm/messages` every `FLOW_004_POLL_INTERVAL_S` seconds (default 10) up to `FLOW_004_TIMEOUT_S` (default 300) for an email whose `from.address` matches `/nlqdb/i`, (5) extracts the `?invite=<code>` parameter from the message text/html, (6) **control probe** — `POST /v1/ask` with `Authorization: Bearer anon_<uuid>` and NO `X-Invite-Code` header; must return `error.status="feature_gated"`, otherwise the gate is open globally and the walk is `inconclusive`, (7) **invite probe** — `POST /v1/ask` with the same anon bearer AND `X-Invite-Code: <code>`; passes only if the response is NOT `feature_gated`. Decision matrix: `passed` = control blocked AND invite HTTP 200; `failed step 5` = control blocked AND invite `feature_gated` (the real SK-GATE-007 regression signature); `partial` = control blocked AND invite non-200 non-`feature_gated` (gate honoured the code; downstream owns the failure — e.g. transient LLM 422 on schema-infer); `inconclusive` = control NOT blocked (the gate cleared the threshold globally; SK-GATE-007 invariant unprovable on this run, exit code 4). The trap-registered cleanup runs `DELETE /accounts/{id}` on every exit path, including a Ctrl-C between account-create and token-fetch (the trap re-mints the JWT from the saved password if needed). Outcome JSON shape (uniform across success/failure): `{utc, flow, base_url, mail_tm_domain, state, gate_bypassed, control_blocked, email_latency_s, total_wall_s, ask_status, ask_error_status, control_status, control_error_status, notes}` — [`SK-STRG-006`](#sk-strg-006--flow-004-walker-grades-first-value-quality-on-the-http-200-not-just-reachability) appends the first-value-quality fields (`first_value_kind`, `first_value_quality`, `result_status`, `row_count`, `table_count`, `answer_confidence`, `answer_model`, `sql_is_select`). Per-run cost: one of 200/week SK-GATE-007 invites + one Resend send (3k/mo free tier).
- **Core value:** Bullet-proof, Simple, Goal-first
- **Why:** Before this script, FLOW-004 had been "shipped not verified" since 2026-05-21 — SK-GATE-007's invite codes have a Resend-template / KV-key-shape / middleware regression surface no one could exercise without an inbox. mail.tm exposes a free anonymous bearer-token REST API ([`docs.mail.tm`](https://docs.mail.tm/)) that mints disposable inboxes at 8 QPS without signup. First live walk recorded `HTTP 200` in 18s; the control+invite pair landed the same pass in 15s with full SK-GATE-007 invariant proof. Bash+curl matches `verify-flows.sh`'s precedent. The control probe makes this a regression detector, not a static "API up" check: when BIRD/Spider clear and `gatePreAlpha` returns `pass` for unbypassed traffic, the walker must NOT silently green-light — `inconclusive` signals the next agent to switch slice.
- **Consequence in code:** Adding a new gate-bypass channel (e.g. allowlist-by-email, paid-tier auto-invite) requires extending FLOW-004 + this walker + the mirrored impl-plan §8 block. The `redact()` helper (first-4 + last-4 only, refuses < 12 chars) is the contract for any agent-facing log touching invite codes, JWTs, or throwaway mail.tm addresses. The `write_outcome` helper centralises the JSON shape so every failure path emits a uniform record — no triage-blind exit. Output JSON lives under `tools/stranger-test/results/` so a future R2-archive cron sweeps both walkers with one glob. Scheduled re-runs must stay well below the 200/week cap or the Worker silently returns 200 with no code. When BIRD/Spider clear and the walker starts returning `inconclusive`, the next slice is switching to a direct middleware probe — production-config-changes-from-CI is rejected as a worse property.
- **Alternatives rejected:**
  - **Resend webhook capture.** Public ingest endpoint leaks invite codes to anyone guessing the URL and adds Worker-side state. mail.tm needs zero infra changes.
  - **Dedicated nlqdb-owned test inbox.** Adds DNS / IMAP / OAuth surface; every run lands in the same mailbox, creating race conditions and stale-code reuse.
  - **Test-only `/v1/waitlist?reveal=1` returning the invite in response body.** Breaks SK-GATE-007's "invite reaches user only via email" property; creates a backdoor that survives prod by accident.
  - **Mock-IdP injection of the invite into KV via Cloudflare API.** Skips Resend + the email-delivery path — exactly the regression the walker exists to catch.
  - **Playwright walker extension on its own (`--invite-code <c>`).** Closes the browser-capture gap (now [`SK-STRG-004`](./decisions/SK-STRG-004-invite-bearing-composer.md)) but needs a code from somewhere — doesn't replace the inbox-receive gap this script closes.
  - **TS workspace under `tools/flow-004-walker/`.** Heavier than `scripts/verify-flows.sh`'s precedent; the agent can grep the whole walk in one file.

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
  - *In this feature:* the canonical-five (FLOW-001/002/003/004/005) each map to a walker owned by this feature — FLOW-001/002/003 to `stranger-test.sh` (+ `stranger-test-invited.sh` for the invite-bearing variant), FLOW-004 to `flow-004-walk.sh`, FLOW-005 to `flow-005-walk.sh` (SK-STRG-005). The daily `acquisition-health.yml` cron re-runs each walker every 24 h, satisfying the GLOBAL's seven-day freshness rule by default. Demoting a canonical flow or adding a sixth requires editing GLOBAL-032 and updating both trackers in the same PR.

## Open questions / known unknowns

- **R2 archive + diff-against-prior-run.** Cron landed via [`SK-STRG-003`](#sk-strg-003--daily-gh-actions-cron-walks-all-walkers-at-0600-utc-exits-0-unconditionally-so-no-founder-facing-email-channel-is-created); current artifact shelf-life is 90 days on GitHub. R2 archive would extend retention and enable `diff-against-prior-run` as a follow-up agent step (today the agent re-fetches the latest two runs from the workflow's artifact history). Deferred until either the 90-day window proves too short or a real `diff` consumer exists.
- **TTFV semantics under the gate.** `ttfvMs` is "submit → first `/v1/ask` response"; under a 403 that's "time to gate-block" (≈150 ms), not time-to-value. The §1.2 KPI dashboard ([`SK-ONBOARD-005`](../onboarding/FEATURE.md)) is the canonical TTFV source with split-by-status; renaming the walker field is deferred until the §1.4 gate-bypass debate resolves.
- **Resolved.** Invite-bearing Playwright mode → SK-STRG-004 (`stranger-test-invited.sh`, full browser SK-GATE-007 path); continuous FLOW-004 regression watch → SK-STRG-003 (daily cron, ≤7/week of the 200/week cap); FLOW-004 first-value-quality grading → SK-STRG-006.
- **`@cloudflare/playwright` evaluation.** If CF exposes a Workers-runtime Playwright the cron could collapse to one Worker hop — but the §1.1 stranger-IP rule still bars a Worker from being the stranger, so the current "runs anywhere with `bun` + Chromium" shape sidesteps it.
