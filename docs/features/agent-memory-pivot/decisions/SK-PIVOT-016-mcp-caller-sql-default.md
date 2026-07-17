# SK-PIVOT-016 — Caller-inference is the MCP default lane: agents compose SQL; NL is the compile-and-coach fallback

- **Decision:** The MCP surface gains an **additive** `nlqdb_run` tool —
  the GLOBAL-015 raw-SQL escape hatch that every other surface already has
  (`/v1/run`, CLI `nlq run`, SDK `runSql()` per SK-SDK-009) — and the MCP
  tool contract makes **caller-composed SQL the default read lane**: tool
  descriptions steer capable agents to `nlqdb_describe` → compose SQL →
  `nlqdb_run`; `nlqdb_query` responses (which already return the compiled
  SQL) coach "edit this and re-run via `nlqdb_run`". Natural language stays
  one call away and is never removed (SK-MCP-002 additive rule).
  **`nlqdb_run` is read-only on MCP in v1**: write verbs are rejected via
  the existing `containsWriteVerb` gate — writes stay on the deterministic
  `nlqdb_remember` and on `nlqdb_query`'s `confirm_required` diff flow, so
  the GLOBAL-023 / SK-TRUST-001 mutation-confirm contract is preserved
  without building a raw-SQL confirm flow. (A later widen may add raw
  writes behind the same `confirm_required` diff, or `dryRun` per
  SK-SDK-012, if demanded.)
- **Core value:** Goal-first, Simple, Bullet-proof
- **Why:** Smoothest possible onboarding for SaaS builders and the coding
  agents that build with them (the ratified 2026-07-17 design rule): the
  calling agent already spent its own inference deciding what it wants —
  expressing that as SQL is free for a frontier coding agent, while our NL
  hop costs seconds of latency and free-chain budget per call. Default-SQL
  makes MCP reads faster (performance pillar), our marginal inference cost
  ~zero (protects the free chain from the highest-volume callers), and the
  frontier lane of the GLOBAL-025 bet materialises through the caller at
  $0. Everything needed exists server-side: `/v1/run` bypasses only the
  LLM steps — same three-stage validator (SK-SQLAL-001), same exec wrapper
  (tenant RLS + `SET LOCAL ROLE`), and E-03's agent/end-user restrictive
  policies (SK-PIVOT-009) gate SQL of **any** provenance, so
  caller-composed SQL is exactly as scoped as ours. The formal MCP
  alternative — spec "sampling" (`sampling/createMessage`), where the
  server borrows the client's model — is rejected: Claude Code and Claude
  Desktop do not support it (anthropics/claude-code#1785, open since
  2025-06), and the spec makes it human-in-the-loop by design
  (modelcontextprotocol.io/specification/2025-06-18/client/sampling).
- **Consequence in code:** Worksheet
  [`E-08`](../worksheets/engine/E-08-caller-sql-lane.md). `packages/mcp`
  registers `nlqdb_run` (additive; SK-MCP-002's verb list gains it on
  ship) calling `/v1/run` via the SDK; tool descriptions get the
  describe→run steering (copy change, SK-PIVOT-003 pattern);
  `nlqdb_query`'s response text gains the re-run coach line. NL remains
  first-class as the human path **and the engine-portability layer** —
  caller SQL binds to the engine dialect (accepted for the escape hatch
  since GLOBAL-015), so an E-07 engine migration is what NL insulates
  callers from. Sequenced **after E-03** so the scope gates are live
  before arbitrary agent SQL is invited at memory scale.
- **Alternatives rejected:** **MCP sampling** — unsupported by the exact
  hosts the wedge targets; approval-dialog friction (above). · **BYOLLM /
  free-key as the only MCP lanes** — leaves the smoothest caller path
  (zero LLM config) on the table and pays inference for callers who don't
  need it. · **NL-only MCP** — forfeits GLOBAL-015 parity on the one
  surface agents actually use. · **Raw writes on `nlqdb_run` v1** — would
  bypass the SK-TRUST-001 confirm contract on the MCP surface for
  marginal gain; `nlqdb_remember` + NL-with-confirm already cover writes.
