# GLOBAL-014 — OTel span on every external call (DB, LLM, HTTP, queue)

- **Decision:** Every call that crosses a process boundary — DB query,
  LLM call, outbound HTTP, queue enqueue/dequeue — is wrapped in an
  OpenTelemetry span with the canonical attributes from
  `docs/performance.md` §3 (the span / metric / label catalog).
- **Core value:** Honest latency, Bullet-proof, Fast
- **Why:** Without spans on every external call, we can't answer "why
  is this request slow," "is the LLM the bottleneck," or "did this
  retry actually go to the DB twice." The catalog enforces consistent
  attribute names so dashboards and queries don't fragment.
- **Consequence in code:** `packages/otel` exposes the wrapper helpers;
  all DB / LLM / HTTP / queue clients in the codebase route through
  them. New external calls without a span fail review. Span names,
  attributes, and metrics match the catalog (no ad-hoc names).
- **Alternatives rejected:**
  - Sample only slow requests — loses the baseline distribution.
  - Per-team conventions — fragments the dashboards within a quarter.
