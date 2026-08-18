# SK-ASK-007 — `user.first_query` fires exactly once per user via the lookup-then-emit-then-commit pattern

Parent feature: [`ask-pipeline/FEATURE.md`](../FEATURE.md).

- **Decision:** The first successful `/v1/ask` per user emits a `user.first_query` product event exactly once, via lookup-then-emit-then-commit against a KV marker — the marker is checked, the event is emitted, the marker is committed. The full pattern is in `docs/performance.md §4` Slice 6.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Writing the marker before emitting drops the event on a Worker crash; emitting then writing double-emits on retry. Lookup-then-emit-then-commit with idempotent sink writes (events-pipeline) gives at-most-once *user-visible* (the dashboard counts unique users) without dropping the signal.
- **Consequence in code:** the lookup/commit pair is span-wrapped (`nlqdb.cache.first_query.{lookup,commit}`) and the emit rides `ctx.waitUntil` so it runs after the response — at-most-once even across two concurrent first calls (the second observes the marker).
- **Alternatives rejected:** Write marker first — event drops on crash. Emit first — double-emit on retry. Synchronous DB write — adds a DB round-trip to the response path.
