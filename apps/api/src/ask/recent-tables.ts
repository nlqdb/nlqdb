// Per-principal recent-tables MRU. Bounded LRU of the 100 most
// recent (dbId, slug, table) tuples — consumed by routeAsk's
// classifier (SK-ASK-009) to disambiguate verbs that could mean DML
// against an existing table or DDL for a new one.
//
// Storage: JSON `{ entries: RecentTable[] }` at `recent_tables:<principalId>`.
// TTL 90 days matches `SK-ANON-002` server retention. Per `SK-ANON-006`
// no anon vs auth branch — principal id encodes the kind in its prefix
// (`user:<id>` / `anon:<hash>`).
//
// Parser choice: this module sits on the eager `/v1/ask` startup graph
// (`buildAskDeps` is statically imported by `index.ts`). `libpg-query`
// requires `__filename` / `__dirname` polyfills set by the route handler
// before its WASM loader runs, so wiring it eagerly here would break
// worker startup. `sql-validate.ts` already uses `node-sql-parser` on
// the same path; reusing it keeps cold-start cheap and makes this
// module pure JS (no WASM in the dep graph).

import { recentTablesEntries } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { Parser } from "node-sql-parser";
import type { KVStore } from "../kv-store.ts";

const KEY_PREFIX = "recent_tables:";
const MAX_ENTRIES = 100;
const TTL_SECONDS = 90 * 24 * 60 * 60;

// `node-sql-parser` is sync and the JS event loop in Workers is single-
// threaded, so a module-scoped Parser is safe across concurrent calls
// (matches the same trade-off in `sql-validate.ts`).
const parser = new Parser();

export type RecentTable = {
  dbId: string;
  slug: string;
  table: string;
  touchedAt: number;
};

export type RecentTablesStore = {
  // Returns up to 100 entries, sorted by `touchedAt` descending.
  load(principalId: string): Promise<RecentTable[]>;
  // Read-merge-write. New tables go to the front; existing entries with
  // the same `(dbId, table)` are dropped (their slot is the fresh one).
  // Concurrent touches race on the KV write; last-write-wins is harmless
  // for an MRU. Errors are swallowed — callers wrap this in
  // `ctx.waitUntil` so a KV blip never affects the user-visible response.
  touch(principalId: string, dbId: string, slug: string, tables: string[]): Promise<void>;
};

export function makeRecentTablesStore(kv: KVStore): RecentTablesStore {
  return {
    load(principalId) {
      return withSpan("nlqdb.recent_tables.lookup", async () => {
        const raw = await kv.get(key(principalId)).catch(() => null);
        // Sort defensively: under concurrent touches an out-of-order write
        // can land, and consumers (classifier prompt, speculation predicate)
        // assume newest-first.
        return parseEntries(raw).sort((a, b) => b.touchedAt - a.touchedAt);
      });
    },
    touch(principalId, dbId, slug, tables) {
      return withSpan("nlqdb.recent_tables.touch", async () => {
        if (tables.length === 0) return;
        const k = key(principalId);
        const now = Date.now();
        const existing = parseEntries(await kv.get(k).catch(() => null));

        const fresh: RecentTable[] = tables.map((t) => ({
          dbId,
          slug,
          table: t,
          touchedAt: now,
        }));
        const seen = new Set<string>(fresh.map(dedupeKey));
        const merged: RecentTable[] = [...fresh];
        for (const e of existing) {
          const k2 = dedupeKey(e);
          if (seen.has(k2)) continue;
          seen.add(k2);
          merged.push(e);
          if (merged.length >= MAX_ENTRIES) break;
        }

        const trimmed = merged.slice(0, MAX_ENTRIES);
        await kv
          .put(k, JSON.stringify({ entries: trimmed }), { expirationTtl: TTL_SECONDS })
          .catch(() => {});
        // Gauge label derives from the principal prefix; the prefix
        // already encodes auth-vs-anon (`SK-ANON-006`), so this is
        // attribute-shaping for observability — not a behavioral branch.
        recentTablesEntries().record(trimmed.length, {
          principal_kind: principalId.startsWith("anon:") ? "anon" : "user",
        });
      });
    },
  };
}

// Wrap an async block in a span — keeps `load`/`touch` as the OTel
// boundary so callers don't have to. Errors are recorded on the span
// then re-thrown; the outer try/catch in `kv.get`/`kv.put` already
// swallows the common KV failure path, so a thrown exception here is
// the rare unexpected case (corrupt parse, etc.).
async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return trace.getTracer("@nlqdb/api").startActiveSpan(name, async (span) => {
    try {
      return await fn();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

// Lowercased table names from our compiled `CREATE TABLE` DDL, in
// declaration order, deduped. Regex (vs. a full parse) is safe because
// we author the DDL — used by `checkSchemaTables` and `seedFromPinnedDb`.
export function tablesFromSchemaText(schemaText: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of schemaText.matchAll(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"[^"]+"\.)?["]?(\w+)["]?/gi,
  )) {
    const name = match[1]?.toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

// Pull table refs out of a SQL plan, honoring CTE **lexical scope**.
// Allowlist statement types are SELECT / INSERT / UPDATE / DELETE. A `WITH`
// name is a scope-local alias, not a real table, so it is excluded — but
// only where it is genuinely in scope: within the defining query's main
// body and within *later* sibling CTE bodies. It is deliberately NOT
// excluded inside its own body, nor in an unrelated (sibling / enclosing)
// scope. That closes a scope-membership bypass: a global CTE-name blacklist
// lets `SELECT * FROM billing WHERE id IN (WITH billing AS (…) SELECT …)`
// mask the real, out-of-scope outer `billing` read behind an inner CTE of
// the same name. node-sql-parser exposes no RECURSIVE flag, so a
// self-referential/recursive CTE surfaces its own name and is conservatively
// treated as a table — fail-closed (a false reject) over fail-open (a
// masked read). Returns deduped names in encounter order; empty array on
// parse failure or any other statement kind.
export function extractTables(sql: string): string[] {
  let asts: AstNode[];
  try {
    const parsed = parser.astify(sql, { database: "PostgreSQL" }) as unknown as AstNode | AstNode[];
    asts = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
  const out = new Set<string>();
  for (const root of asts) {
    if (isAllowedStatement(root)) collectTables(root, new Set(), out);
  }
  return [...out];
}

type AstNode = { type?: string; [k: string]: unknown };

function isAllowedStatement(node: AstNode): boolean {
  return (
    node.type === "select" ||
    node.type === "insert" ||
    node.type === "update" ||
    node.type === "delete"
  );
}

// Scope-aware walk. `cteScope` is the set of CTE names visible at this node.
// A relation node is `{ db, table }` — the `db` key discriminates it from a
// `column_ref` that merely carries a `table` alias string, so the same walk
// targets SELECT.from[] and INSERT/UPDATE/DELETE.table[] without false
// positives.
function collectTables(node: unknown, cteScope: Set<string>, out: Set<string>): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectTables(item, cteScope, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj["table"] === "string" && "db" in obj && !cteScope.has(obj["table"])) {
    out.add(obj["table"]);
  }
  const w = obj["with"];
  if (Array.isArray(w)) {
    const names = (w as Array<{ name?: { value?: unknown } }>)
      .map((c) => c?.name?.value)
      .filter((n): n is string => typeof n === "string");
    // Each CTE body sees only *earlier* siblings — never itself (recursion
    // is conservatively surfaced) and never a later sibling — so a
    // same-named inner CTE cannot mask a real table read in its own body.
    for (let i = 0; i < w.length; i++) {
      collectTables(w[i], new Set([...cteScope, ...names.slice(0, i)]), out);
    }
    // The main body (everything but `with`) sees all of this node's names.
    const mainScope = new Set([...cteScope, ...names]);
    for (const [k, v] of Object.entries(obj)) {
      if (k !== "with") collectTables(v, mainScope, out);
    }
    return;
  }
  for (const v of Object.values(obj)) collectTables(v, cteScope, out);
}

function key(principalId: string): string {
  return `${KEY_PREFIX}${principalId}`;
}

function dedupeKey(entry: { dbId: string; table: string }): string {
  return `${entry.dbId}\x1f${entry.table}`;
}

function parseEntries(raw: string | null): RecentTable[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { entries?: unknown };
    return Array.isArray(parsed.entries) ? (parsed.entries as RecentTable[]) : [];
  } catch {
    return [];
  }
}
