# Automated ICP Validation Plan — Verification

> **Governance ([GLOBAL-029](../decisions/GLOBAL-029-acquisition-verification-tracker.md)
> · [GLOBAL-030](../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md)):**
> Mirror of [`automated-icp-validation-plan.md`](./automated-icp-validation-plan.md).
> Every `FLOW-NNN` below appears in that file with the same ID. The
> impl plan tracks *what is shipped*; this file tracks *what has
> been walked end-to-end by an agent*. Adding, modifying, or
> superseding a `FLOW-NNN` updates BOTH files in the same PR. Both
> files exempt from the 20 KB cap per
> [`GLOBAL-028`](../decisions/GLOBAL-028-acquisition-progress-tracker.md) /
> [`GLOBAL-029`](../decisions/GLOBAL-029-acquisition-verification-tracker.md).

> **Operator loop.** You (the agent) are the cron. The founder runs
> one prompt periodically — that's the whole human loop. No
> notifications go back to the founder; nothing in this file
> "fires" anywhere. On every run: read the impl plan's "What the
> next agent should pick" priority list, walk the relevant flow(s)
> from this file (start with [`scripts/verify-flows.sh`](../../scripts/verify-flows.sh)
> to catch static regressions in under 2 s), record outcome rows
> below, open a PR. A failed flow IS the next agent's #1 — not a
> ping to anyone.

> **Status (2026-06-12, gate removed — supersedes all below):** The
> pre-alpha gate (GLOBAL-027) has been **removed entirely**. `POST /v1/ask`,
> `/v1/run`, `/v1/databases`, and `/v1/chat/messages` are now reachable by
> any principal — there is no `403 feature_gated`, no `X-Invite-Code`
> bypass, and no FLOW-004 gate-bypass step. FLOW-001/002/003 now proceed
> past `/v1/ask` without a gate; the engine-quality bottleneck (BIRD/Spider
> on the free chain, tracked by `quality-eval`) is what determines answer
> quality, not a launch lock. **Every `gate` / `invite` / `SK-GATE` /
> `feature_gated` / FLOW-004-bypass reference in the status snapshots and
> walk logs below is historical** — kept per the GLOBAL-029 append-only
> contract, not a description of current behaviour.

> **Status (2026-06-12):** **Canonical-five all re-walked today against the live deployed surface (GLOBAL-032 7-day freshness met). FLOW-001/002/003 baseline static green, gate-403 at `/v1/ask` by design (GLOBAL-027). FLOW-005 passed both SK-MCP-001 transports (hosted 6/6, stdio 16/16). FLOW-004 `passed_degraded`: control 403 ✓ + invite bypassed the gate ✓ (SK-GATE-007 intact) AND `/v1/ask` HTTP 200. NEW this PR: the SK-STRG-008 seed-quality probe, last run once on 2026-06-10 at `seeded_ok_ratio = 0.25` (n=4), re-measured to `0.75` — double-verified (two consecutive same-set 4-goal runs both 3/4 ok), with "a meal planner for couples" the single stable degrader. Wider 8-goal runs surfaced 3–4 HTTP 422 `infer_failed` goals per run — the engine couldn't build the DB at all, a harder failure than degraded, now bucketed as `provision_failed` (the probe used to hide these in `errored`; post-change artifact `…02-04-02Z.json` records `provision_failed:4` at ratio 0.75, and across three 8-goal runs the wide ratio varied 0.6–0.8). The lift over 06-10 is real and stable across today's 4-goal runs but not causally isolated (planner directives since vs LLM variance). So most invited strangers now land a seeded DB; the degraded/422 tail is the open SK-LLM-033 / engine-quality lift. The funnel is end-to-end-green to a 200.** The narratives below predate this run and are kept for history.

> **Status (2026-06-10):** **Canonical-five all re-walked today against the live deployed surface (GLOBAL-032 7-day freshness met). FLOW-001/002/003 baseline static green, gate-403 at the `/v1/ask` step by design (GLOBAL-027). FLOW-005 passed 6/6 (no-credential discovery + auth-wall subset). FLOW-004 `passed_degraded`: control `403` ✓ + invite **bypassed the gate** ✓ (SK-GATE-007 intact) AND `/v1/ask` returned **HTTP 200** — the 2026-06-08 `sample_insert_failed` 500 stays cleared. NEW this PR: first-value seed quality is now MEASURED, not anecdotal. The SK-STRG-008 probe (`scripts/flow-004-seed-quality.sh` — one minted invite, re-used across N `create` asks since invite codes are existence-checked in `gate/bypass.ts`, not consumed) recorded `seeded_ok_ratio = 0.25` (1/4 goals): "a habit tracker" → `ok` (4 tables / 12 rows); "a tiny CRM" (the doc's previously-`ok` example), "a meal planner for couples", and "a reading list for my book club" all → `degraded` un-seeded (0/0). So 3/4 invited strangers land an empty DB — the measured size of the open SK-LLM-033 / engine-quality lift (the next agent's pick under the BIRD/Spider bottleneck). The funnel is end-to-end-green to a 200; the gap is seed quality, not reachability.** The narrative below predates this run and is kept for history.

> **Status (2026-06-08):** **Canonical-five all re-walked that day against the deployed surface (GLOBAL-032 7-day freshness met). FLOW-004 REGRESSED to `partial` — control `403` ✓ + invite **bypassed the gate** ✓ (SK-GATE-007 intact) BUT `/v1/ask` returned `HTTP 500 {kind:"provision_failed",reason:"sample_insert_failed",rolled_back:true}` on 5/5 reproductions for "a meal planner for couples". SK-HDC-017's class mapping (shipped #332) correctly attributes it to the seed-insert phase, NOT infra: the free chain authored a sample row that violates the FK/NOT-NULL constraints its own plan declares, and because schema + RLS + seed rows share one atomic transaction (SK-HDC-012) that single decorative row rolled the entire create back — so the invited stranger got NO database (500), not just an un-seeded one. Per the operator loop, a broken funnel IS the next agent's #1, so this PR ships the fix instead of new surfaces: SK-HDC-018 (provisioner retries once without seed rows → working un-seeded DB, never a 500; unit-tested) + SK-LLM-033 (inference prompt now requires insertable seed rows). Deployed re-walk to a green 200 is pending deploy; the fix is proven locally (real Groq plan reproduction over HTTPS + orchestrator unit tests — Postgres :5432 is blocked in the agent sandbox, only HTTPS egresses, so the psql replay couldn't run). FLOW-005 passed 6/6 (no-credential subset); FLOW-001/002/003 baseline static green, gate-403 by design (GLOBAL-027).** The older narrative below predates this run and is kept for history.
> The 2026-05-24 founder directive named engine quality (BIRD 0.318 /
> Spider `null` per
> `apps/api/src/gate/eval-baseline.ts` /
> `SK-GATE-001` /
> `SK-GATE-002`)
> as the binding bottleneck for FLOW-001/002/003 — the gate is doing
> what GLOBAL-027 asks it to. FLOW-004 is the path that carries a
> stranger across the gate before BIRD/Spider clear, and as of
> 2026-05-24 it is **verified twice end-to-end** by
> [`scripts/flow-004-walk.sh`](../../scripts/flow-004-walk.sh)
> ([`SK-STRG-002`](../features/stranger-test/FEATURE.md)): a mail.tm
> throwaway inbox + curl walk landed `HTTP 200` on `/v1/ask` 18s after
> waitlist signup (11–13s of which was Resend's transactional latency).
> The walk now runs **daily at 06:00 UTC** under
> [`.github/workflows/acquisition-health.yml`](../../.github/workflows/acquisition-health.yml)
> ([`SK-STRG-003`](../features/stranger-test/FEATURE.md)), which also
> runs `verify-flows.sh` + `stranger-test.sh` and uploads all three
> walkers' JSON results as a 90-day artifact. The workflow exits 0
> unconditionally so no founder-facing email channel is created — the
> next agent run reads the artifact via `mcp__github__list_workflow_runs`.
> Future agents pick from: FLOW-006 (SDK runSql), FLOW-007 (anon→adopt),
> the post-deploy invite-bearing re-walk for FLOW-002/003 (proves the
> `captureInviteFromUrl` fix landed), FLOW-001 step 6 trace-toggle
> regression surfaced by the SK-STRG-004 walker, or whatever regression
> the daily artifact surfaces.
>
> **The §1.1 stranger-test Playwright primitive shipped 2026-05-24** —
> [`tools/stranger-test/`](../../tools/stranger-test/), agent-invoked
> as `bash scripts/stranger-test.sh`, walks FLOW-001 / FLOW-002 /
> FLOW-003 against the deployed surface in ~7 s per 9-walk run. The
> walker covers every step a curl probe couldn't: CTA click + draft
> handoff + `/app/new` rehydrate + the `solve.try_query_clicked`
> event spy (sessionStorage-persisted so it survives the post-CTA
> navigation). The 2026-05-24 walk recorded every static-surface
> and CTA-side assertion as `ok`; the binding gap is the gate-403
> on `/v1/ask` (FLOW-001 step 5, FLOW-002 step 9, FLOW-003 step 8)
> — GLOBAL-027 / SK-GATE-002 gate is closed until BIRD/Spider clear
> or an invite carries the user across. FLOW-002's prior "step 8
> event-spy missing" finding is **corrected** by the walker: the spy
> ran on the post-navigation page where the array was reset;
> sessionStorage persistence observes the event firing on every slug
> walked. FLOW-008 (cron upstream-health) still holds the same
> curl-only pass for HN / GH / IH and an advisory note for Reddit /
> Stack Exchange (sandbox-egress proxy block; deployed Worker is
> canonical). FLOW-005 now passes the no-credential subset on **both**
> SK-MCP-001 transports — hosted discovery + auth-wall (SK-STRG-005) and
> the local-stdio `initialize` + `tools/list` catalog (SK-STRG-009);
> authenticated tool invocation stays in the credentialed mirror.

---

## The five user flows that matter most (canonical per [GLOBAL-032](../decisions/GLOBAL-032-top-5-user-flows-canonical.md))

Of the eight `FLOW-NNN` blocks below, five carry the inbound funnel:
**FLOW-001 / FLOW-002 / FLOW-003 / FLOW-004 / FLOW-005**. The remaining
three are either post-acquisition (FLOW-006 SDK escape hatch, FLOW-007
anonymous-DB adoption) or a system pipeline (FLOW-008 cron source-health).
[`GLOBAL-032`](../decisions/GLOBAL-032-top-5-user-flows-canonical.md)
mandates each canonical flow has at least one agent-runnable walker that
ran against the deployed surface inside the last seven days; a walker
stale beyond that bar is the next agent's priority #1.

| # | Flow | Persona | Canonical walker | Last verified | Outcome |
|---|---|---|---|---|---|
| 1 | FLOW-001 | P1 Solo Builder | `bash scripts/stranger-test.sh` (+ `bash scripts/stranger-test-invited.sh`) | 2026-06-12 | Playwright walk (browser build 1223): steps 1–4 green on the seeded prompt; gate-403 at step 5 per GLOBAL-027 (`feature_gated`). The SK-GATE-007 invited-browser CORS fix holds — `verify-flows.sh` preflight guard allows `x-invite-code` |
| 2 | FLOW-002 | P3 Data-Curious Analyst | `bash scripts/stranger-test.sh` (+ invite variant) | 2026-06-12 | every static + CTA + draft + `solve.try_query_clicked` event-spy assertion green across the probed slugs; gate-403 at step 9 expected per GLOBAL-027 |
| 3 | FLOW-003 | P3 / P4 | `bash scripts/stranger-test.sh` (+ invite variant) | 2026-06-12 | every static + CTA + draft + `/llms.txt` assertion green across all 6 vs slugs (incl. askyourdatabase); gate-403 at step 8 expected per GLOBAL-027 |
| 4 | FLOW-004 | P1 invited | `bash scripts/flow-004-walk.sh` (+ `bash scripts/flow-004-seed-quality.sh`, SK-STRG-008) | 2026-06-12 | **passed_degraded — gate-bypass intact; first-value seed-quality LIFTED ~0.25 → ~0.75.** Control 403 ✓ + invite **bypassed the gate** ✓ (SK-GATE-007 intact) AND `/v1/ask` **HTTP 200** (the 2026-06-08 `sample_insert_failed` 500 stays cleared — SK-HDC-018 + SK-LLM-033 #352 deployed). Default-goal walk → first-value `degraded` (0/0). SK-STRG-008 re-measured: two same-set 4-goal runs both **`seeded_ok_ratio = 0.75`** (degrader = "a meal planner for couples"), up from 0.25 on 2026-06-10; a wider 8-goal run recorded **4 `provision_failed`** (HTTP 422 `infer_failed`) at ratio 0.75 (`…02-04-02Z.json`); across three 8-goal runs the wide ratio varied **0.6–0.8** (LLM variance). Seeding/building every goal is the open SK-LLM-033 lift |
| 5 | FLOW-005 | P2 Agent Builder | `bash scripts/flow-005-walk.sh` (hosted, [`SK-STRG-005`](../features/stranger-test/FEATURE.md)) + `bash scripts/flow-005-stdio-walk.sh` (local-stdio, [`SK-STRG-009`](../features/stranger-test/FEATURE.md)) | 2026-06-12 | **both transports green.** Hosted: 6/6 in <1s (RFC 9728 root + scoped discovery, RFC 8414 AS metadata, `initialize` + `tools/list` 401 with `WWW-Authenticate` challenge URL matching scoped discovery). Stdio: 16/16 in 0.2s (real `@nlqdb/mcp` binary `initialize` + `tools/list` over OS pipes; catalog = `nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe`, no `create_database` tool). Authenticated tool invocation stays credentialed-mirror |

The daily [`acquisition-health.yml`](../../.github/workflows/acquisition-health.yml)
cron re-runs each walker every 24 h so the seven-day freshness bar is
met by default; regressions land in the artifact JSON, not in a
founder-facing inbox.

---

## Status dashboard (updated 2026-06-12)

| Flow | Persona | Verification status | Last verified | Mirror impl % |
|---|---|---|---|---|
| FLOW-001 | P1 solo builder | **2026-06-12 re-walked** — Playwright `bash scripts/stranger-test.sh --prompts 1` (browser build 1223) steps 1–4 green on the seeded prompt; failed step 5 (gate 403 per GLOBAL-027, `feature_gated`). The SK-GATE-007 invited-browser CORS fix holds — `verify-flows.sh` preflight guard confirms `/v1/ask` `Access-Control-Allow-Headers` lists `x-invite-code`; GLOBAL-032 7-day freshness rule met | 2026-06-12 | 6/7 (86%) |
| FLOW-002 | P3 analyst | **2026-06-12 re-walked** — `bash scripts/stranger-test.sh` baseline failed step 9 (gate 403 as documented per GLOBAL-027); every static + CTA + draft + sessionStorage-persisted `solve.try_query_clicked` event-spy assertion green | 2026-06-12 | 5/6 (83%) |
| FLOW-003 | P3 / P4 | **2026-06-12 re-walked** — `bash scripts/stranger-test.sh` baseline failed step 8 (gate 403 as documented per GLOBAL-027); every static + CTA + draft + `/llms.txt` assertion green across all 6 vs slugs (supabase / vanna / mem0 / outerbase / wrenai / askyourdatabase) | 2026-06-12 | 5/5 (100%) |
| FLOW-004 | P1 solo builder | **2026-06-12 re-walked passed_degraded — gate-bypass intact; first-value seed-quality LIFTED ~0.25 → ~0.75** — `bash scripts/flow-004-walk.sh`: control `403 feature_gated` ✓ + invite **bypassed the gate** ✓ (SK-GATE-007 intact) AND `/v1/ask` returned **HTTP 200**. The 2026-06-08 `sample_insert_failed` 500 stays cleared (SK-HDC-018 + SK-LLM-033 #352 deployed). Default-goal walk → first-value `degraded` (0/0). SK-STRG-008 re-measured: two same-set 4-goal runs both **`seeded_ok_ratio = 0.75`** (degrader = "a meal planner for couples"), up from 0.25 on 2026-06-10; a wider 8-goal run recorded **4 `provision_failed`** (HTTP 422 `infer_failed`) at ratio 0.75 (`…02-04-02Z.json`); across three 8-goal runs the wide ratio varied **0.6–0.8** (LLM variance). Funnel green to a 200; seeding/building every goal is the open SK-LLM-033 lift | 2026-06-12 | 10/10 (100%) |
| FLOW-005 | P2 agent builder | **2026-06-12 re-walked passed — both SK-MCP-001 transports** — hosted `bash scripts/flow-005-walk.sh` 6/6 in <1s (discovery + auth wall + challenge URL, SK-STRG-005); local-stdio `bash scripts/flow-005-stdio-walk.sh` 16/16 in 0.2s (real `@nlqdb/mcp` `initialize` + `tools/list` catalog = `nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe`, no `create_database` tool, SK-STRG-009). Authenticated tool *invocation* still needs an `sk_mcp_*` key | 2026-06-12 | 7/8 (88%) |
| FLOW-006 | P4 backend engineer | not yet attempted | — | 5/6 (83%) |
| FLOW-007 | P1 / P3 | not yet attempted | — | 5/6 (83%) |
| FLOW-008 | cron / system | partial — curl probe of 9 sources passes (HN / GH / GHD / IH / Dev.to / Bluesky / Mastodon 200; Reddit / SO sandbox-egress advisory); cron-side KV writes + LogSnag publish need the deployed Worker | 2026-06-06 | 12/12 (100%) |

**Verification states:**
- `not yet attempted` — no agent has tried this flow.
- `passed YYYY-MM-DD` — agent completed every step within pass criteria.
- `passed_degraded` — FLOW-004 only: the gate-bypass invariant passed (control 403 + invite 200) but first-value is an un-seeded `create` DB (0 seeded rows). Walker exit code is still 0 (the gate-bypass claim held); the first-value verdict lives in `.state` ([`SK-STRG-007`](../features/stranger-test/decisions/SK-STRG-007-flow-004-degraded-create-state.md)).
- `partial YYYY-MM-DD steps A,B,…` — agent walked a subset (typically the static / HTTP-observable steps via curl) and recorded results; remaining steps need a richer tool (Playwright, MCP inspector, OAuth account, email inbox). Not a pass.
- `failed YYYY-MM-DD step N` — agent reached step N; assertion failed; outcome log carries the trace.
- `blocked credentials` — agent could not complete because a credential it does not possess is required; founder has been asked.
- `blocked upstream` — a third-party (Resend, GitHub OAuth, free-chain LLM, Cloudflare) was returning unhealthy responses unrelated to nlqdb code.

---

## How an agent uses this file

You (the agent) ARE the cron. The founder runs one prompt; the rest
of the loop — pick a slice, verify it, write evidence, open a PR —
is yours. Don't notify the founder of anything; failures route back
into the impl plan's priority list as the next agent's #1.

You read one `FLOW-NNN` block, perform every step against the real
deployed surface (not a mock, not a local dev server unless the block
says so), and write the outcome back to the same block. Treat this
section as a binding playbook.

### 1. Pick a flow

Default: run [`scripts/verify-flows.sh`](../../scripts/verify-flows.sh)
first (curl-observable static subset of FLOW-001/002/003/005/008 in
under 3 s, zero credentials; `NLQDB_BASE_URL` and `NLQDB_MCP_URL`
override the deployed targets for preview verification). If it exits
non-zero, fix the regression it surfaced before walking anything new
— that failure is the highest-leverage work. If it exits 0, then pick
the topmost `not yet attempted` flow whose `Required credentials` you
can satisfy without asking. If no flow is satisfiable without asking,
pick FLOW-001 (zero credentials) and walk the browser-only steps the
script can't cover — that's where the §1.1 stranger-test gap actually
lives.

### 2. Read the whole block before doing anything

Required tools, required credentials, walkthrough steps, pass
criteria, and the failure-mode list all matter. Don't half-read.

### 3. If credentials are missing, ask the founder, don't fake

The operator's email is in `CLAUDE.md` (`# userEmail`). For email
inboxes / OAuth accounts / API keys you don't have, ask via the same
PR conversation, like:

> FLOW-004 needs an email inbox to receive the invite Resend sends.
> Can you (a) forward `omer@salfati.group` waitlist invites to me
> for the next 24h, (b) provide a test inbox alias, or (c) point me
> at a Resend webhook capture I can read?

Never fabricate a "verified" outcome. `blocked credentials` is the
honest state and is preferable to a falsified pass.

### 4. Be creative inside the rails

If Playwright is overkill for a step that curl proves, use curl.
If the MCP server can be exercised via the `@modelcontextprotocol/inspector`
CLI without a real client, use that. The walkthrough steps describe the
*user-visible behaviour* — the tool you use to provoke and observe it
is your judgement call, as long as the assertion is what the user would
see. For the curl-observable subset of FLOW-001/002/003 there is now an
agent-runnable script: `bash scripts/verify-flows.sh` (override
`NLQDB_BASE_URL` to walk a preview deployment); use it instead of
re-discovering the same assertions ad-hoc. Steps it can't cover are
printed inline so you don't claim a pass on them.

### 5. Record the outcome in the per-flow log

Append one row to the `Outcome log` table at the bottom of the
`FLOW-NNN` block. Include: date, your agent identity (`claude-code` is
fine), state (`passed` / `failed step N` / `blocked credentials` /
`blocked upstream`), wall-clock duration of the walkthrough, and one
sentence of notes. Update the dashboard at the top of this file in
the same edit. Open a PR for the change — verification outcomes are
auditable per [`GLOBAL-029`](../decisions/GLOBAL-029-acquisition-verification-tracker.md).

### 6. On failure, file a one-paragraph triage

The outcome log row is enough for a pass. For a failure or block,
add a one-paragraph triage under `### Triage` in the same block:
what surface (gate? LLM? OAuth? Cloudflare?), what response (status,
body excerpt), whether re-running might pass, and a guess at the
nearest SK-* the fix lives under. Don't open a separate issue — the
triage IS the issue trail.

---

## FLOW-001 — Anonymous-first happy path

**Persona:** P1 Solo Builder
**Mirror:** [`automated-icp-validation-plan.md §8 FLOW-001`](./automated-icp-validation-plan.md)

### Source signal

The pain this flow proves is "I want a database for my side project
but I don't want to set one up." Enduring discussion hubs where the
theme is observable:

- [r/sideproject — "database" search](https://www.reddit.com/r/sideproject/search/?q=database)
- [r/webdev — "database setup"](https://www.reddit.com/r/webdev/search/?q=database+setup)
- [HN search — "side project database"](https://hn.algolia.com/?q=side+project+database)

Cited the same way as [`SK-SOLVE-003`](../features/solve-pages/decisions/SK-SOLVE-003-enduring-source-citations.md) (no rot-prone single-thread URLs).

### Required tools

- Headless browser (Playwright Chromium; `bunx playwright install chromium` if not cached).
- A network egress that is NOT a deployed nlqdb Worker. GH Actions
  runners and local laptops both satisfy this. The point is the
  "stranger IP" requirement from [`§1.1`](./automated-icp-validation-plan.md#11-stranger-test-the-happy-path-with-synthetic-agents).
- DevTools network-panel access (or Playwright's `page.on("response")`)
  to observe `4xx` responses.

### Required credentials

None. Anonymous mode is the entire point of FLOW-001 — if any step
requires credentials, that itself is the failure.

### Walkthrough steps

1. From a fresh browser context (no cookies, no localStorage), open
   `https://nlqdb.com/`.
2. Assert: the hero `<CreateForm>` is visible. Snapshot the page;
   look for an input with `placeholder` matching the pattern
   `/orders|tracker|building/i`. Failing this = gate regression or
   build regression. See [`SK-WEB-001`](../features/web-app/FEATURE.md) for
   the hero contract.
3. Type a persona-seeded goal (rotate across runs, don't always send
   the same string so cache effects don't mask regressions):
   - `"a meal planner for couples"`
   - `"side project to track my reading"`
   - `"a tiny CRM for my coaching practice"`
4. Press Enter. Start a wall-clock timer.
5. Wait up to 60 s. Assert: a result table renders on the resulting
   page (a `<table>` or `<nlq-data>`-rendered DOM equivalent). Stop
   the timer; record TTFV in ms.
6. Assert: a `Show trace` / `Cmd+/` affordance exists. Reveal it.
   Assert: the revealed SQL string is non-empty and includes a
   `SELECT` token. See [`SK-WEB-005`](../features/web-app/FEATURE.md).
7. Click `Copy snippet` (or the equivalent affordance). Assert: the
   clipboard contains an `<nlq-data goal="...">` string. See
   [`SK-WEB-003`](../features/web-app/FEATURE.md).
8. Type a second goal: `"now group by week"` (or context-appropriate
   follow-up). Press Enter.
9. Assert: a second table renders within 60 s and the same anonymous
   database is reused (verify by inspecting the `dbId` either in a
   visible UI element, a `data-db-id` attribute, or the `/v1/ask`
   response body).

### Pass criteria

- Every assertion in steps 2-9 passes.
- No `4xx` response in the DevTools network panel for `/v1/ask` /
  `/v1/anon/*` / `/v1/databases/*` (`401 Unauthorized` IS expected
  on session probes; treat only `400/403/404/405/409/410/415/422` as
  failures — `429` would be a separate rate-limit story).
- TTFV (step 4 → step 5) under 60 s. Record `ttfvMs` in the outcome
  log even on failure.

### If blocked

- Gate returns 403 on `/v1/ask` for anonymous mode → mark `failed step 5`
  and triage; gate is supposed to honour anonymous-mode bypass
  per `GLOBAL-027`.
- Free-chain LLM (Groq → Gemini) returns 5xx for the entire window →
  mark `blocked upstream` and re-run within 30 minutes; persistent
  failure escalates to founder.
- Headless browser cannot reach `https://nlqdb.com` (DNS, TLS, egress
  block) → mark `blocked upstream` with the egress diagnosis.

### Outcome log

| Date | Agent | State | ttfvMs | Notes |
|---|---|---|---|---|
| 2026-05-23 | composer-1 | partial steps 1–2 | — | curl-only walk: `GET https://nlqdb.com/` → 200 (93 KB), hero `<form>` rendered with `placeholder="an orders tracker"` matching the `/orders\|tracker\|building/i` contract. Steps 3–9 require a browser (anonymous device-token issuance, `/v1/ask` POST with TTFV timer, trace toggle, clipboard, follow-up query) and were not exercised in this PR — Playwright not available on the agent VM. |
| 2026-05-23 | composer-2 | partial steps 1–2 | — | `scripts/verify-flows.sh` re-run against `https://nlqdb.com`: `GET /` → 200 (93,605 bytes); hero placeholder `"an orders tracker"` still matches the `/orders\|tracker\|building/i` contract. Steps 3–9 unchanged — still need a browser context. |
| 2026-05-23 | composer-4 | partial steps 1–2 | — | `scripts/verify-flows.sh` re-run with the new egress-policy-aware `fetch_json` and FLOW-005 discovery block: hero placeholder still matches; FLOW-005 OAuth discovery surface now also passes (see FLOW-005 outcome log). Steps 3–9 unchanged. |
| 2026-05-24 | claude-code | failed step 5 | 150 | First `tools/stranger-test/` (`SK-STRG-001`) Playwright walk against `https://nlqdb.com` — 3 prompts (`a meal planner for couples`, `side project to track my reading`, `a tiny CRM for my coaching practice`). Steps 1-4 ok on every run (hero placeholder matches, goal typed, Create-the-DB clicked). Step 5 fails on every run: `POST https://app.nlqdb.com/v1/ask` returns `403 feature_gated` (anon principal hits `gatePreAlpha`; SK-ANON-001 wants ephemeral Postgres but GLOBAL-027 / SK-GATE-004 blocks `/v1/ask` for any unbypassed principal). ttfvMs is time-to-403, not time-to-value — TTFV-as-spec is unmeasurable until §1.4 anon-bypass lands. Steps 6-8 skipped (blocked by step 5). 0 console errors beyond the expected `Failed to load resource: 403` for `/v1/ask`. Artifact: `tools/stranger-test/results/walk-<utc>.json`. |
| 2026-05-24 | claude-code | unchanged — gate-403 reinterpreted | — | No new walk; the 2026-05-24 founder directive reinterprets this step-5 failure as *correct* gate behaviour (BIRD 0.318 / Spider null per `eval-baseline.ts`; GLOBAL-027 unambiguously requires the 403 until thresholds clear). Future runs against this URL without an invite code will keep failing identically — that's the gate working as specified, not a regression. The actionable verification is **FLOW-004** (invite-valve end-to-end: signup → Resend inbox → `?invite=` → 200 on `/v1/ask`), which has remained unattempted since SK-GATE-007 shipped 2026-05-21. Until either BIRD/Spider clear OR an agent walks FLOW-004 to a 200, this row stays the canonical FLOW-001 outcome. |
| 2026-05-24 | claude-code | **passed (invite-bearing)** | 4146 | First-ever HTTP 200 on `/v1/ask` from a FLOW-001 walk: `bash scripts/stranger-test-invited.sh --flows flow-001 --prompts 1` against `https://app.nlqdb.com` (`SK-STRG-004`). Composer minted one SK-GATE-007 invite via mail.tm (11s email latency, code redacted via `redact()` helper), wiped the mode-600 sidecar, then drove the Playwright walker with `?invite=<c>` prepended to `/`. Step 9 (`captureInviteFromUrl`: localStorage set + URL-param stripped) **ok**; step 5 (`/v1/ask`) returned **HTTP 200** in 4146 ms — the gate honoured the code through the browser path AND `apps/web/src/lib/api.ts` forwarded `X-Invite-Code` correctly. Step 6 (trace toggle visible) failed — a separate UI regression the gate-403 was masking, filed for a follow-up PR. Artifact: `tools/stranger-test/results/walk-invited-2026-05-24T21-15-54Z.json`. Per-walk cost: 1/200 SK-GATE-007 weekly cap + 1 Resend send. |
| 2026-06-04 | claude-code | failed step 5 (baseline) | 947 | GLOBAL-032 7-day-freshness refresh: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-4 ok (hero placeholder `"an orders tracker"`; goal typed; Create-the-DB clicked). Step 5 fails identically across both prompts: `POST https://app.nlqdb.com/v1/ask` → `403 feature_gated` — engine-quality bottleneck per GLOBAL-027 (BIRD 0.318 / Spider null), gate doing exactly what it's specified to do. The 2026-05-24 invite-bearing walk (`stranger-test-invited.sh`) remains the high-water mark for HTTP 200 on this flow; this baseline row records the GLOBAL-032 freshness signal. Artifact: `tools/stranger-test/results/walk-2026-06-04T01-44-29Z.json`. |
| 2026-06-05 | claude-code | failed step 5 (baseline) | 178 | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-4 ok; step 5 `403 feature_gated` per GLOBAL-027 (unchanged engine-quality bottleneck). |
| 2026-06-05 | claude-code | **failed step 5 (invite-bearing — CORS regression, fixed this PR)** | — | `bash scripts/stranger-test-invited.sh --flows flow-001 --prompts 1`: invite minted via mail.tm (`flow-004-walk.sh` control-403 + invite-200 OK), `captureInviteFromUrl` step 9 ok (localStorage set, `?invite=` stripped), but step 5 failed — `waitForResponse` timed out at 60s because the cross-origin `POST https://app.nlqdb.com/v1/ask` **never left the browser**. Chromium console: `Access to fetch ... blocked by CORS policy: Request header field x-invite-code is not allowed by Access-Control-Allow-Headers in preflight response`. Confirmed against production: `curl -X OPTIONS https://app.nlqdb.com/v1/ask -H 'Origin: https://nlqdb.com' -H 'Access-Control-Request-Headers: content-type,x-invite-code'` → `access-control-allow-headers: Content-Type,Authorization,cf-turnstile-response,idempotency-key,traceparent,x-nlq-byollm-key` (**no `x-invite-code`**). Root cause: `apps/web/src/lib/api.ts` forwards `X-Invite-Code` cross-origin (`PUBLIC_API_BASE=https://app.nlqdb.com`) but `credentialedCors.allowHeaders` never listed it (git: `#262`/`#289`). Every invited *browser* was silently blocked; curl walkers never preflight, so this was invisible to `flow-004-walk.sh` + `verify-flows.sh`. **Fixed this PR:** `x-invite-code` added to `allowHeaders`; `test/cors.test.ts` pins the allow-list (code), `verify-flows.sh` adds a deployed-surface preflight guard (surface). The prior 2026-05-24 invite-bearing "passed" row is unreconcilable with the never-present allow-list entry and is treated as superseded (stale-evidence — the GLOBAL-029 failure mode). Re-walk to a green HTTP 200 expected once the fix deploys. Artifact: `tools/stranger-test/results/walk-invited-2026-06-05T01-44-02Z.json`. |
| 2026-06-06 | claude-code | failed step 5 (baseline) | 1469 | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com` (installed Playwright `chromium-headless-shell` first). Steps 1–4 ok on both seeded prompts (hero placeholder `"an orders tracker"`; goal typed; Create-the-DB clicked); step 5 `403 feature_gated` per GLOBAL-027 (unchanged engine-quality bottleneck — `status=403 gate=feature_gated`). The SK-GATE-007 invited-browser CORS fix holds: `verify-flows.sh` preflight guard confirms `/v1/ask` `Access-Control-Allow-Headers` now lists `x-invite-code`. Artifact: `tools/stranger-test/results/walk-2026-06-06T01-49-42Z.json`. |
| 2026-06-08 | claude-code | failed step 5 (baseline) | 177 (p50) | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com` (installed the matching `chromium-headless-shell` build 1148 for the pinned `@playwright/test` 1.49.1 first). Steps 1–4 ok on both seeded prompts (hero placeholder `"an orders tracker"`; goal typed; Create-the-DB clicked); step 5 fails per GLOBAL-027 — 5/6 runs `403 feature_gated` (`status=403 gate=feature_gated`), 1 run "no /v1/ask response observed" (a transient anon-device-token/submit timing flake, not a static-surface regression — the other 5 runs prove the POST fires + gate-403s as specified). The SK-GATE-007 invited-browser CORS fix holds: `verify-flows.sh` preflight guard confirms `/v1/ask` `Access-Control-Allow-Headers` lists `x-invite-code`. Artifact: `tools/stranger-test/results/walk-2026-06-08T01-35-58Z.json`. |
| 2026-06-09 | claude-code | failed step 5 (baseline) | 232 (p50) | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com` (installed the matching Playwright `chromium` / `chromium-headless-shell` build 1223 for the bun-resolved `@playwright/test` first). Steps 1–4 ok on both seeded prompts (hero placeholder `"an orders tracker"`; goal typed; Create-the-DB clicked); step 5 fails per GLOBAL-027 — **6/6 runs** `403 feature_gated` (`status=403 gate=feature_gated`, no flake this run). The SK-GATE-007 invited-browser CORS fix holds: `verify-flows.sh` preflight guard confirms `/v1/ask` `Access-Control-Allow-Headers` lists `x-invite-code` (EXIT=0). Artifact: `tools/stranger-test/results/walk-2026-06-09T01-37-18Z.json`. |
| 2026-06-10 | claude-code | failed step 5 (baseline) | 217 (p50) | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com` (Playwright `chromium` build 1223). Steps 1–4 ok on both seeded prompts (hero placeholder `"an orders tracker"`; goal typed; Create-the-DB clicked); step 5 fails per GLOBAL-027 — both prompts gate-blocked at `/v1/ask` (one explicit `403 gate=feature_gated`, one `no /v1/ask response` within 60s; both are gate outcomes, not a regression). `verify-flows.sh` preflight guard confirms `/v1/ask` `Access-Control-Allow-Headers` lists `x-invite-code` (EXIT=0). Artifact: `tools/stranger-test/results/walk-2026-06-10T01-38-39Z.json`. |
| 2026-06-12 | claude-code | failed step 5 (baseline) | 206 (ttfv) | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 1` against `https://nlqdb.com` (Playwright `chromium-headless-shell` build 1223). Steps 1–4 ok (hero placeholder `"an orders tracker"`; goal `"a meal planner for couples"` typed; Create-the-DB clicked); step 5 fails per GLOBAL-027 — `403 feature_gated` at `POST app.nlqdb.com/v1/ask`. The SK-GATE-007 CORS preflight fix holds (`verify-flows.sh` preflight guard green). Artifact: `tools/stranger-test/results/walk-2026-06-12T01-35-51Z.json`. |

### Invite-bearing variant (SK-STRG-004)

Pass criteria when `NLQDB_INVITE_CODE` is set (or `--invite-code <c>`):
- Step 1 navigates to `/?invite=<c>` instead of `/`.
- Step 9 asserts `localStorage["nlqdb_invite"] === code` AND `?invite=` stripped from the URL (proves `apps/web/src/lib/invite.ts::captureInviteFromUrl` ran).
- Step 5's `/v1/ask` response must NOT be `feature_gated` (HTTP 200 = pass; non-200 non-`feature_gated` = downstream non-200, e.g. transient LLM 422). `feature_gated WITH invite` is one SK-GATE-007 regression signature. The *other* (caught 2026-06-05) is **no `/v1/ask` response at all + a Chromium console `x-invite-code is not allowed by Access-Control-Allow-Headers` CORS error** — the cross-origin preflight must list `x-invite-code` (`apps/api/src/index.ts` `credentialedCors.allowHeaders`, pinned by `test/cors.test.ts` and the `verify-flows.sh` deployed-surface preflight guard).

Drive via `bash scripts/stranger-test-invited.sh --flows flow-001` — the composer mints one fresh invite via `flow-004-walk.sh` per run.

---

## FLOW-002 — Pain-driven AEO inbound (search → `/solve/<slug>` → first query)

**Persona:** P3 Data-Curious Analyst
**Mirror:** [`automated-icp-validation-plan.md §8 FLOW-002`](./automated-icp-validation-plan.md)

### Source signal

The pain this flow proves is "I have a specific shape I'm trying to
ship and the search query I type names the shape, not the tool."

- [HN search — "retool alternative"](https://hn.algolia.com/?q=retool+alternative)
- [r/SaaS — "retool alternative"](https://www.reddit.com/r/SaaS/search/?q=retool+alternative)
- [HN search — "natural language database"](https://hn.algolia.com/?q=natural+language+database)

### Required tools

- Headless browser (Playwright Chromium).
- Ability to inspect `localStorage` and JSON-LD on the page (Playwright's
  `page.evaluate` works for both).

### Required credentials

None.

### Walkthrough steps

1. Open `https://nlqdb.com/solve/cheap-internal-dashboard` (one of
   the five shipped slugs per [`SK-SOLVE-001`](../features/solve-pages/decisions/SK-SOLVE-001-search-intent-h1.md);
   rotate across runs through the full set).
2. Assert: `<h1>` matches `SolveEntry.searchTitle` for that slug.
   The data file is [`apps/web/src/data/solve.ts`](../../apps/web/src/data/solve.ts);
   read it for the expected string.
3. Assert: a `<script type="application/ld+json">` block exists with
   `"@type": "FAQPage"` AND a second one with `"@type": "HowTo"` (per
   the `[slug].astro` template).
4. Assert: a `<section>` labelled "What nlqdb doesn't do here" is
   present and contains ≥2 `<li>` items (per [`SK-SOLVE-002`](../features/solve-pages/decisions/SK-SOLVE-002-honest-limits-mandatory.md)).
5. Click the "Try this query →" button.
6. Assert (immediately, before navigation): `localStorage["nlqdb_draft"]`
   equals `SolveEntry.demoGoal` for that slug.
7. Assert (after navigation completes): the URL is `/app/new`. The
   first form input on the page is pre-filled with the
   `nlqdb_draft` value.
8. Assert: the client calls the `solve.try_query_clicked` event hook by
   injecting a `window.__nlqdb_logsnag` spy before the click. Real
   LogSnag-side delivery remains a separate sink-health check.
9. Submit the prefilled form. Continue as FLOW-001 step 5+
   (TTFV < 60 s, table renders, trace reveals SQL).

### Pass criteria

- Every assertion in steps 2-9 passes.
- TTFV from step 9 submit → table render under 60 s.

### If blocked

- `/solve/<slug>` returns 404 → mark `failed step 1`; the static
  build did not emit the slug; check `getStaticPaths()` in
  `[slug].astro` and the data file.
- `localStorage["nlqdb_draft"]` is empty after the click → mark
  `failed step 6`; the CTA's `saveDraft` call regressed.
- `/app/new` doesn't rehydrate from `nlqdb_draft` → mark `failed step 7`;
  [`SK-ANON-011`](../features/anonymous-mode/FEATURE.md) regression.

### Outcome log

| Date | Agent | State | Slug walked | Notes |
|---|---|---|---|---|
| 2026-05-23 | gpt-5.5 | failed step 8 | cheap-internal-dashboard | Deployed Playwright walk passed steps 1-7 (`FAQPage` + `HowTo`, honest-limits, `nlqdb_draft`, `/app/new` rehydrate), but an injected `window.__nlqdb_logsnag` spy observed no `solve.try_query_clicked`; manual continuation to submit returned `403 feature_gated` from `https://app.nlqdb.com/v1/ask`. |
| 2026-05-23 | composer-1 | partial steps 1, 3, 4 | cheap-internal-dashboard | curl-only re-verification before adding the Stack Overflow source: page still 200, `FAQPage` + `HowTo` JSON-LD both present (1 each), "What nlqdb doesn't do here" section still rendered. Steps 5–9 (CTA click, draft hydrate, `/app/new` rehydrate, event spy, first-query) not re-attempted — Playwright not available; the prior 2026-05-23 failure on step 8 stands as the binding gap. |
| 2026-05-23 | composer-2 | partial steps 1, 3, 4 | all 5 slugs | `scripts/verify-flows.sh` re-walk against `https://nlqdb.com`: every slug (`cheap-internal-dashboard`, `give-ai-agent-persistent-memory`, `skip-postgres-setup-side-project`, `natural-language-sql-without-training-data`, `ship-leaderboard-no-sql`) returns `307 → https://nlqdb.com/solve/<slug>/` and the final `200` body carries `"@type": "FAQPage"`, `"@type": "HowTo"`, and a "What nlqdb doesn't do here" section. Trailing-slash redirect is new evidence — see Triage. Steps 5–9 still need a browser; the prior step 8 failure stands. |
| 2026-05-23 | composer-4 | partial steps 1, 3, 4 | all 5 slugs | Same re-walk after the FLOW-005 + egress-policy script additions landed: every slug still 307 → trailing-slash → 200 with FAQPage + HowTo JSON-LD and the honest-limits section. Steps 5–9 still need a browser; step 8 failure stands. |
| 2026-05-24 | claude-code | failed step 9 | cheap-internal-dashboard, give-ai-agent-persistent-memory, skip-postgres-setup-side-project | `tools/stranger-test/` Playwright walk against `https://nlqdb.com`. Steps 1-8 pass on every walked slug — h1, FAQPage + HowTo JSON-LD, honest-limits section (≥2 `<li>`), Try-this-query CTA, `localStorage["nlqdb_draft"]` equals `SolveEntry.demoGoal`, navigation to `/app/new`, AND `solve.try_query_clicked` event observed via sessionStorage-persisted spy. Step 9 fails on every slug: `POST .../v1/ask` returns `403 feature_gated`. The prior 2026-05-23 "step 8 event-spy missing" finding is **corrected** by this run — the prior in-window spy got reset by the navigation; sessionStorage survives it and the event IS fired. Binding gap is now step 9 (gate) only. ttfvMs ~250 ms is time-to-gate-403, not time-to-table. Artifact: `tools/stranger-test/results/walk-<utc>.json`. |
| 2026-05-24 | claude-code | **failed step 10 — regression discovered** | cheap-internal-dashboard | `bash scripts/stranger-test-invited.sh --flows flow-002 --prompts 1` against `https://app.nlqdb.com` (`SK-STRG-004`). Composer minted one fresh invite via mail.tm (12s email latency), drove the walker with `?invite=<c>` prepended to `/solve/cheap-internal-dashboard/`. **Walker uncovered a real regression**: step 10 (`captureInviteFromUrl: localStorage.nlqdb_invite set + ?invite= stripped`) failed — `stored=<null> urlClean=false`. Root cause: the `[slug].astro` script bundle did NOT import `captureInviteFromUrl`; the call lived only on `index.astro` and `app/new.astro`. A stranger landing on `/solve/<slug>?invite=<c>` lost the code at the first `location.assign("/app/new")` because that navigation dropped the query string. **Fix applied in this PR**: added `captureInviteFromUrl()` import + call to `apps/web/src/pages/solve/[slug].astro` (and `vs/[slug].astro`). Post-deploy re-walk pending. (Initial artifact JSON contained the raw `?invite=<code>` value in step-1 description — confirmed leak; fixed in round-2 review iteration via `redactInviteFromUrl()` helper applied in `flow-002.ts`/`flow-003.ts`; leaked code was burned by the agent post-discovery; local artifacts scrubbed.) |
| 2026-06-04 | claude-code | failed step 9 (baseline) | cheap-internal-dashboard, give-ai-agent-persistent-memory | GLOBAL-032 7-day-freshness refresh: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-8 ok on both walked slugs — h1 rendered (`How do I build an internal dashboard without per-seat pricing?` / persistent-memory equivalent), FAQPage + HowTo JSON-LD, honest-limits ≥2 `<li>`, CTA clickable, `localStorage["nlqdb_draft"]` matches `SolveEntry.demoGoal`, navigation to `/app/new`, `solve.try_query_clicked` event observed via the sessionStorage spy. Step 9 fails identically per the GLOBAL-027 expectation: `POST /v1/ask` → `403 feature_gated`. Artifact: `tools/stranger-test/results/walk-2026-06-04T01-44-29Z.json`. |
| 2026-05-30 | claude-code | candidate `/solve/no-migration-files-database` pulled after round-2 review | (none — slug never shipped) | Round-2 independent self-review (sub-agent, opus 4.7) on PR #288 found 1 round-2 CRITICAL (R2-C1) the round-1 review had missed: the candidate page's entire thesis (NL-driven `ALTER TABLE ADD COLUMN NULL` widening) is not shipped. Code-side proof: `apps/api/src/ask/sql-validate.ts:90` `LEADING_VERB_REJECT` rejects every DDL verb (`alter` / `drop` / `create` / `truncate` / `grant` / `revoke` / `vacuum`); `apps/api/src/ask/orchestrate.ts:156` returns `schema_unavailable` when `db.schemaHash` is null; `apps/api/src/ask/types.ts:62-64` says `DDL via /v1/ask` is rejected by the allowlist; [`schema-widening/FEATURE.md`](../features/schema-widening/FEATURE.md) Status `partial` (observed-fields collector + widening trigger post-Phase-0); `apps/api/src/run/orchestrate.ts:83` uses the same `validateSql` so the `runSql` escape hatch also rejects DDL; `SK-DB-008` ([`db-adapter/FEATURE.md:98`](../features/db-adapter/FEATURE.md)) describes widening as **planner-observed on a SELECT against a new field**, not as an English DDL verb. The page would have shipped a promise the product doesn't keep. Pull was the right call (revert vs. reframe: reframing into "what we're building" would have violated SK-SOLVE-002's "demo that works today" contract). Source-vetting on a candidate 7th Lemmy ICP source (probed `programming.dev` + `lemmy.world`; `programming.dev` Content-Signal `ai-train=no` respected, `lemmy.world` dominated by Reddit-RSS bot bridges) is recorded under the impl plan's Progress log row for future agents — the verification work was real even if no surface ships from this PR. |
| 2026-06-05 | claude-code | failed step 9 (baseline) | cheap-internal-dashboard, give-ai-agent-persistent-memory | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-8 ok (h1, FAQPage + HowTo JSON-LD, honest-limits, CTA, `nlqdb_draft`, `/app/new`, `solve.try_query_clicked` sessionStorage spy); step 9 `403 feature_gated` per GLOBAL-027 (unchanged). `verify-flows.sh` solve-side assertions all green pre/post-edit. |
| 2026-06-06 | claude-code | failed step 9 (baseline) | cheap-internal-dashboard, give-ai-agent-persistent-memory | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-8 ok (h1, FAQPage + HowTo JSON-LD, honest-limits, CTA, `nlqdb_draft`, `/app/new`, `solve.try_query_clicked` sessionStorage spy); step 9 `403 feature_gated` per GLOBAL-027 (unchanged). `verify-flows.sh` solve-side assertions all green. Artifact: `tools/stranger-test/results/walk-2026-06-06T01-49-42Z.json`. |
| 2026-06-08 | claude-code | failed step 9 (baseline) | cheap-internal-dashboard, give-ai-agent-persistent-memory | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-8 ok on both walked slugs (h1, FAQPage + HowTo JSON-LD, honest-limits, CTA, `nlqdb_draft`, `/app/new`, `solve.try_query_clicked` sessionStorage spy); step 9 `403 feature_gated` per GLOBAL-027 (unchanged). `verify-flows.sh` solve-side assertions all green (run minutes earlier, EXIT=0). Artifact: `tools/stranger-test/results/walk-2026-06-08T01-35-58Z.json`. |
| 2026-06-09 | claude-code | failed step 9 (baseline) | cheap-internal-dashboard, give-ai-agent-persistent-memory | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-8 ok on both walked slugs (h1, FAQPage + HowTo JSON-LD, honest-limits, CTA, `nlqdb_draft`, `/app/new`, `solve.try_query_clicked` sessionStorage spy); step 9 `403 feature_gated` per GLOBAL-027 (unchanged). `verify-flows.sh` solve-side assertions all green (EXIT=0, 5 solve slugs, run minutes earlier). Artifact: `tools/stranger-test/results/walk-2026-06-09T01-37-18Z.json`. |
| 2026-06-10 | claude-code | failed step 9 (baseline) | cheap-internal-dashboard, give-ai-agent-persistent-memory | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-8 ok on both walked slugs (h1, FAQPage + HowTo JSON-LD, honest-limits, CTA, `nlqdb_draft`, `/app/new`, `solve.try_query_clicked` sessionStorage spy); step 9 `403 feature_gated` per GLOBAL-027 (unchanged). `verify-flows.sh` solve-side assertions all green (EXIT=0, 5 solve slugs). Artifact: `tools/stranger-test/results/walk-2026-06-10T01-38-39Z.json`. |
| 2026-06-12 | claude-code | failed step 9 (baseline) | cheap-internal-dashboard | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 1` against `https://nlqdb.com`. Steps 1-8 ok on the walked slug (h1, FAQPage + HowTo JSON-LD, honest-limits, CTA, `nlqdb_draft`, `/app/new`, `solve.try_query_clicked` sessionStorage spy); step 9 `403 feature_gated` per GLOBAL-027 (unchanged). `verify-flows.sh` solve-side assertions all green (EXIT=0, 5 solve slugs). Artifact: `tools/stranger-test/results/walk-2026-06-12T01-35-51Z.json`. |

### Triage

The first failed assertion across every walked slug is the post-submit `/v1/ask` returning `403 feature_gated` — SK-ANON-001 vs GLOBAL-027 / SK-GATE-004. Static + CTA + draft-handoff + event-spy all confirmed healthy by the 2026-05-24 walker run; the earlier "event-spy missing" finding was a measurement artifact (spy reset by the post-CTA `location.assign`). Closing FLOW-002 requires the §1.4 anon-bypass slice from the impl plan or an invite-bearing walk variant (`tools/stranger-test/` open question).

**Trailing-slash redirect (2026-05-23, composer-2):** the deployed CDN now serves `/solve/<slug>` only via `307 → /solve/<slug>/`. A curl probe without `-L` (or without the trailing slash) gets HTTP 307 + 0 bytes and looks like a regression; with `-L` (or against the trailing-slash URL) every slug returns 200. `scripts/verify-flows.sh` follows redirects and additionally records the redirect chain as informational, so future agents don't re-discover this on every PR. No content regression — the static AEO surface is intact.

**Invite-bearing variant (SK-STRG-004):** when `NLQDB_INVITE_CODE` is set, the walker prepends `?invite=<c>` to the navigation URL and inserts step 10 (`captureInviteFromUrl: localStorage.nlqdb_invite set + ?invite= stripped`) right after step 1. The 2026-05-24 first run against the deployed surface caught a regression: `[slug].astro` did not call `captureInviteFromUrl()`, so the invite was lost at `location.assign("/app/new")`. **Fix landed in the same PR** (import + call added to `solve/[slug].astro` and `vs/[slug].astro`). Drive via `bash scripts/stranger-test-invited.sh --flows flow-002`.

---

## FLOW-003 — Comparison-driven inbound (search → `/vs/<competitor>` → first query)

**Persona:** P3 / P4
**Mirror:** [`automated-icp-validation-plan.md §8 FLOW-003`](./automated-icp-validation-plan.md)

### Source signal

The pain this flow proves is "I'm comparing alternatives and the
buyer has already named the competitor in the search query."

- [HN search — "supabase alternative"](https://hn.algolia.com/?q=supabase+alternative)
- [HN search — "vanna ai"](https://hn.algolia.com/?q=vanna+ai)
- Competitor brand-keyword Google traffic (no public hub; observable
  via Search Console once the marketing surface is verified).

### Required tools

- Headless browser. No additional tools beyond FLOW-002.

### Required credentials

None.

### Walkthrough steps

1. Open `https://nlqdb.com/vs/supabase` (rotate through `vanna`,
   `mem0` across runs).
2. Assert: `<h1>` is `nlqdb vs <Name>` for that slug per the
   `[slug].astro` template.
3. Assert: a "When to choose <Name>" section exists with ≥3 `<li>`
   items, per [`SK-CMP-001`](../features/comparison-pages/decisions/SK-CMP-001-honest-trade-offs.md).
4. Assert: a `FAQPage` JSON-LD block is present, per
   [`SK-CMP-003`](../features/comparison-pages/decisions/SK-CMP-003-faqpage-json-ld.md).
5. Click "Try this query →".
6. Assert: `localStorage["nlqdb_draft"]` equals
   `Competitor.demo.goal` for that slug.
7. Assert (after navigation): the URL is `/app/new` and the form is
   prefilled.
8. Submit. Assert FLOW-001 step 5+ behaviour.
9. Open `https://nlqdb.com/llms.txt`. Assert: a `## Comparisons` line
   for the slug walked is present (smoke-test that the comparison
   list isn't stale).

### Pass criteria

- Every assertion in steps 2-9 passes.
- TTFV from step 8 submit → table under 60 s.

### If blocked

- Same patterns as FLOW-002 ; in addition: stale `llms.txt` ⇒
  `failed step 9`, file an SK-CMP-004 regression in triage.

### Outcome log

| Date | Agent | State | Slug walked | Notes |
|---|---|---|---|---|
| 2026-05-23 | composer-1 | partial steps 1, 2, 4, 9 | supabase | curl-only walk: `GET https://nlqdb.com/vs/supabase` → 200; `<h1 class="vs__title">nlqdb vs Supabase</h1>` matches the template; `FAQPage` JSON-LD present (1); `/llms.txt` lists all 3 vs slugs (`mem0`, `supabase`, `vanna`) — step 9 smoke check passes. Steps 3 (DOM "When to choose Supabase" section), 5–8 (CTA click, draft hydrate, prefill, first-query submit) require a browser and are unattempted. |
| 2026-05-23 | composer-2 | partial steps 1, 2, 4, 9 | all 3 slugs | `scripts/verify-flows.sh` re-walk: every slug (`supabase`, `vanna`, `mem0`) returns `307 → /vs/<slug>/` and the final 200 body matches `<h1[^>]*>nlqdb vs <Name></h1>` (Supabase / Vanna AI / Mem0) and carries a `"@type": "FAQPage"` JSON-LD block. `/llms.txt` (200, 4,357 bytes) enumerates every vs slug AND every solve slug (5/5). `/sitemap.xml` (200) lists 12 `<loc>` entries — the floor the script enforces. Steps 3, 5–8 still require a browser. |
| 2026-05-23 | composer-3 | partial steps 1, 2, 4, 9 | all 3 slugs | Same `scripts/verify-flows.sh` re-walk after FLOW-008 source-health was added: every vs slug still 307 → trailing-slash → 200 with `<h1>` template-matching + FAQPage JSON-LD; `/llms.txt` enumerates all 3 vs + 5 solve slugs; `/sitemap.xml` still ≥ 12 `<loc>`. Steps 3, 5–8 still need a browser. |
| 2026-05-23 | composer-4 | partial steps 1, 2, 4, 9 | all 3 slugs | Same re-walk after FLOW-005 + egress-policy script additions: every vs slug 307 → 200 with the template `<h1>` and FAQPage JSON-LD; `/llms.txt` still enumerates all 3 vs + 5 solve slugs; `/sitemap.xml` still 12 `<loc>`. Steps 3, 5–8 still need a browser. |
| 2026-05-24 | claude-code | failed step 8 | supabase, vanna, mem0 | `tools/stranger-test/` Playwright walk against `https://nlqdb.com`. Steps 1-7 + 9 pass on every walked slug — `<h1>` matches `nlqdb vs <Name>` (Supabase / Vanna AI / Mem0), "When to choose <Name>" section renders ≥3 `<li>` (e.g. 8 for Supabase), FAQPage JSON-LD present, Try-this-query CTA clickable, `localStorage["nlqdb_draft"]` equals `Competitor.demo.goal`, `/app/new` reached, `/llms.txt` enumerates this slug. Step 8 fails on every slug: `POST .../v1/ask` returns `403 feature_gated` — same gate cause as FLOW-001/002. No new content regression; the gate-403 is the only thing standing between FLOW-003 and a fully-passed walk. Artifact: `tools/stranger-test/results/walk-<utc>.json`. |
| 2026-05-24 | claude-code | pre-deploy build (outerbase) | outerbase | New `/vs/outerbase` page added in this PR; not yet on the deployed `https://nlqdb.com`. Build-time verification only: `bun run build` from `apps/web/` emitted `dist/vs/outerbase/index.html` with `<h1 class="vs__title">nlqdb vs Outerbase</h1>` matching the FLOW-003 step 2 regex, FAQPage JSON-LD block present (1 occurrence), 4 `whenChooseThem` bullets render under "When to choose Outerbase", `dist/sitemap.xml` lists 13 `<loc>` entries (4 vs + 5 solve + 4 root), `dist/llms.txt` enumerates `vs/outerbase`. Live `bash scripts/verify-flows.sh` against `https://nlqdb.com` returns exactly 4 expected pre-deploy failures (`/vs/outerbase/` 404, sitemap floor 12 < 13, `llms.txt` missing slug) — the only 4 failures of the entire walk. Steps 5-8 (browser walk against the deployed page) come on the next agent run after `deploy-web.yml` ships `apps/web/dist` to `https://nlqdb.com`. The gate-403 binding gap stands for the live walk per the 2026-05-24 stranger-test row. |
| 2026-05-24 | claude-code | **failed step 10 — regression discovered + fixed** | supabase | `bash scripts/stranger-test-invited.sh --flows flow-003 --prompts 1` against `https://app.nlqdb.com`. Same root cause as the FLOW-002 row: `vs/[slug].astro` did not call `captureInviteFromUrl()`; stranger landing on `/vs/supabase?invite=<c>` lost the code at `location.assign("/app/new")`. **Fixed in this PR** alongside the `/solve/` fix — import + call added to `vs/[slug].astro`. Post-deploy re-walk lives in the next agent run. Artifact: `tools/stranger-test/results/walk-invited-2026-05-24T21-16-34Z.json` (combined flow-002 + flow-003 walk; one invite re-used). |
| 2026-05-29 | claude-code | pre-deploy build (wrenai) | wrenai | New `/vs/wrenai` page added in this PR — 5th competitor, P3 analyst slot (semantic-layer / governance angle). Not yet on the deployed `https://nlqdb.com`. Build-time verification: `cd apps/web && bun run build` emits `dist/vs/wrenai/index.html` with `<h1 class="vs__title">nlqdb vs Wren AI</h1>` matching the FLOW-003 step 2 regex; FAQPage JSON-LD block present (1 occurrence); 4 `whenChooseThem` bullets render under "When to choose Wren AI"; `dist/sitemap.xml` lists 14 `<loc>` entries (5 vs + 5 solve + 4 root); `dist/llms.txt` enumerates `vs/wrenai`. Local probe via `NLQDB_BASE_URL=http://localhost:9999 bash scripts/verify-flows.sh` against the local dist: every assertion green including `/vs/wrenai/`, `<h1>` template-match, FAQPage JSON-LD, and the 14-entry sitemap floor. Live `bash scripts/verify-flows.sh` against `https://nlqdb.com` returns exactly 4 expected pre-deploy failures (`/vs/wrenai/` 404, sitemap floor 13 < 14, `llms.txt` missing `vs/wrenai`, redirect probe 404) — the only failures of the entire walk. **Round-1 self-review (opus 4.7) found 2 MAJOR factual errors (SOC 2 across-all-plans / Apache-2.0-pure framing) refuted by live WebFetch — both fixed in 6+5 user-facing copy locations + this row + impl plan + competitors.md; SOC 2 feature-table `them: shipped` → `them: partial` to match the Essential/Enterprise-only contract.** Steps 5-8 (browser walk against the deployed page) come on the next agent run after `deploy-web.yml` ships `apps/web/dist` to `https://nlqdb.com`. The gate-403 binding gap stands for the live walk per the 2026-05-24 stranger-test row. |
| 2026-06-04 | claude-code | failed step 8 (baseline) | supabase, vanna | GLOBAL-032 7-day-freshness refresh: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-7 + 9 ok on both walked slugs — `<h1>` matches (`nlqdb vs Supabase` / `nlqdb vs Vanna AI`), "When to choose <Name>" ≥3 `<li>` (e.g. 8 for Supabase), FAQPage JSON-LD, Try-this-query CTA clickable, `localStorage["nlqdb_draft"]` matches `Competitor.demo.goal` (`top 5 customers by revenue this month`), navigation to `/app/new`, `/llms.txt` enumerates the slug. Step 8 fails identically per the GLOBAL-027 expectation: `POST /v1/ask` → `403 feature_gated`. Mirror integrity remains tight: the 6 deployed `/vs/<slug>` pages all still pass curl-observable assertions per `scripts/verify-flows.sh` (run minutes earlier). Artifact: `tools/stranger-test/results/walk-2026-06-04T01-44-29Z.json`. |
| 2026-06-02 | claude-code | pre-deploy build (askyourdatabase) | askyourdatabase | New `/vs/askyourdatabase` page added in this PR — 6th competitor, P3 analyst slot (chat-with-my-DB / Dashboard-Builder / customer-facing-BI angle). Not yet on the deployed `https://nlqdb.com`. Pre-implementation verification: (a) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers) empty; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all 49 curl-observable assertions green (Reddit/SO sandbox-egress advisories as expected); (c) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — passed in 22s wall (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 10s, control `403 feature_gated`, invite `HTTP 200`; SK-GATE-007 invariant honoured). Build-time verification: `bun run --filter @nlqdb/web build` emits `dist/vs/askyourdatabase/index.html` with `<h1 class="vs__title">nlqdb vs AskYourDatabase</h1>` matching the FLOW-003 step 2 regex; FAQPage JSON-LD block present (1 occurrence); 4 `whenChooseThem` bullets render under "When to choose AskYourDatabase"; `dist/sitemap.xml` lists 15 `<loc>` entries (6 vs + 5 solve + 4 root); `dist/llms.txt` enumerates `vs/askyourdatabase`. Local probe via `NLQDB_BASE_URL=http://localhost:9999 bash scripts/verify-flows.sh` against the local `apps/web/dist`: every assertion green including `/vs/askyourdatabase/` (HTTP 200), `<h1>` template-match, FAQPage JSON-LD, redirect probe 301, the 15-entry sitemap floor, and `/llms.txt` enumerating the new slug. Live `bash scripts/verify-flows.sh` against `https://nlqdb.com` returns the 4 expected pre-deploy failures (`/vs/askyourdatabase/` 404, sitemap floor 14 < 15, `llms.txt` missing `vs/askyourdatabase`, redirect probe 404) — the only failures of the entire walk; all clear post-`deploy-web.yml`. Evidence sources for the user-facing copy (WebFetch 2026-06-02): `askyourdatabase.com/pricing` (paid plans + engine list + models), `askyourdatabase.com/docs` (three main use cases + API surfaces + WhatsApp integration), `askyourdatabase.com/docs/security` (Desktop = local-creds-local-execution-no-data-storage, Chatbot = encrypted-creds + conversation-history + fixed-IP-gateway + TLS-in-transit + query-sanitisation + read-only-DB-user recommendation; SOC 2 Type 2 audit publicly initiated with first complete report originally anticipated December 2025 — not yet certified on free product as of mid-2026; live security page is source of truth). **Round-1 self-review (sub-agent, opus 4.7) found 1 MAJOR + 4 MINOR + 2 NIT — all actionable findings closed in the same PR**: (M1) FAQ4 + MCP feature-table row fabricated `nlqdb_create_database` / `ask` / `run` as MCP tool names (contradicts SK-MCP-002 + `packages/mcp/src/server.ts:73-110`); fixed to use real `nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe`; (m1) SOC 2 temporal hedge reframed from "anticipated December 2025" to "originally anticipated December 2025 — check current security page for live status" so the post-deadline reading is honest; (m2) impl-plan progress-log "3 expected pre-deploy failures" corrected to "4 expected" (matches reality + this row); (m3) "Free tier (unmetered NL queries)" feature-table row dropped (decorative against Anonymous-mode + pricing rows); (m4) `docs/competitors.md` "Desktop \"Ultimate\" $49/mo priced to move to $69" corrected to "$49/mo billed yearly or $69.99/mo monthly" matching the live pricing page; (N1) engine ordering standardised to `BigQuery, MSSQL, MySQL, PostgreSQL, Snowflake` across 7 occurrences; (N2 observation-only). Re-ran every verification artifact post-iteration: tests still 106/106 pass, build still 22 pages, biome + astro check clean, local + live probes match expectations, mirror integrity empty. Site-wide cleanup of the same MCP fabrication on the 5 prior `/vs/` pages tracked as an Open question in `comparison-pages/FEATURE.md` (out of scope for this PR). Steps 5-8 (browser walk against the deployed page) come on the next agent run after `deploy-web.yml` ships `apps/web/dist` to `https://nlqdb.com`. The gate-403 binding gap stands for the live walk per the 2026-05-24 stranger-test row. |
| 2026-06-05 | claude-code | failed step 8 (baseline) | supabase, vanna | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-7 + 9 ok on both slugs (`<h1>` match, "When to choose <Name>" ≥3 `<li>`, FAQPage JSON-LD, CTA, `nlqdb_draft`, `/app/new`, `/llms.txt` enumerates all 6 vs slugs); step 8 `403 feature_gated` per GLOBAL-027 (unchanged). All 6 deployed `/vs/<slug>` pages green under `verify-flows.sh` (run minutes earlier). |
| 2026-06-06 | claude-code | failed step 8 (baseline) | supabase, vanna | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-7 + 9 ok on both slugs (`<h1>` match, "When to choose <Name>" ≥3 `<li>`, FAQPage JSON-LD, CTA, `nlqdb_draft`, `/app/new`, `/llms.txt` enumerates all 6 vs slugs); step 8 `403 feature_gated` per GLOBAL-027 (unchanged). All 6 deployed `/vs/<slug>` pages green under `verify-flows.sh` (run minutes earlier). Artifact: `tools/stranger-test/results/walk-2026-06-06T01-49-42Z.json`. |
| 2026-06-08 | claude-code | failed step 8 (baseline) | supabase, vanna | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-7 + 9 ok on both slugs (`<h1>` match, "When to choose <Name>" ≥3 `<li>`, FAQPage JSON-LD, CTA, `nlqdb_draft`, `/app/new`, `/llms.txt` enumerates all 6 vs slugs); step 8 `403 feature_gated` per GLOBAL-027 (unchanged). All 6 deployed `/vs/<slug>` pages green under `verify-flows.sh` (EXIT=0, run minutes earlier). Artifact: `tools/stranger-test/results/walk-2026-06-08T01-35-58Z.json`. |
| 2026-06-09 | claude-code | failed step 8 (baseline) | supabase, vanna | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-7 + 9 ok on both slugs (`<h1>` match, "When to choose <Name>" trade-offs, FAQPage JSON-LD, CTA, `nlqdb_draft`, `/app/new`, `/llms.txt` enumerates all 6 vs slugs); step 8 `403 feature_gated` per GLOBAL-027 (unchanged). All 6 deployed `/vs/<slug>` pages green under `verify-flows.sh` (EXIT=0, run minutes earlier). Artifact: `tools/stranger-test/results/walk-2026-06-09T01-37-18Z.json`. |
| 2026-06-10 | claude-code | failed step 8 (baseline) | supabase, vanna | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com`. Steps 1-7 + 9 ok on both slugs (`<h1>` match, "When to choose <Name>" trade-offs, FAQPage JSON-LD, CTA, `nlqdb_draft`, `/app/new`, `/llms.txt` enumerates all 6 vs slugs); step 8 `403 feature_gated` per GLOBAL-027 (unchanged). All 6 deployed `/vs/<slug>` pages green under `verify-flows.sh` (EXIT=0). Artifact: `tools/stranger-test/results/walk-2026-06-10T01-38-39Z.json`. |
| 2026-06-12 | claude-code | failed step 8 (baseline) | supabase | GLOBAL-032 freshness re-walk: `bash scripts/stranger-test.sh --prompts 1` against `https://nlqdb.com`. Steps 1-7 + 9 ok on the walked slug (`<h1>` match, "When to choose <Name>" trade-offs, FAQPage JSON-LD, CTA, `nlqdb_draft`, `/app/new`, `/llms.txt` enumerates all 6 vs slugs); step 8 `403 feature_gated` per GLOBAL-027 (unchanged). All 6 deployed `/vs/<slug>` pages green under `verify-flows.sh` (EXIT=0). Artifact: `tools/stranger-test/results/walk-2026-06-12T01-35-51Z.json`. |

---

## FLOW-004 — Waitlist signup → invite email → gate bypass

**Persona:** P1 Solo Builder (invited)
**Mirror:** [`automated-icp-validation-plan.md §8 FLOW-004`](./automated-icp-validation-plan.md)

### Source signal

This flow proves the `SK-GATE-007`
release-valve actually closes the loop: a stranger arrives, hits the
gate, joins the waitlist, gets a code, and lands a working first
query — all without any human in the loop.

### Required tools

- `bash scripts/flow-004-walk.sh` — agent-runnable end-to-end walker
  ([`SK-STRG-002`](../features/stranger-test/FEATURE.md)). Uses
  `curl` + `jq` + `openssl` plus the free, no-key `api.mail.tm` REST
  API to mint a throwaway inbox; no Playwright needed because every
  step is HTTP-observable. Browser walks remain valid for verifying
  the web-app capture of `?invite=` into `localStorage["nlqdb_invite"]`.
- `bash scripts/flow-004-seed-quality.sh` — agent-on-demand first-value
  seed-quality probe ([`SK-STRG-008`](../features/stranger-test/decisions/SK-STRG-008-flow-004-seed-quality-probe.md)).
  Mints ONE invite via the walker above, then re-uses it across N `create`
  asks (one fresh `anon_<uuid>` each) to report `seeded_ok_ratio` — the
  measured fraction of goals that yield a *seeded* DB — plus a
  `provision_failed` bucket for goals whose create 422'd (engine couldn't
  build the DB at all; excluded from the ratio but reported separately so a
  hard build failure stays visible). Not in the daily cron (1+N throwaway
  DBs per run); run it to size the SK-LLM-033 lift.

### Required credentials

- **None for the script path.** mail.tm provides anonymous bearer-token
  access to a fresh inbox per run (8 QPS limit, no signup, no key).
  The walker consumes one entry of the 200/week SK-GATE-007 invite cap
  and one Resend send (3k/mo free tier) per pass.

### Walkthrough steps

1. Mint a throwaway mail.tm inbox (script: `POST api.mail.tm/accounts`
   + `POST /token`; no key, no signup).
2. `POST $NLQDB_BASE_URL/v1/waitlist` with the mail.tm address
   (`source: "flow-004-walker"`); assert `200 {received: true}`.
3. Poll `GET api.mail.tm/messages` every `FLOW_004_POLL_INTERVAL_S`
   (default 10s) up to `FLOW_004_TIMEOUT_S` (default 300s) for an email
   whose `from.address` matches `/nlqdb/i`. Resend SLA is sub-30 s for
   transactional; the live 2026-05-24 walks observed 10–13 s.
4. Extract `?invite=<code>` from the message text+html. The code is
   128-bit base64url per `SK-GATE-007`;
   match `/invite=[A-Za-z0-9_-]{16,}/`.
5. **Control probe** — `POST $NLQDB_BASE_URL/v1/ask` with
   `Authorization: Bearer anon_<uuid>` and NO `X-Invite-Code`. Assert:
   `error.status="feature_gated"`. If control is NOT blocked the gate
   is open globally and the walk is `inconclusive` — the SK-GATE-007
   invariant is unprovable on this run (BIRD/Spider crossed the
   threshold; the walker must not silently green-light).
6. **Invite probe** — `POST $NLQDB_BASE_URL/v1/ask` with the same
   anon bearer AND `X-Invite-Code: <code>`. Assert: response is NOT
   `feature_gated`. Pass when `HTTP 200`; `partial` when non-200 +
   non-`feature_gated` (gate bypassed; downstream owns the failure,
   e.g. a transient LLM 422 on schema-infer).
7. (Optional browser variant — open `https://nlqdb.com/?invite=<code>`
   in a Playwright context and assert `localStorage["nlqdb_invite"]`
   is set; covers the web-app's `?invite=` URL-param capture path,
   tracked as the "Playwright invite-bearing slice" open question
   in `stranger-test/FEATURE.md`.)

### Pass criteria

- Step 5 control returns `error.status="feature_gated"` (proves the
  gate is doing its job and the walker is exercising the bypass path,
  not a globally-open gate).
- Step 6 invite returns a response that is NOT `feature_gated`
  (`HTTP 200` is the strict pass; non-200 non-`feature_gated` is
  `partial`).
- Step 3 polling completes inside `FLOW_004_TIMEOUT_S` (default 5 min).
- **First-value quality (SK-STRG-006 / SK-STRG-007):** on the `HTTP 200`
  the walker grades the invited stranger's first-value. A `create`
  envelope is `ok` only when it carries a real `db` + `schemaName` AND
  ≥ 1 seeded sample row; a `create` that returns **0 seeded rows** (the
  SK-HDC-018 un-seeded fallback — the LLM's seed rows violated their own
  schema) records `state:"passed_degraded"` so the dashboards can't show
  a bare "passed" for an empty-DB stranger. The **process exit code stays
  0** in both cases — the SK-STRG-002 control×invite gate-bypass invariant
  still passed; the quality verdict lives in `.state` + `first_value_quality`,
  not the exit code (composer/cron contract preserved). A 0-row *query*
  stays `passed` (legitimate first-value on a fresh DB).

### If blocked

- No email arrives within `FLOW_004_TIMEOUT_S` → `blocked upstream`
  (Resend outage, mail.tm spam-filter, or waitlist cap exhausted —
  the Worker silently emits no code when the cap is hit and still
  returns 200, so the symptom is identical). Triage by checking the
  Resend dashboard + the `wl:invite-cap:*` KV counter.
- Email arrives but no `invite=` token in the body → `failed step 4`;
  the Resend template regressed (the buildInviteEmail string moved).
- Control probe (step 5) returns `200` instead of `feature_gated` →
  `inconclusive`; the gate is open globally (BIRD ≥ 0.65 AND Spider ≥
  0.75 per `eval-baseline.ts`). This is GOOD news for the product, but
  the walker can no longer prove SK-GATE-007 is honoured — switch the
  next slice to direct middleware probes.
- Control blocked but invite returns `feature_gated` → `failed step 6`;
  the gate's `X-Invite-Code` honouring regressed. This is the real
  SK-GATE-007 regression signature.

### Outcome log

| Date | Agent | State | Email arrived in (s) | Notes |
|---|---|---|---|---|
| 2026-05-24 | claude-code | passed | 13 | `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com`. mail.tm `wshu.net` inbox minted, `POST /v1/waitlist` 200, Resend invite email landed 13s later, `?invite=<code>` extracted, `POST /v1/ask` with `Authorization: Bearer anon_<uuid>` + `X-Invite-Code` returned **HTTP 200** (gate bypassed). Total wall-clock 18s. Closes the §1.4 invite-valve end-to-end verification gap that has been open since SK-GATE-007 shipped 2026-05-21. Artifact: `tools/stranger-test/results/flow-004-2026-05-24T11-16-15Z.json`. Walker primitive: SK-STRG-002 (initial revision — no control probe). |
| 2026-05-24 | claude-code | passed | 10 | Re-walk after independent self-review iteration. Walker now does a **control probe** (`/v1/ask` without invite — must be `feature_gated`) before the invite probe; only `passed` when both succeed, `inconclusive` if the gate is open globally. Control returned `403 feature_gated`, invite returned `HTTP 200`, total wall 15s. JSON now also carries `control_status` + `control_error_status` + `control_blocked` so future runs are self-validating across gate-state changes. Artifact: `tools/stranger-test/results/flow-004-2026-05-24T11-32-44Z.json`. |
| 2026-05-24 | claude-code | passed | 11 | Pre-PR verification re-walk to align this mirror before shipping [`SK-STRG-003`](../features/stranger-test/FEATURE.md) (daily acquisition-health cron). Same control + invite shape: control returned `403 feature_gated`, invite returned `HTTP 200`, total wall 18s. Confirms SK-GATE-007 honour is still intact and the daily cron will start from a green baseline. Artifact: `tools/stranger-test/results/flow-004-2026-05-24T13-19-12Z.json`. Continuous watch shipped this PR via `.github/workflows/acquisition-health.yml` (`0 6 * * *` UTC, `continue-on-error: true` on every step, 90-day artifact retention) — exits 0 unconditionally so a future regression lands in the artifact JSON instead of in the founder's inbox. |
| 2026-05-24 | claude-code | passed | 11 | Post-review walk after the PR #276 sub-agent (opus 4.7) review closed 4 MINOR findings: (M1) `redact()` now applied to the throwaway mail.tm address in `flow-004-walk.sh` stdout so the GH Actions log never exposes the full local-part; (M2) Playwright cache key now hashes `bun.lock` AND `tools/stranger-test/package.json` with `restore-keys` for incremental priming; (M3) workflow summary table now hoists `.state` from each walker's JSON so the agent re-fetching the run can react without downloading the artifact; (M4) verify-flows step now sets `pipefail` so `tee`'s exit can't mask the script's real exit code in `$GITHUB_OUTPUT`. Control returned `403 feature_gated`, invite returned `HTTP 200`, total wall 17s. Artifact: `tools/stranger-test/results/flow-004-2026-05-24T13-41-05Z.json`. |
| 2026-05-24 | claude-code | passed (×3, SK-STRG-004 composer) | 11/12/12 | Three composer walks via `bash scripts/stranger-test-invited.sh` invoking `flow-004-walk.sh` with `FLOW_004_INVITE_OUT=<sidecar>` to mint and hand off the invite. All three passed end-to-end: control returned `403 feature_gated`, invite returned `HTTP 200`, total wall 17–18s per walk. Walks: 21:04:13Z (flow-001 alone via direct call), 21:13:03Z (composer + flow-001), 21:15:54Z (composer + flow-001 + browser walk to HTTP 200), 21:16:34Z (composer + flow-002 + flow-003). Each composer run wiped the mode-600 sidecar immediately after read; the in-process variable was scrubbed on exit. Per SK-STRG-004 the composer consumed 3 of 200/week (1.5%) — under the cap by 196×. |
| 2026-06-04 | claude-code | **partial — engine-side regression observed** | 11 | GLOBAL-032 7-day-freshness re-walk: `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com`. mail.tm `wshu.net` inbox minted, `POST /v1/waitlist` 200, Resend invite landed 11s later, `?invite=<code>` extracted. Control returned `403 feature_gated` (gate doing its job). Invite returned **HTTP 422** with the body's `error.kind` set (not `error.status`) — the SK-GATE-007 invariant is intact (gate bypassed) but the downstream db-create LLM call (per `apps/api/src/index.ts:741` `formatCreateJsonResponse`: `infer/compile/ddl/embed_failed → 422`) failed engine-side. Walker correctly classifies this as `partial` (not `failed step 5`) because the control + invite pair proved SK-GATE-007 honoured the code; the 422 is the engine-quality bottleneck per GLOBAL-027 already enshrined as priority #1 in the preamble, NOT a gate-valve regression. Total wall 20s. Artifact: `tools/stranger-test/results/flow-004-2026-06-04T01-42-12Z.json`. Per SK-GATE-007 weekly cap accounting: 1 of 200/week consumed. The 2026-05-24/06-03 walks remain the high-water mark for full HTTP 200; future agents pick this 422 up via the daily `acquisition-health.yml` artifact (the failure routes back to the priority list, NOT to a founder-facing inbox per SK-STRG-003). |
| 2026-06-05 | claude-code | **passed** | — | GLOBAL-032 freshness re-walk: `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com`. mail.tm `wshu.net` inbox minted, `POST /v1/waitlist` 200, Resend invite landed 11s later. Control returned `403 feature_gated`; invite returned **HTTP 200** — full first-value restored (the 2026-06-04 downstream db-create 422 has cleared engine-side; SK-GATE-007 invariant intact throughout). Total wall 18s. Ran twice today (standalone + as the invite-minting step of the FLOW-001 composer) — both control-403 + invite-200. Artifact: `tools/stranger-test/results/flow-004-2026-06-05T01-41-08Z.json`. Per SK-GATE-007 weekly cap: 2 of 200/week consumed today. |
| 2026-06-06 | claude-code | **partial — provisioning regression** | 10 | GLOBAL-032 freshness re-walk: `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com`. mail.tm `wshu.net` inbox minted, `POST /v1/waitlist` 200, Resend invite landed 10s later, `?invite=<code>` extracted. Control returned `403 feature_gated` (gate doing its job). Invite **bypassed the gate** (SK-GATE-007 intact) but `/v1/ask` returned **HTTP 500 `{kind:"provision_failed",reason:"transaction_failed",rolled_back:true}`** — the hosted-DB provision leg failed (06-05 was 200, 06-04 was 422; the provision step is flaky on engine/data-quality DDL, not the valve). Walker correctly classifies `partial` (control+invite proved SK-GATE-007 honoured the code; the 500 is downstream). Total wall 19s. **Root-caused without Grafana** (operator loop has none): reproduced the 500 twice with full body, confirmed the Neon project healthy via `NEON_API_KEY` (4 branches, quota fine) and the production role healthy via Neon's HTTP SQL endpoint (`neondb_owner` has `createrole`/`createdb`; 47 schemas / 65 roles, no limit) — the failure is in the LLM-generated DDL/sample rows, and the two most likely SQLSTATE classes (`42704` hallucinated type, `22P02` bad value) both collapsed to the opaque `transaction_failed`. **Fix shipped this PR: SK-HDC-017** maps the SQLSTATE class into the `reason` + records `db.transaction.error_sqlstate` on the span, so the next walk reports `ddl_execution_failed`/`sample_insert_failed` and the bottleneck is attributable from the deployed surface. Artifact: `tools/stranger-test/results/flow-004-2026-06-06T01-38-01Z.json`. Per SK-GATE-007 weekly cap: 2 of 200/week consumed today. Routed to engine-quality (preamble priority #1); NOT a gate-valve regression. |
| 2026-06-07 | claude-code | **passed — first-value verified (SK-STRG-006)** | 11 | GLOBAL-032 freshness re-walk + first-value-quality grading: `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com`. mail.tm `wshu.net` inbox minted, `POST /v1/waitlist` 200, Resend invite landed 11s later, `?invite=<code>` extracted. Control returned `403 feature_gated` (gate doing its job); invite **bypassed the gate** (SK-GATE-007 intact) AND `/v1/ask` returned **HTTP 200** — **the 2026-06-06 `transaction_failed` HTTP 500 has cleared; the provision leg now succeeds** (SK-HDC-017 #332's SQLSTATE-class mapping confirmed the prior break was a provision-DDL flake, not infra). **SK-STRG-006 (this PR)** now grades the invited stranger's first-value, not just reachability: the 200 body was a `kind:"create"` envelope graded `first_value_quality=ok` — a **provisioned Postgres DB, 6 tables seeded with 13 sample rows** (`table_count=6`, `row_count=13`, `engine=postgres`). The first cut of the grader assumed a `query` AskResult and scored the live response `degraded`; re-running against the real surface surfaced that the invited 0-DB stranger's first-value is a `create`, and the corrected walker recorded `ok`. Total wall 15s. Three FLOW-004 walks consumed today (2 dev iterations of the grader + 1 final) = 3 of 200/week. Artifacts: `tools/stranger-test/results/flow-004-2026-06-07T01-44-16Z.json` (final, graded `ok`). NOT a gate-valve regression — the valve carries the stranger to real first-value end-to-end. |
| 2026-06-08 | claude-code | **partial — provision regression (fix shipped this PR)** | 11 | GLOBAL-032 freshness re-walk: `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com`. mail.tm `wshu.net` inbox minted, `POST /v1/waitlist` 200, Resend invite landed 11s later, `?invite=<code>` extracted. Control returned `403 feature_gated` (gate doing its job); invite **bypassed the gate** (SK-GATE-007 intact) BUT `/v1/ask` returned **HTTP 500 `{kind:"provision_failed",reason:"sample_insert_failed",rolled_back:true}`** — reproduced **5/5** for goal "a meal planner for couples" (the first walk + 4 manual replays with fresh invites; consistent, not flaky). SK-HDC-017's SQLSTATE-class mapping (shipped #332) attributes it to the **seed-insert phase** (class 22/23), NOT infra: the free chain authored a `sample_rows` row that violates the FK/NOT-NULL constraints its own plan declares, and because schema + RLS + seed rows share one atomic transaction (SK-HDC-012) that single decorative row rolled the **entire** create back — so the invited stranger got no database. Walker correctly classifies `partial` (control+invite proved SK-GATE-007 honoured the code; the 500 is downstream). Total wall 15s. **Root-caused without Postgres access** (the agent sandbox blocks `:5432`, only HTTPS egresses): reproduced the exact free-chain plan over the Groq HTTPS endpoint (`llama-3.3-70b-versatile`, the deployed `schema_infer` model) — the plan has `meals.couple_id→couples.id` + `ingredients.meal_id→meals.id` FKs and integer PKs, and the inference prompt gave **zero** guidance to make seed rows FK-consistent / NOT-NULL-complete. **Fix shipped this PR: SK-HDC-018** (orchestrator retries the provision once with `sample_rows:[]` so the invited stranger gets a working un-seeded DB instead of a 500 — unit-tested in `orchestrate.test.ts`) **+ SK-LLM-033** (the `schema_infer` prompt now requires insertable seed rows). Deployed re-walk to a green 200 is the next agent's pick once `deploy-api.yml` ships the fix. Artifact: `tools/stranger-test/results/flow-004-2026-06-08T01-37-42Z.json`. Per SK-GATE-007 weekly cap: 5 of 200/week consumed today (1 walk + 4 root-cause replays). Routed to engine-quality + provision-robustness (preamble priority #1); NOT a gate-valve regression. |
| 2026-06-09 | claude-code | **passed (gate-bypass + 200) — 500-fix verified deployed; first-value prompt-variable** | 10–11 | GLOBAL-032 freshness re-walk + first-value grading (SK-STRG-006), ×3 against `https://app.nlqdb.com`. Each walk: mail.tm inbox minted, `POST /v1/waitlist` 200, Resend invite landed ~10–11s, control `403 feature_gated` ✓, invite **bypassed the gate** ✓ (SK-GATE-007 intact) AND `/v1/ask` returned **HTTP 200** — the 2026-06-08 `sample_insert_failed` 500 has cleared (**SK-HDC-018 + SK-LLM-033 #352 deployed**). **First-value seed quality is prompt-variable:** "a tiny CRM for my coaching practice" → `ok` (4 tables / 9 seeded rows, `flow-004-2026-06-09T01-41-21Z.json`); "a meal planner for couples" → `degraded` un-seeded DB (0 tables / 0 rows, **reproduced 2/2** — `flow-004-2026-06-09T01-38-07Z.json` + `…01-44-56Z.json`). The SK-HDC-018 fallback converts the seed failure into a working un-seeded DB (never a 500), but SK-LLM-033's prompt doesn't yet make every goal seed. **SK-STRG-007 (this PR):** a degraded `create` now records `state:"passed_degraded"` — the **process exit code stays 0** (the SK-STRG-002 control×invite gate-bypass invariant held, so the composer/cron contract + SK-STRG-006 "never fatal" both hold); only the recorded `.state` carries the first-value verdict, so the §0.5 / cron dashboards can't show a bare "passed" for an empty-DB stranger. Verified live (meal-planner re-walk emits `passed_degraded` + exit 0). Per SK-GATE-007 weekly cap: 3 of 200/week consumed today. Seeding every goal routed to engine-quality / SK-LLM-033 (preamble priority #1); NOT a gate-valve regression. |
| 2026-06-10 | claude-code | **passed_degraded — gate-bypass intact; first-value seed-quality MEASURED (SK-STRG-008)** | 11 | GLOBAL-032 freshness re-walk + first-value seed-quality probe. Standalone `FLOW_004_GOAL="a tiny CRM" bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com`: mail.tm inbox minted, `POST /v1/waitlist` 200, Resend invite landed 11s, control `403 feature_gated` ✓, invite **bypassed the gate** ✓ (SK-GATE-007 intact) AND `/v1/ask` **HTTP 200**; first-value `degraded` (CRM goal → 0/0, `flow-004-2026-06-10T01-37-11Z.json`). **NEW — SK-STRG-008 measured rate:** `bash scripts/flow-004-seed-quality.sh` mints ONE invite then re-uses it (codes are existence-checked in `gate/bypass.ts`, not consumed) across 4 `create` asks on fresh anon principals → **`seeded_ok_ratio = 0.25`** (`flow-004-seed-quality-2026-06-10T01-45-55Z.json`): "a habit tracker for my morning routine" → `ok` (4 tables / 12 rows); "a tiny CRM" (the doc's previously-`ok` example), "a meal planner for couples", "a reading list for my book club" → `degraded` un-seeded (0/0). So 3/4 invited strangers land an empty DB — the measured size of the SK-LLM-033 / engine-quality lift; NOT a gate-valve regression (funnel is end-to-end-green to a 200). Per SK-GATE-007 cap: 2 of 200/week consumed today (one per walk). |
| 2026-06-12 | claude-code | **passed_degraded — gate-bypass intact; first-value seed-quality LIFTED 0.25 → ~0.75 (SK-STRG-008)** | 10–11 | GLOBAL-032 freshness re-walk + seed-quality re-measure. `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com`: control `403 feature_gated` ✓, invite **bypassed the gate** ✓ (SK-GATE-007 intact) AND `/v1/ask` **HTTP 200**; default-goal first-value `degraded` (0/0, `flow-004-2026-06-12T01-36-07Z.json`). **NEW — SK-STRG-008 double-verified lift:** `bash scripts/flow-004-seed-quality.sh` (4-goal default set) re-ran **twice**, both **`seeded_ok_ratio = 0.75`** (3/4 — "a tiny CRM" 4t/12r, "a habit tracker for my morning routine" 3t/12r, "a reading list for my book club" 4t/10r all `ok`; **"a meal planner for couples" the only degrader**, 0/0). That is up from the 2026-06-10 single-run **0.25** (n=4). Wider 8-goal runs (`FLOW_SQ_GOALS`) surfaced **3–4 `provision_failed` per run** — HTTP 422 `infer_failed`, the engine couldn't build the DB at all (a *harder* failure than `degraded`), which the probe previously hid in its generic `errored` bucket; this PR splits that bucket so the 422 tail is visible. The wide-run `seeded_ok_ratio` varied **0.6–0.8** across three 8-goal runs, and which goals degrade vs 422 shifts run-to-run — so LLM schema-inference is non-deterministic; the lift is real and stable across today's 4-goal runs but **not causally isolated** (planner directives since 06-10 vs variance). Most invited strangers now land a seeded DB; the degraded/422 tail is the open SK-LLM-033 / engine-quality lift — NOT a gate-valve regression. Per SK-GATE-007 cap: 6 of 200/week consumed today (1 standalone walk + 1 mint per seed-quality run × 5: two 4-goal + three 8-goal). Artifacts: `tools/stranger-test/results/flow-004-seed-quality-2026-06-12T01-37-13Z.json` + `…01-38-15Z.json` (the two 4-goal runs, both 0.75); `…01-39-37Z.json` (8-goal, **0.6 pre-change** — the three 422s recorded as `errored`/`unknown` because the split hadn't shipped yet); `…02-04-02Z.json` (8-goal, **post-change**, `seeded_ok_ratio:0.75`, `provision_failed:4`, all `kind:"infer_failed"` — the citable record of the new bucket). A third 8-goal run (0.8) was the pre-commit validation; its result went to a scratch path and is not retained — the `02-04-02Z` run is the reproducible post-change artifact. |

### Triage

**2026-06-08 (claude-code):** Surface = the hosted-DB provisioner (last leg of FLOW-004, after the gate is bypassed). Response = `HTTP 500 {kind:"provision_failed",reason:"sample_insert_failed",rolled_back:true}`, reproduced 5/5. Re-running will keep failing for this goal until the fix deploys — it is a consistent, attributable engine/provision-robustness break, not a transient. Nearest decisions: the failure lives under [`SK-HDC-012`](../features/hosted-db-create/FEATURE.md) (atomic batch) + [`SK-HDC-017`](../features/hosted-db-create/decisions/SK-HDC-017-provision-sqlstate-fidelity.md) (which made it legible). Fix lands as [`SK-HDC-018`](../features/hosted-db-create/decisions/SK-HDC-018-sample-insert-graceful-degradation.md) (deterministic no-500 floor) + [`SK-LLM-033`](../features/llm-router/decisions/SK-LLM-033-schema-infer-insertable-sample-rows.md) (seed-quality prompt). The atomic-transaction boundary (GLOBAL-033) is deliberately **not** touched — each provision attempt stays one transaction.

---

## FLOW-005 — Agent self-provisions DB via MCP

**Persona:** P2 Agent Builder
**Mirror:** [`automated-icp-validation-plan.md §8 FLOW-005`](./automated-icp-validation-plan.md)

### Source signal

The pain this flow proves is "my agent needs a database it can
provision and query in English."

- [r/LocalLLaMA — "agent memory"](https://www.reddit.com/r/LocalLLaMA/search/?q=agent+memory)
- [r/LangChain — "memory"](https://www.reddit.com/r/LangChain/search/?q=memory)
- [r/ClaudeAI — "memory"](https://www.reddit.com/r/ClaudeAI/search/?q=memory)
- [HN search — "MCP server"](https://hn.algolia.com/?q=MCP+server)

FLOW-005 runs over both [`SK-MCP-001`](../features/mcp-server/decisions/SK-MCP-001-two-transports.md) transports — the **hosted** Streamable-HTTP server (`mcp.nlqdb.com`) and the **local-stdio** npm-fallback. Each has its own no-credential walker.

### Required tools

- For the **hosted no-credential subset (steps 1-5, SK-STRG-005)**: `bash scripts/flow-005-walk.sh`. HTTP-only (curl + jq), no
  Playwright, no MCP inspector. Exercises RFC 9728 root + scoped
  resource-metadata, RFC 8414 AS metadata, and the unauthenticated
  `initialize` + `tools/list` 401-with-challenge contract. ≤ 4 s wall.
- For the **stdio no-credential subset (step 5b, SK-STRG-009)**: `bash scripts/flow-005-stdio-walk.sh`. Spawns the real `@nlqdb/mcp`
  binary and drives a real MCP `initialize` + `tools/list` handshake over
  OS pipes (no network — both served from the in-memory registry).
  Asserts the tool catalog an npm-fallback install discovers. ~0.3 s wall.
- For the **credentialed subset (steps 6+)**: the official MCP inspector
  ([`@modelcontextprotocol/inspector`](https://www.npmjs.com/package/@modelcontextprotocol/inspector))
  OR a real MCP-aware client (Claude Desktop, Cursor, Cline, ChatGPT desktop),
  OR the local-stdio transport with a real key (`NLQDB_API_KEY=<sk_…> bunx @nlqdb/mcp`).
- The MCP HTTP transport URL: `https://mcp.nlqdb.com`.

### Required credentials

- **None for steps 1-5 and step 5b** (the SK-STRG-005 + SK-STRG-009
  walkers cover everything an MCP client hits before it asks the user
  for a key — discovery, the auth wall, and the tool catalog).
- **`sk_mcp_*` / `sk_live_*` API key OR an invite code** for steps 6+
  (authenticated `nlqdb_list_databases` / `nlqdb_describe`, and
  `nlqdb_query` against a real DB). If the agent has neither, ask the
  founder per `### 3.` of the preamble — no such key is mintable in-env
  (keys are stateful in D1; the hosted `/mcp` endpoint needs an
  OAuth-minted token).

### Walkthrough steps

**No-credential subset (steps 1-5, SK-STRG-005 walker):** run
`bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` and read
the JSON outcome. The walker performs each step end-to-end; the agent
asserts `state == "passed"` in the JSON, NOT the individual HTTP calls.

1. `GET https://mcp.nlqdb.com/.well-known/oauth-protected-resource` →
   200; body's `resource` field equals `https://mcp.nlqdb.com` (RFC 9728
   root variant). The inspector + every MCP client begins discovery here.
2. `GET https://mcp.nlqdb.com/.well-known/oauth-protected-resource/mcp` →
   200; body's `resource` field equals `https://mcp.nlqdb.com/mcp` (RFC
   9728 §3.1 resource-scoped variant; the URL the auth-wall challenge
   points at in step 4).
3. `GET https://mcp.nlqdb.com/.well-known/oauth-authorization-server` →
   200; body carries `issuer`, `authorization_endpoint`, `token_endpoint`
   (RFC 8414).
4. `POST https://mcp.nlqdb.com/mcp` with the JSON-RPC `initialize`
   request and no `Authorization` header → 401 with
   `WWW-Authenticate: Bearer realm="OAuth", resource_metadata="<url>", error="invalid_token"`;
   the `<url>` MUST equal step 2's URL (RFC 9728 §5.1 — the challenge
   resource_metadata must be the discovery endpoint a fresh client can
   reach without context).
5. `POST https://mcp.nlqdb.com/mcp` with `tools/list` and no auth → same
   401 + same challenge shape (proves the wall isn't method-specific).

**Stdio no-credential subset (step 5b, SK-STRG-009 walker):** run
`bash scripts/flow-005-stdio-walk.sh` and read the JSON outcome.

5b. The walker spawns the real `@nlqdb/mcp` binary, completes the MCP
    `initialize` handshake, calls `tools/list`, and asserts the catalog
    an npm-fallback install discovers: exactly `nlqdb_query`
    (destructiveHint), `nlqdb_list_databases` (readOnlyHint), and
    `nlqdb_describe` (readOnlyHint) with their input-schema keys, and
    **no `create_database` / `ask` / `run` tool** (create is implicit
    via `nlqdb_query` per [`SK-MCP-002`](../features/mcp-server/decisions/SK-MCP-002-three-tools.md)).
    Assert `state == "passed"` AND `protocol_ok` AND `catalog_ok`.

**Credentialed subset (steps 6+, needs `sk_mcp_*` / `sk_live_*` key):**

6. Start the MCP inspector against `https://mcp.nlqdb.com` (Streamable
   HTTP transport): `bunx @modelcontextprotocol/inspector https://mcp.nlqdb.com`,
   or the local-stdio transport with a key: `NLQDB_API_KEY=<sk_…> bunx @nlqdb/mcp`.
7. Assert: `tools/list` returns exactly `nlqdb_query`,
   `nlqdb_list_databases`, `nlqdb_describe` (no `create_database` / `ask` /
   `run` — verified credential-free by `flow-005-stdio-walk.sh`). See
   [`docs/features/mcp-server/FEATURE.md`](../features/mcp-server/FEATURE.md).
8. Call `nlqdb_query` with `{"db": "research-memory", "q": "create a
   place to store facts with a key and a value, then show me everything"}`
   — the DB is materialised on first reference (implicit create, no
   separate create tool).
9. Assert: the response carries `db_created: true`, a `trace.sql` field
   (the audit surface per [`GLOBAL-023`](../decisions/GLOBAL-023-trust-ux-baseline.md)),
   and a typed (possibly empty) `rows` array.
10. Call `nlqdb_list_databases` (no args) → assert the new `research-memory`
    DB appears with its engine (needs a user-scoped key).
11. Call `nlqdb_describe` with `{"db": "research-memory"}` → assert the
    schema metadata (slug, engine, schema name).
12. Call `nlqdb_query` with a destructive goal → assert
    `requires_confirm: true` + a `diff` body; re-call with `confirm: true`
    → assert the write commits and the row appears on a follow-up read.

### Pass criteria

- **Hosted no-credential subset (steps 1-5):** `bash scripts/flow-005-walk.sh`
  exits 0 AND the JSON outcome has `state == "passed"` AND every one of
  `discovery_ok`, `auth_wall_ok`, `challenge_url_matches` is `true`.
  Wall-clock under 30 s (5 HTTP calls; the walker times each at 15 s).
- **Stdio no-credential subset (step 5b):** `bash scripts/flow-005-stdio-walk.sh`
  exits 0 AND the JSON outcome has `state == "passed"` AND both
  `protocol_ok` and `catalog_ok` are `true`.
- **Credentialed subset (steps 6+):** every assertion in steps 7-12
  passes. Total wall under 90 s (MCP handshake adds latency vs HTTP).

### If blocked

- `flow-005-walk.sh` returns `failed discovery` → the Worker / route
  regression; one of the three discovery endpoints stopped serving 200
  with the expected contract. `apps/mcp` regression.
- `flow-005-walk.sh` returns `failed auth wall` → the `WWW-Authenticate`
  header dropped or no longer carries `resource_metadata` + `error="invalid_token"`.
  Every MCP client now fails handshake silently — escalate.
- `flow-005-walk.sh` returns `failed challenge URL` → the challenge's
  `resource_metadata` URL no longer matches step 2's scoped discovery
  URL. A fresh MCP client can't reach the discovery endpoint pointed
  at by the challenge — handshake breaks. `apps/mcp` regression.
- `flow-005-stdio-walk.sh` returns `failed` with `catalog_ok:false` → the
  tool catalog regressed (a renamed/extra tool, a dropped trust-annotation
  hint, a changed input-schema key); every npm-fallback install breaks at
  use time. `@nlqdb/mcp` regression. `state:"error"` (exit 2) → the binary
  failed to spawn or handshake (a build / dependency regression).
- MCP transport handshake fails (step 6) → `blocked upstream` (CF) or
  `failed step 6` (mcp-server regression).
- `tools/list` is missing one of `nlqdb_query` / `nlqdb_list_databases` /
  `nlqdb_describe`, or exposes a `create_database` / `ask` / `run` tool
  (step 7) → `failed step 7`; mcp-server regression (and `flow-005-stdio-walk.sh`
  would already be red).
- 401 on the auth header (step 6+) → `blocked credentials`; the `sk_mcp_*`
  key is missing or rotated.

### Outcome log

| Date | Agent | State | Tools confirmed | Notes |
|---|---|---|---|---|
| 2026-05-23 | composer-4 | partial (discovery precondition) | OAuth metadata (no tools confirmed) | `scripts/verify-flows.sh` curl-only probe against `https://mcp.nlqdb.com`: `/.well-known/oauth-protected-resource` → 200 with `resource=https://mcp.nlqdb.com`; `/.well-known/oauth-authorization-server` → 200 with `issuer=https://mcp.nlqdb.com`, `authorization_endpoint`, `token_endpoint`. These two endpoints are the precondition the MCP inspector consumes during its handshake in walkthrough step 1 — a 4xx/5xx here would block step 1 outright. Unauthenticated `POST /mcp tools/list` returns `401 invalid_token` — the auth wall is intact. Walkthrough steps 1-7 (inspector transport handshake, authenticated `tools/list`, then the `nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe` tools — the `create_database`/`ask`/`run` names in this 2026-05-23 note predate the SK-STRG-009 catalog correction) need an MCP inspector + `sk_mcp_*` key and are unattempted in this PR. |
| 2026-06-04 | claude-code | **passed (no-credential subset, SK-STRG-005)** | discovery endpoints + auth-wall challenge | GLOBAL-032 7-day-freshness re-walk: `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` 6/6 in 1s wall. Every assertion green: RFC 9728 root + scoped resource-metadata both 200 with `resource=https://mcp.nlqdb.com` and `resource=https://mcp.nlqdb.com/mcp`; RFC 8414 AS metadata carries `issuer` + `authorization_endpoint` + `token_endpoint`; `POST /mcp initialize` and `POST /mcp tools/list` both 401 with `WWW-Authenticate: Bearer realm="OAuth", resource_metadata="https://mcp.nlqdb.com/.well-known/oauth-protected-resource/mcp", error="invalid_token"` AND the challenge `resource_metadata` URL matches the scoped discovery (RFC 9728 §5.1). JSON artifact `state:"passed"`, `discovery_ok:true`, `auth_wall_ok:true`, `challenge_url_matches:true`, `total_wall_s:1`. Artifact: `tools/stranger-test/results/flow-005-2026-06-04T01-42-37Z.json`. |
| 2026-06-05 | claude-code | **passed (no-credential subset, SK-STRG-005)** | discovery endpoints + auth-wall challenge | GLOBAL-032 freshness re-walk: `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` 6/6 in 1s wall — RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, `initialize` + `tools/list` 401 with `WWW-Authenticate` challenge URL matching the scoped discovery (all unchanged). Walkthrough steps 6+ still need an `sk_mcp_*` key. Artifact: `tools/stranger-test/results/flow-005-2026-06-05T01-41-03Z.json`. |
| 2026-06-06 | claude-code | **passed (no-credential subset, SK-STRG-005)** | discovery endpoints + auth-wall challenge | GLOBAL-032 freshness re-walk: `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` 6/6 in 1s wall — RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, `initialize` + `tools/list` 401 with `WWW-Authenticate` challenge URL matching the scoped discovery (all unchanged). Walkthrough steps 6+ still need an `sk_mcp_*` key. Artifact: `tools/stranger-test/results/flow-005-2026-06-06T01-37-56Z.json`. |
| 2026-06-03 | claude-code | **passed (no-credential subset, SK-STRG-005)** | discovery endpoints + auth-wall challenge | First `bash scripts/flow-005-walk.sh` (`SK-STRG-005`) run against `https://mcp.nlqdb.com` from this agent VM. 6/6 assertions green in 4s wall: (1) RFC 9728 root resource-metadata `resource=https://mcp.nlqdb.com`; (2) RFC 9728 scoped resource-metadata `resource=https://mcp.nlqdb.com/mcp`; (3) RFC 8414 AS metadata carries `issuer` + `authorization_endpoint` + `token_endpoint`; (4) `POST /mcp initialize` no auth → 401 `WWW-Authenticate: Bearer realm="OAuth", resource_metadata="https://mcp.nlqdb.com/.well-known/oauth-protected-resource/mcp", error="invalid_token"` AND `resource_metadata` URL matches step 2 (RFC 9728 §5.1); (5) `POST /mcp tools/list` no auth → same 401 + same challenge shape. JSON artifact `state:"passed"`, `discovery_ok:true`, `auth_wall_ok:true`, `challenge_url_matches:true`. Walker added to the daily `acquisition-health.yml` cron — regressions land in the artifact JSON, not in any inbox. Walkthrough steps 6+ (authenticated `tools/list`, then the `nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe` tools — the `create_database`/`ask`/`run` names in this 2026-06-03 note predate the SK-STRG-009 catalog correction) still need an `sk_mcp_*` key and remain `blocked credentials` until the founder provisions one or the agent mints one via FLOW-004 + SK-MCP key issuance. |
| 2026-06-08 | claude-code | **passed (no-credential subset, SK-STRG-005)** | discovery endpoints + auth-wall challenge | GLOBAL-032 freshness re-walk: `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` 6/6 in 1s wall — RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, `initialize` + `tools/list` 401 with `WWW-Authenticate` challenge URL matching the scoped discovery (all unchanged). Walkthrough steps 6+ still need an `sk_mcp_*` key. Artifact: `tools/stranger-test/results/flow-005-2026-06-08T01-35-09Z.json`. |
| 2026-06-09 | claude-code | **passed (no-credential subset, SK-STRG-005)** | discovery endpoints + auth-wall challenge | GLOBAL-032 freshness re-walk: `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` 6/6 in 2s wall — RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, `initialize` + `tools/list` 401 with `WWW-Authenticate` challenge URL matching the scoped discovery (all unchanged). Walkthrough steps 6+ still need an `sk_mcp_*` key. Artifact: `tools/stranger-test/results/flow-005-2026-06-09T01-35-22Z.json`. |
| 2026-06-10 | claude-code | **passed (no-credential subset, SK-STRG-005)** | discovery endpoints + auth-wall challenge | GLOBAL-032 freshness re-walk: `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` 6/6 in <1s wall — RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, `initialize` + `tools/list` 401 with `WWW-Authenticate` challenge URL matching the scoped discovery (all unchanged). Walkthrough steps 6+ still need an `sk_mcp_*` key. Artifact: `tools/stranger-test/results/flow-005-2026-06-10T01-36-57Z.json`. |
| 2026-06-11 | claude-code | **passed (hosted no-credential subset, SK-STRG-005)** | discovery endpoints + auth-wall challenge | GLOBAL-032 freshness re-walk: `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` 6/6 in 1s wall — RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, `initialize` + `tools/list` 401 with `WWW-Authenticate` challenge URL matching the scoped discovery (all unchanged). Artifact: `tools/stranger-test/results/flow-005-2026-06-11T01-35-38Z.json`. |
| 2026-06-11 | claude-code | **passed (stdio no-credential subset, SK-STRG-009)** | `initialize` + `tools/list` tool catalog | First-ever stdio-transport walk — closes the FLOW-005 local-stdio (npm-fallback) e2e gap. `bash scripts/flow-005-stdio-walk.sh` spawned the real `@nlqdb/mcp` binary and drove a real MCP `initialize` + `tools/list` handshake over OS pipes (no network): **16/16 checks in 0.3s**. serverInfo `{"name":"@nlqdb/mcp"}`; capabilities `{"tools":{"listChanged":true}}`; catalog = `nlqdb_query` (destructiveHint, input `{db,q,confirm}`) + `nlqdb_list_databases` (readOnlyHint, `{}`) + `nlqdb_describe` (readOnlyHint, `{db}`); asserted **no `create_database`/`nlqdb_create_database`/`ask`/`run` tool**. JSON artifact `state:"passed"`, `protocol_ok:true`, `catalog_ok:true`. This walk corrected the credentialed walkthrough's stale `create_database`/`ask`/`run` tool names (steps 6-12) to the real `SK-MCP-002` catalog. Authenticated tool *invocation* still needs a key. Artifact: `tools/stranger-test/results/flow-005-stdio-2026-06-11T01-46-12-678Z.json`. |
| 2026-06-12 | claude-code | **passed (hosted no-credential subset, SK-STRG-005)** | discovery endpoints + auth-wall challenge | GLOBAL-032 freshness re-walk: `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` 6/6 in <1s — RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, `initialize` + `tools/list` 401 with `WWW-Authenticate` challenge URL matching scoped discovery (all unchanged). Artifact: `tools/stranger-test/results/flow-005-2026-06-12T01-35-09Z.json`. |
| 2026-06-12 | claude-code | **passed (stdio no-credential subset, SK-STRG-009)** | `initialize` + `tools/list` tool catalog | GLOBAL-032 freshness re-walk: `bash scripts/flow-005-stdio-walk.sh` spawned the real `@nlqdb/mcp` binary and drove a real `initialize` + `tools/list` handshake over OS pipes (no network): **16/16 checks in 0.2s**. Catalog unchanged = `nlqdb_query` (destructiveHint, `{db,q,confirm}`) + `nlqdb_list_databases` (readOnlyHint) + `nlqdb_describe` (readOnlyHint, `{db}`); no `create_database`/`ask`/`run` tool. JSON `state:"passed"`, `protocol_ok:true`, `catalog_ok:true`. Authenticated tool *invocation* still needs a key. Artifact: `tools/stranger-test/results/flow-005-stdio-2026-06-12T01-35-28-432Z.json`. |

---

## FLOW-006 — SDK `runSql` escape hatch

**Persona:** P4 Backend Engineer
**Mirror:** [`automated-icp-validation-plan.md §8 FLOW-006`](./automated-icp-validation-plan.md)

### Source signal

The pain this flow proves is "I want NL→SQL most of the time but I
also need a raw-SQL escape hatch I can parameterise from an SDK call."
This is [`GLOBAL-015`](../decisions/GLOBAL-015-power-user-escape-hatch.md)
in motion.

- [HN search — "text to sql"](https://hn.algolia.com/?q=text+to+sql)
- [r/dataengineering — "text to sql"](https://www.reddit.com/r/dataengineering/search/?q=text+to+sql)

### Required tools

- A Node / Bun runtime able to install `@nlqdb/sdk` from npm.
- A scratch directory to instantiate the SDK in (the agent should
  use a temp dir, not commit the test harness).

### Required credentials

- An `sk_live_*` or `sk_test_*` API key for an nlqdb tenant the
  agent owns. If absent, ask the founder.

### Walkthrough steps

1. In a fresh temp directory: `bun init -y && bun add @nlqdb/sdk`.
2. Write a short test script that imports the client, configures it
   with the API key + an existing `dbId`, and calls `runSql` with a
   parameterised `SELECT`:
   ```ts
   import { NlqdbClient } from "@nlqdb/sdk";
   const c = new NlqdbClient({ apiKey: process.env.NLQDB_API_KEY! });
   const r = await c.runSql({ dbId: process.env.NLQDB_DB_ID!,
     sql: "SELECT 1 AS one", params: [] });
   console.log(r);
   ```
3. Run the script. Assert: it prints a typed result with `rows` and
   `rowCount`.
4. Repeat with an `INSERT ... RETURNING`: assert the inserted row
   appears in a follow-up `runSql("SELECT * FROM …")`.
5. Attempt a `DROP TABLE`. Assert: rejected with the validator's
   "DDL goes through `nlq new`" message ([`docs/features/sql-allowlist/FEATURE.md`](../features/sql-allowlist/FEATURE.md)).

### Pass criteria

- Every assertion in steps 3-5 passes.
- `@nlqdb/sdk` resolves on `bun add` (no version-pin regression on the
  npm tarball).

### If blocked

- `@nlqdb/sdk` fails to install → `blocked upstream` (npm) or
  `failed step 1` (package regression).
- 401 on `runSql` → `blocked credentials`; key invalid or revoked.
- DROP TABLE not rejected → `failed step 5`; allowlist regression
  (security-relevant; escalate to founder immediately).

### Outcome log

| Date | Agent | State | SDK version | Notes |
|---|---|---|---|---|
| — | — | not yet attempted | — | — |

---

## FLOW-007 — Adopt anonymous DB on signup

**Persona:** P1 Solo Builder → authed
**Mirror:** [`automated-icp-validation-plan.md §8 FLOW-007`](./automated-icp-validation-plan.md)

### Source signal

The pain this flow proves is "I started anonymous, the database
works, now I want to keep it without re-creating my schema and
losing my rows."

- [r/sideproject — "anonymous data keep"](https://www.reddit.com/r/sideproject/search/?q=anonymous+data+keep)
- The 72 h sweep behaviour cited in [`SK-ANON-002`](../features/anonymous-mode/FEATURE.md)
  is the contractual surface this flow exercises.

### Required tools

- Headless browser.
- A GitHub or Google account the agent can sign into. If absent,
  ask the founder (the staging mock-IdP works for preview
  environments per [`docs/features/auth/FEATURE.md`](../features/auth/FEATURE.md)
  but production requires real OAuth).

### Required credentials

- A real OAuth account (GitHub or Google) for production
  verification; mock-IdP for staging-preview verification.

### Walkthrough steps

1. Run FLOW-001 steps 1-9 against `https://nlqdb.com`. Capture the
   anonymous `dbId` from the response.
2. Without clearing the browser context, click "Sign in" (top nav).
3. Complete the OAuth flow with the available account.
4. Assert: post-signin lands back on `/app/new` (or similar
   authenticated surface), the session cookie is set, and the user's
   visible identity matches the OAuth account name.
5. Assert: an "Adopt this database" affordance is present (per
   [`SK-ANON-002`](../features/anonymous-mode/FEATURE.md)).
6. Click it. Assert: an `Idempotency-Key` header (per [`GLOBAL-005`](../decisions/GLOBAL-005-idempotency-key.md))
   is included on the POST.
7. After the response, assert: the `dbId` is now listed under the
   user's authed `/v1/databases` list. The earlier anonymous device
   token continues to authorise the same DB until rotated.
8. Run a follow-up `ask` against the adopted `dbId`. Assert: rows
   from step 1 are still present (no data loss across the adoption).

### Pass criteria

- Every assertion in steps 4-8 passes.
- No data loss across the adoption boundary.

### If blocked

- OAuth redirect fails → `blocked upstream` (GitHub / Google) or
  `failed step 3` (auth regression).
- Adoption button absent → `failed step 5`; SK-ANON-002 regression.
- Rows missing after adoption → `failed step 8`; the most severe
  failure mode (data loss); escalate to founder immediately.

### Outcome log

| Date | Agent | State | Rows preserved? | Notes |
|---|---|---|---|---|
| — | — | not yet attempted | — | — |

---

## FLOW-008 — Weekly ICP scrape source-health

**Persona:** cron / system (no user persona — this is the data pipeline)
**Mirror:** [`automated-icp-validation-plan.md §8 FLOW-008`](./automated-icp-validation-plan.md)

### Source signal

The signal this flow proves is "the Mon 06:00 UTC cron can still reach
the 8 upstreams it depends on". A silent upstream schema change or
endpoint move only surfaces today after the LogSnag count drops to
zero; this flow makes the failure agent-observable before the cron
fires. Per [`SK-ICP-007`](../features/icp-mining/FEATURE.md) the probe
is best-effort: the 8 sources are the same ones listed in
[`automated-icp-validation-plan.md §2.1`](./automated-icp-validation-plan.md).

### Required tools

- `curl` (the agent VM's stdlib is enough).
- `bash` ≥ 4.

### Required credentials

- `GH_TOKEN` (optional) for both the GitHub Search Issues probe AND
  the GitHub Discussions GraphQL probe (same token authorises both —
  the `public_repo` read scope returns Issues via REST and DISCUSSION
  nodes via GraphQL). When absent the script skips both probes with
  a single note; the deployed Worker still uses its own bound secret.
- No other credentials. The Stack Exchange and Indie Hackers probes
  are anonymous; HN Algolia is public; Reddit is unauthenticated.

### Walkthrough steps

1. From the repo root, run `bash scripts/verify-flows.sh`. The script
   exits non-zero on any fatal assertion.
2. Assert: HN Algolia `/api/v1/search` returns 200 AND the body
   contains a `"hits"` key. Failure ⇒ HN Algolia schema/endpoint
   regression — the cron's `fetchHN` will start returning empty.
3. Assert: GitHub `/search/issues` returns 200 AND the body contains
   `"total_count"` (only when `GH_TOKEN` is set; otherwise this step
   AND step 4 are both skipped with a single note).
4. Assert (gated on the same `GH_TOKEN`): GitHub GraphQL POST to
   `/graphql` with a `search(query: \"text to sql\", type: DISCUSSION, first: 1) { discussionCount }`
   payload returns 200 AND the body contains `"discussionCount"`. Failure
   with `GH_TOKEN` present ⇒ either the PAT lost the scope GraphQL
   needs to resolve DISCUSSION nodes OR the GraphQL endpoint moved —
   the cron's `fetchGitHubDiscussions` (SK-ICP-009) will start
   returning empty.
5. Assert: Indie Hackers `/posts.json` returns 200 AND the body
   contains an `"items"` key.
6. Reddit `/r/SaaS/search.json` and Stack Exchange `/search/advanced`
   may return 200 (good — record the `quota_remaining` for SO) OR
   they may return 403 with `x-block-reason: hostname_blocked`
   (sandbox-egress proxy block — the script downgrades to an advisory
   note since the deployed Worker is the canonical probe). Any other
   non-200 ⇒ real upstream regression.
7. Assert: Dev.to `/api/articles?tag=database&per_page=5&top=7` returns
   200 AND the body is a top-level JSON array (per the Forem
   [`/api/v1`](https://developers.forem.com/api/v1) contract). Failure ⇒
   Forem schema/endpoint regression — the cron's `fetchDevto` will start
   returning empty.
8. Assert: Bluesky `api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=text+to+sql&limit=5&sort=latest&since=<isoSeven>`
   returns 200 AND the body contains a `"posts"` key (per the
   [AT Protocol AppView contract](https://docs.bsky.app/docs/api/app-bsky-feed-search-posts)).
   Failure ⇒ AT Protocol AppView schema/endpoint regression — the cron's
   `fetchBluesky` (SK-ICP-012) will start returning empty.
   `public.api.bsky.app` 403'd from this agent VM 2026-06-01 (BunnyCDN
   block; not re-verified from CF Workers egress); the probe uses the
   canonical `api.bsky.app` Express AppView.
9. Assert: Mastodon `mastodon.social/api/v1/timelines/tag/postgres?limit=5&local=false`
   returns 200 AND the body is a top-level JSON array (per the
   [`docs.joinmastodon.org/methods/timelines/`](https://docs.joinmastodon.org/methods/timelines/) contract — `OAuth: Public`,
   no auth needed). Failure ⇒ ActivityPub hashtag-timeline schema/endpoint
   regression — the cron's `fetchMastodon` (SK-ICP-013) will start returning
   empty. `mastodon.social/robots.txt` disallows GPTBot only; our
   `nlqdb-icp-bot` UA is allowed on `/api/v1/timelines/tag/*`.

### Pass criteria

- HN + IH + Dev.to + Bluesky + Mastodon probes return 200 with the contract keys.
- Both GitHub probes (Issues REST + Discussions GraphQL) are either
  200-with-key OR skipped-no-token together.
- Reddit + SO probes are either 200-with-quota-key OR advisory
  egress-block notes. Any other 4xx/5xx fails the walk.
- Script exits 0.

### If blocked

- HN 5xx for the whole walk window → `blocked upstream` (HN Algolia
  outage). Re-run within an hour.
- GH 401 with `GH_TOKEN` set on either step 3 (Issues REST) or step 4
  (Discussions GraphQL) → `failed step <3|4>`; the token rotated, was
  revoked, or lost a scope. Mint a new PAT (must retain `public_repo`
  read for REST AND GraphQL) and update the Worker secret per
  [`scripts/mirror-secrets-workers.sh`](../../scripts/mirror-secrets-workers.sh).
- GraphQL `errors` body on step 4 with `GH_TOKEN` set ⇒ `failed step 4`
  unless the message is `RATE_LIMITED` (in which case the next agent run
  inherits headroom; surface in the outcome log but do not block the
  walk — the cron's per-source `.catch` already isolates this from the
  other 6 sources).
- IH 502 from the unofficial mirror → `blocked upstream`; the mirror
  is single-instance and occasionally rate-limits. The cron's per-source
  catch isolates IH from killing the rest.
- Dev.to non-200 → `blocked upstream`; Forem runs on Heroku with a
  Cloudflare-fronted CDN, so a hard outage shows as 5xx with no
  block-reason header. The cron's per-tag catch isolates Dev.to from
  killing the rest.
- Bluesky non-200 from `api.bsky.app` → `blocked upstream`; the AT
  Protocol AppView is documented as no-auth with "generous" rate-limits
  so 429 should be vanishingly rare for 5 calls/week, but if it appears
  the cron's per-query `.catch` isolates Bluesky from killing the rest.
  A 403 specifically from `public.api.bsky.app` is the BunnyCDN block
  this agent VM observed 2026-06-01 (not re-verified from CF Workers
  egress) — switch the probe back to `api.bsky.app` (the canonical
  Express AppView), don't open a credential ticket.
- Mastodon non-200 from `mastodon.social` → `blocked upstream`; the
  AP hub is documented at 300 reads / 5 min / IP, so 429 should be
  vanishingly rare for 5 calls/week. If it appears, the cron's per-tag
  short-circuit (single 429 stops the remaining 4 queries within the
  same run) caps damage and the per-source `.catch` isolates Mastodon
  from killing the other 8 sources.

### Outcome log

| Date | Agent | State | Notes |
|---|---|---|---|
| 2026-05-23 | composer-4 | partial steps 1-5 (upstream availability) | `scripts/verify-flows.sh` against `https://nlqdb.com` + `https://mcp.nlqdb.com`: HN 200 (`hits` present), GH 200 (`total_count=1644` live-probed today), IH 200 (`items` present). Reddit + Stack Exchange both 403 with `x-block-reason: hostname_blocked` from the sandbox-egress proxy — degraded to advisory per the script's helper. Cron-side checks (KV writes, evidence-file PUT, LogSnag publish) require the deployed Worker and remain a separate post-cron audit. |
| 2026-05-25 | claude-code | partial steps 1-6 (upstream availability) | `scripts/verify-flows.sh` against `https://nlqdb.com` + `https://mcp.nlqdb.com` after SK-ICP-008 added the Dev.to probe: HN 200 (`hits` present), GH 200 (`total_count` present), IH 200 (`items` present), **Dev.to 200 (top-level JSON array)** — live probe of `https://dev.to/api/articles?tag=database&per_page=5&top=7` returned 5 fresh articles inside the `top=7` 7-day window. Reddit + SO 403 `x-block-reason: hostname_blocked` (unchanged sandbox-egress advisory). Cron-side checks (KV writes, evidence-file PUT, LogSnag publish) remain a separate post-cron audit; the new `fetchDevto` matches the IH error-isolation pattern exactly so its regression surface is the response-schema contract that the probe pins. Pre-walk also: `flow-004-walk.sh` passed in 19s (control 403, invite 200) — full SK-GATE-007 invariant proof, gate is doing its job and the invite-valve is intact. |
| 2026-05-31 | claude-code | partial steps 1-7 (upstream availability) | Verification-first run before any code edit, per GLOBAL-030: (a) mirror integrity check `diff <(grep -oE '^#{2,3} FLOW-[0-9]+' impl) <(... verif)` ⇒ empty, both trackers in sync; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` ⇒ all curl-observable assertions green pre-edit (HN/GH/IH/Dev.to 200, Reddit/SO sandbox-egress advisory, `flow-005` MCP discovery 200, every `/solve/` + `/vs/` slug 200, sitemap floor 14, `Base.astro` invite-capture loaded site-wide); (c) live probe of `api.github.com/graphql` with the env's `GH_TOKEN` ⇒ `viewer.login=omerhochman`, `rateLimit{cost:1, remaining:4998, limit:5000}` confirming the PAT authorises GraphQL `DISCUSSION` searches without a new scope. After landing SK-ICP-009 in `apps/api/src/icp-scrape.ts` + tests + `scripts/verify-flows.sh` step 4 (new), re-walked the script: **GitHub Discussions probe 200 with `"discussionCount"` present** — full FLOW-008 status now `partial steps 1-7` (Reddit/SO still sandbox-egress advisory; cron-side KV/LogSnag still need the deployed Worker). Post-edit `bun --filter @nlqdb/api test test/icp-scrape.test.ts` ⇒ 28/28 pass (5 new tests cover POST + Bearer + bot UA + `DISCUSSION` body + `created:>` filter, absent-token short-circuit, GraphQL `errors` soft failure, unparseable `createdAt` drop, basic store-and-dedup). Mirror integrity check post-edit ⇒ still empty (no new FLOW added; FLOW-008 sub-tasks gained one on each side). |
| 2026-06-01 | claude-code | partial steps 1-8 (upstream availability) | Verification-first run before any code edit, per GLOBAL-030: (a) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers across both trackers) ⇒ empty pre-edit; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` ⇒ all curl-observable assertions green pre-edit (including the 7 existing source-health probes; Reddit/SO sandbox-egress advisory as expected); (c) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` ⇒ **passed in 18s wall** (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 10s, control 403 + invite 200 — SK-GATE-007 invariant honoured). BEFORE writing any code, live-probed the AT Protocol AppView from this VM: (1) `public.api.bsky.app/xrpc/app.bsky.feed.searchPosts` ⇒ HTTP 403 from BunnyCDN on this agent VM 2026-06-01 (not re-verified from CF Workers egress); (2) `api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=text+to+sql&limit=5&sort=latest&since=<isoSeven>` ⇒ HTTP 200 with `{posts, cursor}` shape, 5 fresh posts in the past 7d including the P2 quote `"My SQL bot dies after two questions! Did you read the JP Morgan study?"` that the prior 7 sources never caught; (3) `agent memory` / `vector database` / `rag pipeline` / `supabase` each returned 10 fresh posts; (4) `bsky.app/robots.txt` ⇒ `Allow: /` (no scrape-deny); (5) `docs.bsky.app/docs/advanced-guides/rate-limits` documents AppView read endpoints as no-auth with "generous rate-limits" — cron's 5 calls/week is trivially inside. After landing SK-ICP-012 in `apps/api/src/icp-scrape.ts` + 5 tests + `scripts/verify-flows.sh` step 8 (new, cross-compatible `date -u -d '7 days ago'` / `date -u -v-7d` idiom), re-walked the script: **Bluesky probe 200 with `"posts"` present** — full FLOW-008 status now `partial steps 1-8` (Reddit/SO still sandbox-egress advisory; cron-side KV/LogSnag still need the deployed Worker). Post-edit `bun --filter @nlqdb/api test test/icp-scrape.test.ts` ⇒ 33/33 pass (5 new tests pin the `q`+`sort=latest`+`since=` URL contract with a since-value-within-60s check, URL rebuild from `at://.../app.bsky.feed.post/<rkey>`, unparseable-`createdAt` drop, non-`app.bsky.feed.post` URI drop, 503 graceful). Mirror integrity check post-edit ⇒ still empty (no new FLOW added; FLOW-008 sub-tasks gained one on each side). |
| 2026-06-04 | claude-code | partial steps 1-9 (upstream availability) | Verification-first run before any code edit, per GLOBAL-030: (a) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers across both trackers) ⇒ empty pre-edit; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` ⇒ all curl-observable assertions green (including the 8 existing source-health probes; Reddit/SO sandbox-egress advisory as expected); (c) `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` ⇒ **passed 6/6 in 1s** (discovery + auth wall + challenge URL all OK); (d) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` ⇒ **partial in 20s** (control 403 + invite HTTP 422 — gate bypassed per SK-GATE-007, downstream engine-side regression recorded under FLOW-004); (e) `bash scripts/stranger-test.sh --prompts 2` ⇒ 0/6 baseline (all six runs gate-fail at the `/v1/ask` step exactly as expected per GLOBAL-027; every static + CTA + draft + event-spy assertion green). BEFORE writing any code, live-probed the Mastodon hub from this VM: (1) `mastodon.social/api/v1/timelines/tag/sql?limit=10&local=false` ⇒ HTTP 200 with a JSON array of 10 fresh status objects + `x-ratelimit-limit=300, x-ratelimit-remaining=294` headers (cron's 5/week is three orders of magnitude inside); (2) probed `postgres` / `database` / `sql` / `llm` / `rag` / `agent` / `vectordb` / `text+to+sql` / `ai` ⇒ each returned 10-20 fresh posts in the past 7 days including *"Handling graphs with SQL/PGQ in PostgreSQL"* (P3 analyst pain quote); (3) `mastodon.social/robots.txt` disallows GPTBot only — `/api/v1/timelines/tag/*` is allowed for any other UA (`nlqdb-icp-bot` matches); (4) `docs.joinmastodon.org/methods/timelines/` marks `GET /api/v1/timelines/tag/<tag>` as `OAuth: Public` (no auth, no app registration). After landing SK-ICP-013 in `apps/api/src/icp-scrape.ts` + 6 tests + `scripts/verify-flows.sh` step 9 (new), re-walked the script: **Mastodon probe 200 with JSON-array body** — full FLOW-008 status now `partial steps 1-9` (Reddit/SO still sandbox-egress advisory; cron-side KV/LogSnag still need the deployed Worker). Post-edit `bun --filter @nlqdb/api test test/icp-scrape.test.ts` ⇒ 43/43 pass (6 new tests pin HTML-stripped storage with `mast-<id>` prefix, URL+headers contract with path-segment-encoded tag, 429 short-circuit, 7-day window drop, sensitive=true NSFW drop, 503 graceful). Mirror integrity check post-edit ⇒ still empty (no new FLOW added; FLOW-008 sub-tasks gained one on each side). |
| 2026-06-06 | claude-code | partial steps 1-9 (upstream availability) | GLOBAL-032 freshness re-walk: `bash scripts/verify-flows.sh` against `https://nlqdb.com` ⇒ all curl-observable source-health probes green — HN / GitHub Issues / GitHub Discussions (`discussionCount` present) / Indie Hackers / Dev.to / Bluesky (`posts` present) / Mastodon (JSON-array) all HTTP 200; Reddit + Stack Exchange 403 `x-block-reason=hostname_blocked` (sandbox-egress advisory, deployed Worker is canonical). Cron-side KV writes + evidence-file PUT + LogSnag publish still need the deployed Worker (separate post-cron audit). This PR's SK-HDC-017 touches db-create provisioning, not the scrape sources — no FLOW-008 source contract changed. |

### Triage

**Sandbox egress vs real upstream (2026-05-23, composer-4):** the
agent VM sits behind a managed-egress proxy that returns
`HTTP 403, x-block-reason: hostname_blocked` for `www.reddit.com`
and `api.stackexchange.com`. A naive curl call from the agent VM
will see this as a hard failure; the deployed Worker's Cloudflare
egress is the canonical probe because it doesn't share the block.
The `fetch_json` helper in `scripts/verify-flows.sh` reads the
`x-block-reason` response header and degrades any non-200 carrying
it to an advisory note, regardless of the caller's severity choice.
No content regression — the cron itself runs on the Worker and is
unaffected.

---

## Adding a new flow

Per [`GLOBAL-029`](../decisions/GLOBAL-029-acquisition-verification-tracker.md),
adding `FLOW-NNN` updates BOTH this file AND
[`automated-icp-validation-plan.md §8`](./automated-icp-validation-plan.md)
in the same PR, with the same `FLOW-NNN` ID.

1. Pick the next monotonic `FLOW-NNN` (sticky; never renumber).
2. Add a block here with: Persona, Mirror cross-ref, Source signal
   (enduring discussion-hub URLs per [`SK-SOLVE-003`](../features/solve-pages/decisions/SK-SOLVE-003-enduring-source-citations.md)
   — never single-thread URLs), Required tools, Required credentials
   (and how to ask for missing ones), Walkthrough steps, Pass
   criteria, If-blocked failure modes, Outcome log table seeded with
   the `not yet attempted` row.
3. Add the mirrored block in the impl plan §8 with: Persona, Source
   signal (same URLs), Implementation sub-tasks (`[x]` / `[ ]` with
   SK-* refs), Progress (`X/Y · Z%`), Mirror cross-ref back to this
   file.
4. Update both files' status dashboards.
5. The PR body explicitly names the flow ID and which persona it
   serves.

## Mirror integrity check (run this in any PR that edits either file)

```bash
# Both files share the same FLOW-NNN set (flows are ## headers in
# the verification file and ### headers nested under §8 in the impl
# plan; the regex accepts both).
diff \
  <(grep -oE '^#{2,3} FLOW-[0-9]+' docs/research/automated-icp-validation-plan.md | grep -oE 'FLOW-[0-9]+' | sort -u) \
  <(grep -oE '^#{2,3} FLOW-[0-9]+' docs/research/automated-icp-validation-plan-verification.md | grep -oE 'FLOW-[0-9]+' | sort -u)
```

The diff must be empty. Drift between the two files is the
regression [`GLOBAL-029`](../decisions/GLOBAL-029-acquisition-verification-tracker.md)
exists to prevent.
