# GLOBAL-006 — Plans content-addressed by `(schema_hash, query_hash)`

- **Decision:** A query plan's cache key is the pair
  `(schema_hash, query_hash)`. There is no time-based invalidation, no
  "cache version," no manual flush. If the inputs match, the plan
  matches.
- **Core value:** Fast, Simple, Bullet-proof
- **Why:** Cache invalidation is the second-hardest problem in
  computer science; we side-step it by making every cache key
  derive entirely from the inputs that determine the output. Combined
  with `GLOBAL-004`, this guarantees plans are stable under benign
  schema growth.
- **Consequence in code:** `plan-cache` writes are keyed by
  `(schema_hash, query_hash)`; reads are exact-match only. Anything
  that wants to "force a new plan" must change `query_hash` (e.g., a
  pin or a hint), not invalidate the cache. LLM-generated plans are
  the only writers; humans pinning a plan write to the same store.
- **Alternatives rejected:**
  - TTL-based caches — wastes the 99% case where the inputs are
    unchanged, plus introduces flakiness around the boundary.
  - Versioned plans tied to schema versions — would force
    `GLOBAL-004` to branch.
