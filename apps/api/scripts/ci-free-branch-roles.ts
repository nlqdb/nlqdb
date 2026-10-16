// CI only: frees tenant roles on the throwaway `ci-smoke-*` Neon branch so
// the smoke suite can mint its own. The branch copies production's roles,
// and production sits at Neon's 500-role cap until the founder-gated reaper
// runs (SK-HDC-024), so `CREATE ROLE` failed on every PR. Dropping roles on
// a child branch never touches its parent; the branch is deleted after the
// job. Never point this at production — it ignores D1 liveness.
//
// Usage: NEON_TEST_BRANCH_URL=… bun scripts/ci-free-branch-roles.ts [count]

import { buildPgClient } from "../src/db-create/pg-client.ts";
import { buildReapStatements, ROLE_SCHEMAS_SQL } from "../src/db-sweep/role-reap.ts";

const url = process.env["NEON_TEST_BRANCH_URL"];
if (!url) throw new Error("NEON_TEST_BRANCH_URL is unset");
const want = Number(process.argv[2] ?? 5);

const pg = buildPgClient(url);
const rows = (await pg.query<{ rolname: string; nspname: string | null }>(ROLE_SCHEMAS_SQL)).rows;
const schemasByRole = new Map<string, string[]>();
for (const { rolname, nspname } of rows) {
  const schemas = schemasByRole.get(rolname) ?? [];
  if (nspname) schemas.push(nspname);
  schemasByRole.set(rolname, schemas);
}

let freed = 0;
let failed = 0;
for (const [role, schemas] of schemasByRole) {
  if (freed >= want) break;
  try {
    await pg.transaction(buildReapStatements(role, schemas));
    freed++;
  } catch {
    failed++; // 2BP01 — holds a privilege outside its schemas; try the next
  }
}
console.info(
  `ci-free-branch-roles: ${schemasByRole.size} tenant roles, freed ${freed}, skipped ${failed}`,
);
