# WS1 — Per-principal recent-tables MRU cache

**Branch:** `claude/ws1-recent-tables` off `origin/main`
**SK-ID reserved:** `SK-ASK-012` (was `SK-ASK-010` in the original draft;
the slot was taken by the goal-length cap landed in PR #140, so the
sticky-ID rule per CLAUDE.md §10.2 routed this worksheet to the next
free number)
**Hard deps:** none. **Soft deps:** none. Lands cleanly first.

## Goal

Give every principal (auth'd user or anon device) a small KV-backed LRU
of the 100 most recently used `(dbId, slug, table)` tuples. Updated on
every successful `/v1/ask` exec and every successful `db.create`. Read
by WS2's classifier and WS3's speculation predicate.

## Pre-read (mandatory)

- `apps/api/src/ask/plan-cache.ts` — pattern to mirror (KVStore + content-addressed key)
- `apps/api/src/ask/disambiguate-db.ts` — KV-cache pattern with TTL
- `apps/api/src/principal.ts` — principal id derivation (`user:<id>` / `anon:<sha256(token)[:16]>`)
- `apps/api/src/ask/orchestrate.ts` — ctx.waitUntil pattern around `firstQuery` + `events.emit`
- `apps/api/src/ask/build-deps.ts` — how OrchestrateDeps are wired
- `apps/api/src/db-create/orchestrate.ts` — the create-side orchestrator that also needs to call this
- `docs/features/ask-pipeline/FEATURE.md` — add SK-ASK-012 here
- `docs/features/anonymous-mode/FEATURE.md` SK-ANON-002 (90-day retention rationale)
- `docs/skill-conventions.md` §4 (5-field decision block format)

## Interface contract (consumed by WS2 + WS3)

```ts
// apps/api/src/ask/recent-tables.ts

export type RecentTable = {
  dbId: string;       // "db_<slug_hint>_<6char>"
  slug: string;       // human form, mirrors deriveSlug() in databases/list.ts
  table: string;      // identifier passed assertSafeIdentifier per SK-HDC-009
  touchedAt: number;  // unix ms; LRU ordering key
};

export type RecentTablesStore = {
  load(principalId: string): Promise<RecentTable[]>;        // length ≤ 100, sorted touchedAt desc
  touch(principalId: string, dbId: string, slug: string, tables: string[]): Promise<void>;
};

export function makeRecentTablesStore(kv: KVStore): RecentTablesStore;
```

Other WSs import `RecentTable` and `makeRecentTablesStore`. Stable.

## Files to create

| Path | Purpose |
|---|---|
| `apps/api/src/ask/recent-tables.ts` | Store implementation |
| `apps/api/src/ask/recent-tables.test.ts` | Vitest covering LRU semantics, TTL, max-100 cap |

## Files to modify

| Path | Change |
|---|---|
| `apps/api/src/ask/orchestrate.ts` | Add `recentTables: RecentTablesStore` to `OrchestrateDeps`; after exec succeeds, call `recentTables.touch(...)` wrapped in `ctx.waitUntil`. Extract referenced tables from the executed `planSql` using `libpg-query-worker.ts` (already a dep). |
| `apps/api/src/ask/build-deps.ts` | Wire `makeRecentTablesStore(envBindings.KV)` into `buildAskDeps()`. |
| `apps/api/src/db-create/orchestrate.ts` | Add `recentTables` dep; after step 5 (provisioner success) push `plan.tables[].name` to MRU. |
| `apps/api/src/db-create/build-deps.ts` | Wire `makeRecentTablesStore` here too. |
| `docs/features/ask-pipeline/FEATURE.md` | Add SK-ASK-012 block (template below). |
| `docs/features/hosted-db-create/FEATURE.md` | Add one-line note under SK-HDC-001 *Consequence in code*: "post-create, the orchestrator pushes `plan.tables[].name` to the principal's recent-tables MRU per SK-ASK-012." |
| `docs/performance.md §3.1` | Add span rows: `nlqdb.recent_tables.lookup`, `nlqdb.recent_tables.touch`. |
| `docs/performance.md §3.2` | Add metric rows: `nlqdb.recent_tables.entries{principal_kind}` (gauge, post-touch length). |

## Implementation notes

1. **Storage shape.** JSON-encoded `{ entries: RecentTable[] }`. Key: `recent_tables:<principalId>`. Same KVStore type as `plan-cache.ts`. TTL: 90 days (matches SK-ANON-002 server retention).
2. **LRU semantics on `touch()`.** Read → merge new tables to front (dedupe by `(dbId, table)`) → trim to 100 → write. Race: concurrent touches → last-write-wins; harmless for an MRU.
3. **Failure mode.** `touch()` writes via fire-and-forget — KV failure is swallowed (`.catch(() => {})`), wrapped in `nlqdb.recent_tables.touch` span with non-OK status. Response is unaffected.
4. **Update on cache-hit too.** In `orchestrate.ts`, the `recentTables.touch` call goes after `exec()` succeeds — both cache-hit and cache-miss paths converge there. **Do not** skip on cache-hit; MRU tracks user activity.
5. **Table-name extraction.** Use `libpg-query-worker.ts` to parse `planSql` and walk for `RangeVar` / `RelationExpr` nodes. The walk is allowlist-style: only `SELECT`, `INSERT`, `UPDATE`, `DELETE` references count. CTE aliases are excluded. **Test cases must cover** join trees, subqueries, CTEs.
6. **Anonymous vs auth — no branch.** Per SK-ANON-006, no `if (kind === "anon")` in this module. Principal id is the cache key; anon vs user falls out of the prefix.
7. **Bundle budget (GLOBAL-013).** New module is < 2 KB minified. No new deps; libpg_query is already on the worker.

## SK-* block to add (paste into `docs/features/ask-pipeline/FEATURE.md` Decisions, after SK-ASK-008)

```markdown
### SK-ASK-012 — Per-principal recent-tables LRU (100 entries) in KV

- **Decision:** Each principal (`user:<id>` or `anon:<hash>`) has a KV-backed MRU list of the 100 most recently used `(dbId, slug, table)` tuples. Stored at `recent_tables:<principalId>` with a 90-day `expirationTtl` matching `SK-ANON-002`'s server retention. Updated after every successful `/v1/ask` exec and after every successful `db.create` provisioning.
- **Core value:** Bullet-proof, Free, Fast
- **Why:** SK-ASK-009's classifier consumes this list to disambiguate ambiguous verbs ("insert / add / put") that can mean either DML against existing tables or DDL for new ones. Per-principal scope mirrors the existing rate-limit and disambiguate-cache patterns; 100 × ~30 chars ≈ 3 KB fits cheap-tier prompt budget. KV writes ride `ctx.waitUntil` so the update never sits on the user-visible p99.
- **Consequence in code:** `apps/api/src/ask/recent-tables.ts` exports `makeRecentTablesStore(kv): RecentTablesStore` with `load` / `touch`. `OrchestrateDeps` (read + create) carry the store. The OTel spans `nlqdb.recent_tables.{lookup,touch}` (per `GLOBAL-014`) wrap the KV read-merge-write. PRs that read or update the MRU outside this module fail review.
- **Alternatives rejected:**
  - Derive lazily from per-db schema introspection — every classifier call pays a schema query; the union view across multiple dbs is what's actually needed.
  - Per-(principal, db) cache — needs the dbId at classify time, but classify *outputs* the dbId; chicken-and-egg.
  - Track all-time tables (no LRU cap) — unbounded growth on power users; 100 covers the realistic active set.
```

## Performance.md additions

§3.1 — add rows:

| `nlqdb.recent_tables.lookup` | KV read of principal's recent-tables MRU. |
| `nlqdb.recent_tables.touch` | KV read-merge-write to push new tables. |

§3.2 — add row:

| `nlqdb.recent_tables.entries` | gauge (post-touch length, label `principal_kind`). |

## Tests required

- LRU dedup: touching `(dbId=A, table=foo)` twice keeps one entry, updates `touchedAt`.
- 100-entry cap: 101st touch evicts oldest by `touchedAt`.
- Multi-db: tables from different `dbId`s coexist.
- Round-trip: touch → load returns the entries in `touchedAt` desc order.
- KV failure on `touch()` does not throw to caller.
- Empty principal: `load()` returns `[]`, no error.
- libpg_query extraction: `INSERT INTO foo SELECT FROM bar` extracts both `foo` and `bar`.
- libpg_query extraction: CTE aliases are excluded (`WITH cte AS (...) SELECT FROM cte JOIN real`).

## Acceptance criteria

- [ ] `recent-tables.ts` module shipped with full test coverage.
- [ ] `OrchestrateDeps` (both read + create) carry the store; build-deps wire it.
- [ ] `nlqdb.recent_tables.{lookup,touch}` spans emit on every call.
- [ ] SK-ASK-012 block landed in `docs/features/ask-pipeline/FEATURE.md`.
- [ ] SK-HDC-001 *Consequence in code* gets the one-line addition.
- [ ] `docs/performance.md` §3.1 + §3.2 updated.
- [ ] `bun run typecheck && bun run lint && bun run test` green.
- [ ] No emoji in code or docs.
- [ ] Bundle size delta ≤ 2 KB compressed (`bun run --filter apps/api build && wrangler deploy --dry-run --outdir=/tmp/out`).

## Out of scope

- The classifier change (WS2's job).
- The speculative-create branch (WS3's job).
- Server-side prompt mirroring (open question on `SK-ANON-001`).
