// Browser product events (SK-EVENTS-015): the closed set of names the web
// app may send to `POST /v1/events/web`, and each one's props. One schema
// types the browser's `emit()`, validates the API's input, and types the
// `ProductEvent` variant the events-worker drains to PostHog. Dependency-free
// so the browser bundle can import it.

export const WEB_EVENTS = {
  "home.snippet_copied": { surface: "string", goal_length: "number" },
  "home.snippet_signin_cta_clicked": { surface: "string" },
  "home.starter_clicked": { starter: "string" },
  "onboarding.landing_viewed": { surface: "string" },
  "onboarding.query_attempted": { surface: "string", ordinal: "number" },
  "onboarding.first_answer": { surface: "string", ttfv_ms: "number" },
  "handoff.rejected": {},
  "anon.adopt_failed": {},
  "agents.connect_clicked": { method: "string" },
  "agents.try_query_clicked": { goal: "string" },
  "blog.cta_clicked": { slug: "string" },
  "solve.try_query_clicked": { slug: "string", goal: "string" },
  "vs.try_query_clicked": { slug: "string", goal: "string" },
} as const satisfies Record<string, Record<string, "string" | "number">>;

type Schema = typeof WEB_EVENTS;
type Value<K> = K extends "string" ? string : number;

export type WebEventName = keyof Schema;
export type WebEventProps<N extends WebEventName> = {
  [P in keyof Schema[N]]?: Value<Schema[N][P]>;
};
export type WebEvent = {
  [N in WebEventName]: { name: N; principalId: string } & WebEventProps<N>;
}[WebEventName];

// Clamp, as the LogSnag tags were: the props are unauthenticated input.
const MAX_STRING = 120;

export function isWebEventName(name: unknown): name is WebEventName {
  return typeof name === "string" && Object.hasOwn(WEB_EVENTS, name);
}

export function isWebEvent(event: { name: string }): event is WebEvent {
  return isWebEventName(event.name);
}

/**
 * Validate a browser body `{ event, props }` into a `WebEvent`. Unknown
 * names → null; props off the event's schema or of the wrong type are
 * dropped; strings are clamped.
 */
export function parseWebEvent(body: unknown, principalId: string): WebEvent | null {
  if (!body || typeof body !== "object") return null;
  const { event, props } = body as { event?: unknown; props?: unknown };
  if (!isWebEventName(event)) return null;
  const input = props && typeof props === "object" ? (props as Record<string, unknown>) : {};
  const out: Record<string, string | number> = {};
  for (const [key, kind] of Object.entries(WEB_EVENTS[event])) {
    const v = input[key];
    if (kind === "string" && typeof v === "string") out[key] = v.slice(0, MAX_STRING);
    else if (kind === "number" && typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  // Every key was checked against this event's schema above.
  return { ...out, name: event, principalId } as WebEvent;
}
