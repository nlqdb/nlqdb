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
  and note the registry URL.

- **Fire the launch sequence** — the founder-only half of
  [`docs/research/launch-kit.md`](./research/launch-kit.md): pick the angle
  (§2; GLOBAL-036 says lead with analytical agent memory), write the Show
  HN post + first comment in your own voice from the §3.1 fact sheet
  (never agent copy — the r/SQL lesson), soft-launch lobste.rs/r/SideProject
  first, then Show HN Tue–Thu morning, Product Hunt ≥ 1 week later
  (account-walled). Attribution (#745) is merged, so every visit is
  attributable; apply the migrations bullet above first. nlqdb has never
  launched anywhere; this is the highest-yield untaken acquisition action.

## Suggestions needing approval (to amend the guidelines)

_None open._
