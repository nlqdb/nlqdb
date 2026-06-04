# SK-DB-010 — `engine?` on `db.create`: classifier-default with optional override

Parent feature: [`db-adapter/FEATURE.md`](../FEATURE.md).

- **Decision:** `db.create({ goal, engine? })` accepts an optional `engine: Engine`. If omitted, the classifier infers the engine from `goal` text using the engine-fit table in `SK-MULTIENG-002` (the prompt embeds it verbatim). Explicit `engine` overrides the classifier and skips its LLM call. Surface parity (`GLOBAL-003`): SDK / CLI (`--engine=…`) / MCP (`nlqdb_list_databases` returns `engine` per row) all carry the field; the web embed (`<nlq-data>`) does not (auto-create binds engine).
- **Core value:** Effortless UX, Simple
- **Why:** `GLOBAL-020` says no config in the first 60 s — default = inferred. `GLOBAL-015` says power users get an escape hatch — explicit override is that hatch. Two paths cover both audiences without adding a second endpoint (`GLOBAL-017`).
- **Consequence in code:** `apps/api/src/db-create/orchestrate.ts` calls a new `classifyEngine(goal)` step before schema inference when `engine` is unset. Default fallback is `"postgres"` if classifier confidence is below threshold. The `databases` row in D1 stores `engine` as a non-null column; existing rows back-fill to `"postgres"`.
- **Alternatives rejected:**
  - Always require `engine` — breaks `GLOBAL-020`.
  - Always classify (no override) — breaks `GLOBAL-015`.
  - Add a second endpoint per engine — breaks `GLOBAL-017`.
