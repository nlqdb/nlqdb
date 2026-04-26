# `apps/events-worker`

Drains the `nlqdb-events` Cloudflare Queue and dispatches each event to
its sink(s). Phase 0 has one sink: **LogSnag**.

## Why a separate Worker

Keeps `apps/api`'s request hot path clean — no LogSnag client, no
event-fan-out logic, no per-sink retry budget. Producers fire-and-
forget through the `EVENTS_QUEUE` binding; this Worker handles the
delivery side.

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

1. Create `src/sinks/<name>.ts` exporting a `publish<Name>()` function
   that takes a config + `ProductEvent`.
2. Wire it in `sendToSinks()` in [`src/index.ts`](src/index.ts), gated
   on the appropriate env-var check (so an unconfigured sink doesn't
   block delivery to other sinks).
3. Add the sink's secrets to `.envrc`,
   [`scripts/mirror-secrets-workers.sh`](../../scripts/mirror-secrets-workers.sh),
   and [`src/env.d.ts`](src/env.d.ts).

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
bun --cwd apps/events-worker test
```

## Failure handling

- **LogSnag 5xx / network error** → consumer throws → Cloudflare retries
  per `wrangler.toml` `max_retries = 3`.
- **LogSnag 4xx** → also retries (cheap to swallow once or twice). After
  retry exhaustion, the message is **dropped** (no DLQ configured today).
- **Token / project unset** → ack-and-drop with no fetch, so config
  drift doesn't pile up retries forever.

When retry-exhaustion drops start showing in OTel, configure a DLQ:
add a second queue, then in `wrangler.toml`:

```toml
[[queues.consumers]]
queue = "nlqdb-events"
dead_letter_queue = "nlqdb-events-dlq"
```
