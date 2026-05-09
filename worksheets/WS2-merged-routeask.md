# WS2 — Merged routeAsk classifier

**Branch:** `claude/ws2-routeask` off `origin/main`
**SK-ID reserved:** `SK-ASK-009`
**Hard deps:** none. **Soft deps:** WS1 (`RecentTable` type + store).

## Goal

Replace today's two cheap-tier LLM calls (`classifyKind` + `disambiguateDb`)
with a single `routeAsk` that consumes the principal's recent-tables MRU
plus the dbset and returns `{kind, targetDbId, referencedTables, ...}`.

This is the line of defense against the "insert red and blue tables"
misclassification. With `recentTables` in context, the LLM sees that
`red`/`blue` aren't existing tables and routes to `kind=create` instead
of `kind=write`.

## Pre-read (mandatory)

- `apps/api/src/ask/classifier.ts` — current cheap-tier kind classifier
- `apps/api/src/ask/disambiguate-db.ts` — slug fast-path + KV cache + LLM disambiguate
- `apps/api/src/index.ts` lines ~412–540 — current dbId-resolution prelude (you rewrite this)
- `packages/llm/src/types.ts`, `router.ts`, `prompts.ts`, `providers/*.ts` — LLM op surface
- `docs/features/ask-pipeline/FEATURE.md` SK-ASK-002 (canonical step order — you reorder), SK-ASK-003 (dbId resolution — you supersede)
- `docs/features/hosted-db-create/FEATURE.md` SK-HDC-005 (mirror of SK-ASK-003 — also supersede)
- `docs/features/llm-router/FEATURE.md`
- `docs/performance.md §2.3` (dbId resolution prelude budget — you update)
- `docs/performance.md §3.1` (span catalog — you update)

## Interface contract

```ts
// apps/api/src/ask/route-ask.ts

import type { RecentTable } from "./recent-tables.ts";  // WS1; see "Soft-dep stub" below

export type DbCandidate = { id: string; slug: string };

export type RouteAskInput = {
  goal: string;
  dbs: DbCandidate[];          // from listDatabasesForTenant
  recentTables: RecentTable[]; // from WS1; [] if WS1 not yet merged
};

export type RouteAskOutput = {
  kind: "create" | "query" | "write";
  targetDbId: string | null;        // null when kind === "create"
  referencedTables: string[];       // empty when kind === "create"
  confidence: number;               // 0..1
  reason: "no_dbs" | "recent_table_match" | "slug_match" | "llm";
};

export const ROUTE_CONFIDENCE_FLOOR = 0.7;  // mirrors today's DISAMBIGUATE_CONFIDENCE_FLOOR

export async function routeAsk(
  deps: { llm: LLMRouter; cache?: KVStore },
  input: RouteAskInput,
): Promise<RouteAskOutput>;
```

### Routing logic (in order)

1. **0 dbs** → `{kind: "create", targetDbId: null, referencedTables: [], confidence: 1, reason: "no_dbs"}`. Deterministic, no LLM.
2. **Recent-table substring fast-path.** If goal contains a `table` from `recentTables` (case-insensitive word-boundary), pick its `dbId`. Verb keywords decide kind: `insert/update/delete/add/remove` → write; `show/count/list/describe/what/how/which` → query. Ambiguous verb → fall through. No LLM.
3. **Slug fast-path.** Mirror today's `matchBySlug`. Picks `targetDbId` only; LLM still decides kind.
4. **LLM call.** Single cheap-tier `llm.route(...)` with full context. Confidence floor `≥ 0.7`; below floor → `409 candidate_dbs` (handler-level).

## Soft-dep stub (if WS1 not merged yet)

If `apps/api/src/ask/recent-tables.ts` doesn't exist when you start, declare a local type and a no-op store:

```ts
export type RecentTable = { dbId: string; slug: string; table: string; touchedAt: number };
export const recentTablesStub: { load(): Promise<RecentTable[]> } = { load: async () => [] };
```

When WS1 lands, replace the import. The `routeAsk` API doesn't change — only the source of `recentTables` does.

## Files to create

| Path | Purpose |
|---|---|
| `apps/api/src/ask/route-ask.ts` | Merged classifier |
| `apps/api/src/ask/route-ask.test.ts` | Vitest covering all 4 routing cases |

## Files to modify

| Path | Change |
|---|---|
| `apps/api/src/index.ts` lines ~412–540 | Replace the `classifyPromise` + `speculativeDisambiguatePromise` block with a single `routeAsk` call. The `await listDatabasesForTenant` still runs in parallel. The result-handling switch reduces to: `if (kind === "create") runCreatePath(); else if (targetDbId) orchestrateAsk(... dbId: targetDbId); else 409 candidate_dbs`. |
| `packages/llm/src/types.ts` | Drop `LLMOperation.classify`; drop `ClassifyIntent`, `ClassifyRequest`, `ClassifyResponse`; drop `disambiguate` types. Add `RouteRequest`, `RouteResponse`, `LLMOperation = "route" \| ...`. |
| `packages/llm/src/router.ts` | Drop `classify` + `disambiguate` methods on `LLMRouter`; add `route(req: RouteRequest, opts?): Promise<RouteResponse>`. Wire through the same `route<>(op, req, ...)` helper. Add `route: 1500` to `DEFAULT_TIMEOUTS_MS`; remove `classify` and `disambiguate` entries. |
| `packages/llm/src/prompts.ts` | Drop `CLASSIFY_SYSTEM`, `DISAMBIGUATE_SYSTEM`, `buildClassifyUser`, `buildDisambiguateUser`. Add `ROUTE_SYSTEM`, `buildRouteUser(req)`. |
| `packages/llm/src/providers/*.ts` | Each provider's `classify()` + `disambiguate()` methods become `route()`. The shared `_chat-provider.ts` (if it exists) is the place to make this change once. |
| `packages/llm/src/index.ts` | Update exports. |
| `apps/api/src/ask/classifier.ts` | DELETE. |
| `apps/api/src/ask/classifier.test.ts` | DELETE. |
| `apps/api/src/ask/disambiguate-db.ts` | DELETE. (the disambiguate-db.test.ts too if present) |
| `docs/features/ask-pipeline/FEATURE.md` | Add SK-ASK-009 block; update SK-ASK-002 step order (`classify → disambiguate → plan` becomes `route → plan`); mark SK-ASK-003 `Status: superseded by SK-ASK-009`. |
| `docs/features/hosted-db-create/FEATURE.md` | Mark SK-HDC-005 `Status: superseded by SK-ASK-009` (it was a mirror). |
| `docs/features/llm-router/FEATURE.md` | Update prompt op list — drop classify + disambiguate, add route. |
| `docs/performance.md §2.3` | Rewrite the prelude latency table. New shape: `route` is one cheap-tier call (~115 ms p50 / 445 ms p99) instead of two serial calls. |
| `docs/performance.md §3.1` | Add `llm.route` span row; remove `llm.classify` and `llm.disambiguate`. |

## Prompt skeleton — `ROUTE_SYSTEM`

```
You decide how to handle a user's natural-language goal against their database.
You are given:
- The user's databases (id, slug).
- Tables they recently used in those databases (dbId, slug, table).
- The goal text.

Decide:
- "kind": "create" (the user wants a new database or new tables),
          "query"  (read existing tables),
          "write"  (insert/update/delete in existing tables).
- "targetDbId": which database the goal refers to (null when kind="create").
- "referencedTables": the tables the goal references (empty when kind="create").

Rule: if the goal mentions tables that are NOT in any recent list AND
no slug matches, treat it as "create" — the user wants to make those
tables, not read/write them.

Respond with strict JSON:
{"kind":"create"|"query"|"write","targetDbId":<id or null>,
 "referencedTables":[<strings>],"confidence":<0-1 float>,"reason":"<one short sentence>"}
No prose, no code fences.
```

`buildRouteUser(req)` formats the input as compact JSON (cap recentTables to 100; cap dbs to 25).

## SK-* block to add (paste into `docs/features/ask-pipeline/FEATURE.md` Decisions, before SK-ASK-010)

```markdown
### SK-ASK-009 — Cheap-tier classifier sees the principal's recent tables; classify + disambiguate merge into `routeAsk`

- **Decision:** The `/v1/ask` cheap-tier classifier receives the principal's 100 most-recent `(dbId, table)` tuples in its prompt. Output is `{kind, targetDbId, referencedTables, confidence, reason}` from a single LLM call (`llm.route`). This collapses today's two cheap-tier calls (`classify` + `disambiguate`) into one.
- **Core value:** Bullet-proof, Fast, Effortless UX
- **Why:** Without table-level context the classifier can't tell "insert red and blue tables" (intended `kind=create`) from "insert into red and blue" (intended `kind=write`). Recent tables are the cheapest signal that disambiguates the two — if `red`/`blue` aren't in the cache, the goal must be create. Merging classify + disambiguate halves cheap-tier latency on the dbId-absent path; the prompt budget absorbs the extra context (100 × ~30 chars ≈ 3 KB).
- **Consequence in code:** `apps/api/src/ask/route-ask.ts` exports `routeAsk(deps, input)`. `apps/api/src/ask/classifier.ts` and `apps/api/src/ask/disambiguate-db.ts` are deleted. `LLMRouter.classify` and `LLMRouter.disambiguate` are replaced by `LLMRouter.route`; `LLMOperation.classify` and `LLMOperation.disambiguate` are removed. The route handler in `apps/api/src/index.ts` runs `routeAsk` in parallel with `listDatabasesForTenant` and dispatches on `{kind, targetDbId}`. PRs that re-introduce a separate kind-classification call fail review.
- **Alternatives rejected:**
  - Keep classify + disambiguate as separate cheap-tier calls — two LLM round-trips on every dbId-absent send; second call's input partially overlaps the first.
  - Pass the full schema (every table across every db) — token-explodes on power users; bounded MRU is the right subset.
  - Pass dbset only (no tables) — solves classify+disambiguate merge but doesn't help the "insert red and blue tables" misclassification, which is the load-bearing case.
```

Also: SK-ASK-003 gets a one-line `Status: superseded by SK-ASK-009 — see SK-ASK-009 for the merged decision`. Same for SK-HDC-005. **Don't delete or renumber.**

## SK-ASK-002 update (canonical step order)

Reword the **Decision** and **Consequence in code** lines so the canonical step order changes from:

> rate-limit → hash → plan-cache → (hit: validate → exec) | (miss: classify → plan → SQL-validate → exec → cache-write) → optional summarize

To:

> rate-limit → hash → plan-cache → (hit: validate → exec) | (miss: route → plan → SQL-validate → exec → cache-write) → optional summarize

Update `docs/performance.md §2.1, §2.2` in the same edit (SK-ASK-002 mandates the paired update).

## Tests required

- 0-dbs → deterministic `kind=create`, no LLM call.
- Recent-table substring + write verb → `kind=write`, correct dbId.
- Recent-table substring + query verb → `kind=query`.
- Slug fast-path picks dbId; LLM still decides kind.
- LLM call: structured-output validation (Zod or hand-rolled — match the codebase's existing pattern in providers).
- LLM picks unknown table → returns `kind=create` (the prompt rule encodes this).
- LLM `confidence < 0.7` → handler returns 409 `candidate_dbs`.
- Bundle budget unchanged or smaller (we deleted two files).

## Acceptance criteria

- [ ] `route-ask.ts` ships with full test coverage; `classifier.ts` + `disambiguate-db.ts` deleted.
- [ ] `LLMRouter.route` op wired through router + every provider; old `classify`/`disambiguate` paths gone.
- [ ] `apps/api/src/index.ts` prelude rewritten; speculative-disambiguate gone.
- [ ] SK-ASK-009 added; SK-ASK-003 + SK-HDC-005 marked superseded; SK-ASK-002 + `docs/performance.md §2.1, §2.2, §2.3, §3.1` updated.
- [ ] `bun run typecheck && bun run lint && bun run test` green.
- [ ] Bundle delta ≤ 0 KB (deleting two files; new module is comparable size).

## Out of scope

- The MRU cache itself (WS1).
- Speculative create on probable-0-dbs (WS3).
- Retry-with-feedback when the classifier still gets it wrong (deferred — relies on `GLOBAL-022`).
