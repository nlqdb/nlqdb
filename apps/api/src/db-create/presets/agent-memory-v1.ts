// Canonical `agent_memory_v1` schema preset for the db.create path
// (agent-memory pivot engine track, worksheet E-01). An agent that
// wants memory picks this up with **zero schema design**: `db.create`
// today infers a schema from an English goal, but the agent still has
// to know what tables it wants. The preset says "agent memory has a
// known shape; here it is" — every later engine worksheet (E-02
// remember/recall, E-03 scoping, E-04 TTL, E-05 hybrid recall) writes
// to or queries these four tables.
//
// Why plain DDL and not a `SchemaPlan`: the memory shape needs
// multi-column UNIQUE (`entities`), a composite-PK link table
// (`entity_facts`), `ON DELETE CASCADE`, and `TEXT[]` + GIN — beyond
// the LLM-inferred `SchemaPlan` grammar the deterministic compiler
// (`compile-ddl.ts`) accepts. The preset is *our* deterministic DDL,
// not the LLM's, so it bypasses inference + the SchemaPlan compiler —
// but it is authored to pass the **same** libpg_query DDL validator
// (`ask/sql-validate-ddl.ts`, SK-HDC-006), which is asserted in the
// test. Defense-in-depth (SK-HDC-003) is preserved: the preset still
// flows through the validator + provisioner when wired (E-01 run 2).
//
// Contract (SK-PIVOT-007): the table + column set below is part of the
// public contract once shipped. Widen by `ALTER TABLE ADD COLUMN`
// (GLOBAL-004); evolve breaking changes by promoting to
// `agent_memory_v2`; never rename or drop in place on an active preset.
//
// Deferred to later engine slices (kept out of v1 so the preset
// provisions on stock Postgres with no extension): `facts.embedding
// VECTOR(?)` is E-05 (pgvector — its own multi-run slice, all code:
// per-DB `CREATE EXTENSION IF NOT EXISTS vector`) and lands as an additive
// ADD COLUMN widen. `facts.expires_at` ships now (a plain nullable
// column); the TTL sweep that consumes it is E-04.
//
// Sibling skill: `docs/features/hosted-db-create/FEATURE.md` (the
// create path E-01 extends) and
// `docs/features/agent-memory-pivot/worksheets/engine/E-01-memory-schema-preset.md`.

import type { Column, ColumnType, ForeignKey, SchemaPlan, Table } from "@nlqdb/db";

// The versionTag that flows into `schema_hash` (E-01 run 2 wires it via
// the SchemaPlan projection below — `slug_hint` carries it), so the
// preset path is a distinct, stable schema identity for the plan cache
// (GLOBAL-006) and the workload-analyzer rule (E-07).
export const AGENT_MEMORY_V1_VERSION = "agent_memory_v1" as const;

// The opt-in `{ preset }` value `db.create` accepts (SK-HDC-020). The
// route handler validates the request body against this and gates it
// behind the `MEMORY_PRESET` flag; the orchestrator branches on it to
// skip inferSchema/classifyEngine/compileDdl.
export type MemoryPreset = typeof AGENT_MEMORY_V1_VERSION;

// The canonical column set per table (SK-PIVOT-007 contract). The
// test pins these so a silent rename/drop is rejected at PR time;
// adding a column here is a widen and is allowed.
export const AGENT_MEMORY_V1_COLUMNS = {
  facts: [
    "id",
    "agent_id",
    "end_user_id",
    "thread_id",
    "kind",
    "content",
    "tags",
    "source",
    "created_at",
    "expires_at",
  ],
  episodes: [
    "id",
    "agent_id",
    "end_user_id",
    "thread_id",
    "role",
    "content",
    "tool_calls",
    "tokens",
    "occurred_at",
  ],
  entities: [
    "id",
    "agent_id",
    "kind",
    "canonical_name",
    "properties",
    "first_seen_at",
    "last_seen_at",
  ],
  entity_facts: ["entity_id", "fact_id"],
} as const satisfies Record<string, readonly string[]>;

export type AgentMemoryV1Table = keyof typeof AGENT_MEMORY_V1_COLUMNS;

// SK-HDC-009 — identifier guard, mirrored from `neon-provision.ts`.
// The preset is the last-mile author of its own SQL, so it re-validates
// the only interpolated identifier (the per-db schema name) before
// quoting, even though the provisioner asserts it again upstream.
function assertSafeSchemaName(value: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`agent-memory-v1: unsafe schema name "${value}"`);
  }
  if (value.length > 63) {
    throw new Error(`agent-memory-v1: schema name "${value}" exceeds Postgres 63-char limit`);
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Emit the deterministic `agent_memory_v1` DDL, schema-qualified for
 * `schemaName`. Statement order is locked: four `CREATE TABLE`, the two
 * `entity_facts` FK attachments (ALTER ADD CONSTRAINT — forward-ref safe,
 * the house style from `compile-ddl.ts`), then the read/GIN indexes.
 * `CREATE SCHEMA` is intentionally absent — the provisioner creates the
 * schema (matches the `compile-ddl.ts` contract).
 */
export function agentMemoryV1Ddl(schemaName: string): string[] {
  assertSafeSchemaName(schemaName);
  const q = (table: string) => `${quoteIdent(schemaName)}.${quoteIdent(table)}`;

  return [
    `CREATE TABLE ${q("facts")} (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY,
  "agent_id" TEXT NOT NULL,
  "end_user_id" TEXT,
  "thread_id" TEXT,
  "kind" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT '{}',
  "source" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMPTZ,
  PRIMARY KEY ("id")
);`,
    `CREATE TABLE ${q("episodes")} (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY,
  "agent_id" TEXT NOT NULL,
  "end_user_id" TEXT,
  "thread_id" TEXT,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "tool_calls" JSONB,
  "tokens" INTEGER,
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id")
);`,
    `CREATE TABLE ${q("entities")} (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY,
  "agent_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "canonical_name" TEXT NOT NULL,
  "properties" JSONB,
  "first_seen_at" TIMESTAMPTZ,
  "last_seen_at" TIMESTAMPTZ,
  PRIMARY KEY ("id"),
  UNIQUE ("agent_id", "kind", "canonical_name")
);`,
    `CREATE TABLE ${q("entity_facts")} (
  "entity_id" BIGINT NOT NULL,
  "fact_id" BIGINT NOT NULL,
  PRIMARY KEY ("entity_id", "fact_id")
);`,
    `ALTER TABLE ${q("entity_facts")}
  ADD CONSTRAINT "fk_entity_facts__entity_id"
  FOREIGN KEY ("entity_id")
  REFERENCES ${q("entities")} ("id")
  ON DELETE CASCADE;`,
    `ALTER TABLE ${q("entity_facts")}
  ADD CONSTRAINT "fk_entity_facts__fact_id"
  FOREIGN KEY ("fact_id")
  REFERENCES ${q("facts")} ("id")
  ON DELETE CASCADE;`,
    // Scope index: every read filters by (agent_id, end_user_id,
    // thread_id) then orders by recency — the leading scope columns are
    // the ones E-03's RLS policies key on (SK-PIVOT-009).
    `CREATE INDEX "idx_facts__scope" ON ${q("facts")} ("agent_id", "end_user_id", "thread_id", "created_at" DESC);`,
    `CREATE INDEX "idx_episodes__scope" ON ${q("episodes")} ("agent_id", "end_user_id", "thread_id", "occurred_at" DESC);`,
    `CREATE INDEX "idx_facts__tags" ON ${q("facts")} USING GIN ("tags");`,
    `CREATE INDEX "idx_entity_facts__fact_id" ON ${q("entity_facts")} ("fact_id");`,
  ];
}

// Typed `SchemaPlan` *projection* of the v1 shape. The executable schema
// is the hand-authored DDL above (`agentMemoryV1Ddl`) — the SchemaPlan
// grammar can't express `TEXT[]` + GIN, a composite-PK link table,
// multi-column UNIQUE, or `ON DELETE CASCADE` (SK-PIVOT-006), which is
// why run 1 authored plain DDL. This projection is the metadata the
// orchestrator still needs on the preset path, so the rest of the
// pipeline is unchanged:
//   • the table list → RLS policies + the recent-tables MRU (SK-ASK-012)
//   • the FK summary → echoed on the create response
//   • a deterministic, version-keyed `schema_hash`: `slug_hint` is the
//     version, and no per-DB schema name leaks into the plan, so every
//     `agent_memory_v1` database shares one plan-cache fingerprint
//     (GLOBAL-006).
// Column names/types mirror `agentMemoryV1Ddl`; the contract test pins
// them to `AGENT_MEMORY_V1_COLUMNS` so the two representations can't drift.
type ColSpec = readonly [name: string, type: ColumnType, nullable: boolean];

function buildTable(name: string, pk: string[], cols: readonly ColSpec[]): Table {
  return {
    name,
    description: `agent_memory_v1 ${name}`,
    primary_key: pk,
    columns: cols.map(
      ([colName, type, nullable]): Column => ({
        name: colName,
        type,
        nullable,
        description: `${name}.${colName}`,
      }),
    ),
  };
}

export function agentMemoryV1Plan(): SchemaPlan {
  const tables: Table[] = [
    buildTable(
      "facts",
      ["id"],
      [
        ["id", "bigint", false],
        ["agent_id", "text", false],
        ["end_user_id", "text", true],
        ["thread_id", "text", true],
        ["kind", "text", false],
        ["content", "text", false],
        ["tags", "text_array", false],
        ["source", "jsonb", true],
        ["created_at", "timestamp_tz", false],
        ["expires_at", "timestamp_tz", true],
      ],
    ),
    buildTable(
      "episodes",
      ["id"],
      [
        ["id", "bigint", false],
        ["agent_id", "text", false],
        ["end_user_id", "text", true],
        ["thread_id", "text", true],
        ["role", "text", false],
        ["content", "text", false],
        ["tool_calls", "jsonb", true],
        ["tokens", "integer", true],
        ["occurred_at", "timestamp_tz", false],
      ],
    ),
    buildTable(
      "entities",
      ["id"],
      [
        ["id", "bigint", false],
        ["agent_id", "text", false],
        ["kind", "text", false],
        ["canonical_name", "text", false],
        ["properties", "jsonb", true],
        ["first_seen_at", "timestamp_tz", true],
        ["last_seen_at", "timestamp_tz", true],
      ],
    ),
    buildTable(
      "entity_facts",
      ["entity_id", "fact_id"],
      [
        ["entity_id", "bigint", false],
        ["fact_id", "bigint", false],
      ],
    ),
  ];

  const foreign_keys: ForeignKey[] = [
    {
      from_table: "entity_facts",
      from_columns: ["entity_id"],
      to_table: "entities",
      to_columns: ["id"],
      on_delete: "cascade",
    },
    {
      from_table: "entity_facts",
      from_columns: ["fact_id"],
      to_table: "facts",
      to_columns: ["id"],
      on_delete: "cascade",
    },
  ];

  return {
    // `slug_hint` IS the version tag (lower_snake, GLOBAL-004): it drives
    // both the dbId/schema name (`db_agent_memory_v1_<6hex>`) and the
    // version-keyed `schema_hash`.
    slug_hint: AGENT_MEMORY_V1_VERSION,
    description: "Canonical agent-memory schema (facts / episodes / entities / entity_facts).",
    tables,
    foreign_keys,
    // The semantic layer (SK-HDC-004) and seed rows are empty on the
    // preset path — an agent fills its own memory at runtime.
    metrics: [],
    dimensions: [],
    sample_rows: [],
  };
}
