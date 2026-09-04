// Contract tests for the `agent_memory_v1` schema preset (E-01 run 1).
//
// Two things matter here:
//   1. The table + column set is the public contract (seed contract) —
//      pin it so a silent rename/drop is rejected at PR time.
//   2. The preset's plain DDL must pass the *same* libpg_query DDL
//      validator the LLM-compiled path uses (SK-HDC-006), so wiring it
//      into the provisioner (E-01 run 2) can't smuggle a destructive
//      verb past defense-in-depth. We assert that here, before any
//      request-path wiring exists.

import { SchemaPlanSchema } from "@nlqdb/db";
import { describe, expect, it } from "vitest";
import { validateCompiledDdl } from "../../ask/sql-validate-ddl.ts";
import {
  AGENT_MEMORY_V1_COLUMNS,
  AGENT_MEMORY_V1_VERSION,
  agentMemoryV1Ddl,
  agentMemoryV1Plan,
  agentMemoryV1ScopePolicies,
  isAgentMemoryV1Db,
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

  it("declares every contracted column on its table (seed contract)", () => {
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

  it("indexes facts.expires_at (partial) so the E-04 sweep is not a per-write seq scan", () => {
    const ddl = agentMemoryV1Ddl(SCHEMA);
    const ttl = ddl.find((s) => s.includes(`"idx_facts__expires_at"`));
    expect(ttl).toContain(`ON "${SCHEMA}"."facts" ("expires_at")`);
    expect(ttl).toContain(`WHERE "expires_at" IS NOT NULL`);
  });

  it("defers the pgvector embedding column to E-05 (provisions on stock Postgres)", () => {
    const ddl = agentMemoryV1Ddl(SCHEMA).join("\n");
    expect(ddl).not.toMatch(/vector/i);
    expect(ddl).not.toMatch(/embedding/i);
  });

  it("passes the libpg_query DDL validator (SK-HDC-006 defense-in-depth)", () => {
    expect(validateCompiledDdl(agentMemoryV1Ddl(SCHEMA))).toEqual({ ok: true });
  });

  // The inline `-- comment` hints ARE the planner's `Schema:` block for a
  // memory-preset DB (this DDL text is stored verbatim as `schema_text`),
  // so pin the load-bearing structural hints (SK-QUAL-023 criterion-4
  // lever). They are GLOBAL-037 lane-1 schema descriptions — no cell-value
  // may appear, which the next assertion guards.
  it("carries the planner-facing structural hints (SK-PIVOT-016 criterion-4)", () => {
    const ddl = agentMemoryV1Ddl(SCHEMA).join("\n");
    // owning-agent scoping, kind-is-categorical, content-vs-entity,
    // supersession-by-recency, entity_facts traversal, group-by canonical_name.
    expect(ddl).toContain("the OWNING agent");
    expect(ddl).toContain("categorical token");
    expect(ddl).toContain("entity_facts -> entities");
    expect(ddl).toContain(`ORDER BY "created_at" DESC`);
    expect(ddl).toContain("Traverse facts -> entity_facts -> entities");
    expect(ddl).toContain("GROUP BY this when a question asks WHICH entity");
  });

  it("keeps the hints schema-only — no seed/user cell-value egress (GLOBAL-037)", () => {
    // Comment text may name columns/tables and query conventions, never a
    // real stored value. Guard against the pack-specific example literals the
    // eval fixtures carry ever leaking into the shared base DDL.
    const comments = agentMemoryV1Ddl(SCHEMA)
      .join("\n")
      .split("\n")
      .filter((l) => l.includes("--"))
      .join("\n");
    for (const leak of ["open_question", "decision_status", "GLOBAL-", "student:", "repo-ops"]) {
      expect(comments, `hint must not embed the value "${leak}"`).not.toContain(leak);
    }
  });

  it("rejects an unsafe schema name before quoting (SK-HDC-009)", () => {
    expect(() => agentMemoryV1Ddl(`evil"; DROP SCHEMA public; --`)).toThrow(/unsafe schema name/);
    expect(() => agentMemoryV1Ddl("a".repeat(64))).toThrow(/63-char/);
  });
});

// E-03 / SK-PIVOT-009 — the security invariant of the whole memory wedge
// lives in these policies, so the tests pin the generated SQL clause by
// clause. `AS RESTRICTIVE` is the load-bearing keyword: without it Postgres
// OR-combines the policy with the permissive `tenant_isolation` and every
// agent reads every other agent's memory while the code still "has RLS".
describe("agentMemoryV1ScopePolicies", () => {
  const TENANT = "user_42";
  const policies = () => agentMemoryV1ScopePolicies(SCHEMA, TENANT);
  const policyOn = (name: string, table: string) =>
    policies().find((s) => s.startsWith(`CREATE POLICY ${name} ON "${SCHEMA}"."${table}"`));

  it("creates EVERY policy AS RESTRICTIVE (permissive would OR with tenant_isolation)", () => {
    const all = policies();
    expect(all.length).toBeGreaterThan(0);
    for (const sql of all) {
      expect(sql, sql).toMatch(/AS RESTRICTIVE USING \(/);
    }
    expect(all.filter((s) => /AS PERMISSIVE/.test(s))).toEqual([]);
  });

  it("puts an agent_isolation policy on all four contract tables", () => {
    for (const table of Object.keys(AGENT_MEMORY_V1_COLUMNS)) {
      expect(policyOn("agent_isolation", table), `agent_isolation on ${table}`).toBeDefined();
    }
  });

  it("keys agent_isolation on the GUC-or-baked-tenant-literal pair (owner stays sighted)", () => {
    for (const table of ["facts", "episodes", "entities"]) {
      const sql = policyOn("agent_isolation", table);
      expect(sql, table).toContain(`current_setting('app.agent_id', true) = "agent_id"`);
      expect(sql, table).toContain(`current_setting('app.agent_id', true) = '${TENANT}'`);
    }
  });

  it("carries E-04's TTL read arm on facts only (SK-PIVOT-011)", () => {
    expect(policyOn("agent_isolation", "facts")).toContain(
      `AND ("expires_at" IS NULL OR "expires_at" > now())`,
    );
    for (const table of ["episodes", "entities", "entity_facts"]) {
      expect(policyOn("agent_isolation", table), table).not.toContain("expires_at");
    }
  });

  it("scopes the entity_facts link table through its parent entities row", () => {
    const sql = policyOn("agent_isolation", "entity_facts");
    expect(sql).toContain(`"entity_id" IN (SELECT e."id" FROM "${SCHEMA}"."entities" AS e`);
    expect(sql).toContain(`current_setting('app.agent_id', true) = e."agent_id"`);
    expect(sql).toContain(`current_setting('app.agent_id', true) = '${TENANT}'`);
  });

  it("gates end_user_id / thread_id only when the GUC is set (opt-in hard gate)", () => {
    for (const [name, guc, column] of [
      ["end_user_isolation", "app.end_user_id", "end_user_id"],
      ["thread_isolation", "app.thread_id", "thread_id"],
    ] as const) {
      for (const table of ["facts", "episodes"]) {
        const sql = policyOn(name, table);
        expect(sql, `${name} on ${table}`).toBeDefined();
        // absent GUC ⇒ the arm is a no-op, so cross-end-user analytics still
        // run inside the agent scope. `nullif(…, '')` — NOT a bare
        // `IS NULL` — because a custom GUC resets to the empty string once
        // anything has set it on that backend session (Neon reuses
        // backends), which would otherwise zero every later unnarrowed read.
        expect(sql).toContain(`nullif(current_setting('${guc}', true), '') IS NULL`);
        // present ⇒ exact equality, enforced at the row level.
        expect(sql).toContain(`current_setting('${guc}', true) = "${column}"`);
      }
      // Only facts / episodes carry the columns (seed contract).
      expect(policyOn(name, "entities")).toBeUndefined();
      expect(policyOn(name, "entity_facts")).toBeUndefined();
    }
  });

  it("never emits a WITH CHECK — USING doubles as the write check", () => {
    expect(policies().filter((s) => /WITH CHECK/.test(s))).toEqual([]);
  });

  it("inlines the caller-escaped tenant literal and rejects an unsafe schema name", () => {
    expect(agentMemoryV1ScopePolicies(SCHEMA, "anon:o''malley")[0]).toContain(`'anon:o''malley'`);
    expect(() => agentMemoryV1ScopePolicies(`evil"; DROP SCHEMA public; --`, TENANT)).toThrow(
      /unsafe schema name/,
    );
  });
});

describe("isAgentMemoryV1Db", () => {
  it("matches only the version-keyed preset id prefix", () => {
    expect(isAgentMemoryV1Db(`db_${AGENT_MEMORY_V1_VERSION}_abc123`)).toBe(true);
    expect(isAgentMemoryV1Db("db_orders_xyz789")).toBe(false);
    expect(isAgentMemoryV1Db("db_agent_memory_v2_abc123")).toBe(false);
  });
});

// The typed `SchemaPlan` projection wired into the orchestrator on the
// preset path (E-01 run 2 / SK-HDC-020). It is metadata only — the
// executable schema is the DDL above — so the tests pin the two against
// the same `AGENT_MEMORY_V1_COLUMNS` contract to prevent drift.
describe("agentMemoryV1Plan", () => {
  it("is a Zod-valid SchemaPlan", () => {
    expect(() => SchemaPlanSchema.parse(agentMemoryV1Plan())).not.toThrow();
  });

  it("uses the version tag as slug_hint so schema_hash is version-keyed", () => {
    expect(agentMemoryV1Plan().slug_hint).toBe(AGENT_MEMORY_V1_VERSION);
  });

  it("is deterministic — same plan every call (one shared plan-cache hash)", () => {
    expect(JSON.stringify(agentMemoryV1Plan())).toBe(JSON.stringify(agentMemoryV1Plan()));
  });

  it("projects exactly the contract tables + columns (no drift vs the DDL)", () => {
    const plan = agentMemoryV1Plan();
    const planTables = Object.fromEntries(
      plan.tables.map((t) => [t.name, t.columns.map((c) => c.name)]),
    );
    expect(planTables).toEqual(AGENT_MEMORY_V1_COLUMNS);
  });

  it("carries the entity_facts → entities/facts FKs and no seed/semantic rows", () => {
    const plan = agentMemoryV1Plan();
    expect(plan.foreign_keys).toHaveLength(2);
    expect(plan.foreign_keys.every((fk) => fk.from_table === "entity_facts")).toBe(true);
    expect(plan.foreign_keys.every((fk) => fk.on_delete === "cascade")).toBe(true);
    expect(plan.sample_rows).toEqual([]);
    expect(plan.metrics).toEqual([]);
    expect(plan.dimensions).toEqual([]);
  });
});
