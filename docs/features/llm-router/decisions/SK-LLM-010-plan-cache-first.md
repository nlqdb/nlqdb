# SK-LLM-010 — Plan cache first, LLM second (cost-control rule #1)

- **Decision:** Every `/v1/ask` request consults the plan cache before any LLM call. The expected steady-state cache hit rate is 60–80% (`docs/architecture.md §7`); cache-warming is a deliberate step on first-deploy. The LLM router never bypasses the plan cache.
- **Core value:** Free, Fast, Honest latency
- **Why:** A frontier-model plan call is the most expensive operation on the hot path. The plan cache turns that cost into a one-time-per-`(schema_hash, query_hash)` event. Skipping the cache to "save a hop" is penny-wise; LLM cost dominates at every traffic level. This is also the single highest-leverage cost lever we have.
- **Consequence in code:** The ask-pipeline order in `SK-ASK-002` puts plan-cache lookup before any `llm.*` span. Tests assert that a second identical request hits the cache (no `llm.plan` span emitted). The router's API exposes no "skip-cache" flag; force-replan is a `query_hash` salt at the ask layer (`SK-PLAN-005`).
- **Alternatives rejected:** Cache only on second hit — wastes the first call; same cost as no-cache for a one-shot query. Cache off for "expensive" queries — every cached-but-expensive plan would be the one we discarded.
