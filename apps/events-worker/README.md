# `apps/events-worker`

Drains the `nlqdb-events` Cloudflare Queue and dispatches each event to
its sink(s). Phase 0 has two sinks:

- **LogSnag** — one-shot user/lifecycle events (`SK-EVENTS-006`).
- **Tinybird `query_log`** — batched `ask.completed` fingerprints (W4 →
  W5 input). Per `GLOBAL-021`, the Tinybird HTTP boundary lives in
  `@nlqdb/db/clickhouse-tinybird/query-log.ts`; this worker imports
  `writeQueryLog` and never holds a Tinybird token of its own.

Architecture rationale lives in [`docs/features/events-pipeline/FEATURE.md`](../../docs/features/events-pipeline/FEATURE.md) and
[`docs/history/infrastructure-setup.md §6`](../../docs/history/infrastructure-setup.md#6-observability). This README covers
the operational surface only.

## Adding a new event type

1. Extend the `ProductEvent` discriminated union in
   [`packages/events/src/types.ts`](../../packages/events/src/types.ts).
2. Add a case to `buildPayload()` in
   [`src/sinks/logsnag.ts`](src/sinks/logsnag.ts) (or skip if no
   LogSnag mapping is needed yet).
3. Producers can call `events.emit({ name: "...", ... })` immediately —
   the consumer dispatch is the only place that needs to know the new
   shape.

## Adding a new sink

1. Create `src/sinks/<name>.ts` exporting a `publishTo<Name>()` function
   that takes a config + the relevant event payload.
2. Wire it in `drainBatch()` in [`src/index.ts`](src/index.ts), routing
   the relevant event names to the new sink and gating on the
   appropriate env-var check (so an unconfigured sink doesn't block
   delivery to other sinks).
3. Add the sink's secrets to `.envrc`,
   [`scripts/mirror-secrets-workers.sh`](../../scripts/mirror-secrets-workers.sh),
   and [`src/env.d.ts`](src/env.d.ts).
4. If the sink talks to an external system not yet in the `GLOBAL-021`
   owner table, add a row there and put the SDK / fetch client in the
   canonical owner package — never inside `apps/events-worker`.

## Deploy

Same three-step pattern as `apps/api`, minus migrations (this Worker
has no D1 schema):

```bash
(cd apps/events-worker && bun run secrets:remote)
(cd apps/events-worker && bun run deploy)
```

## Test

Unit-only for now (no Miniflare-backed queue test):

```bash
bun run --cwd apps/events-worker test
```

## Failure handling

- **LogSnag 5xx / network error** → consumer throws → Cloudflare retries
  per `wrangler.toml` `max_retries = 3`.
- **LogSnag 4xx** → also retries (cheap to swallow once or twice). After
  retry exhaustion, the message is **dropped** (no DLQ configured today).
- **LogSnag token / project unset** → ack-and-drop with no fetch, so
  config drift doesn't pile up retries forever.
- **Tinybird query_log 5xx / network error** → batch retries via the
  queue. Five consecutive batch failures trip an isolate-scoped
  circuit-breaker (`SK-EVENTS-009`) — subsequent batches ack-and-drop
  until the breaker resets on the next successful write. Operator
  signals: `nlqdb.events.sink.query_log.failures.total{status_class}`
  counter and `nlqdb.events.circuit_open=true` on the sink span.
- **Tinybird token / workspace unset** → ack-and-drop, same pattern as
  LogSnag.

When retry-exhaustion drops start showing in OTel, configure a DLQ:
add a second queue, then in `wrangler.toml`:

```toml
[[queues.consumers]]
queue = "nlqdb-events"
dead_letter_queue = "nlqdb-events-dlq"
```
