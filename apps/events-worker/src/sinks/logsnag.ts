// LogSnag sink. POSTs to https://api.logsnag.com/v1/log per their
// public API contract (no SDK — the call shape is small and stable
// enough that a fetch is cleaner than a dependency).
//
// Idempotency: LogSnag honours an `event_id` field for dedup
// (SK-EVENTS-004 — the producer side derives a stable id per event
// shape, e.g. `feature.requested.X.<principal>.<utcDay>`). The sink
// passes `EventEnvelope.id` through to that field so per-day dedup
// works across Cloudflare Queue redeliveries.

import type { ProductEvent } from "@nlqdb/events";

const LOGSNAG_URL = "https://api.logsnag.com/v1/log";

export type LogSnagConfig = {
  token: string;
  project: string;
};

// Translates a pager event into LogSnag's payload shape. Each event
// type owns its channel + display copy here — the rest of the
// codebase stays presentation-agnostic.
type LogSnagPayload = {
  project: string;
  channel: string;
  event: string;
  description?: string;
  icon?: string;
  notify?: boolean;
  tags?: Record<string, string>;
  user_id?: string;
  // SK-EVENTS-004 — passed through from `EventEnvelope.id` for
  // sink-side dedup. Optional because tests can omit it.
  event_id?: string;
};

/**
 * LogSnag is the pager only (`SK-EVENTS-006`): an event it carries is a push,
 * except `user.auth_failed` past the day's first — a silent row, the outage's
 * apology list (that event never reaches PostHog). null = not LogSnag-routed.
 */
export function buildPayload(
  project: string,
  event: ProductEvent,
  eventId?: string,
): LogSnagPayload | null {
  const body = pageBody(event);
  if (!body) return null;
  return { project, ...body, ...(eventId ? { event_id: eventId } : {}) };
}

export function isLogSnagRouted(event: ProductEvent): boolean {
  return pageBody(event) !== null;
}

function pageBody(event: ProductEvent): Omit<LogSnagPayload, "project"> | null {
  switch (event.name) {
    case "user.first_query":
      return {
        channel: "users",
        event: "First Query",
        description: `User ran their first /v1/ask query against db ${event.dbId}`,
        icon: "🎉",
        notify: true,
        user_id: event.userId,
        tags: { "db-id": event.dbId },
      };
    case "user.registered":
      return {
        channel: "users",
        event: "Registered",
        description: `New account: ${event.email}`,
        icon: "👋",
        notify: true,
        user_id: event.userId,
        tags: { email: event.email },
      };
    case "user.auth_failed":
      return {
        channel: "users",
        event: "Sign-in failed",
        description: `${event.status} on ${event.path} for ${event.email}`,
        icon: "🚧",
        notify: event.firstToday,
        tags: { email: event.email, path: event.path, status: String(event.status) },
      };
    case "billing.subscription_created":
      return {
        channel: "billing",
        event: "Subscription Created",
        description: `${event.userId} subscribed (price ${event.priceId})`,
        icon: "💳",
        notify: true,
        user_id: event.userId,
        tags: {
          "customer-id": event.customerId,
          "subscription-id": event.subscriptionId,
          "price-id": event.priceId,
        },
      };
    case "billing.subscription_canceled":
      return {
        channel: "billing",
        event: "Subscription Canceled",
        description: `${event.userId} canceled (price ${event.priceId})`,
        icon: "🚫",
        notify: true,
        user_id: event.userId,
        tags: {
          "customer-id": event.customerId,
          "subscription-id": event.subscriptionId,
          "price-id": event.priceId,
        },
      };
    case "billing.payment_failed":
      // SK-STRIPE-011 — operator dunning alert. `notify: true`: an at-risk
      // subscription is actionable (reach out / watch the retry schedule).
      // Deduped per invoice at the producer (SK-EVENTS-008) so Stripe's
      // dunning retries don't re-page. Amount stays in minor units in the
      // tag — no currency-decimal guessing in an internal alert.
      return {
        channel: "billing",
        event: "Payment Failed",
        description: `${event.userId} payment failed (attempt ${event.attemptCount})`,
        icon: "⚠️",
        notify: true,
        user_id: event.userId,
        tags: {
          "customer-id": event.customerId,
          "invoice-id": event.invoiceId,
          "attempt-count": String(event.attemptCount),
          "amount-due-minor": String(event.amountDue),
          currency: event.currency,
          ...(event.hostedInvoiceUrl ? { "invoice-url": event.hostedInvoiceUrl } : {}),
        },
      };
    case "db.adopted":
      // The one moment an anonymous session becomes a retained user —
      // rare, high-signal, and the founder wants to know. Replays are
      // bookkeeping: PostHog only.
      if (event.replay) return null;
      return {
        channel: "activation",
        event: "DB kept after sign-in",
        description: `Anonymous db ${event.dbId} adopted by a signed-in user`,
        icon: "🔐",
        notify: true,
        user_id: event.userId,
        tags: { "db-id": event.dbId },
      };
    // Aggregate signals read on a dashboard, never pages: PostHog only,
    // and PostHog owns their ack/retry (`SK-EVENTS-013`).
    case "feature.requested.ddl_via_ask":
    case "feature.requested.heavier_tier":
    case "feature.requested.larger_account":
    case "feature.destructive.preview_rendered":
    case "feature.destructive.committed":
    case "home.surface_wishlist":
    case "pricing.page_viewed":
    case "pricing.plan_selected":
    case "db.created":
    case "feature.eval.weekly":
    // `ask.completed` flows to Tinybird `query_log` (`SK-EVENTS-009`).
    case "ask.completed":
      return null;
    case "feature.eval.regression":
      // SK-QUAL-002: regression pages the on-call. `trigger` tag
      // distinguishes McNemar vs threshold without re-parsing.
      return {
        channel: "north-star",
        event: "Eval regression",
        description: `${event.dataset} / ${event.lane}: ${(event.deltaPp * 100).toFixed(2)} pts (${event.trigger}${event.pValue === null ? "" : `, p=${event.pValue.toFixed(4)}`})`,
        icon: "🚨",
        notify: true,
        tags: {
          dataset: event.dataset,
          run: event.runId,
          lane: event.lane,
          trigger: event.trigger,
        },
      };
    default: {
      const _exhaustive: never = event;
      throw new Error(`unhandled event: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export async function publishToLogSnag(
  config: LogSnagConfig,
  event: ProductEvent,
  eventId: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const payload = buildPayload(config.project, event, eventId);
  if (!payload) throw new Error(`logsnag sink received non-routed event: ${event.name}`);
  const res = await fetchImpl(LOGSNAG_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // Non-2xx → throw so the consumer retries. LogSnag's 4xx (auth /
    // schema) won't recover from retry, but the retry budget caps
    // damage. 5xx is the case retry actually helps.
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`logsnag ${res.status}: ${body}`);
  }
}
