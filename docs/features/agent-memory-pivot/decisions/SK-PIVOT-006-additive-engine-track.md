# SK-PIVOT-006 — Engine track ships **additive** memory primitives; the existing contract is preserved

- **Decision:** The architectural commitment behind the wedge ships as a
  parallel **engine track** (`worksheets/engine/E-01..E-08`) — a canonical
  `agent_memory_v1` schema preset, additive MCP tools (`nlqdb_remember`,
  `nlqdb_recall`, `nlqdb_run`), per-agent scoping, TTL, pgvector hybrid
  recall, a preset on-ramp on the **authed** create surface (SK-PIVOT-010),
  and a workload-analyzer rule. **No existing MCP tool, API, table, or
  surface is renamed or removed.** The existing generalist `db.create` /
  `nlqdb_query` / `<nlq-data>` flows keep their contracts; the memory shape
  sits alongside as a first-class opt-in.
- **Core value:** Bullet-proof, Simple, Goal-first
- **Why:** The moat ("real SQL on structured memory, typed-plan trust
  boundary") is already shipped — but **being a database isn't the same as
  being the memory primitive an agent reaches for.** Today an agent must
  design its own schema via generic `db.create`, so the "zero schema design"
  claim isn't yet true. The engine track makes it true without an
  incompatible rebuild: keep `SK-MCP-002`'s tool contract and `db.create`'s
  generalist path (GLOBAL-036's dual front door), add memory shapes
  alongside. Renames are a hidden tax on early adopters; additive is the
  right shape pre-PMF.
- **Consequence in code:** New `apps/api/src/db-create/presets/agent-memory-v1.ts`
  (E-01) and a `{ preset }` field on `db.create`. New `nlqdb_remember`
  (E-02), `nlqdb_recall` (E-05), and `nlqdb_run` (E-08, SK-PIVOT-016) MCP
  tools alongside the existing ones. Per-agent scope via row-level RLS
  (E-03, `app.agent_id` GUC — SK-PIVOT-009), not query-rewriting.
  `expires_at` TTL with a scheduled sweep (E-04). pgvector index on
  `facts.content` + server-side hybrid fusion (E-05, infra-gated). Authed
  create surface passes `preset="agent_memory_v1"` (E-06, SK-PIVOT-010).
  Workload-analyzer + migration orchestrator gain a memory rule (E-07,
  Phase 3).
- **Alternatives rejected:** **Rename `nlqdb_query` to memory verbs** —
  breaks SK-MCP-002 and every integrated host for cosmetic gain. · **Replace
  the generalist `db.create` path with the memory preset** — destroys the
  P1/P3/P4 surfaces the dual-front-door (GLOBAL-036) is committed to. ·
  **Skip the engine track and let agents build their own memory schema via
  generic `db.create`** — what we have today; the "zero schema design"
  wedge claim is then false. · **One mega-PR for the whole track** —
  unreviewable, contradicts the daily-loop sizing rule.
