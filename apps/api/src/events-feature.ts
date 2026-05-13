// `feature.*` / `home.*` demand-signal endpoints (SK-EVENTS-011).
//
// Two routes, both pure-fanout-into-the-events-pipeline:
//
//   POST /v1/events/notify-paid   — requires Principal (anon or authed)
//   POST /v1/events/wishlist      — public, IP-hash-bucketed for dedup
//
// Both close the Phase 1.5 exit-gate criterion "the 'notify me when
// paid launches' queue is non-empty (demonstrates the capture pipe
// works)" (`docs/phase-plan.md §3`). They emit `feature.requested.notify_paid`
// and `home.surface_wishlist` respectively; the LogSnag sink routes
// both to the `demand-signal` channel where the §6 monetization
// trigger is read off.
//
// Per `SK-EVENTS-003`, `events.emit()` is fire-and-forget — the route
// returns 202 as soon as the queue producer accepts the message
// (failures land on the OTel span, not the response status).

import type { EventEmitter, NlqSurface, NotifyPaidCta, WishlistSurface } from "@nlqdb/events";
import { makeKvThrottle } from "./lib/kv-throttle.ts";
import { sha256Hex } from "./principal.ts";

const NOTIFY_PAID_CTAS: ReadonlySet<NotifyPaidCta> = new Set([
  "db_create_success",
  "anon_warning",
  "rate_limit",
]);

// Source-of-truth check. Must mirror the `WishlistSurface` union in
// `packages/events/src/types.ts` AND the `data-wishlist` attributes in
// `apps/web/src/components/CodePanel.astro:101-104`. Adding a wishlist
// badge is a three-place edit; the API rejects an unknown surface with
// 400 `invalid_surface` so a missed edit fails loud rather than silent.
const WISHLIST_SURFACES: ReadonlySet<WishlistSurface> = new Set([
  "vscode",
  "jetbrains",
  "slack",
  "discord",
]);

// Wishlist endpoint is public; KV throttle is the only defense.
// 10/min/IP is generous enough that a real visitor clicking through
// the matrix doesn't trip it, tight enough that a botnet running one
// click per second from a single IP exhausts within 6 seconds.
const WISHLIST_RATE_WINDOW_SECONDS = 60;
const WISHLIST_RATE_MAX = 10;

export type NotifyPaidResult =
  | { status: 202; pendingEmit: Promise<unknown> }
  | { status: 400; reason: "invalid_cta" };

export type WishlistResult =
  | { status: 202; pendingEmit: Promise<unknown> }
  | { status: 400; reason: "invalid_surface" }
  | { status: 429 };

export function isNotifyPaidCta(value: unknown): value is NotifyPaidCta {
  return typeof value === "string" && NOTIFY_PAID_CTAS.has(value as NotifyPaidCta);
}

export function recordNotifyPaid(
  events: EventEmitter,
  principalId: string,
  surface: NlqSurface,
  cta: unknown,
): NotifyPaidResult {
  if (!isNotifyPaidCta(cta)) return { status: 400, reason: "invalid_cta" };
  const pendingEmit = events.emit({
    name: "feature.requested.notify_paid",
    principalId,
    surface,
    cta,
  });
  return { status: 202, pendingEmit };
}

export type WishlistDeps = {
  kv: KVNamespace;
  events: EventEmitter;
};

function isWishlistSurface(value: unknown): value is WishlistSurface {
  return typeof value === "string" && WISHLIST_SURFACES.has(value as WishlistSurface);
}

export async function recordWishlist(
  deps: WishlistDeps,
  surface: unknown,
  clientIp: string | null,
): Promise<WishlistResult> {
  if (!isWishlistSurface(surface)) {
    return { status: 400, reason: "invalid_surface" };
  }
  // Mirror waitlist.ts: null `cf-connecting-ip` collapses to a shared
  // "unknown" bucket. Production behind Cloudflare always has the
  // header; null means local dev / a non-CF preview path.
  const ip = clientIp ?? "unknown";
  const throttle = makeKvThrottle(deps.kv, {
    prefix: "wl-surf:rate:",
    max: WISHLIST_RATE_MAX,
    windowSeconds: WISHLIST_RATE_WINDOW_SECONDS,
  });
  const allowed = await throttle.tryConsume(ip);
  if (!allowed) return { status: 429 };
  // PrincipalId for the wishlist event is the per-day IP-hash bucket —
  // the visitor has no anon-bearer (the marketing page doesn't mint
  // one until they submit the hero form), and we don't want to mint
  // one just to register a wishlist click. The hash keeps raw IPs out
  // of the event store; the per-day rotation matches the `defaultId()`
  // dedup window so a chatty visitor isn't double-counted at the sink.
  const principalId = await deriveWishlistPrincipalId(ip);
  const pendingEmit = deps.events.emit({
    name: "home.surface_wishlist",
    principalId,
    surface,
  });
  return { status: 202, pendingEmit };
}

async function deriveWishlistPrincipalId(ip: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  // 16-hex-char prefix matches `Principal.id` for anon principals
  // (`anon:<16hex>`); using a distinct `wl:` prefix keeps these from
  // colliding with real anon ids in the LogSnag user_id facet.
  return `wl:${await sha256Hex(`${ip}:${day}`, 16)}`;
}
