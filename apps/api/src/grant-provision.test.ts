// EK-06 box 2 — grant-role provisioning DDL tests (SK-EKP-008, the
// DB-role half, sub-piece (a)). Asserts the batch is SELECT-only, scoped
// to exactly the grant's tables, re-scope safe, FORCE-RLSes each scoped
// table, and refuses unsafe identifiers / empty scope — the invariants
// the live executor wiring (box 2b/c) will run against real Postgres.

import { describe, expect, it } from "vitest";
import { buildGrantRoleDdl } from "./grant-provision.ts";
import { grantRoleName } from "./grant-role.ts";

const GRANT_ID = "11111111-2222-3333-4444-555555555555";
const SCHEMA = "abcdef0123456789";

async function build(scope: string[], opts?: { schemaName?: string; grantId?: string }) {
  return buildGrantRoleDdl({
    grantId: opts?.grantId ?? GRANT_ID,
    schemaName: opts?.schemaName ?? SCHEMA,
    scope,
  });
}

describe("buildGrantRoleDdl — SELECT-only, scoped, fail-closed", () => {
  it("creates the role before granting anything to it", async () => {
    const stmts = await build(["lessons"]);
    const role = await grantRoleName(GRANT_ID);
    const createIdx = stmts.findIndex((s) => s.includes(`CREATE ROLE "${role}"`));
    expect(createIdx).toBe(0);
    // Every statement that references the role name after the create is a
    // GRANT/REVOKE/ALTER — nothing touches the role before it exists.
    const firstUse = stmts.findIndex((s, i) => i > 0 && s.includes(role));
    expect(firstUse).toBeGreaterThan(createIdx);
  });

  it("uses the canonical `grant_<16hex>` role name (provisioner ↔ exec cannot drift)", async () => {
    const stmts = await build(["lessons"]);
    const role = await grantRoleName(GRANT_ID);
    expect(role).toMatch(/^grant_[0-9a-f]{16}$/);
    for (const s of stmts) {
      // No other role token leaks into the batch — only the derived name.
      const roleRefs = s.match(/"grant_[0-9a-f]{16}"/g) ?? [];
      for (const ref of roleRefs) expect(ref).toBe(`"${role}"`);
    }
  });

  it("grants SELECT on exactly the scope tables — never a write, never ALL TABLES", async () => {
    const stmts = await build(["lessons", "students"]);
    const role = await grantRoleName(GRANT_ID);
    const selects = stmts.filter((s) => s.startsWith("GRANT SELECT ON"));
    expect(selects).toEqual([
      `GRANT SELECT ON "${SCHEMA}"."lessons" TO "${role}"`,
      `GRANT SELECT ON "${SCHEMA}"."students" TO "${role}"`,
    ]);
    const batch = stmts.join("\n");
    expect(batch).not.toMatch(/GRANT[^;]*\b(INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/);
    // ALL TABLES SELECT would silently include out-of-scope / schema-widened
    // tables — the one shape SK-EKP-008 forbids here.
    expect(batch).not.toMatch(/GRANT SELECT ON ALL TABLES/);
  });

  it("FORCE-RLSes exactly the scope tables (guardrail #3)", async () => {
    const stmts = await build(["lessons", "students"]);
    const forces = stmts.filter((s) => s.includes("FORCE ROW LEVEL SECURITY"));
    expect(forces).toEqual([
      `ALTER TABLE "${SCHEMA}"."lessons" FORCE ROW LEVEL SECURITY`,
      `ALTER TABLE "${SCHEMA}"."students" FORCE ROW LEVEL SECURITY`,
    ]);
  });

  it("grants role membership to the connecting owner WITH SET TRUE", async () => {
    const stmts = await build(["lessons"]);
    const role = await grantRoleName(GRANT_ID);
    expect(stmts).toContain(`GRANT "${role}" TO CURRENT_USER WITH SET TRUE`);
  });

  it("revokes prior table privileges before re-granting (re-scope drops removed tables)", async () => {
    const stmts = await build(["lessons"]);
    const role = await grantRoleName(GRANT_ID);
    const revokeIdx = stmts.indexOf(
      `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${SCHEMA}" FROM "${role}"`,
    );
    const firstGrantIdx = stmts.findIndex((s) => s.startsWith("GRANT "));
    expect(revokeIdx).toBeGreaterThanOrEqual(0);
    expect(revokeIdx).toBeLessThan(firstGrantIdx);
  });

  it("is deterministic for the same inputs", async () => {
    expect(await build(["lessons", "students"])).toEqual(await build(["lessons", "students"]));
  });

  it("scopes each statement to the given schema", async () => {
    const stmts = await build(["lessons"], { schemaName: "deadbeefcafe0001" });
    for (const s of stmts.filter((x) => x.includes(".") || x.includes("SCHEMA"))) {
      if (s.includes("pg_roles")) continue;
      expect(s).toContain('"deadbeefcafe0001"');
    }
  });
});

describe("buildGrantRoleDdl — identifier + scope guards (SK-HDC-009 defense-in-depth)", () => {
  it("rejects an empty scope (fail closed — no scopeless role)", async () => {
    await expect(build([])).rejects.toThrow(/empty scope/);
  });

  it("rejects an unsafe schema name before interpolation", async () => {
    await expect(build(["lessons"], { schemaName: 'x"; DROP SCHEMA public; --' })).rejects.toThrow(
      /unsafe/,
    );
  });

  it("rejects an unsafe scope table before interpolation", async () => {
    await expect(build(['lessons"; DROP TABLE students; --'])).rejects.toThrow(/unsafe/);
  });
});
