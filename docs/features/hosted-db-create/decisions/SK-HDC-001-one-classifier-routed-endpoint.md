# SK-HDC-001 — One classifier-routed endpoint: `/v1/ask` does create, query, and write

- **Decision:** There is no `/v1/db/new`. `POST /v1/ask` accepts a `goal`, a cheap classifier-tier LLM call decides `kind ∈ {"create" | "query" | "write"}`, and `kind=create` routes to the typed-plan pipeline owned by this feature. `kind=query` and `kind=write` continue to use the existing read/write orchestrator.
- **Core value:** Simple, Goal-first
- **Why:** `GLOBAL-017` says one way to do each thing. No persona ever woke up wanting to "create a database" (`docs/runbook.md §10`); they want a meal-planner, an agent that remembers, a number for the 4pm sync. A separate "create" endpoint forces every surface to add a "are you starting fresh?" branch — exactly the DB-first framing `docs/architecture.md §0.1` rejects. Folding create into `/v1/ask` lets `<nlq-data>` work with no `db=` attribute, lets MCP work with no setup tool, and keeps the SDK / CLI / MCP surface symmetric.
- **Consequence in code:** The `/v1/ask` handler runs the classifier first, then routes `kind=create` to `db-create/orchestrate.ts` and `kind=query`/`kind=write` to the existing `ask/orchestrate.ts`. New create endpoints are rejected at review; surfaces (`<nlq-data>`, CLI, MCP, SDK) never branch on "create vs query" — they pass the goal and the API decides.
- **Alternatives rejected:**
  - `/v1/db/new` separate endpoint — forces every surface to add a "is this a new db?" branch; contradicts `GLOBAL-017` and the goal-first framing in `docs/architecture.md §0.1`.
  - Heuristic in the surface ("if no `db=`, call create") — pushes routing logic to N surfaces; drifts; the LLM classifier stays in one place.
