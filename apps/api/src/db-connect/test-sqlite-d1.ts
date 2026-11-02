// The api's own D1 (every migration) on an in-memory `node:sqlite`, behind the
// slice of the D1 API the attach door, the verbs and verify call. Test-only:
// shared by `attach.pg.test.ts` and `attach.d1.test.ts`.

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

// `node:sqlite` (Node 22) has no types under the Workers type set.
type SQLInputValue = string | number | null;
type Statement = {
  get: (...p: SQLInputValue[]) => unknown;
  all: (...p: SQLInputValue[]) => unknown[];
  run: (...p: SQLInputValue[]) => { changes: number | bigint; lastInsertRowid: number | bigint };
};
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (
    path: string,
  ) => { exec: (sql: string) => void; prepare: (sql: string) => Statement };
};

export function sqliteD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../../migrations/", import.meta.url);
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(new URL(f, dir), "utf8"));
  }
  const bound = (sql: string, params: SQLInputValue[]) => ({
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    run: async () => {
      if (/^\s*SELECT/i.test(sql)) return { results: db.prepare(sql).all(...params), meta: {} };
      const r = db.prepare(sql).run(...params);
      return {
        results: [],
        meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
      };
    },
  });
  return {
    prepare: (sql: string) => ({
      ...bound(sql, []),
      bind: (...p: SQLInputValue[]) => bound(sql, p),
    }),
    batch: async (stmts: { run: () => Promise<unknown> }[]) => {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  } as unknown as D1Database;
}
