# SK-ASK-023 — Swallowed-failure diagnostics persist to shared KV because preview invocations log nowhere

- **Decision:** Failure classes whose only record is a console line +
  span attributes persist their extracted `(pgCode, pgMessage, dbId, …)`
  as 7-day-TTL rows in the shared `KV` namespace
  (`diag:<event>:<ts>:<rand>`, `makeKvDiagSink` in
  `apps/api/src/ask/diag.ts`, stamped with `NODE_ENV` as `source`) —
  because Cloudflare **preview-URL invocations emit no logs anywhere**
  (Workers Logs, `wrangler tail`, and Logpush all exclude them), and
  previews are exactly where the e2e suite's failures happen. Classes
  today: the `/v1/ask` exec catch-all (`exec_db_unreachable`) and the
  adoption ACL-retarget catch (`anon_adopt_regrant_failed`).
- **Core value:** Bullet-proof, Free
- **Why:** `SK-ASK-019` made the `db_unreachable` black hole "greppable in
  a single run" — but only where logs exist. The e2e staging surface runs
  on Workers *preview versions* (`wrangler versions upload`), and
  Cloudflare stores no telemetry for preview invocations (verified against
  CF docs + community, 2026-07-11; the Workers Logs dataset for a full e2e
  window contains zero preview events). The run-48 adoption-ACL gap took
  nine e2e runs to diagnose for exactly this reason, and run 52's surviving
  intermittent `db_unreachable` class ended on "pull the SQLSTATE from
  staging logs" — an impossible instruction. Shared bindings DO work from
  previews (D1 control-plane sharing; queue events observed arriving from a
  preview mid-dispatch), so KV is the minimal durable channel: no D1
  migration, no consumer deploy, prefix-multiplexed like `plan:` /
  `recent_tables:`, TTL retention for free, pullable offline via the CF
  REST API.
- **Consequence in code:** `diag.ts` is pure storage over `KVStore` (the
  plan-cache split); the orchestrate catch-all calls
  `recordExecUnreachable` (which now returns the extracted pair) and then
  `deps.diag.record` under a **swallowed** `nlqdb.diag.write` span — a
  diagnostic write must never alter the error path or delay the 502
  meaningfully. `build-deps.ts` wires `makeKvDiagSink(KV, NODE_ENV)`.
  Pull: list `diag:` keys via wrangler / the CF KV REST API. Writes are
  capped per isolate per minute (`DIAG_MAX_WRITES_PER_WINDOW`) so an
  outage storm eats the namespace's shared 1 k/day free-tier write
  quota (GLOBAL-013) at a trickle, not at request rate. The cap is
  load-bearing: the ask-pipeline's own KV writes (plan-cache fills,
  first-query, recent-tables, diag itself) fail soft when the quota
  drains, but the same namespace also backs writers that fail hard —
  the anon per-IP limiter's counter put and Better Auth secondary
  storage. Reviewers reject a diag write that can throw into the
  request path, and any new `diag:*` row class without a TTL.
- **Alternatives rejected:**
  - **Live `wrangler tail` during e2e runs** — previews don't reach tail
    either; CF excludes them from every log surface.
  - **A `ProductEvent` variant through `EVENTS_QUEUE`** — the consumer is
    the *deployed* events-worker, so a new variant is invisible until
    merge + deploy (unverifiable from the branch that ships it), and it
    bends the founder-signal pipeline (`SK-EVENTS-006` domains) into a
    diagnostics bus.
  - **A D1 diagnostics table** — needs a forward-only migration on the
    shared control plane and conflates the user store with diagnostics
    (the posture `SK-EVENTS-008` already rejected); KV TTL is retention
    for free.
  - **Span attributes / console line only (status quo)** — is the failure
    being fixed; previews drop both.
