# Packages · DB — Agents Guide

Engine-agnostic DB adapter. Phase 0 = Postgres via Neon.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → skill map, and
> the project-wide tech stack. This file narrows that guide to
> `packages/db/`.

## Skills relevant to this area

- [`db-adapter`](../../docs/features/db-adapter/FEATURE.md) — mandatory pre-read for changes that touch the feature.
- [`multi-engine-adapter`](../../docs/features/multi-engine-adapter/FEATURE.md) — mandatory pre-read for ClickHouse/Tinybird and any future non-PG engine.
- [`schema-widening`](../../docs/features/schema-widening/FEATURE.md) — mandatory pre-read for changes that touch the feature.
- [`observability`](../../docs/features/observability/FEATURE.md) — mandatory pre-read for changes that touch the feature.

## External systems owned here (`GLOBAL-021`)

`packages/db/` is the canonical owner for every user-data engine the
product talks to. Each has exactly one entry point; reaching past it
from outside the package fails review.

| External system | Entry module | Notes |
|---|---|---|
| Neon Postgres | `src/postgres.ts` (`createPostgresAdapter`) | All `@neondatabase/serverless` imports. Documented exception: `apps/api/src/db-create/build-deps.ts` for the control-plane provisioner — see `SK-HDC-*`. |
| ClickHouse via Tinybird | `src/clickhouse-tinybird/adapter.ts` (`createTinybirdAdapter`) | Owns the Tinybird HTTP client. The adapter exposes typed intent-named methods (`executePipe()` / `executeRawSql()` via the `execute()` plan dispatch today; W5 adds `createPipe()` / `dropPipe()` for the workload analyser). The Tinybird `fetch` client is **never** re-exported from this package — consumers go through `createTinybirdAdapter`. CI's `no-restricted-imports` rule for the Tinybird API token must reject any import of the HTTP client outside `packages/db/src/clickhouse-tinybird/`. |

When adding a new engine, follow the same pattern: a sibling directory
under `src/` that owns the SDK / HTTP client and exposes only the
typed entry points the rest of the codebase needs.

## Commands

```bash
bun run --filter @nlqdb/db build
bun run --filter @nlqdb/db test
```

## Local rules

- Every change here must respect the `GLOBAL-NNN` decisions in
  [`docs/decisions.md`](../../docs/decisions.md).
- A new external call (DB / LLM / HTTP / queue) needs an OTel span
  (`GLOBAL-014`).
- If a request is ambiguous or an error is unfamiliar — web-research
  current best practices first (see root `AGENTS.md` §2 P2).
- A decision change (new or amended) updates every place that copies
  it, in the same PR (root `AGENTS.md` §2 P3).

## When you finish

1. Run the commands above and ensure they all pass.
2. If you added a decision, it has an ID, lives in the right place
   (`docs/decisions.md` or the relevant `FEATURE.md`), and any duplicate
   of an affected `GLOBAL-NNN` is updated.
3. Open a PR; the root `AGENTS.md` §8 lists the pre-PR quality gates.
