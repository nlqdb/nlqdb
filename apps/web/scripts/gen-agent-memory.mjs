// Refresh the `/agents` dogfood snapshot from nlqdb's own live memory DB.
//
// This is D-06's generator. It is run by D-02's `memory-sync.yml` workflow
// AFTER a corpus re-sync — deliberately NOT wired into `astro build`, so no
// network read reaches the Cloudflare free-tier build/Worker path
// (GLOBAL-013 / SK-PIVOT-012, same reasoning as `og:gen`).
//
// It reads aggregates ONLY (counts + GROUP-BY rollups) through the public
// API — the same `sk_*` key + `agent_memory_v1` DB the ops workload uses,
// never a privileged path — and rewrites `src/data/agentMemory.data.json`
// with a fresh `asOf`. No raw memory row is ever fetched or written to disk
// (SK-PIVOT-016 aggregates-only rule).
//
//   NLQDB_API_KEY=sk_... NLQDB_MEMORY_DB=db_agent_memory_v1_... \
//     NLQDB_ASOF=2026-08-11 node apps/web/scripts/gen-agent-memory.mjs
//
// With the env unset it is a no-op that leaves the committed snapshot in
// place (the expected state in a plain `bun run build` / a PR CI run), so
// the page never goes blank for want of a key.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = join(here, "..", "src", "data", "agentMemory.data.json");

const apiKey = process.env.NLQDB_API_KEY;
const dbId = process.env.NLQDB_MEMORY_DB;
const apiBase = process.env.NLQDB_API_BASE ?? "https://app.nlqdb.com";

if (!apiKey || !dbId) {
  console.log(
    "gen-agent-memory: NLQDB_API_KEY / NLQDB_MEMORY_DB unset — leaving the committed snapshot unchanged (expected in build/CI).",
  );
  process.exit(0);
}

// One aggregate read through the raw-SQL escape hatch (GLOBAL-015). Every
// statement is a COUNT / GROUP BY — no cell value leaves the DB.
async function runSql(sql) {
  const res = await fetch(`${apiBase}/v1/run`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "x-nlqdb-database": dbId,
    },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) throw new Error(`/v1/run ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.rows ?? body.data ?? [];
}

const asInt = (v) => Number(v ?? 0) | 0;

try {
  const snapshot = JSON.parse(readFileSync(dataPath, "utf8"));

  const [facts, entities, episodes, byKind, byType] = await Promise.all([
    runSql("SELECT COUNT(*) AS n FROM facts"),
    runSql("SELECT COUNT(*) AS n FROM entities"),
    runSql("SELECT COUNT(*) AS n FROM episodes"),
    runSql("SELECT kind AS label, COUNT(*) AS n FROM facts GROUP BY kind ORDER BY n DESC"),
    runSql("SELECT type AS label, COUNT(*) AS n FROM entities GROUP BY type ORDER BY n DESC"),
  ]);

  snapshot.asOf = process.env.NLQDB_ASOF ?? snapshot.asOf;
  snapshot.dbId = dbId;
  snapshot.tableCounts = [
    { table: "facts", count: asInt(facts[0]?.n) },
    { table: "entities", count: asInt(entities[0]?.n) },
    { table: "episodes", count: asInt(episodes[0]?.n) },
  ];
  snapshot.factsByKind = byKind.map((r) => ({ label: String(r.label), count: asInt(r.n) }));
  snapshot.entitiesByType = byType.map((r) => ({ label: String(r.label), count: asInt(r.n) }));
  snapshot.goldenQueries = [
    {
      q: "open questions per fact kind",
      sql: "SELECT kind, COUNT(*) AS n\n  FROM facts\n GROUP BY kind\n ORDER BY n DESC;",
      columns: ["kind", "n"],
      rows: snapshot.factsByKind.map((d) => [d.label, d.count]),
    },
    {
      q: "tracked entities by type",
      sql: "SELECT type, COUNT(*) AS n\n  FROM entities\n GROUP BY type\n ORDER BY n DESC;",
      columns: ["type", "n"],
      rows: snapshot.entitiesByType.map((d) => [d.label, d.count]),
    },
  ];

  writeFileSync(dataPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`gen-agent-memory: refreshed ${dataPath} (asOf ${snapshot.asOf}).`);
} catch (err) {
  console.error(`gen-agent-memory: refresh failed — ${err.message}`);
  process.exit(1);
}
