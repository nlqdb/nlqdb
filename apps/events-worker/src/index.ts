// nlqdb-events-worker — drains the `nlqdb-events` queue and dispatches
// each event to its configured sink(s). Phase 0 has two sinks:
//   • LogSnag — one-shot user/lifecycle events (`SK-EVENTS-006`).
//   • Tinybird `query_log` — batched `ask.completed` fingerprints (W4).
//
// The producer side is `@nlqdb/events`; this worker is the only thing
// that talks to external sinks, keeping `apps/api`'s dependency
// surface minimal (no LogSnag client / Tinybird HTTP in the request
// hot path).
//
// Per `GLOBAL-021`, the Tinybird HTTP client itself lives in
// `@nlqdb/db/clickhouse-tinybird/query-log.ts`; this worker imports
// `writeQueryLog` (via the `query-log.ts` sink helper) and never
// holds a Tinybird token directly. Owner-to-owner library dependency
// is explicitly allowed by GLOBAL-021.
//
// `ask.completed` is high-volume (one per `/v1/ask` success). To keep
// us under Cloudflare's 10K queue ops/day Free-tier ceiling, we
// dispatch all `ask.completed` messages in a batch via a single
// Tinybird HTTP write rather than one per message. LogSnag-bound
// events still iterate one-by-one — its API has no bulk submission.
//
// Telemetry per batch + per message via OTel; same setup pattern as
// apps/api so spans correlate via `service.name`.

import type { QueryLogEntry } from "@nlqdb/db";
import type { EventEnvelope } from "@nlqdb/events";
import { setupTelemetry } from "@nlqdb/otel";
import { trace } from "@opentelemetry/api";
import { publishToLogSnag } from "./sinks/logsnag.ts";
import { publishToQueryLog } from "./sinks/query-log.ts";

const SERVICE_VERSION = "0.1.0";

export default {
  async queue(
    batch: MessageBatch<EventEnvelope>,
    env: Cloudflare.Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    if (env.GRAFANA_OTLP_ENDPOINT && env.GRAFANA_OTLP_AUTHORIZATION) {
      const telemetry = setupTelemetry({
        serviceName: "nlqdb-events-worker",
        serviceVersion: SERVICE_VERSION,
        otlpEndpoint: env.GRAFANA_OTLP_ENDPOINT,
        authorization: env.GRAFANA_OTLP_AUTHORIZATION,
      });
      ctx.waitUntil(telemetry.forceFlush());
    }

    const tracer = trace.getTracer("@nlqdb/events-worker");
    await tracer.startActiveSpan("nlqdb.events.consume", async (batchSpan) => {
      batchSpan.setAttribute("nlqdb.events.batch_size", batch.messages.length);
      try {
        await drainBatch(env, batch);
      } finally {
        batchSpan.end();
      }
    });
  },
} satisfies ExportedHandler<Cloudflare.Env, EventEnvelope>;

// Split the batch by destination sink, then dispatch each group.
// `ask.completed` flows to Tinybird in one HTTP call; everything else
// goes to LogSnag one-by-one (its API has no bulk submission).
async function drainBatch(env: Cloudflare.Env, batch: MessageBatch<EventEnvelope>): Promise<void> {
  const queryLogMsgs: Message<EventEnvelope>[] = [];
  const logSnagMsgs: Message<EventEnvelope>[] = [];
  for (const msg of batch.messages) {
    if (msg.body.event.name === "ask.completed") {
      queryLogMsgs.push(msg);
    } else {
      logSnagMsgs.push(msg);
    }
  }
  await Promise.all([drainQueryLog(env, queryLogMsgs), drainLogSnag(env, logSnagMsgs)]);
}

// LogSnag dispatch — same shape as before. Each event is its own HTTP
// call; ack/retry per message.
async function drainLogSnag(env: Cloudflare.Env, msgs: Message<EventEnvelope>[]): Promise<void> {
  for (const msg of msgs) {
    await dispatchLogSnag(env, msg);
  }
}

async function dispatchLogSnag(env: Cloudflare.Env, msg: Message<EventEnvelope>): Promise<void> {
  const tracer = trace.getTracer("@nlqdb/events-worker");
  await tracer.startActiveSpan("nlqdb.events.dispatch", async (span) => {
    span.setAttribute("nlqdb.event.id", msg.body.id);
    span.setAttribute("nlqdb.event.type", msg.body.event.name);
    try {
      if (!env.LOGSNAG_TOKEN || !env.LOGSNAG_PROJECT) {
        // Unconfigured sink: ack-and-drop rather than retry forever.
        // The trace span on the parent already records the event id, so
        // an operator missing config can find dropped events in OTel.
        msg.ack();
        return;
      }
      await publishToLogSnag(
        { token: env.LOGSNAG_TOKEN, project: env.LOGSNAG_PROJECT },
        msg.body.event,
        msg.body.id,
      );
      // Logged at info level (no PII — id is `<event>.<userId>`, which
      // is opaque). Cheap insurance for `wrangler tail` debugging in
      // prod when an OTel pipeline isn't already attached.
      console.info(`dispatched ${msg.body.event.name} id=${msg.body.id}`);
      msg.ack();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.recordException(error);
      console.error(`dispatch failed ${msg.body.event.name} id=${msg.body.id}: ${error.message}`);
      msg.retry();
    } finally {
      span.end();
    }
  });
}

// Query-log dispatch — one Tinybird HTTP call per batch. On success
// every message acks; on failure every message retries (the queue
// re-batches them). When the circuit-breaker is open, every message
// ack-and-drops — Tinybird is consistently down and queue retries
// won't recover the upstream.
async function drainQueryLog(env: Cloudflare.Env, msgs: Message<EventEnvelope>[]): Promise<void> {
  if (msgs.length === 0) return;

  if (!env.TINYBIRD_TOKEN) {
    // Unconfigured sink: ack-and-drop. Same posture as LogSnag's
    // `SK-EVENTS-005`. Tinybird auths by token alone — workspace is
    // implicit in the token's scope.
    for (const msg of msgs) msg.ack();
    return;
  }

  const entries: QueryLogEntry[] = msgs.map((m) => {
    // Narrowing: drainBatch only routes `ask.completed` here, so the
    // cast is safe — the worker's discriminated union enforces the
    // shape upstream. We pass through the envelope `id` as `eventId`
    // so the writer can emit it as the `event_id` column for
    // downstream dedup (Cloudflare Queues redelivers; Tinybird does
    // not dedupe natively — see SK-EVENTS-009 / writeQueryLog JSDoc).
    if (m.body.event.name !== "ask.completed") {
      throw new Error(`drainQueryLog received non-ask.completed event: ${m.body.event.name}`);
    }
    return { eventId: m.body.id, event: m.body.event };
  });

  try {
    const result = await publishToQueryLog(
      {
        token: env.TINYBIRD_TOKEN,
        apiBase: env.TINYBIRD_API_BASE,
      },
      entries,
    );
    if (!result.ok) {
      // Circuit-breaker open — ack-and-drop. The operator signal is
      // the OTel span (ERROR status, `nlqdb.events.circuit_open=true`)
      // and the failures counter; the queue retry budget would burn
      // for nothing while Tinybird is wedged.
      for (const msg of msgs) msg.ack();
      return;
    }
    for (const msg of msgs) msg.ack();
  } catch {
    // publishToQueryLog already recorded the exception + incremented
    // the failure counter on its span. Retry every message in the
    // batch; Cloudflare Queues caps retries at `max_retries` (3) per
    // message.
    for (const msg of msgs) msg.retry();
  }
}
