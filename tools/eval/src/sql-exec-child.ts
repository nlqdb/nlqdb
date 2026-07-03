// SK-QUAL-021 — SQL execution isolated in a killable subprocess.
//
// bun:sqlite's synchronous `.values()` cannot be interrupted in-process
// (no `sqlite3_interrupt` / progress-handler binding is exposed), so a
// runaway predicted query — a cartesian join over BIRD's million-row
// tables — blocks the runner's entire event loop: no throttle, no
// capacity wait, no checkpoint append, until the CI ceiling kills the
// job. The parent (`score.ts::runSqlBounded`) spawns this child per
// statement and SIGKILLs it at the deadline instead, turning the
// runaway into a scored timeout — canonical BIRD `evaluation.py` does
// the same via `func_timeout`.
//
// Protocol: argv = [dbPath, busyTimeoutMs]; the SQL text arrives on
// stdin (never argv — SQL length/content would break the arg vector).
// stdout is one JSON object: `{ok:true, rows}` with positional-tuple
// rows (bigint → number, blob → {__b64}) or `{ok:false, error}`.
// Structured errors exit 0; only an unexpected crash exits non-zero.

import { readFileSync } from "node:fs";

type SqliteDatabase = {
  query: (sql: string) => { all: () => unknown[]; values: () => unknown[][] };
  close: () => void;
};

// Dynamic specifier so tsc (which doesn't know bun:* schemes) still
// resolves the module — same trick as the parent's loader.
const { Database } = (await import(/* @vite-ignore */ "bun:sqlite")) as {
  Database: new (
    filename: string,
    opts?: { readonly?: boolean },
  ) => SqliteDatabase;
};

const [dbPath, busyTimeoutMsRaw] = process.argv.slice(2);
const busyTimeoutMs = Math.max(1, Math.floor(Number(busyTimeoutMsRaw) || 1));
const sql = readFileSync(0, "utf8");

const db = new Database(dbPath ?? "", { readonly: true });
try {
  db.query(`PRAGMA busy_timeout = ${busyTimeoutMs}`).all();
  const rows = db.query(sql).values();
  const out = rows.map((row) =>
    row.map((v) => {
      if (typeof v === "bigint") return Number(v);
      if (v instanceof Uint8Array) return { __b64: Buffer.from(v).toString("base64") };
      return v;
    }),
  );
  process.stdout.write(JSON.stringify({ ok: true, rows: out }));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stdout.write(JSON.stringify({ ok: false, error: msg }));
} finally {
  db.close();
}
