// nlqdb-events-worker — drains the `nlqdb-events` queue and dispatches
// each event to its configured sink(s). Phase 0 has one sink: LogSnag.
//
// The producer side is `@nlqdb/events`; this worker is the only thing
// that talks to external sinks, keeping `apps/api`'s dependency
// surface minimal (no LogSnag client in the request hot path).
//
// Telemetry per batch + per message via OTel; same setup pattern as
// apps/api so spans correlate via `service.name`.

import type { EventEnvelope } from "@nlqdb/events";
import { setupTelemetry } from "@nlqdb/otel";
import { trace } from "@opentelemetry/api";
import { publishToLogSnag } from "./sinks/logsnag.ts";

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
        for (const msg of batch.messages) {
          await dispatch(env, msg);
        }
      } finally {
        batchSpan.end();
      }
    });
  },
} satisfies ExportedHandler<Cloudflare.Env, EventEnvelope>;

// Per-message dispatch. ack() on success, retry() on throw — Cloudflare
// caps total retries via wrangler.toml's max_retries.
async function dispatch(env: Cloudflare.Env, msg: Message<EventEnvelope>): Promise<void> {
  const tracer = trace.getTracer("@nlqdb/events-worker");
  await tracer.startActiveSpan("nlqdb.events.dispatch", async (span) => {
    span.setAttribute("nlqdb.event.id", msg.body.id);
    span.setAttribute("nlqdb.event.type", msg.body.event.name);
    try {
      await sendToSinks(env, msg.body);
      // Logged at info level (no PII — id is `<event>.<userId>`, which
      // is opaque). Cheap insurance for `wrangler tail` debugging in
      // prod when an OTel pipeline isn't already attached. The same
      // values are also on the `nlqdb.events.dispatch` span attributes
      // above, so OTel-attached environments don't need this line.
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

// Sink fan-out. Today every event goes to LogSnag (or nowhere if the
// token is unset — see env.d.ts). When a second sink lands (Resend,
// outbound webhook, etc.), add it here behind its own env-gate.
async function sendToSinks(env: Cloudflare.Env, envelope: EventEnvelope): Promise<void> {
  if (!env.LOGSNAG_TOKEN || !env.LOGSNAG_PROJECT) {
    // Unconfigured sink: ack-and-drop rather than retry forever.
    // The trace span on the parent already records the event id, so
    // an operator missing config can find dropped events in OTel.
    return;
  }
  await publishToLogSnag(
    { token: env.LOGSNAG_TOKEN, project: env.LOGSNAG_PROJECT },
    envelope.event,
  );
}
