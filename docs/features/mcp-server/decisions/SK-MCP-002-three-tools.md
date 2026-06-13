# SK-MCP-002 — Three tools, no `nlqdb_create_database`: `nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe`

- **Decision:** The MCP server exposes exactly three tools: `nlqdb_query(q, db?)`, `nlqdb_list_databases()`, `nlqdb_describe(db)`. There is **no public `nlqdb_create_database` tool** — `nlqdb_query` materializes the DB on first reference (per the goal-first inversion in `docs/architecture.md §0.1`). `db` is optional: omitting it lets `/v1/ask` auto-target the caller's only DB, create one from the goal when none exists, or return `ambiguous_db` with candidates on a multi-DB key — keeping the agent's prompt goal-first.
- **Core value:** Simple, Goal-first, Effortless UX
- **Why:** Two tools (`create`, then `query`) doubles the prompt the agent has to learn and creates an "agent forgot to call create" failure mode. One tool that does the right thing is the goal-first design applied to MCP — the agent never had a goal that was "create a database". Implicit creation is also what makes the persona walkthrough (P2 / Jordan) work: the system prompt has one tool, not two.
- **Consequence in code:** `packages/mcp/src/tools.ts` registers exactly three tool handlers. `nlqdb_query` POSTs to `/v1/ask` which routes through the typed-plan create path on first reference (`docs/architecture.md §3.6.2`). PRs adding more tools require explicit justification against `GLOBAL-017` ("one way to do each thing").
- **Alternatives rejected:**
  - Expose `nlqdb_create_database` as a power-user tool — dilutes the agent's prompt, contradicts §0.1 inversion.
  - One mega-tool that takes an `op` parameter — harder for the host LLM to plan with, no real simplification.
