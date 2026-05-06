---
name: rate-limit
description: Per-key, per-IP rate-limit middleware with X-RateLimit-* headers.
when-to-load:
  globs:
    - apps/api/src/ask/rate-limit.ts
    - apps/api/src/demo.ts
  topics: [rate-limit, throttle, 429, rate_limited, anonymous-tier]
---

# Feature: Rate Limit

**One-liner:** Per-key, per-IP rate-limit middleware with X-RateLimit-* headers.
**Status:** implemented — per-account D1 limiter (`/v1/ask`), per-IP anon-tier KV limiter (`apps/api/src/anon-rate-limit.ts`), global anon KV cap (`apps/api/src/anon-global-cap.ts`), and `X-RateLimit-*` parity headers. The legacy `/v1/demo/ask` per-IP limiter (formerly `apps/api/src/demo.ts`'s `makeRateLimiter`) was retired with the demo route under SK-WEB-008. Per-account anon-create cap (20/day) lands with adoption.
**Owners (code):** `apps/api/src/ask/rate-limit.ts`, `apps/api/src/demo.ts`
**Cross-refs:** docs/architecture.md §6 (free-tier rate-limit guarantees) · docs/architecture.md §3.5 (`pk_live_*` origin-pinned) · docs/architecture.md §3.6.8 (rate limits on create) · docs/architecture.md §10 §8 (per-IP + per-account "Day 1") · docs/architecture.md §10 §5.3 / §11.5 (free-tier abuse) · docs/performance.md §2.1 stage 3 / §2.2 stage 3 (KV-read budget — 5 ms p50 / 15 ms p99) · §3.1 (`nlqdb.ratelimit.check` span) · §4 Slice 6

## Touchpoints — read this skill before editing

- `apps/api/src/ask/rate-limit.ts` (per-user D1 limiter for `/v1/ask`)
- `apps/api/src/anon-rate-limit.ts` (per-IP KV limiter for the anon `/v1/ask` path)
- `apps/api/src/anon-global-cap.ts` (global anon KV cap, summed across all anon traffic)
- `apps/api/src/demo.ts` (fixture library only — the route + per-IP demo limiter retired in SK-WEB-008)
- `apps/api/src/index.ts` (route handlers that emit `Retry-After` + 429)
- `apps/api/src/ask/orchestrate.ts` (rate-limit-first ordering in the `/v1/ask` pipeline)
- D1 table `rate_limit_buckets` (schema in `apps/api/migrations/`)
- Workers KV namespace bound as `KV` (also used by Better Auth `secondaryStorage`)

## Decisions

### SK-RL-001 — Two limiter implementations: D1 for per-user (authed `/v1/ask`), KV for per-IP + global anon

- **Decision:** Per-user (authenticated) rate-limiting on `/v1/ask` runs against D1 with an atomic UPSERT-RETURNING counter (`apps/api/src/ask/rate-limit.ts`). Per-IP (anonymous) rate-limiting on `/v1/ask` runs against Workers KV with TTL-bucketed counters (`apps/api/src/anon-rate-limit.ts`). Global anonymous spend control runs against KV too (`apps/api/src/anon-global-cap.ts` — three rolling buckets summed across ALL anon traffic). Default ceilings: 60/min per user on the authed path, 30/min per anon IP, 100/hr / 1000/day / 10k/month globally across anon. The legacy `/v1/demo/ask` per-IP KV limiter (`apps/api/src/demo.ts`'s `makeRateLimiter`) was retired with the route under `SK-WEB-008`.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Workers KV writes are 1k/day on the free plan — one rate-limit `put` per `/v1/ask` exhausts that at ~1k requests/day total, which is below our launch-day target. D1 writes are 100k/day on Free (100× headroom) and SQLite UPSERT lets us increment + read the post-increment count in one atomic round-trip, avoiding the read-then-write race the KV version has. The demo endpoint trades that race for a thicker abuse-resistance budget — KV's TTL semantics map cleanly to "10/min per IP, no auth, cheap to abandon" without standing up a D1 row per anonymous IP.
- **Consequence in code:** `makeRateLimiter(d1, opts)` in `apps/api/src/ask/rate-limit.ts` is the only limiter on authenticated request paths. `makeRateLimiter(kv)` in `apps/api/src/demo.ts` is the only limiter on the public demo path. New authenticated endpoints reach for the D1 helper; new public endpoints reach for the KV helper. The two implementations share the `RateLimiter` interface shape (`{ ok: boolean, ... }`) so callers stay symmetric.
- **Alternatives rejected:**
  - Single KV-backed limiter for both — exhausts the 1k-writes-per-day Free quota within a day of any real traffic.
  - Single D1-backed limiter for both — every anonymous demo hit creates a `rate_limit_buckets` row keyed by IP, exploding D1 row count under abuse exactly when we need the limiter to be cheap.
  - Upstash Redis token-bucket (referenced in `docs/architecture.md §10 §3` "per-API-key token bucket in Upstash Redis") — not free-tier viable today; deferred to Phase 2 if D1 ceiling becomes a problem.

### SK-RL-002 — D1 limiter: atomic UPSERT-with-RETURNING; over-limit requests still increment

- **Decision:** The `/v1/ask` limiter uses a single SQL statement: `INSERT INTO rate_limit_buckets (user_id, window_start, count) VALUES (?, ?, 1) ON CONFLICT(user_id, window_start) DO UPDATE SET count = count + 1 RETURNING count`. The returned post-increment count gates allow/deny. **Over-limit requests still increment** the counter — N+1 → N+2, both deny.
- **Core value:** Bullet-proof, Fast, Simple
- **Why:** The two-statement read-then-write pattern races: two concurrent over-limit requests both read N, both write N+1, both think they're the first hit over. The atomic UPSERT closes this. Continuing to increment over-limit is harmless (the second over-limit hit just bumps the count), and it avoids a conditional UPDATE that would require a second SELECT to read state — adding latency to the most common deny path.
- **Consequence in code:** The limiter MUST stay a single SQL round-trip — no separate SELECT for "current state". The fixed-window boundary is computed as `Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds`; bucket roll-over is implicit (a new `window_start` value yields a new row). Stale rows are not actively swept today; D1's free-tier row count gives plenty of head-room for a Phase-0 launch.
- **Alternatives rejected:**
  - Separate SELECT then INSERT/UPDATE — open race window between read and write under load.
  - Sliding window — needs per-request retention of timestamps in D1; multi-row writes per request, much higher D1 write cost.
  - Token bucket in KV — re-introduces the read-then-write race and exhausts the KV write quota.

### SK-RL-003 — Rate-limit check is the FIRST step in the `/v1/ask` pipeline

- **Decision:** In `apps/api/src/ask/orchestrate.ts`, the rate-limit check (`nlqdb.ratelimit.check` span) runs before plan-cache lookup, before the LLM router, before SQL allowlist, before exec. An over-limit verdict short-circuits with `{ ok: false, error: { status: "rate_limited", limit, count } }` — no DB work, no LLM call, no plan-cache write.
- **Core value:** Fast, Honest latency, Free
- **Why:** Rate-limit is the cheapest gate. Every other step costs real money or latency: plan-cache reads use D1, LLM router calls outbound network, exec hits Neon. Running rate-limit last would spend the budget we're refusing to grant. This ordering also makes the pipeline-step semantics clean for the trace UI (`GLOBAL-011`) — the user sees a `rate_limited` step as the first and only step on a 429.
- **Consequence in code:** Reviewers reject any reordering that puts rate-limit downstream of cache/LLM/exec. The orchestrator's step order — `rate-limit → cache → router → allowlist → exec → summarize` — is canonical (see `docs/features/ask-pipeline/FEATURE.md`). The 429 response carries `{ limit, count }` so the client can render an honest "you've used N of M" message rather than a generic "try later".
- **Alternatives rejected:**
  - Per-step rate-limit (e.g. cap LLM calls separately) — fragments the limit into multiple counters; users can't predict their headroom.
  - Rate-limit after cache lookup so cache hits are exempt — sounds nice, but cache hits + over-limit users in the same window blow our `/v1/ask` Free-plan budget; the limiter is the budget.

### SK-RL-004 — 429 response shape: `{ status, limit, count, resetAt }` + RFC 9110 `X-RateLimit-*` headers + `Retry-After` on every limited surface

- **Decision:** `POST /v1/ask` (authed and anon-bearer paths) returns 429 with body `{ error: { status: "rate_limited", limit, count, resetAt } }`, `Retry-After: <seconds>`, and the `X-RateLimit-{Limit,Remaining,Reset}` triplet. `/v1/chat/messages` mirrors this shape. The legacy `/v1/demo/ask` surface (deleted under SK-WEB-008) used to return a slimmer `{ status: "rate_limited" }` body — now history. The `error.status` slug is constant across every limited surface so client code branches on a single string. Surfaces returning **`401 auth_required`** (`SK-ANON-010`, the global-anon-cap envelope) are **not** rate-limited responses — they're soft-promotions to sign-in and carry their own `{ status, code, window, resetAt, signInUrl, action }` body.
- **Core value:** Effortless UX, Honest latency, Bullet-proof
- **Why:** The demo path is unauthenticated and stateless; `Retry-After` is the standard browser/CLI signal for "wait this long". Authenticated `/v1/ask` carries richer context (the user can see their actual ceiling and current usage), so the body is the more useful surface — but the slug parity matters: a single client `if (error.status === "rate_limited")` works on both. (See Open Questions for `X-RateLimit-*` parity headers.)
- **Consequence in code:** Both routes set `c.header("Retry-After", ...)` only where the limit is window-based; SDK error parsing maps `error.status === "rate_limited"` to a `RateLimitedError` regardless of which route returned it. The error envelope is consistent with `GLOBAL-012` ("one sentence + next action").
- **Alternatives rejected:**
  - Bare 429 with no body — clients can't render a useful next-action message; violates `GLOBAL-012`.
  - Different slugs per surface (`demo_rate_limited` vs `ask_rate_limited`) — fragments client error handling and contradicts `GLOBAL-002` (parity across surfaces).

### SK-RL-005 — Free-tier abuse policy: rate-limit, never delete, never silently upgrade

- **Decision:** Hitting any free-tier ceiling rate-limits the user with a clear message — never deletes data, never silently upgrades to a paid plan, never holds data hostage. Export is always free, even 90d after a notional cancellation. DBs auto-pause after 7d idle (resume <2s, clearly disclosed). The "next action" the message offers is surface-dependent: per-IP / authed buckets surface 429 + `Retry-After`; the **anon global cap** (`SK-ANON-010`) surfaces 401 + `signInUrl` (the user is invited to sign in rather than wait, since their anon quota can't refresh).
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** The free-tier guarantee in `docs/architecture.md §6` is load-bearing for activation. A user who feels their data is at risk will not return; a rate-limit message they understand will (often) result in a card. "Free trial with countdown" is exactly the dark pattern we are not.
- **Consequence in code:** No code path in `apps/api` deletes user data on quota violation. Pause logic (Phase 1+) marks DBs paused on idle but reactivates on the next query. The 429 message must offer a next action (add a card / wait for window reset / export data); reviewers reject "rate limited, sorry" with no follow-up.
- **Alternatives rejected:**
  - Soft-delete after 30d over quota — exactly the user-hostile pattern we differentiate against.
  - Silent auto-upgrade with a card on file — violates `docs/architecture.md §6` "honest billing"; first charge is always double-confirmed via email.

### SK-RL-006 — Per-IP companion to per-account ships when anonymous-mode ships

- **Decision:** Today, `/v1/ask` is gated by `requireSession`, so per-account rate-limiting is sufficient. The per-IP companion limiter (PLAN §11.5 "per-IP + per-account rate limits Day 1") lands on the same slice that opens `/v1/ask` to anonymous requests. The two limiters compose: per-IP runs first on the unauthenticated path, per-account runs second after auth resolution.
- **Core value:** Bullet-proof, Free
- **Why:** Anonymous mode is the moment per-IP becomes load-bearing — without auth there's no per-account key, so IP becomes the only abuse-resistant identifier. Building the companion before anonymous-mode ships either (a) gates on a `clientIp` value that's always `requireSession`'s authed user — meaningless — or (b) requires gymnastic stub scaffolding. Co-shipping keeps the limiter and the surface it protects in lockstep.
- **Consequence in code:** The pipeline order on the anonymous-mode slice will be `per-IP rate-limit → resolve-or-mint-anonymous → per-account rate-limit → cache → ...`. Per-IP uses the demo-style KV limiter pattern (`apps/api/src/demo.ts`); per-account stays D1-backed. See `docs/features/anonymous-mode/FEATURE.md` for the cross-cutting decisions.
- **Alternatives rejected:**
  - Build per-IP today, gated on `cf-connecting-ip` only — adds ops surface (KV write quota) without buying any abuse resistance under the current authenticated-only `/v1/ask`.
  - Skip per-IP entirely — leaves anonymous mode with no defence against script-kiddie LLM-stand-in abuse.

### SK-RL-007 — Anon limiter splits one identity (IP) into three buckets: query, hour-create, burst-create

- **Decision:** `apps/api/src/anon-rate-limit.ts` keys three independent KV buckets off `cf-connecting-ip`: a 30/min query window, a 5/hour create cap, and a 5-minute burst window that flips to "needs Turnstile" at 3 creates. All three live in KV (per `SK-RL-001`'s per-IP/KV split) under distinct prefixes (`anon:query:`, `anon:create:hr:`, `anon:create:burst:`). Each verdict carries `{ limit, count, resetAt }` so the route emits `X-RateLimit-*` headers consistent with the authed path (`SK-RL-004` / `GLOBAL-002`). Layered ABOVE these per-IP buckets sits the **global anon cap** (`SK-ANON-010` / `apps/api/src/anon-global-cap.ts`) — three additional KV buckets (`anon:global:hr:` / `anon:global:day:` / `anon:global:mo:`) summed across all anon traffic, evaluated FIRST in the route. Trip-priority on the route: global → per-IP query → per-IP create → Turnstile burst.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** A single counter can't satisfy both the slow-burn cap (5/hour) and the burst gate (3-in-5min) — they have different windows and different consequences (429 vs. 428). Composing them as separate buckets keyed off the same IP keeps each one cheap (one KV `get`/`put` per bucket per request) and lets the Turnstile gate live independently of the hard cap. Same-prefix buckets would race on TTL and force one window length on both. KV's TTL semantics auto-evict; no sweep job (matches `SK-RL-001`).
- **Consequence in code:** `peekCreate()` is a read-only check the route runs before the orchestrator boots libpg-query — that's the cheap gate. `recordCreate()` runs only AFTER any Turnstile clears, so a bot stuck on the gate can't ratchet the counter forward. `checkQuery()` increments unconditionally (matching `SK-RL-002`). The 30/min query default is half the 60/min authed tier (`apps/api/src/ask/rate-limit.ts`); the rate-limit skill's Open Question on the anon ceiling is now closed at this number. Tests in `apps/api/test/anon-rate-limit.test.ts` cover the three-bucket isolation.
- **Alternatives rejected:**
  - Single `(ip, window)` row covering all three behaviors — forces one window length for query / hour-cap / burst, and bakes 429-vs-428 logic into a counter shape that can't express it.
  - D1-backed anon limiter — IP cardinality is unbounded under abuse; D1 row count would explode exactly when we need the limiter to be cheap (per `SK-RL-001`'s rejected-alternatives).
  - Reuse the demo limiter (`apps/api/src/demo.ts`) — its `hit()` is a single-bucket counter; can't compose for the burst-vs-cap split without forking it.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-007** — No login wall before first value.

## Open questions / known unknowns

- **`X-RateLimit-*` parity headers — RESOLVED.** `/v1/ask` (authed and anon-bearer) and `/v1/chat/messages` emit `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on every 429. `RateLimitDecision` carries `resetAt`. The legacy `/v1/demo/ask` parity claim (formerly here) was retired with the route under `SK-WEB-008`. The SDK-side header definitions (referenced in the original open question) are deferred to whenever the SDK adds retry-with-backoff — at that point the SDK should read `X-RateLimit-Reset` to schedule the retry rather than sleeping a fixed duration. SSE rate-limit responses (`/v1/ask` with `Accept: text/event-stream`) do NOT emit these headers because Hono's `streamSSE` commits the 200 before the rate-limit verdict is known; callers should use the `{ error: { status, limit, count, resetAt } }` event payload instead. Tracked as an open question: should SSE rate-limit responses return a plain 429 (not a stream) so headers can be set?
- **Stale `rate_limit_buckets` row sweep.** D1 rows accumulate one per `(user_id, window_start)` tuple. At 60-second windows + 1k DAU that's ~1.4M rows/day — well within D1's 5GB Free quota for now, but a sweep job (drop rows older than 1 hour) is cheap insurance once volume crosses 100k MAU.
- **Anonymous-tier ceiling — RESOLVED.** Pinned at 30/min per IP for `/v1/ask` (half the 60/min authed tier) plus 5/hour per-IP DB-create cap and a 3-in-5min Turnstile burst gate. Implemented in `apps/api/src/anon-rate-limit.ts` (per `SK-RL-007`). Per-account anon-create cap (20/day, named in `SK-ANON-004`) is still pending — anon principals don't have an "account" yet, so the per-IP cap is the only effective ceiling on creates. Lands when adoption (Worksheet 4) gives anon principals a stable per-account identity.
- **Tier-aware ceilings (Hobby / Pro).** Free is 60/min today. Hobby (50k/mo) and Pro ($0.0005/query over 50k) tiers in `docs/architecture.md §6` imply a higher per-minute ceiling for paid tiers. Limit-per-tier is not yet wired; needs `customers.tier` JOIN on the limiter call.
- **Premium-models add-on per-key spend cap.** `docs/architecture.md §6` Premium-models row notes "per-key spend cap" — separate from request-count rate-limit. Lago wiring (PLAN §6) is the natural home; not built.
- **Token bucket vs fixed window.** Fixed-window is cheap but allows burst-at-boundary (60 in the last second of one window, 60 in the first of the next). Token bucket smooths this. Defer until burst-abuse shows up in OTel.
