// `home.surface_wishlist` demand-signal endpoint (SK-EVENTS-011).
//
//   POST /v1/events/wishlist — public, IP-hash-bucketed for dedup
//   POST /v1/events/eval     — internal, bearer-token (SK-QUAL-002)
//
// Per `SK-EVENTS-003`, `events.emit()` is fire-and-forget — the route
// returns 202 as soon as the queue producer accepts the message
// (failures land on the OTel span, not the response status).

import type {
  EventEmitter,
  FeatureEvalRegressionEvent,
  FeatureEvalWeeklyEvent,
  WishlistSurface,
} from "@nlqdb/events";
import { makeKvThrottle } from "./lib/kv-throttle.ts";
import { sha256Hex } from "./principal.ts";

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

export type WishlistResult =
  | { status: 202; pendingEmit: Promise<unknown> }
  | { status: 400; reason: "invalid_surface" }
  | { status: 429 };

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

// ---- POST /v1/events/eval — quality-eval cron ingestion (SK-QUAL-002) ----

// Caller-supplied shape; we accept the harness's `EvalReport` plus the
// optional `baseline` diff. The handler doesn't recompute either — the
// GH-Actions runner is the canonical computer (it has both files locally)
// and we just emit the typed events. Validation is shape-level only,
// scoped to the fields the producer actually reads.
export type EvalIngestPayload = {
  report: {
    run_at: string;
    dataset: string;
    question_count: number;
    lanes: Array<{ lane: string; execution_accuracy: number }>;
    free_vs_frontier_delta: number | null;
    // SK-QUAL-009 — optional so a pre-3c producer's payload still validates.
    free_vs_agentic_frontier_delta?: number | null;
    baseline?: {
      lanes: Array<{
        lane: string;
        delta_pp: number | null;
        regressions: Array<{ trigger: "threshold" | "mcnemar"; pValue: number | null }>;
      }>;
    };
  };
};

export type EvalIngestResult =
  | { status: 202; emitted: number; pendingEmits: Promise<unknown>[] }
  | { status: 400; reason: "invalid_body" }
  | { status: 401 };

// Constant-time bearer compare so a length-leak doesn't reveal token
// length on a brute-force attempt. Workers' `crypto.subtle.timingSafeEqual`
// isn't available; we use a fixed-prefix XOR loop. Bearer prefix is
// stripped before compare.
function bearerEquals(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const prefix = "Bearer ";
  if (!provided.startsWith(prefix)) return false;
  const token = provided.slice(prefix.length);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function isValidPayload(value: unknown): value is EvalIngestPayload {
  if (!value || typeof value !== "object") return false;
  const root = value as { report?: unknown };
  if (!root.report || typeof root.report !== "object") return false;
  const r = root.report as {
    run_at?: unknown;
    dataset?: unknown;
    question_count?: unknown;
    lanes?: unknown;
    free_vs_frontier_delta?: unknown;
    free_vs_agentic_frontier_delta?: unknown;
  };
  const validDelta = (v: unknown) => v === null || v === undefined || typeof v === "number";
  return (
    typeof r.run_at === "string" &&
    typeof r.dataset === "string" &&
    typeof r.question_count === "number" &&
    Array.isArray(r.lanes) &&
    validDelta(r.free_vs_frontier_delta) &&
    r.free_vs_frontier_delta !== undefined &&
    validDelta(r.free_vs_agentic_frontier_delta)
  );
}

export function recordEvalReport(
  events: EventEmitter,
  authorization: string | null,
  expectedToken: string,
  payload: unknown,
): EvalIngestResult {
  if (!bearerEquals(authorization, expectedToken)) return { status: 401 };
  if (!isValidPayload(payload)) return { status: 400, reason: "invalid_body" };
  const { report } = payload;
  const pendingEmits: Promise<unknown>[] = [];
  // Always emit the weekly summary so the SK-QUAL-002 weekly cadence
  // reaches the dashboard regardless of whether a regression fired.
  const weekly: FeatureEvalWeeklyEvent = {
    name: "feature.eval.weekly",
    runId: report.run_at,
    dataset: report.dataset,
    questionCount: report.question_count,
    laneExecutionAccuracy: Object.fromEntries(
      report.lanes.map((l) => [l.lane, l.execution_accuracy]),
    ),
    freeVsFrontierDelta: report.free_vs_frontier_delta,
    // SK-QUAL-009 headline KPI. Pre-3c reports omit the field; default
    // to `null` so the LogSnag sink sees a uniform "lane didn't run" signal.
    freeVsAgenticFrontierDelta: report.free_vs_agentic_frontier_delta ?? null,
  };
  pendingEmits.push(events.emit(weekly));
  if (report.baseline) {
    for (const laneCmp of report.baseline.lanes) {
      // delta_pp is null for newly-added lanes — skip the regression
      // emission since there's nothing to compare against.
      if (laneCmp.delta_pp === null) continue;
      for (const r of laneCmp.regressions) {
        const event: FeatureEvalRegressionEvent = {
          name: "feature.eval.regression",
          runId: report.run_at,
          dataset: report.dataset,
          lane: laneCmp.lane,
          deltaPp: laneCmp.delta_pp,
          trigger: r.trigger,
          pValue: r.pValue,
        };
        pendingEmits.push(events.emit(event));
      }
    }
  }
  return { status: 202, emitted: pendingEmits.length, pendingEmits };
}
