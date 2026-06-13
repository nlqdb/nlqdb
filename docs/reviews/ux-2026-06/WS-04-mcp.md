# WS-04 — MCP server (stdio + hosted)

**Scope:** `packages/mcp/src/`, `apps/mcp/src/`, `apps/docs/.../mcp.mdx`.
**Pre-reads:** `docs/features/mcp-server/FEATURE.md`, GLOBAL-012,
GLOBAL-023 (files under `docs/decisions/`).
**Default KPI:** UX — the agent is the primary user of this surface; tool
and parameter descriptions ARE the product copy.
**Constraints:** SK-MCP-002 (exactly three tools; creation is implicit via
`nlqdb_query` — do not add tools), SK-MCP-007 (hosted + stdio share one
core; every change lands on both), SK-TRUST-001 (diff before commit),
GLOBAL-012 (one-sentence errors + action).

Verified strengths to preserve: minimal 3-tool surface, `mapSdkError`'s
message+action shape, 1s revocation re-validation (SK-MCP-014), gate
errors that include live BIRD/Spider numbers.

---

## WS04-T1 (P1) — Tool/param descriptions under-specify the contract agents must learn by trial

- **Files:** `packages/mcp/src/tools.ts` (~lines 28-95: input + output
  Zod `.describe()` texts), `packages/mcp/src/server.ts`
  (`maxRowsInResponse = 200`, truncation in `formatQueryResult`)
- **Problem:** Four contract facts exist only in code, so a cold agent
  discovers them by failing:
  1. `q` gives no example of a well-formed goal.
  2. `db` doesn't say it's ignored on `pk_live_` keys *and* that omitting
     it on a multi-DB `sk_*` key yields `ambiguous_db` with candidates.
  3. `confirm` doesn't describe the two-call state machine (first call →
     `requires_confirm: true` + `diff`; re-call same tool with
     `confirm: true` to commit).
  4. `rows` is silently capped at 200 (`rowsTruncated`/`totalRowCount`
     exist but the cap and the recovery — refine the query — are
     undocumented).
- **Fix:** Enrich the `.describe()` strings in place (both transports
  inherit automatically per SK-MCP-007). Suggested texts:
  - `q`: "The natural-language goal. Example: 'top 5 customers by revenue
    this year'. Name tables explicitly when you know them; avoid pronouns."
  - `db`: "Database id or slug. Ignored for pk_live_ keys (scoped to one
    DB). For sk_live_/sk_mcp_ keys with multiple databases, omitting it
    returns ambiguous_db with candidate_dbs — pass one of those ids."
  - `confirm`: "Destructive writes are two calls: first call (confirm
    absent) returns requires_confirm: true plus a diff preview; show the
    diff, then re-call with confirm: true to commit. Read-only queries
    ignore this."
  - `rows`: "Result rows, capped at 200 for response size. When
    rowsTruncated is true, totalRowCount holds the full count — refine
    the query rather than paging."
  Keep each under ~3 sentences; descriptions are prompt-budget.
- **Accept:** All four facts visible in `tools/list` output; existing
  tests updated; stdio + hosted both reflect it.

## WS04-T2 (P2) — Auth errors conflate `sk_live_` and `sk_mcp_` scopes

- **Files:** `packages/mcp/src/tools.ts` (`mapSdkError`, ~lines 256-270)
- **Problem:** "This tool requires a user-scoped key (sk_live_ or
  sk_mcp_)" reads as if the two are interchangeable; `sk_live_` is
  read-oriented while `sk_mcp_` is the per-host MCP credential
  (SK-MCP-004). A user following the mint CTA can't choose correctly.
- **Fix:** One clause: "…(sk_live_ for read-only, sk_mcp_ for full MCP
  access)". Verify the exact capability split against
  `docs/features/api-keys/FEATURE.md` before wording it — don't guess.
- **Accept:** Message names which key for which purpose; still one
  sentence + action.

## WS04-T3 (P2) — stdio missing-key error hides the zero-setup hosted path

- **Files:** `packages/mcp/src/stdio.ts:19-24`
- **Problem:** A first-time user who installs `@nlqdb/mcp` without a key
  gets "NLQDB_API_KEY is not set. Run `nlq mcp install`…" — but
  `nlq mcp install` is still deferred (see WS-05), and the genuinely
  easiest path (hosted `mcp.nlqdb.com`, OAuth, no env) is never mentioned.
- **Fix:** Rewrite the stderr message to lead with the hosted option:
  "NLQDB_API_KEY is not set. Easiest: point your host at the hosted
  server (mcp.nlqdb.com — OAuth, no key needed). For local stdio, set
  env NLQDB_API_KEY=sk_mcp_… in the host config." Drop the
  `nlq mcp install` reference until that command ships.
- **Accept:** Message mentions hosted path first; no dead-end command
  referenced.

## WS04-T4 (P2) — Server version is hand-pinned at `0.0.0`

- **Files:** `packages/mcp/src/stdio.ts:5-7`
- **Problem:** `PACKAGE_VERSION = "0.0.0"` is "hand-maintained" but
  already drifted; every host sees v0.0.0 in server metadata, making
  upgrade debugging impossible.
- **Fix:** Cheapest honest fix per CLAUDE.md P5: a unit test asserting
  the constant equals `package.json#version` (so drift fails CI), plus
  set the constant to the current version. A build-time codegen is
  overkill for one constant.
- **Accept:** Test exists and passes; advertised version matches
  package.json.

## WS04-T5 (P2) — Rate-limit error invents no number but offers no real one either

- **Files:** `packages/mcp/src/tools.ts` (~lines 296-301)
- **Problem:** "Wait briefly and retry; rate limits reset within a
  minute." — "within a minute" is a guess in copy. Agents build backoff
  loops off this sentence.
- **Fix:** Read `docs/features/rate-limit/FEATURE.md` for the actual
  window/bucket semantics and state them ("resets within 60s" only if
  true). If the API returns `Retry-After` or a reset hint in the error
  body, surface that value instead of static copy. Do not invent numbers.
- **Accept:** Message matches the documented rate-limit behaviour, with
  the source decision ID in the commit message.
