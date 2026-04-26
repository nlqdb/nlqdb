// LogSnag sink. POSTs to https://api.logsnag.com/v1/log per their
// public API contract (no SDK — the call shape is small and stable
// enough that a fetch is cleaner than a dependency).
//
// Idempotency: LogSnag has no native dedup. Cloudflare Queues retries
// on consumer-thrown exceptions only; if we get a 200 we don't retry,
// so duplicate emission requires the rare LogSnag-down-then-up window.
// Acceptable for Phase 0 — revisit when retry-exhaustion metrics show
// it's a real problem.

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
};

export function buildPayload(project: string, event: ProductEvent): LogSnagPayload {
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
    default: {
      const _exhaustive: never = event;
      throw new Error(`unhandled event: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export async function publishToLogSnag(
  config: LogSnagConfig,
  event: ProductEvent,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const payload = buildPayload(config.project, event);
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
