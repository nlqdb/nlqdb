// Contract tests for the `agent_memory_v1` schema preset (E-01 run 1).
//
// Two things matter here:
//   1. The table + column set is the public contract (SK-PIVOT-007) —
//      pin it so a silent rename/drop is rejected at PR time.
//   2. The preset's plain DDL must pass the *same* libpg_query DDL
//      validator the LLM-compiled path uses (SK-HDC-006), so wiring it
//      into the provisioner (E-01 run 2) can't smuggle a destructive
//      verb past defense-in-depth. We assert that here, before any
//      request-path wiring exists.

import { describe, expect, it } from "vitest";
import { validateCompiledDdl } from "../../ask/sql-validate-ddl.ts";
import {
  AGENT_MEMORY_V1_COLUMNS,
  AGENT_MEMORY_V1_VERSION,
  agentMemoryV1Ddl,
} from "./agent-memory-v1.ts";

const SCHEMA = "agent_mem_ab12cd";

describe("agent_memory_v1 preset", () => {
  it("exports the stable version tag", () => {
    expect(AGENT_MEMORY_V1_VERSION).toBe("agent_memory_v1");
  });

  it("emits one CREATE TABLE per contract table, schema-qualified", () => {
    const ddl = agentMemoryV1Ddl(SCHEMA);
    for (const table of Object.keys(AGENT_MEMORY_V1_COLUMNS)) {
      expect(ddl.some((s) => s.includes(`CREATE TABLE "${SCHEMA}"."${table}"`))).toBe(true);
    }
  });

  it("declares every contracted column on its table (SK-PIVOT-007)", () => {
    const ddl = agentMemoryV1Ddl(SCHEMA);
    for (const [table, columns] of Object.entries(AGENT_MEMORY_V1_COLUMNS)) {
      const create = ddl.find((s) => s.includes(`CREATE TABLE "${SCHEMA}"."${table}"`));
      expect(create, `CREATE TABLE for ${table}`).toBeDefined();
      for (const col of columns) {
        expect(create, `${table}.${col}`).toContain(`"${col}"`);
      }
    }
  });

  it("links entity_facts to entities and facts with ON DELETE CASCADE", () => {
    const ddl = agentMemoryV1Ddl(SCHEMA);
    const fks = ddl.filter((s) => s.includes("FOREIGN KEY"));
    expect(fks).toHaveLength(2);
    expect(fks.every((s) => s.includes("ON DELETE CASCADE"))).toBe(true);
    expect(fks.some((s) => s.includes(`REFERENCES "${SCHEMA}"."entities"`))).toBe(true);
    expect(fks.some((s) => s.includes(`REFERENCES "${SCHEMA}"."facts"`))).toBe(true);
  });

  it("gives entities a multi-column uniqueness and entity_facts a composite PK", () => {
    const ddl = agentMemoryV1Ddl(SCHEMA);
    const entities = ddl.find((s) => s.includes(`"${SCHEMA}"."entities"`));
    expect(entities).toContain(`UNIQUE ("agent_id", "kind", "canonical_name")`);
    const link = ddl.find((s) => s.includes(`CREATE TABLE "${SCHEMA}"."entity_facts"`));
    expect(link).toContain(`PRIMARY KEY ("entity_id", "fact_id")`);
  });

  it("defers the pgvector embedding column to E-05 (provisions on stock Postgres)", () => {
    const ddl = agentMemoryV1Ddl(SCHEMA).join("\n");
    expect(ddl).not.toMatch(/vector/i);
    expect(ddl).not.toMatch(/embedding/i);
  });

  it("passes the libpg_query DDL validator (SK-HDC-006 defense-in-depth)", () => {
    expect(validateCompiledDdl(agentMemoryV1Ddl(SCHEMA))).toEqual({ ok: true });
  });

  it("rejects an unsafe schema name before quoting (SK-HDC-009)", () => {
    expect(() => agentMemoryV1Ddl(`evil"; DROP SCHEMA public; --`)).toThrow(/unsafe schema name/);
    expect(() => agentMemoryV1Ddl("a".repeat(64))).toThrow(/63-char/);
  });
});
