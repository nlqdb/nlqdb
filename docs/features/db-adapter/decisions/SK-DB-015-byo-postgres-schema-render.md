# SK-DB-015 — BYO Postgres connect-time schema rendering: read-model → `schema_text` + `schema_hash`

Parent feature: [`db-adapter/FEATURE.md`](../FEATURE.md). The connect-path step
*after* introspection
([`SK-DB-014`](./SK-DB-014-byo-postgres-introspection.md)) and *before* sealing
([`GLOBAL-031`](../../../decisions/GLOBAL-031-byo-secret-envelope.md)): once the
live schema has been read into a faithful read-model, this turns that read-model
into the two stored fields `/v1/ask` plans against — `schema_text` (the schema
description the planner reads) and `schema_hash` (the plan-cache
content-address, [`GLOBAL-006`](../../../decisions/GLOBAL-006-plan-cache-content-addressing.md)).

- **Decision:** Two pure, zero-dep modules in `packages/db/`.
  `render-byo-postgres.ts`'s `renderByoPostgresSchema(schema)` renders an
  `IntrospectedSchema` (`SK-DB-014`) into `{ schemaText, schemaHash }`:
  schema-qualified `CREATE TABLE "schema"."table" ( … )` cards — one column line
  per `{ name, type, nullable }`, the introspected `format_type` string used
  *verbatim* as the column type, `NOT NULL` on a non-nullable column, and a
  trailing `PRIMARY KEY ( … )` line only when the table has one — followed by
  `ALTER TABLE … ADD FOREIGN KEY ( … ) REFERENCES … ( … )` lines, statements
  joined by blank lines. This is the same DDL shape the hosted create path
  stores (`orchestrate.ts` step 5, `compile-ddl.ts`) so the planner prompt sees
  one schema shape across hosted and BYO databases. The companion
  `schema-fingerprint.ts`'s `fingerprintSchema(canonical)` is the **one**
  `schema_hash` function — FNV-1a 32-bit, 8 hex chars — that both the BYO path
  (over the rendered `schema_text`) and the hosted create path (over the
  canonicalised `SchemaPlan` JSON, `build-deps.ts`) hash through, so the
  `databases.schema_hash` column has one shape, not two. Rendering is
  deterministic (the read-model is already sorted by `SK-DB-014`), so the same
  schema always yields the same text and therefore the same hash.
- **Core value:** Simple, Bullet-proof
- **Why:** BYO Postgres needs the same faithful "table names, columns + types,
  foreign keys" schema description the hosted path feeds the planner — and it
  needs it in the *same shape*, because the engine-quality work (few-shot
  exemplars, result-shape directives) is tuned on the create-path DDL; a BYO
  database the planner never authored should look identical in the prompt to one
  it did, so that work transfers unchanged. Two honesty constraints separate
  this renderer from `compile-ddl.ts`: foreign keys are rendered **without a
  constraint name** (the read-model drops the name on assembly, and synthesising
  one would put an identifier in the prompt that does not exist in the user's
  database — `ADD FOREIGN KEY` carries the only thing the planner needs, the
  relationship), and there is **no `ON DELETE` / `CREATE INDEX` / auto-`IDENTITY`**
  (introspection reads none of those, and we never write to a BYO database, so
  the text states what is there and nothing more). Sharing the hash function
  rather than copying the FNV loop is the `GLOBAL-006` content-address being one
  algorithm: two copies could silently drift, and there is no reason for a
  hosted and a BYO `schema_hash` to be computed differently. It is an internal
  primitive shipped ahead of its `registerByoDb` caller — the same
  pure-primitive-ahead-of-callers rhythm as `SK-DB-012`/`SK-DB-013`/`SK-DB-014` —
  so it carries no
  [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md)
  surface-parity obligation of its own; that lands with `/v1/db/connect`
  (`SK-DB-011`).
- **Consequence in code:** `packages/db/src/render-byo-postgres.ts` exports
  `renderByoPostgresSchema` + the `RenderedSchema` type, and
  `packages/db/src/schema-fingerprint.ts` exports `fingerprintSchema` — all
  re-exported from `@nlqdb/db`. `apps/api/src/db-create/build-deps.ts`'s
  `defaultSchemaHash` now delegates to `fingerprintSchema(JSON.stringify(plan))`
  (byte-identical to the previous inline FNV-1a, so no hosted `schema_hash`
  changes). `registerByoDb` (the open caller) calls `renderByoPostgresSchema`
  after `introspectPostgres` succeeds and seals + writes the returned
  `schemaText`/`schemaHash` to D1. Tests in
  `packages/db/test/render-byo-postgres.test.ts` pin the card shape, the
  PK-present/absent forms, the unnamed action-free composite FK, identifier
  quote-escaping, render determinism, the `schemaHash = fingerprintSchema(schemaText)`
  contract, and that a schema change changes the hash.
- **Alternatives rejected:**
  - **A new structured `schema_text` shape (JSON / a custom mini-grammar).**
    Diverges from the create-path DDL the planner prompt is tuned on, so
    engine-quality work would have to be re-tuned per source. DDL text is the
    shape that already works.
  - **Reuse `compile-ddl.ts` directly.** It compiles the *restricted* create
    contract (closed `ColumnType` enum, synthesised FK names, `ON DELETE`,
    `IDENTITY`, indexes) — wrong for a real user schema, which has arbitrary
    real types and whose referential actions/indexes we never read. The renderer
    states what introspection actually found.
  - **A second FNV copy in the renderer.** Two `schema_hash` implementations
    that must stay byte-compatible is a silent-drift hazard for the
    `GLOBAL-006` content-address; one shared `fingerprintSchema` removes it.
  - **A cryptographic hash (SHA-256).** `schema_hash` is a cache fingerprint,
    not a security boundary; we need stability across calls, not collision
    resistance against an adversary. FNV-1a is faster and the existing column
    shape.
- **Source:** canonical here · `SK-DB-014` (the read-model this renders) ·
  `SK-DB-011` (the `/v1/db/connect` + `registerByoDb` shape this feeds) ·
  `GLOBAL-006` (the plan-cache content-address `schema_hash` serves) ·
  `SK-SCHEMA-001` (one stable `schema_hash` string per DB).
