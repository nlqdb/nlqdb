---
name: plan-cache
description: Content-addressed plan storage keyed by (schema_hash, query_hash).
when-to-load:
  globs:
    - apps/api/src/ask/plan-cache.ts
  topics: [plan-cache, schema_hash, query_hash, memoization]
---

# Feature: Plan Cache

**One-liner:** Content-addressed plan storage keyed by (schema_hash, query_hash).
**Status:** implemented
**Owners (code):** `apps/api/src/ask/plan-cache.ts`
**Cross-refs:** docs/architecture.md §0 (Bullet-proof checklist), §2 (architecture), §7 (free-tier stack), §8 (cost-control rules), §9 (cache invalidation row) · docs/architecture.md §10 Slice 6 (`/v1/ask` E2E) · docs/performance.md §2.1, §3.1, §3.2

## Touchpoints — read this skill before editing

- `apps/api/src/ask/plan-cache.ts`

## Decisions

### SK-PLAN-001 — Backend is Cloudflare Workers KV

- **Decision:** The plan cache is stored in Cloudflare Workers KV. Phase 0 / 1 capacity is the KV free tier (100 k reads/day, 1 k writes/day, 1 GiB total).
- **Core value:** Free, Fast, Simple
- **Why:** KV is co-located with the Worker (same edge), giving 5 ms p50 / 15 ms p99 reads (`docs/performance.md §2.1`). It needs no provisioning step, no connection pool, and no extra dependency in the bundle (`GLOBAL-013`). The free tier covers Phase 1 traffic with headroom because plans are cheap to write and most are read many times before they're evicted.
- **Consequence in code:** `apps/api/src/plan-cache/**` uses the Workers KV binding directly. No abstraction layer that pretends KV is interchangeable with Redis or Postgres — when we move the cache (if ever), we move it explicitly. The bundle has zero plan-cache deps.
- **Alternatives rejected:** Redis (Upstash) — adds a connection step, costs at scale, and duplicates KV's edge co-location. D1 — fine for control-plane data; row-level reads are slower than KV's key-value access pattern. In-Worker memory cache — Workers are stateless across invocations; would lose every cache on cold-start.
- **Source:** docs/architecture.md §2, §7

### SK-PLAN-002 — Cache key = `(schema_hash, query_hash)` content-addressed; no other inputs

- **Decision:** The plan cache key is the pair `(schema_hash, query_hash)` — and only that pair. No `user_id`, no `tenant_id`, no LLM-provider, no model-version, no time component appears in the key.
- **Core value:** Fast, Simple, Bullet-proof
- **Why:** Plans are deterministic outputs of (schema, query). Adding any other input narrows the cache key space, drops the hit rate, and re-introduces the "is this user's plan compatible with that user's plan" question that determinism already answered. If a future requirement *does* need to differ — e.g., engine-specific plans for Phase 3 — we widen `query_hash` to include the engine label, not the cache key.
- **Consequence in code:** `cacheKey(schema_hash, query_hash) → string` is the only constructor. Reviews reject any helper that adds a third field. Engine label, model version, prompt-template version, etc. fold into `query_hash` as the input changes — the cache key stays the same shape.
- **Alternatives rejected:** Per-tenant cache (`(tenant_id, schema_hash, query_hash)`) — kills the cross-tenant hit rate that makes the cache pay off; identical schema + query produces identical SQL regardless of tenant. Per-model cache — same problem; if model output differs the input differs (model version goes into `query_hash`).
- **Source:** docs/architecture.md §0, §9 · docs/decisions.md#GLOBAL-006

### SK-PLAN-003 — No TTL, no manual invalidation; eviction is LRU only when budget exhausts

- **Decision:** Cached plans have no TTL and there is no manual flush API. Old keys are evicted by LRU when the storage budget exhausts, never on a schedule and never on a "cache version bump."
- **Core value:** Bullet-proof, Fast, Simple
- **Why:** Cache invalidation is the second-hardest problem in CS; TTLs introduce flakiness around the boundary (a query that just cache-missed re-runs the LLM even though nothing changed). `(schema_hash, query_hash)` covers every input that determines the output, so a TTL would only ever discard correct plans. Letting LRU handle the budget keeps the design free of operator-poked levers.
- **Consequence in code:** No `ttl_sec` parameter on the write path. No `invalidateCache()` admin endpoint. The "force a new plan" escape hatch lives at the input layer — change `query_hash` (e.g., a `--force-replan` hint adds a salt to `query_hash`), don't punch through the cache. Hit on stale plan is structurally impossible because schema widening doesn't change `schema_hash` for fields the plan doesn't reference (per `GLOBAL-004`).
- **Alternatives rejected:** TTL of N hours / N days — wastes the 99% case where inputs are unchanged; introduces flakiness. Manual flush button — operator footgun; usually used to "fix" a bug that's actually input-not-changing-when-it-should.
- **Source:** docs/architecture.md §0, §9 · docs/decisions.md#GLOBAL-006

### SK-PLAN-004 — Reads are exact-match only; no fuzzy / prefix / similar-query lookup

- **Decision:** Cache reads are exact key match. There is no fuzzy lookup ("close enough query"), no prefix scan, no embedding-similarity match against a stored plan corpus.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Fuzzy matching turns the cache from a memo into a heuristic — a "miss looks like a hit" failure mode that's nearly impossible to debug. The user typed "top 5 customers" and got the plan for "top 10 customers" because the embeddings were close. Determinism is the cache's whole point.
- **Consequence in code:** `kv.get(cacheKey)` only. No `kv.list({prefix})` paths in the read flow. Embedding-similarity lookups are reserved for *retrieval-augmented planning* (the LLM router's prompt context, not the plan cache itself).
- **Alternatives rejected:** Embedding nearest-neighbour cache lookup — fast in the happy case, untraceable in the failure case. Prefix-based lookup — same problem with smaller blast radius.
- **Source:** docs/decisions.md#GLOBAL-006

### SK-PLAN-005 — LLM-generated and human-pinned plans share the same store

- **Decision:** The plan cache is a single namespace. LLM-generated plans and human-pinned plans (a power-user "pin this plan to this query" flow) write to the same store under `(schema_hash, query_hash)`. Pinning works by salting `query_hash` so the pinned plan keys live next to the LLM-generated ones, not by introducing a parallel "pinned" cache.
- **Core value:** Simple, Bullet-proof, Creative
- **Why:** A parallel pinned cache means two read paths, two eviction policies, two failure modes. One store with deterministic keys gives pinning the same operational properties as the auto-cached plans — and lets a human pin override the LLM's plan in the obvious way (a hit on a deliberately-shaped key wins).
- **Consequence in code:** Pinning writes are `kv.put(cacheKey(schema_hash, queryHashWithPinSalt), plan)`. Reads still go through one `kv.get`. No "is this pinned?" branch in the read path.
- **Alternatives rejected:** Separate `plan-pins` KV namespace — duplicates eviction logic, doubles surface area. Look up pin first, fall through to LLM-cache — adds a hop on the hot path; same result with a salt.
- **Source:** docs/architecture.md §0 (Bullet-proof) · docs/decisions.md#GLOBAL-006

### SK-PLAN-006 — Cache write happens in-band before the response, not in `waitUntil`

- **Decision:** The plan-cache write on a cache miss completes *before* the response is returned to the client. It is not deferred to `ctx.waitUntil`.
- **Core value:** Bullet-proof, Fast
- **Why:** The next request — possibly arriving milliseconds after this one finishes — must see the new plan, otherwise we'd thrash the LLM on bursty traffic. KV writes are 5 ms p50 / 25 ms p99 (`docs/performance.md §2.4`); deferring it past the response saves 5 ms but creates a window where two near-simultaneous requests both miss and both call the LLM. The 5 ms is paid back many times over by the LLM call avoided.
- **Consequence in code:** Step 11 in the cache-miss flow (`docs/performance.md §2.2`) is `Plan-cache write (KV)` and is awaited synchronously in the request handler. Only `nlqdb.events.emit` (product events) is wrapped in `ctx.waitUntil` — the cache write is not.
- **Alternatives rejected:** Deferred write via `ctx.waitUntil` — saves a few ms per miss at the cost of duplicate LLM calls under burst. Skip the write under load — the failure mode is worse: every concurrent miss becomes a paid LLM call.
- **Source:** docs/performance.md §2.2, §3.1

### SK-PLAN-007 — Every lookup emits hit/miss observability counters

- **Decision:** Every plan-cache lookup emits the canonical observability triple from `docs/performance.md §3`: a `nlqdb.cache.plan.lookup` span with label `hit=true|false`, plus `nlqdb.cache.plan.hits.total` / `nlqdb.cache.plan.misses.total` counters. Writes emit `nlqdb.cache.plan.write` spans.
- **Core value:** Honest latency, Bullet-proof, Fast
- **Why:** The cache is the largest cost lever in the system (per `docs/architecture.md §8`: "60–80% cache hit on mature workloads"). Without per-lookup hit/miss telemetry we can't tell whether a latency regression is the cache rate dropping or the LLM slowing down. Span + counter pair gives both per-request detail and aggregate counts.
- **Consequence in code:** `cacheLookup()` is wrapped in the canonical span; the `hit` label is set before exit. Counter increments are unconditional (one of {`hits`, `misses`} fires every time). The spans/counters land together with the slice they belong to (`docs/architecture.md §10` Slice 6 instrumentation table).
- **Alternatives rejected:** Lookup-counter only (no span) — loses the per-request latency breakdown. Span only (no counter) — loses cheap aggregate reporting; counters land in dashboards without span-aggregation cost.
- **Source:** docs/performance.md §3.1, §3.2 · docs/decisions.md#GLOBAL-014

### SK-PLAN-008 — Replanning is triggered only when an observed field *disappears* (hard-stop, not normal flow)

- **Decision:** Plan replanning is **not** a routine path. The cache hit/miss flow is the routine path. Replanning happens only when an observed-field-disappearance event triggers a hard-stop signal (per `GLOBAL-004`); under benign schema *widening* the cache stays valid because old plans still reference fields that still exist.
- **Core value:** Bullet-proof, Simple, Fast
- **Why:** If schema growth invalidated the cache, every customer would pay the LLM cost on every schema migration. `GLOBAL-004` makes that impossible by widening only — fields don't disappear under normal use. The only event that *would* require a replan (an observed field vanishing) is rare enough that we treat it as a hard-stop, not a branch in the cache code.
- **Consequence in code:** No "schema-version" branch in the cache read path. The disappearance-event handler is a separate, infrequently-tested code path that re-emits a `query_hash` salt and forces a fresh plan generation. It does not invalidate other entries.
- **Alternatives rejected:** Replan on any schema change — breaks `GLOBAL-006`'s "no cache invalidation" promise. Replan on a heuristic ("this query looks similar to one that broke") — silent wrong-plan failure mode.
- **Source:** docs/decisions.md#GLOBAL-004 · docs/decisions.md#GLOBAL-006

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`.
- **GLOBAL-004** — Schemas only widen.

## Open questions / known unknowns

- **Cache-warming on cold KV namespaces.** First-time deploys start with an empty KV. We don't currently warm the cache from the LLM router — every first user pays an LLM call. Decide whether to ship a one-time bulk pre-warm for canonical demo queries, or accept the cold-start cost.
- **Cross-region KV replication latency.** Workers KV is eventually consistent across regions (sub-60s typical). A write in Frankfurt may take seconds to be visible in Sydney. For our Phase 0 / 1 single-region traffic this is moot, but worth flagging before global Phase 2 rollout.
- **Disappearance-event hard-stop UX.** `SK-PLAN-008` says a vanished observed field is a hard-stop. The user-facing story for "your plan was invalidated because field X is gone" is not specified — error code, message, recovery path. Open question for the schema-widening skill.
- **Pin-eviction policy.** `SK-PLAN-005` says LRU evicts pins like any other plan. Should human-pinned plans be exempt from LRU? Probably yes for a power-user feature, but the design doesn't decide.
