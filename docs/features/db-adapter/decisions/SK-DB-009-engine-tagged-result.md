# SK-DB-009 — Engine-tagged Plan + `AsyncIterable<Row>` result; `meta` for engine extras

- **Decision:** The public adapter signature widens (from `SK-DB-001`)
  to `execute(plan, signal?: AbortSignal): EngineResult` where `plan`
  is a discriminated union by `engine` and `EngineResult =
  AsyncIterable<Row> & { meta }` with `Row = Record<string, unknown>`.
  Each adapter projects its native result shape into row-shape;
  engine extras (column schema, command tag, batch count) travel on
  `meta`. The Postgres adapter keeps its `(sql, params)` underlying
  call shape; only the public type widens.
- **Core value:** Simple, Bullet-proof
- **Why:** Anchored by `SK-MULTIENG-001`. ADBC-shaped row streaming
  gives one renderer/summariser surface; one Result type per engine
  multiplies consumer narrowing across `<nlq-data>`, the summariser,
  and the plan-cache hit log. `AbortSignal` is the standard Workers
  cancellation primitive.
- **Consequence in code:** `packages/db/src/types.ts` exports
  `EnginePlan = PgPlan | ChPlan | …`, `Row`, `EngineMeta`, and
  `EngineResult`. The PG adapter's `EnginePlan` variant is
  `{ engine: "postgres", sql, params }`; new adapters add their own
  variant. Tests stub the `query` injection seam (`SK-DB-006`)
  unchanged.
- **Alternatives rejected:**
  - Discriminated `EngineResult` union — pushes engine-narrowing onto
    every consumer.
  - Per-adapter Result types — fragments the renderer/summariser
    surface.
  - Substrait IR — heavy abstraction tax for an LLM that emits engine
    grammars directly.
