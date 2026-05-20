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

// Translates a ProductEvent into LogSnag's payload shape. Each event
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

export function buildPayload(
  project: string,
  event: ProductEvent,
  eventId?: string,
): LogSnagPayload {
  const base = buildPayloadBody(project, event);
  return eventId ? { ...base, event_id: eventId } : base;
}

function buildPayloadBody(project: string, event: ProductEvent): LogSnagPayload {
  switch (event.name) {
    case "user.first_query":
      return {
        project,
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
        project,
        channel: "users",
        event: "Registered",
        description: `New account: ${event.email}`,
        icon: "👋",
        notify: true,
        user_id: event.userId,
        tags: { email: event.email },
      };
    case "billing.subscription_created":
      return {
        project,
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
        project,
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
    case "feature.requested.ddl_via_ask":
      return {
        project,
        channel: "demand-signal",
        event: "DDL via /v1/ask",
        description: `${event.surface}: LLM emitted ${event.rejectReason} on a query path`,
        icon: "🧱",
        notify: false,
        user_id: event.principalId,
        tags: { surface: event.surface, "reject-reason": event.rejectReason },
      };
    case "feature.requested.heavier_tier":
      return {
        project,
        channel: "demand-signal",
        event: "Heavier tier requested",
        description: `${event.surface}: hit the free-tier rate-limit ceiling`,
        icon: "📈",
        notify: false,
        user_id: event.principalId,
        tags: { surface: event.surface },
      };
    case "feature.requested.early_access":
      // GLOBAL-027 / SK-GATE-006 — pre-alpha gate blocked a request.
      // Lands in `#north-star` alongside the weekly eval summaries so
      // the block rate and the eval delta appear side-by-side in the
      // digest.
      return {
        project,
        channel: "north-star",
        event: "Early-access requested",
        description: `${event.surface}: blocked by the pre-alpha gate`,
        icon: "🔒",
        notify: false,
        user_id: event.principalId,
        tags: { surface: event.surface },
      };
    case "home.surface_wishlist":
      // SK-EVENTS-011: wishlist click from the marketing CodePanel.
      // `notify: false` — wishlist counts matter in aggregate, not
      // per-click; the dashboard ranks by `tags.surface` over a window.
      return {
        project,
        channel: "demand-signal",
        event: "Wishlist click",
        description: `${event.surface}: clicked the wishlist badge on the homepage`,
        icon: "⭐",
        notify: false,
        user_id: event.principalId,
        tags: { surface: event.surface },
      };
    case "feature.eval.weekly": {
      // SK-QUAL-002: weekly summary lands in `#north-star`. Lane EAs
      // are emitted as separate tags so the LogSnag dashboard can chart
      // them; `notify: false` because weekly snapshots are review-
      // cadence, not pager-cadence.
      const laneTags = Object.fromEntries(
        Object.entries(event.laneExecutionAccuracy).map(([lane, ea]) => [
          `ea-${lane}`,
          (ea * 100).toFixed(2),
        ]),
      );
      const fmt = (d: number | null | undefined) =>
        d === null || d === undefined ? "n/a" : `${(d * 100).toFixed(2)} pts`;
      const headline = event.freeVsAgenticFrontierDelta ?? null;
      const tags: Record<string, string> = {
        dataset: event.dataset,
        run: event.runId,
        ...laneTags,
      };
      if (headline !== null) tags["delta-agentic"] = (headline * 100).toFixed(2);
      return {
        project,
        channel: "north-star",
        event: "Eval weekly",
        // SK-QUAL-009 — surface both deltas. Agentic-frontier is the
        // GLOBAL-025 headline; single-model frontier is the SK-QUAL-004
        // informational reference.
        description: `${event.dataset}: ${event.questionCount} Qs, agentic-Δ ${fmt(headline)}, single-Δ ${fmt(event.freeVsFrontierDelta)}`,
        icon: "📊",
        notify: false,
        tags,
      };
    }
    case "feature.eval.regression":
      // SK-QUAL-002: regression pages the on-call. `trigger` tag
      // distinguishes McNemar vs threshold without re-parsing.
      return {
        project,
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
    case "user.waitlist_joined":
      // SK-EVENTS-006 amendment — routed to LogSnag now that we know
      // pre-alpha volume is well below the 2,500/mo quota. `persona`
      // surfaces in tags so the operator can see ICP mix at a glance;
      // null degrades to `unspecified` (form lets you skip the choice).
      return {
        project,
        channel: "users",
        event: "Waitlist Joined",
        description: event.persona
          ? `Waitlist signup: ${event.email} (${event.persona})`
          : `Waitlist signup: ${event.email}`,
        icon: "📝",
        notify: true,
        user_id: event.emailHash,
        tags: {
          email: event.email,
          persona: event.persona ?? "unspecified",
          source: event.source,
        },
      };
    case "ask.completed":
      // Not LogSnag-routed — flows to Tinybird `query_log`
      // (`SK-EVENTS-009`). The dispatcher in
      // `apps/events-worker/src/index.ts` filters this before reaching
      // `buildPayload`; this branch exists so the discriminated-union
      // exhaustiveness check still passes.
      throw new Error(`logsnag sink received non-routed event: ${event.name}`);
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
