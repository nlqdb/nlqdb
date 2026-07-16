// PostHog sink (SK-EVENTS-013). Drains every EventEnvelope off
// `EVENTS_QUEUE` into PostHog Cloud so the founder can build funnels /
// cohorts / retention over the real product-event stream (GLOBAL-034).
//
// No SDK: a plain `fetch` to `<host>/batch/` keeps the events-worker
// under GLOBAL-013's 3 MiB bundle ceiling (posthog-node would pull in
// its own transport + retry machinery for a wire shape this small). The
// `phc_` project key is publishable, but this is the server side —
// events flow Worker → PostHog, never browser → PostHog for these.
//
// Idempotency: PostHog dedupes on (uuid, event, timestamp, distinct_id).
// We derive a DETERMINISTIC UUIDv5-shaped id from `EventEnvelope.id`
// (SK-EVENTS-004) so a Cloudflare Queue redelivery of a one-shot event
// (`user.first_query.<userId>`, …) collapses at ingest — the same way
// the LogSnag sink passes `EventEnvelope.id` through to `event_id`.
// Per-request volume events (`ask.completed`, `feature.destructive.*`)
// already carry a random `evt.<uuid>` envelope id, so each stays
// distinct — exactly what those metrics need.
//
// Best-effort fan-out: this sink NEVER flips a message's ack/retry.
// LogSnag (and the Tinybird query_log path) own delivery semantics; a
// PostHog outage must not re-page the operator or re-drive LogSnag. So
// `publishToPostHog` swallows its own errors onto the OTel span
// (`nlqdb.events.sink.posthog`) — mirrors the dunning-email best-effort
// posture in `index.ts`.

import type { EventEnvelope, ProductEvent } from "@nlqdb/events";
import { SpanStatusCode, trace } from "@opentelemetry/api";

export type PostHogConfig = {
  apiKey: string;
  host: string;
};

// One item of PostHog's `/batch` array. `distinct_id` + `uuid` sit at
// the event top level (posthog-node wire shape); the remaining typed
// event fields become `properties`.
type PostHogBatchItem = {
  event: string;
  distinct_id: string;
  uuid: string;
  timestamp: string;
  properties: Record<string, unknown>;
};

// distinct_id per event — mirrors how logsnag.ts picks `user_id`:
// authed events → `userId`; demand-signal / lifecycle events →
// `principalId` (authed id or the anon/wl: bucket); `ask.completed`
// is anonymised so the DB is its closest stable identity; eval runs are
// a system actor keyed by dataset.
function distinctId(event: ProductEvent): string {
  switch (event.name) {
    case "user.first_query":
    case "user.registered":
    case "billing.subscription_created":
    case "billing.subscription_canceled":
    case "billing.payment_failed":
      return event.userId;
    case "feature.requested.ddl_via_ask":
    case "feature.requested.heavier_tier":
    case "feature.requested.larger_account":
    case "feature.destructive.preview_rendered":
    case "feature.destructive.committed":
    case "home.surface_wishlist":
    case "pricing.page_viewed":
    case "pricing.plan_selected":
      return event.principalId;
    case "ask.completed":
      return event.dbId;
    case "feature.eval.weekly":
    case "feature.eval.regression":
      return `eval:${event.dataset}`;
    default: {
      const _exhaustive: never = event;
      return `unknown:${JSON.stringify(_exhaustive)}`;
    }
  }
}

// Deterministic UUID (v5-shaped) from the envelope id, so PostHog's
// (uuid, event, ts, distinct_id) dedup collapses queue redeliveries of
// the same logical event. Pure function of the seed — the only input
// that varies is `EventEnvelope.id`, so a redelivery produces the same
// uuid. Uses SHA-1 (available via Web Crypto on Workers); the
// version/variant nibbles are stamped to keep it a well-formed UUID that
// PostHog's ClickHouse UUID column accepts (an invalid string would be
// silently replaced with a random one, defeating dedup).
async function deterministicUuid(seed: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-1", new TextEncoder().encode(seed)),
  );
  const b = Array.from(digest.slice(0, 16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x50; // version 5
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80; // RFC-4122 variant
  const hex = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Project one envelope to a PostHog batch item. Generic mapping: event
// name → PostHog event, identity field → distinct_id, envelope id →
// uuid, remaining typed fields → properties. `nlqdb_event` mirrors the
// event name into properties so PostHog insights can filter on it
// without parsing the display name.
export async function toBatchItem(envelope: EventEnvelope): Promise<PostHogBatchItem> {
  const { name, ...rest } = envelope.event;
  return {
    event: name,
    distinct_id: distinctId(envelope.event),
    uuid: await deterministicUuid(envelope.id),
    timestamp: new Date(envelope.ts).toISOString(),
    properties: { ...rest, nlqdb_event: name },
  };
}

// Drain the whole batch to PostHog in one `/batch` HTTP call. Never
// throws — records failures on the span and returns. Callers must NOT
// gate message ack/retry on this (see file header).
export async function publishToPostHog(
  config: PostHogConfig,
  envelopes: EventEnvelope[],
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (envelopes.length === 0) return;

  const tracer = trace.getTracer("@nlqdb/events-worker");
  await tracer.startActiveSpan("nlqdb.events.sink.posthog", async (span) => {
    span.setAttribute("nlqdb.events.batch_size", envelopes.length);
    try {
      const batch = await Promise.all(envelopes.map(toBatchItem));
      const res = await fetchImpl(`${config.host.replace(/\/$/, "")}/batch/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: config.apiKey, batch }),
      });
      span.setAttribute("http.response.status_code", res.status);
      if (!res.ok) {
        const body = await res.text().catch(() => "<no body>");
        span.setStatus({ code: SpanStatusCode.ERROR, message: `posthog ${res.status}: ${body}` });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      // Swallowed by design — analytics fan-out is best-effort; LogSnag
      // owns ack/retry. Logged for `wrangler tail` when OTel isn't attached.
      console.error(`posthog batch failed (${envelopes.length} events): ${error.message}`);
    } finally {
      span.end();
    }
  });
}
