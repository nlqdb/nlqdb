# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Arm the 3rd independent free-LLM pool for the opencheck agent lane —
  set repo secret `FALLBACK2_LLM_API_KEY`** (SambaNova/Cerebras/Together
  free tier; lane wired in `_e2e-opencheck.yml`, degrades to "disabled"
  while unset). **Sole** fix for scorecard row #15 (E2E freshness ≈ 0.75):
  the 2 free lanes (NIM + OpenRouter `:free`) flap intrinsically, so a
  2-lane walk can't stay green (run 70). **Blocked ~6 days** (since ~07-13;
  history in `weekly-review.md`).

- **Apply pending D1 migrations (`0022` `gtm_snapshots`, `0023`
  `synthetic_traffic_flag`, `0024` `databases.source_json`, `0025`
  `pmf_survey`) to the prod control-plane D1 at the next deploy**
  (`wrangler d1 migrations apply`). Added by the GTM-metrics dashboard +
  first-touch attribution + in-product Sean-Ellis survey
  ([GLOBAL-038](./decisions/GLOBAL-038-gtm-pmf-instrumentation.md),
  `SK-GTM-005`/`SK-GTM-006`/`SK-GTM-007`); until applied,
  `GET /v1/admin/metrics` snapshot/trend reads, the Sean-Ellis survey
  routes, and create-path source writes error / fail (some logged,
  non-fatal) in prod (tables won't exist). Operator-only (prod
  credentials).

- **Publish nlqdb to the official MCP registry** (`registry.modelcontextprotocol.io`;
  reach R-05 venue #1, ledger row #3). Account-walled: `mcp-publisher` needs an
  interactive GitHub device-flow login *or* a domain-verify private key — an agent
  can't. No npm publish needed (remote server; `remotes`, not `packages`). Verified
  mechanism 2026-07-20. Run from any dir:
  1. Install: `brew install mcp-publisher` (or the `curl … releases/latest` binary).
  2. Save this as `server.json` (endpoint matches `mcp-install.ts` `MCP_ENDPOINT_URL`):
     ```json
     {
       "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
       "name": "io.github.nlqdb/nlqdb",
       "title": "nlqdb — analytical memory for AI agents",
       "description": "Analytical memory for AI agents: a real Postgres your agent connects to over MCP and queries in plain English — GROUP BY, JOIN, aggregate over what it remembered, not just the top-k a vector store recalls. One command to connect.",
       "repository": { "url": "https://github.com/nlqdb/nlqdb", "source": "github" },
       "version": "0.1.0",
       "remotes": [ { "type": "streamable-http", "url": "https://mcp.nlqdb.com/mcp" } ]
     }
     ```
  3. `mcp-publisher login github` → authorize as a member of the **nlqdb** GitHub org
     (grants the `io.github.nlqdb/*` namespace).
  4. `mcp-publisher publish` → then verify:
     `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.nlqdb/nlqdb"`.
  Alt namespace `com.nlqdb/nlqdb` (cleaner) needs DNS-TXT or a
  `/.well-known/mcp-registry-auth` domain-verify secret on `nlqdb.com` instead of the
  GitHub login — heavier; use GitHub. On publish, flip ledger row #3 to **in-flight**
  and note the registry URL. **This one publish cascades:** Smithery, PulseMCP, and
  Glama crawl the official registry (verified 2026-07-20), so they auto-ingest nlqdb
  from this entry — no separate submissions; just claim/clean-up those listings after.
  Flip ledger rows #4–#6 to in-flight at the same time.

- **Submit nlqdb to mcp.so** (`mcp.so/submit`; reach R-05 venue #5, ledger row #7).
  Account-walled: the form needs a GitHub sign-in (anonymous fetch → 403), and mcp.so
  is **not** an official-registry crawler — it's a Next.js + Supabase directory
  (`chatmcp/mcpso`) whose data comes from this form, so the row-#3 registry publish does
  **not** cascade here (per-server pages auto-open a giscus GitHub Discussion for
  *comments*, which is not the submission path). Verified 2026-07-21. Sign in, open
  `mcp.so/submit`, and enter:
  - **GitHub URL:** `https://github.com/nlqdb/nlqdb` (the form auto-fetches name/README)
  - **Name / title:** `nlqdb — analytical memory for AI agents`
  - **Website:** `https://nlqdb.com/agents/?utm_source=mcpso` (carries the ledger key)
  - **Description:** `Analytical memory for AI agents: a real Postgres your agent connects to over MCP and queries in plain English — GROUP BY, JOIN, aggregate over what it remembered, not just the top-k a vector store recalls. One command to connect.`
  - **Connect / config (if asked):** `claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp`
  On submit, flip ledger row #7 to **in-flight** and note the `mcp.so/server/...` URL.

- **Fire the launch sequence** — the founder-only half of
  [`docs/research/launch-kit.md`](./research/launch-kit.md): pick the angle
  (§2; GLOBAL-036 says lead with analytical agent memory), write the Show
  HN post + first comment in your own voice from the §3.1 fact sheet
  (never agent copy — the r/SQL lesson), soft-launch lobste.rs/r/SideProject
  first, then Show HN Tue–Thu morning, Product Hunt ≥ 1 week later
  (account-walled). Attribution (#745) is merged, so every visit is
  attributable; apply the migrations bullet above first. nlqdb has never
  launched anywhere; this is the highest-yield untaken acquisition action.

- **Decide the toolchain path to unblock the Astro 6→7 security upgrade**
  (fixes moderate/low XSS `GHSA-f48w-9m4c-m7f5` / `GHSA-4g3v-8h47-v7g6` /
  `GHSA-7pw4-f3q4-r2p2` on the marketing + docs sites). The dep+code migration
  is otherwise done and green, but Astro 7 hard-requires `cookie@2` (renamed
  `parseCookie` API) while better-auth / express / sveltekit / nuxt need
  `cookie@0.7.x` (held above `GHSA-pxg6-pf52-xh8x` by the root global
  override), and bun 1.3.11 supports neither scoped overrides
  ([oven-sh/bun#6608](https://github.com/oven-sh/bun/issues/6608)) nor correct
  isolated-install linking here. Pick one: migrate the cookie consumers off
  `parse`/`serialize`, switch bun linker mode / package manager, or bump bun
  and re-verify. Until then the 3 Astro advisories stay on `main`
  (agent-verified 2026-07-21).

## Suggestions needing approval (to amend the guidelines)

_None open._
