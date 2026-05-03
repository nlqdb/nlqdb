---
name: idempotency
description: Idempotency-Key on every mutation; (user_id, key) dedupe store; byte-exact retry response.
when-to-load:
  globs:
    - apps/api/src/stripe/webhook.ts
    - apps/api/src/waitlist.ts
    - apps/api/src/middleware.ts
    - apps/api/src/index.ts
    - packages/sdk/**
  topics: [idempotency, idempotency-key, retry, dedupe]
---

# Feature: Idempotency

**One-liner:** `Idempotency-Key` on every mutation; `(user_id, key)` dedupe store; byte-exact retry response.
**Status:** partial — natural-key dedupe shipped (Stripe webhook via `stripe_events`, waitlist via email-hash PK). The general-purpose `Idempotency-Key` middleware on `/v1/ask` writes and the SDK's auto-generated retry keys are open work — the contract is locked (DESIGN §14.6 + GLOBAL-005), implementation is not.
**Owners (code):** `apps/api/src/stripe/webhook.ts`, `apps/api/src/waitlist.ts`, `apps/api/src/middleware.ts` (target for the general middleware), `packages/sdk/**` (target for retry-key auto-generation).
**Cross-refs:** docs/architecture.md §9 line 938–939 (bullet-proof checklist) · §14.6 line 1255–1297 (HTTP API mutation contract) · docs/decisions.md#GLOBAL-005

## Touchpoints — read this skill before editing

- `apps/api/src/stripe/webhook.ts` — natural-key dedupe (`event_id` PK in D1 `stripe_events`).
- `apps/api/src/waitlist.ts` — natural-key dedupe (SHA-256 of email is PK; `ON CONFLICT` collapses).
- `apps/api/src/middleware.ts` — current location for cross-cutting middleware; the general-purpose Idempotency-Key middleware lands here when implemented.
- `apps/api/src/index.ts` — request routing; the auto-classifier (read vs write) lives here.
- `packages/sdk/**` — the SDK auto-generates keys for retried mutations; not yet implemented.

## Decisions

### SK-IDEMP-001 — Auto-classify reads vs writes; reject unkeyed writes with an actionable 400

- **Decision:** The API auto-classifies every request as read or write. Reads succeed without an idempotency key. Writes without a key return `400 idempotency_required` whose body contains a one-sentence message and the exact `curl` snippet showing the missing header (DESIGN §14.6 line 1284–1286).
- **Core value:** Effortless UX, Bullet-proof
- **Why:** Forcing a key on reads adds a useless step to the curl-one-liner workflow that DESIGN §14.6 is designed around. Forcing a key on writes is the only way to keep `GLOBAL-005`'s guarantee intact. Auto-classification + an actionable error is the smallest UX surface that delivers both.
- **Consequence in code:** The middleware (when implemented) inspects the route's classifier verdict — not the HTTP method alone, because `/v1/ask` is `POST` for both reads and writes (the body decides). The 400 body MUST include the exact shell snippet, not a generic "include the header" string. CLI / SDK / MCP surfaces translate the snippet to their idiom before showing it (per `GLOBAL-002` parity).
- **Alternatives rejected:**
  - Require a key on every request — bad UX for the curl path; users learn to copy-paste a static UUID and the protection is lost.
  - Reject without an actionable hint — leaves the user guessing; violates `GLOBAL-012`.

### SK-IDEMP-002 — Dedupe key is `(user_id, idempotency_key)` from the request, not a content hash

- **Decision:** The dedupe key is the tuple `(user_id, idempotency_key)` as supplied in the `Idempotency-Key` header. We do NOT dedupe by hashing the request body, and we do NOT dedupe across users (one user's key is independent of another's).
- **Core value:** Bullet-proof, Simple
- **Why:** Server-side dedup by content hash misses semantic duplicates — same intent, different timestamp / nonce / client clock — which is the exact failure mode `GLOBAL-005` exists to prevent. Scoping the key to `user_id` means a key collision across users is impossible by construction; we never have to argue about whether key reuse is the same user retrying or two callers stepping on each other.
- **Consequence in code:** The dedupe-store schema is `(user_id, idempotency_key) -> recorded_response`. PRs that introduce body-hashing as the primary dedupe mechanism will be rejected; PRs that combine `(user_id, key, body_hash)` for conflict-detection (key reused with different body) are open territory — see Open Questions on Stripe-style 409 mismatch.
- **Alternatives rejected:**
  - Body-hash dedupe — misses semantic duplicates; pinned out by GLOBAL-005's Alternatives list.
  - Global-key dedupe (no `user_id` namespacing) — invites cross-tenant collisions and turns key-guessing into an attack surface.

### SK-IDEMP-003 — Retry replay is byte-exact, including status code and content-type

- **Decision:** When a `(user_id, key)` hit is detected, the original recorded response is replayed byte-for-byte: same status code, same `Content-Type`, same body bytes. Headers that depend on the live request (`Date`, `X-Request-Id`) regenerate; everything else is replayed.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** Byte-exact replay is what makes a retry observably equivalent to the original — the caller's parser, JSON schema, and downstream cache don't need to know it was a retry. Replaying just the status would leave clients to re-derive the body, which defeats the point of recording it.
- **Consequence in code:** The dedupe-store entry stores `{ status, content_type, body }` together. Streaming responses (SSE) are out of scope for replay — see Open Questions; the general-purpose middleware in scope here covers JSON responses only.
- **Alternatives rejected:**
  - Replay status only, regenerate body — defeats GLOBAL-005's "byte-for-byte" promise.
  - Replay everything including transport headers — leaks stale `Date` / `Cache-Control`; harmless for JSON but actively confusing for caching proxies.

### SK-IDEMP-004 — Two coexisting patterns: natural-key dedupe + header-key dedupe

- **Decision:** Endpoints with semantic identity in the request itself (Stripe events keyed by `event_id`, waitlist keyed by email hash) dedupe via that natural key — no `Idempotency-Key` header required. Endpoints without a natural key (`/v1/ask` writes, `/v1/db/connect`, future mutations) use the `Idempotency-Key` header path. Both go through D1 with `ON CONFLICT` semantics for write atomicity.
- **Core value:** Simple, Bullet-proof
- **Why:** Demanding a header on Stripe webhooks would force Stripe (the upstream) to send one, which they don't; demanding one on the waitlist would force a public unauthenticated endpoint to invent client-side keying. The natural-key path is what's actually shipped today and is correct for those endpoints. The header path is the general primitive for everything else; `SK-IDEMP-001`'s auto-classifier routes between them.
- **Consequence in code:** Stripe webhook: `INSERT INTO stripe_events (event_id, ...) ON CONFLICT(event_id) DO NOTHING RETURNING 1`. Waitlist: SHA-256 of email is the PK, `ON CONFLICT DO NOTHING`. Header path (when implemented): `INSERT INTO idempotency_keys (user_id, key, ...) ON CONFLICT(user_id, key) DO NOTHING RETURNING 1`. The shared pattern is "insert-or-detect-existing in one D1 round-trip."
- **Alternatives rejected:**
  - Force every endpoint to use the header — public endpoints can't do that without breaking their unauth posture.
  - Per-endpoint custom dedupe code — the `ON CONFLICT` pattern is small enough to repeat; abstracting prematurely hides the tenant of each endpoint's identity.

### SK-IDEMP-005 — D1 is the dedupe store; `ON CONFLICT DO NOTHING RETURNING 1` is the atomic primitive

- **Decision:** The dedupe store is Cloudflare D1. The atomic insert-or-detect-existing primitive is `INSERT ... ON CONFLICT(<natural_or_synthetic_key>) DO NOTHING RETURNING 1 AS ok`. A non-null `ok` means "first time, process"; a null result means "duplicate, replay or skip." Genuine D1 errors (not duplicates) re-throw and produce a 500.
- **Core value:** Bullet-proof, Free
- **Why:** D1 gives single-writer linearisation per row, which is exactly what dedupe needs. `ON CONFLICT DO NOTHING RETURNING` is one round-trip and avoids the read-then-write race that a separate SELECT-then-INSERT would create. KV's eventual consistency is wrong for this — two concurrent retries could both see "no entry" and both process. Durable Objects would work but cost more and add latency without a benefit over D1's row-level semantics.
- **Consequence in code:** Every dedupe path uses this exact SQL pattern (see `apps/api/src/stripe/webhook.ts` lines 116–144 for the reference implementation). PRs that introduce SELECT-then-INSERT for dedupe will be rejected.
- **Alternatives rejected:**
  - KV — eventual consistency races; wrong tool.
  - Durable Objects — extra moving part, paid feature, no upside over D1.
  - Postgres in the tenant DB — couples cross-tenant control plane to per-tenant data; same reasoning as `SK-SCHEMA-002`.

### SK-IDEMP-006 — Stripe webhook idempotency: dispatch-after-insert; failed dispatch leaves `processed_at = NULL`

- **Decision:** The Stripe webhook flow inserts `(event_id, type, payload_r2_key)` first; on a successful insert (non-duplicate) it dispatches the event; on dispatch success it updates `processed_at`. If dispatch fails AFTER the insert succeeds, the response is still `200` (the event is recorded; Stripe retrying would just hit the duplicate path) and `processed_at` stays `NULL` — the queryable signal that the operator (or a future stuck-event sweeper) needs.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Returning 5xx after a successful insert would invite Stripe to retry, which would idempotent-skip the insert (correct) but never re-attempt the dispatch (wrong) — the event would be lost. Returning 200 with `processed_at = NULL` keeps the event visible without putting Stripe into a retry loop that does nothing useful. Operators replay via Stripe Dashboard "Resend" if needed; this is documented in the file header.
- **Consequence in code:** `apps/api/src/stripe/webhook.ts` `dispatchOk` flag gates the `processed_at` UPDATE. The webhook span carries `nlqdb.webhook.duplicate=true` for replays (a span attribute, not a counter — counts are only for genuine D1 failures via `nlqdb.webhook.stripe.idempotency_errors.total`). The `dispatchEvent`'s `default: return` is the deliberate no-op for unhandled types.
- **Alternatives rejected:**
  - 5xx on dispatch failure — Stripe retries, idempotent-skip blocks reprocessing, event lost.
  - Synchronous retry inside the handler — extends Worker billed-CPU time, still loses the operator-visibility signal that `processed_at = NULL` provides.

### SK-IDEMP-007 — SDK auto-generates keys for retried mutations; manual override allowed

- **Decision:** When the SDK retries a mutating call (because of a transient network error or a 5xx), it generates and re-uses one `Idempotency-Key` UUID for that logical call across retries. Callers can override by passing an explicit key — useful when the same intent crosses processes (e.g. resuming a CLI command).
- **Core value:** Effortless UX, Bullet-proof
- **Why:** Retries without keys are dangerous on any critical path (per `GLOBAL-005` Alternatives); the SDK is the single client (`GLOBAL-001`), so it is the one place that can guarantee every surface gets the same retry semantics. Auto-generation means the caller doesn't have to think about keys; manual override means power users can.
- **Consequence in code:** `packages/sdk/src/index.ts` retry helper generates a `crypto.randomUUID()` once per logical request and threads it through every retry. Surfaces (web, CLI, MCP) that go through the SDK inherit the behaviour; surfaces that bypass the SDK (forbidden by `GLOBAL-001`) would lose it. Not yet implemented — see Open Questions.
- **Alternatives rejected:**
  - Per-attempt keys — defeats the purpose; every retry looks like a new request to the server.
  - Force callers to pass a key always — pushes the responsibility to every surface; high chance someone forgets.

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.

## Open questions / known unknowns

- **Dedupe-store TTL.** GLOBAL-005 says "bounded-TTL store" but does not pin a number. Stripe uses 24h on their idempotency store; that is a defensible default. D1 row TTL would be implemented as a periodic sweep job (see `docs/runbook.md` §9 daily sweeps), not a per-row expiry. Open: pin the TTL + sweep cadence before the middleware lands.
- **Key reuse with a different body** — Stripe returns `400 idempotency_key_in_use` if a retry uses the same key with a different body. We have not decided whether to mirror that or to fall through to a fresh request. Recommended: mirror Stripe (mismatch is a programming error, not a transient hiccup). Storing a body hash alongside `(user_id, key)` makes the check cheap.
- **Replay scope for SSE / streaming responses** — `SK-IDEMP-003` covers JSON; the orchestrator's SSE path (DESIGN §14.6 streaming) is unclear. Likely answer: an SSE stream is not idempotent in the byte-exact sense (timestamps interleave); a retry should fall through to a fresh stream and let the client reconcile. Decision pending.
- **`/v1/waitlist` vs general path** — waitlist's natural-key dedupe is correct (`SK-IDEMP-004`), but it does NOT enforce the "writes require Idempotency-Key" 400 rule (`SK-IDEMP-001`). Waitlist is unauth + idempotent on email by construction; classifying it as "read" for the auto-classifier is a hack but works. Cleaner: a per-route opt-out flag for the middleware.
- **Anonymous-mode `user_id`** — `SK-IDEMP-002` keys on `user_id`, but anonymous-mode requests have a device token, not a Better Auth user ID. Open: do we use the anonymous device token as the `user_id` for dedupe purposes, or do we have a parallel `(device_id, key)` namespace? Cross-link to the `anonymous-mode` skill.
- **Cross-surface dedup** — if a user issues the same mutation via CLI and via web with the same key, do they collide? Per `SK-IDEMP-002` they share `user_id` so yes — that is the desired behaviour (one identity, one mutation). Confirm in the SDK retry helper that cross-surface key reuse is feature, not bug.
