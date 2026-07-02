# SK-HDC-003 — Defense in depth: Zod over the plan + libpg_query parse over the compiled DDL

- **Decision:** Every create runs **two** validators in series: (1) Zod over the `SchemaPlan` rejects identifier collisions, reserved-word use, cross-tenant FK refs, and per-tenant table-count caps; (2) libpg_query parses the compiler's output and rejects anything containing `DROP / TRUNCATE / GRANT / REVOKE / pg_catalog / information_schema` — even though our compiler authored the SQL.
- **Core value:** Bullet-proof
- **Why:** Layered guardrails is the explicit lesson from `docs/research-receipts.md §1` (the Replit incident): AST-level reject-list, role isolation, RLS, statement timeout, transactional wrapper. None of these alone suffices. The Zod layer catches plan-shape errors (LLM hallucination); libpg_query catches compiler regressions (our bugs). Skipping either gives us one bug away from a bad statement reaching the executor.
- **Consequence in code:** `orchestrate.ts` Zod-validates before compile and libpg_query parse-validates after, before the provisioner sees the SQL; PRs that bypass either layer fail review. Same parse primitives as the read/write allowlist, separate validator instance because the allowed-verb set differs (`SK-HDC-006`).
- **Alternatives rejected:**
  - Trust the typed plan — works until the compiler regresses; the parse layer is cheap (libpg_query is fast).
  - Trust the parser only — Zod catches plan-shape problems libpg_query can't (cross-tenant FK refs, reserved words) because they parse fine but are semantically wrong.
