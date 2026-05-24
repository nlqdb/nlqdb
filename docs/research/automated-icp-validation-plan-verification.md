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

> **Status (2026-05-24):** **1 / 8 flows fully passed (FLOW-004).**
> The 2026-05-24 founder directive named engine quality (BIRD 0.318 /
> Spider `null` per
> [`apps/api/src/gate/eval-baseline.ts`](../../apps/api/src/gate/eval-baseline.ts) /
> [`SK-GATE-001`](../features/pre-alpha-gate/FEATURE.md#sk-gate-001) /
> [`SK-GATE-002`](../features/pre-alpha-gate/FEATURE.md#sk-gate-002))
> as the binding bottleneck for FLOW-001/002/003 — the gate is doing
> what GLOBAL-027 asks it to. FLOW-004 is the path that carries a
> stranger across the gate before BIRD/Spider clear, and as of
> 2026-05-24 it is **verified end-to-end** by
> [`scripts/flow-004-walk.sh`](../../scripts/flow-004-walk.sh)
> ([`SK-STRG-002`](../features/stranger-test/FEATURE.md)): a mail.tm
> throwaway inbox + curl walk landed `HTTP 200` on `/v1/ask` 18s after
> waitlist signup (13s of which was Resend's transactional latency).
> Future agents pick from: FLOW-006 (SDK runSql), FLOW-007 (anon→adopt),
> the §1.1 stranger-test daily cron, or schedule
> `scripts/flow-004-walk.sh` for continuous SK-GATE-007 regression watch.
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
> canonical). FLOW-005 still has the curl-only partial pass on the
> OAuth discovery precondition.

---

## Status dashboard (updated 2026-05-24)

| Flow | Persona | Verification status | Last verified | Mirror impl % |
|---|---|---|---|---|
| FLOW-001 | P1 solo builder | failed 2026-05-24 step 5 (gate 403 on `/v1/ask`; steps 1–4 ok across 3 prompts via `stranger-test.sh`) | 2026-05-24 | 6/7 (86%) |
| FLOW-002 | P3 analyst | failed 2026-05-24 step 9 (gate 403 on submit; steps 1–8 ok across 3 slugs via `stranger-test.sh`, includes event-spy on `solve.try_query_clicked`) | 2026-05-24 | 5/6 (83%) |
| FLOW-003 | P3 / P4 | failed 2026-05-24 step 8 (gate 403 on submit; steps 1–7 + 9 ok across 3 slugs via `stranger-test.sh`) | 2026-05-24 | 5/5 (100%) |
| FLOW-004 | P1 solo builder | **passed 2026-05-24** (mail.tm inbox → Resend invite → `X-Invite-Code` → HTTP 200 on `/v1/ask`; 13s email latency, 18s wall) | 2026-05-24 | 6/6 (100%) |
| FLOW-005 | P2 agent builder | partial — OAuth discovery precondition passes via `verify-flows.sh`; walkthrough steps 1-7 need an authenticated MCP client | 2026-05-23 | 5/6 (83%) |
| FLOW-006 | P4 backend engineer | not yet attempted | — | 5/6 (83%) |
| FLOW-007 | P1 / P3 | not yet attempted | — | 5/6 (83%) |
| FLOW-008 | cron / system | partial — curl probe of 5 sources passes (HN / GH / IH 200; Reddit / SO sandbox-egress advisory); cron-side KV writes + LogSnag publish need the deployed Worker | 2026-05-23 | 8/8 (100%) |

**Verification states:**
- `not yet attempted` — no agent has tried this flow.
- `passed YYYY-MM-DD` — agent completed every step within pass criteria.
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
  per [`GLOBAL-027`](../decisions/GLOBAL-027-pre-alpha-gate.md).
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

### Triage

The first failed assertion across every walked slug is the post-submit `/v1/ask` returning `403 feature_gated` — SK-ANON-001 vs GLOBAL-027 / SK-GATE-004. Static + CTA + draft-handoff + event-spy all confirmed healthy by the 2026-05-24 walker run; the earlier "event-spy missing" finding was a measurement artifact (spy reset by the post-CTA `location.assign`). Closing FLOW-002 requires the §1.4 anon-bypass slice from the impl plan or an invite-bearing walk variant (`tools/stranger-test/` open question).

**Trailing-slash redirect (2026-05-23, composer-2):** the deployed CDN now serves `/solve/<slug>` only via `307 → /solve/<slug>/`. A curl probe without `-L` (or without the trailing slash) gets HTTP 307 + 0 bytes and looks like a regression; with `-L` (or against the trailing-slash URL) every slug returns 200. `scripts/verify-flows.sh` follows redirects and additionally records the redirect chain as informational, so future agents don't re-discover this on every PR. No content regression — the static AEO surface is intact.

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

---

## FLOW-004 — Waitlist signup → invite email → gate bypass

**Persona:** P1 Solo Builder (invited)
**Mirror:** [`automated-icp-validation-plan.md §8 FLOW-004`](./automated-icp-validation-plan.md)

### Source signal

This flow proves the [`SK-GATE-007`](../features/pre-alpha-gate/FEATURE.md)
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
   128-bit base64url per [`SK-GATE-007`](../features/pre-alpha-gate/FEATURE.md);
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

### Required tools

- The official MCP inspector ([`@modelcontextprotocol/inspector`](https://www.npmjs.com/package/@modelcontextprotocol/inspector))
  OR a real MCP-aware client (Claude Desktop, Cursor, Cline). The
  inspector is the headless option and the canonical agent path.
- The MCP HTTP transport URL: `https://mcp.nlqdb.com`.

### Required credentials

- An `sk_mcp_*` API key OR an invite code to mint one. If the agent
  has neither, ask the founder per `### 3.` of the preamble.

### Walkthrough steps

1. Start the MCP inspector against `https://mcp.nlqdb.com` (Streamable
   HTTP transport): `bunx @modelcontextprotocol/inspector https://mcp.nlqdb.com`.
2. Assert: the server's `tools/list` response includes
   `create_database`, `ask`, and `run`. See [`docs/features/mcp-server/FEATURE.md`](../features/mcp-server/FEATURE.md).
3. Call `create_database` with an English goal:
   `{"goal": "a memory store for my research assistant"}`.
4. Assert: the response contains a `dbId` and a freshly-provisioned
   schema description.
5. Call `ask` with the new `dbId` and a goal:
   `{"dbId": "<from step 4>", "goal": "list everything I've stored"}`.
6. Assert: the response includes a typed table (possibly empty on a
   fresh DB) and a `sql` field. The SQL is the audit surface per
   [`GLOBAL-023`](../decisions/GLOBAL-023-trust-ux-baseline.md).
7. Call `run` with a parameterised insert: `{"dbId": "<id>", "sql":
   "INSERT INTO facts (k, v) VALUES ($1, $2)", "params": ["pref", "celsius"]}`.
   Assert: 200 status AND the row appears on a follow-up `ask`.

### Pass criteria

- Every assertion in steps 2-7 passes.
- Total wall-clock under 90 s (MCP handshake adds latency vs HTTP).

### If blocked

- MCP transport handshake fails → `blocked upstream` (CF) or
  `failed step 1` (mcp-server regression).
- `tools/list` is missing one of `create_database` / `ask` / `run`
  → `failed step 2`; mcp-server regression.
- 401 on the auth header → `blocked credentials`; the `sk_mcp_*` key
  is missing or rotated.

### Outcome log

| Date | Agent | State | Tools confirmed | Notes |
|---|---|---|---|---|
| 2026-05-23 | composer-4 | partial (discovery precondition) | OAuth metadata (no tools confirmed) | `scripts/verify-flows.sh` curl-only probe against `https://mcp.nlqdb.com`: `/.well-known/oauth-protected-resource` → 200 with `resource=https://mcp.nlqdb.com`; `/.well-known/oauth-authorization-server` → 200 with `issuer=https://mcp.nlqdb.com`, `authorization_endpoint`, `token_endpoint`. These two endpoints are the precondition the MCP inspector consumes during its handshake in walkthrough step 1 — a 4xx/5xx here would block step 1 outright. Unauthenticated `POST /mcp tools/list` returns `401 invalid_token` — the auth wall is intact. Walkthrough steps 1-7 (inspector transport handshake, `tools/list`, `create_database`, `ask`, `run`) need an MCP inspector + `sk_mcp_*` key and are unattempted in this PR. |

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
the 5 upstreams it depends on". A silent upstream schema change or
endpoint move only surfaces today after the LogSnag count drops to
zero; this flow makes the failure agent-observable before the cron
fires. Per [`SK-ICP-007`](../features/icp-mining/FEATURE.md) the probe
is best-effort: the 5 sources are the same ones listed in
[`automated-icp-validation-plan.md §2.1`](./automated-icp-validation-plan.md).

### Required tools

- `curl` (the agent VM's stdlib is enough).
- `bash` ≥ 4.

### Required credentials

- `GH_TOKEN` (optional) for the GitHub Search probe. When absent the
  script skips that single probe with a note; the deployed Worker still
  uses its own bound secret.
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
   is skipped with a note).
4. Assert: Indie Hackers `/posts.json` returns 200 AND the body
   contains an `"items"` key.
5. Reddit `/r/SaaS/search.json` and Stack Exchange `/search/advanced`
   may return 200 (good — record the `quota_remaining` for SO) OR
   they may return 403 with `x-block-reason: hostname_blocked`
   (sandbox-egress proxy block — the script downgrades to an advisory
   note since the deployed Worker is the canonical probe). Any other
   non-200 ⇒ real upstream regression.

### Pass criteria

- HN + IH probes return 200 with the contract keys.
- GH probe is either 200-with-key OR skipped-no-token.
- Reddit + SO probes are either 200-with-quota-key OR advisory
  egress-block notes. Any other 4xx/5xx fails the walk.
- Script exits 0.

### If blocked

- HN 5xx for the whole walk window → `blocked upstream` (HN Algolia
  outage). Re-run within an hour.
- GH 401 with `GH_TOKEN` set → `failed step 3`; the token rotated or
  was revoked. Mint a new PAT and update the Worker secret per
  [`scripts/mirror-secrets-workers.sh`](../../scripts/mirror-secrets-workers.sh).
- IH 502 from the unofficial mirror → `blocked upstream`; the mirror
  is single-instance and occasionally rate-limits. The cron's per-source
  catch isolates IH from killing the rest.

### Outcome log

| Date | Agent | State | Notes |
|---|---|---|---|
| 2026-05-23 | composer-4 | partial steps 1-5 (upstream availability) | `scripts/verify-flows.sh` against `https://nlqdb.com` + `https://mcp.nlqdb.com`: HN 200 (`hits` present), GH 200 (`total_count=1644` live-probed today), IH 200 (`items` present). Reddit + Stack Exchange both 403 with `x-block-reason: hostname_blocked` from the sandbox-egress proxy — degraded to advisory per the script's helper. Cron-side checks (KV writes, evidence-file PUT, LogSnag publish) require the deployed Worker and remain a separate post-cron audit. |

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
