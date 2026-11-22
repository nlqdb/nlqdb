// Browser product events (SK-EVENTS-015): a first-party POST to
// `/v1/events/web`, which validates against `WEB_EVENTS` and queues the
// event to PostHog. No token in page source and no SDK on marketing pages
// (GLOBAL-034). Only nlqdb.com hosts send, so dev and preview builds stay
// out of production analytics.

import type { WebEventName, WebEventProps } from "@nlqdb/events/web";
import { readApiBase } from "./session";

export function emit<N extends WebEventName>(event: N, props?: WebEventProps<N>): void {
  if (typeof window === "undefined") return;
  try {
    if (!/(^|\.)nlqdb\.com$/.test(window.location.hostname)) return;
    void fetch(`${readApiBase().replace(/\/$/, "")}/v1/events/web`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "omit",
      keepalive: true,
      body: JSON.stringify({ event, props: props ?? {} }),
    }).catch(() => {});
  } catch {
    // Analytics never interrupts the flow and has no next action (GLOBAL-012).
  }
}
