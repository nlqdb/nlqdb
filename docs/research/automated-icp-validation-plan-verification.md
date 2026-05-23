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

> **Status (2026-05-23):** 0 / 7 flows fully passed. 3 / 7 have
> curl-only partial passes (FLOW-001, FLOW-002, FLOW-003 — all 8
> AEO slugs covered). FLOW-002 carries a failed step 8 (CTA
> telemetry + gate continuation) — that failure routes back as
> priority #4 in the impl plan's pick-list, not as a notification.
> Full Playwright walks are still pending for every flow; the
> §1.1 stranger-test Playwright primitive (impl plan priority #1)
> is what closes the gap from "curl-observable static" to
> "stranger lands and gets first-value."

---

## Status dashboard (updated 2026-05-23)

| Flow | Persona | Verification status | Last verified | Mirror impl % |
|---|---|---|---|---|
| FLOW-001 | P1 solo builder | partial — curl steps 1–2 re-pass via `verify-flows.sh`; 3–9 need browser | 2026-05-23 | 5/7 (71%) |
| FLOW-002 | P3 analyst | failed 2026-05-23 step 8; curl steps 1, 3, 4 re-pass across all 5 slugs via `verify-flows.sh` | 2026-05-23 | 5/6 (83%) |
| FLOW-003 | P3 / P4 | partial — curl steps 1, 2, 4, 9 re-pass across all 3 slugs via `verify-flows.sh`; 5–8 need browser | 2026-05-23 | 5/5 (100%) |
| FLOW-004 | P1 solo builder | not yet attempted | — | 5/6 (83%) |
| FLOW-005 | P2 agent builder | not yet attempted | — | 5/6 (83%) |
| FLOW-006 | P4 backend engineer | not yet attempted | — | 5/6 (83%) |
| FLOW-007 | P1 / P3 | not yet attempted | — | 5/6 (83%) |

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
first (49 static assertions across FLOW-001/002/003 in under 2 s, zero
credentials). If it exits non-zero, fix the regression it surfaced
before walking anything new — that failure is the highest-leverage
work. If it exits 0, then pick the topmost `not yet attempted` flow
whose `Required credentials` you can satisfy without asking. If no
flow is satisfiable without asking, pick FLOW-001 (zero credentials)
and walk the browser-only steps the script can't cover — that's
where the §1.1 stranger-test gap actually lives.

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

### Triage

The first failed assertion is CTA telemetry: the static page wrote the draft and navigated, but the injected event spy saw no `solve.try_query_clicked`. A manual continuation then reached `/app/new` with the expected draft and hit `403 feature_gated` on first query, so FLOW-002 needs both event-hook verification/fix and an invite-bearing journey (or explicit waitlist detour) before it can count as a verified first-value acquisition path.

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

- Headless browser.
- A real email inbox able to receive the Resend invite. The Resend
  account configured for nlqdb sends from `hello@nlqdb.com`; the
  recipient can be any address the agent controls.

### Required credentials

- **A reachable email address.** If the agent does not have one,
  ask the founder per `### 3.` of the preamble. Options the founder
  may offer: a temporary forwarding alias, a Resend webhook capture
  endpoint, or a test inbox.

### Walkthrough steps

1. Open `https://nlqdb.com/` (fresh context).
2. Scroll to `#waitlist` (or click the gate's "Join the waitlist"
   CTA from any 403 surface).
3. Submit the waitlist form with the agent's reachable email.
4. Assert: the form acknowledges submission (a success message; do
   NOT navigate away yet — capture the page state).
5. Within 5 minutes, poll the inbox for an email `from:hello@nlqdb.com`
   with subject matching `/invite|access|nlqdb/i`.
6. Extract the `?invite=<code>` query parameter from the link in the
   email body. (Resend HTML body parsing; the code is 128-bit
   per [`SK-GATE-007`](../features/pre-alpha-gate/FEATURE.md).)
7. Open `https://nlqdb.com/?invite=<code>` in the same browser
   context. Assert: `localStorage["nlqdb_invite"]` is now set to
   the code value.
8. Type a goal in the hero and submit. Assert: `/v1/ask` request
   in DevTools carries the `X-Invite-Code: <code>` header AND the
   response status is 200 (not the 403 the same surface returns
   without the code).
9. Assert: subsequent `/v1/ask` requests in the same session continue
   to carry the header (one-shot codes are still presented on every
   request for audit; the consumption is server-side).

### Pass criteria

- Steps 4-9 all pass.
- Step 5 polling completes in under 5 minutes (Resend SLA is sub-30 s
  for transactional; 5 min is the slack).

### If blocked

- No email arrives within 5 minutes → `blocked upstream` (Resend
  outage) OR `failed step 5` (waitlist worker regression). Triage by
  checking Resend dashboard logs.
- Email arrives but no invite code in the body → `failed step 6`;
  the Resend template regressed.
- Code is set in localStorage but `/v1/ask` still returns 403 →
  `failed step 8`; the gate's `X-Invite-Code` honouring regressed.

### Outcome log

| Date | Agent | State | Email arrived in (s) | Notes |
|---|---|---|---|---|
| — | — | not yet attempted | — | — |

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
| — | — | not yet attempted | — | — |

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
