# WS-06 — Agent-native surfaces (the "AI does the integrating" worksheet)

**Premise:** Within nlqdb's market window, the entity that discovers,
evaluates, and integrates nlqdb is increasingly an AI agent acting for a
human. The product is already architecturally agent-first (goal-first
create, MCP surface, structured errors, strict `--json`). What's missing
is the *documentation supply chain* an agent consumes: today an agent
fetching `nlqdb.com/llms.txt` gets marketing links only — no install
command, no API shape, no docs-site pointer. These tasks close that gap.

**Scope:** `apps/web/src/pages/llms.txt.ts`, `apps/docs/`,
`apps/mcp/src/index.ts`, `tools/stranger-test/`.
**Pre-reads:** `docs/features/comparison-pages/FEATURE.md` (SK-CMP-004
owns llms.txt), `docs/features/docs-site/FEATURE.md`,
`docs/features/mcp-server/FEATURE.md`,
`docs/features/stranger-test/FEATURE.md`, `docs/features/sdk/FEATURE.md`.
**Default KPI:** Onboarding (agent-mediated acquisition).

---

## WS06-T1 (P1) — llms.txt has no "Integrate" section

- **Files:** `apps/web/src/pages/llms.txt.ts` (verified: emits Pages /
  Comparisons / Solve pages / Optional / Status / Contact — zero
  integration content, no docs.nlqdb.com link)
- **Problem:** llms.txt is the file coding agents fetch when told
  "add nlqdb to my app". Today it answers "what is nlqdb" but not "how do
  I integrate it" — the one question an agent is there to answer.
- **Fix:** Add an `## Integrate` section: one line + link per surface —
  HTML element (script tag + `<nlq-data>` one-liner), SDK
  (`npm i @nlqdb/sdk` + 3-line ask), CLI (install one-liner +
  `nlq "<goal>"`), MCP (hosted `mcp.nlqdb.com` config snippet), HTTP
  (`POST /v1/ask` curl) — each linking to the canonical docs page
  (docs.nlqdb.com once WS06-T2 lands). Source the snippets from a typed
  data file (or reuse the CodePanel snippet data if extractable) so it
  stays a one-file edit per SK-CMP-004's build-time-endpoint rationale.
  Keep total file size modest — llms.txt is consumed inside prompt
  budgets.
- **Accept:** `curl nlqdb.com/llms.txt` shows all five surfaces with
  copy-runnable snippets/links; content derives from data, not prose
  duplicated by hand.

## WS06-T2 (P1) — Docs site has no SDK / framework-wrapper page

- **Files:** `apps/docs/src/content/docs/` (verified contents: `cli.mdx`,
  `index.mdx` (45 lines), `mcp.mdx`, `pre-alpha.mdx`,
  `reference/http-api.mdx` — nothing for `@nlqdb/sdk` or the 8 wrappers)
- **Problem:** Nine published packages have READMEs but docs.nlqdb.com —
  the surface both humans and agents are told to read — doesn't mention
  the SDK at all. GLOBAL-003 parity in docs, not just code.
- **Fix:** Add `sdk.mdx` (install, `createClient`, `ask`/`runSql`, error
  handling on `err.code`, auth modes) and `frameworks.mdx` (one section
  per wrapper with the working snippet from its README + the naming
  conventions table from WS03-T4). Link both from `index.mdx` and the
  sidebar. Don't fork content: where a README already says it, keep the
  docs page summary-level and link out — one canonical body per fact.
- **Accept:** docs site builds; SDK reachable ≤1 click from docs home;
  snippets copy-paste-run.

## WS06-T3 (P2) — Docs site itself serves no llms.txt

- **Files:** `apps/docs/` (Starlight)
- **Problem:** Agents that land on docs.nlqdb.com get no machine index;
  the marketing llms.txt (WS06-T1) shouldn't inline full docs either —
  the docs site should self-describe.
- **Fix:** Per CLAUDE.md P2, web-search current best practice first
  (`starlight llms.txt plugin` — a maintained plugin existed as of 2025;
  verify latest stable before adopting) and emit `/llms.txt` (+
  `/llms-full.txt` if the plugin supports it) from the docs build. Then
  link it from the marketing llms.txt.
- **Accept:** `curl docs.nlqdb.com/llms.txt` returns a generated index of
  every docs page; source cited in the PR body.

## WS06-T4 (P2) — Error codes have no reference page

- **Files:** `apps/docs/src/content/docs/reference/http-api.mdx`;
  source of truth: `ApiErrorCode` + `ApiErrorBody` in
  `packages/sdk/src/index.ts`
- **Problem:** GLOBAL-012 errors are excellent at runtime, but there is
  no enumerable reference an agent can read *before* calling — which
  codes exist, which are retryable, which need a human (e.g.
  `feature_gated` vs `rate_limited` vs `ambiguous_db`).
- **Fix:** Add an error-code table (code · HTTP status · meaning ·
  retryable? · recovery action) to the http-api reference. Keep it in
  lockstep with the SDK union — cheapest guard is a docs-side test or a
  generation script reading the union; choose the simpler (P5). Note the
  extra envelope fields that matter to agents (`candidate_dbs`, `gate`,
  `waitlist_url`, `requires_confirm`).
- **Accept:** Every member of `ApiErrorCode` appears in the table; a
  drift guard exists.

## WS06-T5 (P2) — Anthropic Connectors Directory engineering prereqs

- **Files:** `apps/mcp/src/index.ts`
- **Problem:** `docs/blocked-by-human.md` already tracks the directory
  *submission* as a human action, and notes its two engineering prereqs
  can ship without the human: Origin-header validation in
  `apps/mcp/src/index.ts` + a branded 256×256 SVG logo. Directory listing
  is the highest-leverage agent-discovery channel for the MCP surface.
- **Fix:** Implement Origin validation per current MCP
  streamable-HTTP security guidance (web-search the spec's latest
  revision first, P2) and add the logo asset where the submission needs
  it. Leave the blocked-by-human bullet in place for the form itself.
- **Accept:** Origin checks covered by a test; logo committed; bullet in
  blocked-by-human.md updated to "prereqs done, form pending".

## WS06-T6 (P2) [decision needed] — Cold-agent stranger test

- **Context:** `tools/stranger-test/` + `docs/features/stranger-test/`
  exist for human-shaped cold-start walks. The agent-era equivalent: a
  scripted run where a coding agent is given ONLY `https://nlqdb.com/llms.txt`
  and must reach a first successful query (via MCP or CLI), with every
  friction point logged. That metric ("agent time-to-first-query, no
  human help") is the purest measure of WS06-T1..T4 and arguably a
  GLOBAL-025 onboarding KPI candidate.
- **Task:** Do not build unprompted — it's new eval scope with LLM cost.
  Propose it to the user, citing `stranger-test/FEATURE.md`; if accepted,
  spec it as an SK in that feature first (P4-D1), then implement.

## Out of scope, deliberately

- New MCP tools/prompts/resources beyond the three tools — SK-MCP-002 is
  explicit; raise a P1 with the user before touching.
- Auto-generated per-page OG images, semantic-layer exposure, ingress
  OTel — tracked elsewhere (`comparison-pages` parked items,
  `docs/future/semantic-layer.md`, `byo-otel`).
