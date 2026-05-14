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

// Pull table refs out of a SQL plan. Allowlist statement types are
// SELECT / INSERT / UPDATE / DELETE; CTE aliases (`WITH cte AS …`) are
// excluded because they're scope-local names, not real tables. Returns
// deduped names in encounter order; empty array on parse failure or any
// other statement kind (orchestrator's SQL allowlist already rejected
// DDL by this point, but defence-in-depth keeps the walk allowlist-style).
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
    if (!isAllowedStatement(root)) continue;
    const cteNames = collectCteNames(root);
    walk(root, (node) => {
      // Match the from-item / target-table shape:
      // `{ db: null|string, table: string, as?: string|null, ... }`.
      // The `db` key is the discriminator — column-refs and other AST
      // nodes that happen to carry a `table` string never have a `db`
      // key, so this lets the same walker target both SELECT.from[]
      // and INSERT/UPDATE/DELETE.table[] without false positives on
      // `column_ref.table` (which is an alias, not a relation).
      const obj = node as Record<string, unknown>;
      if (typeof obj["table"] !== "string") return;
      if (!("db" in obj)) return;
      const t = obj["table"] as string;
      if (!cteNames.has(t)) out.add(t);
    });
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

function collectCteNames(node: unknown): Set<string> {
  const names = new Set<string>();
  walk(node, (obj) => {
    const w = (obj as { with?: unknown }).with;
    if (!Array.isArray(w)) return;
    for (const cte of w as Array<{ name?: { value?: unknown } }>) {
      const name = cte?.name?.value;
      if (typeof name === "string") names.add(name);
    }
  });
  return names;
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

function walk(node: unknown, visit: (obj: object) => void): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  visit(node);
  for (const value of Object.values(node)) walk(value, visit);
}
