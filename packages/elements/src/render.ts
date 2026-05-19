// Pure state → HTML. Kept separate from `element.ts` so unit tests
// can verify markup without spinning up a DOM (the CDN bundle has no
// happy-dom / jsdom dep — see `packages/elements/README.md`).

import type { AskFailure, AskSuccess } from "./fetch.ts";
import { escapeHtml, renderTemplate } from "./templates.ts";

export type NlqState =
  | { kind: "idle"; reason: "no-goal" | "no-db" }
  | { kind: "loading" }
  | { kind: "success"; data: AskSuccess }
  | { kind: "error"; failure: AskFailure };

const IDLE_NO_GOAL = '<div class="nlq-pending">nlq-data: set a <code>goal</code> attribute.</div>';
const IDLE_NO_DB = '<div class="nlq-pending">nlq-data: set a <code>db</code> attribute.</div>';
const LOADING_HTML = '<div class="nlq-pending">Loading…</div>';

export function renderState(state: NlqState, template: string): string {
  switch (state.kind) {
    case "idle":
      return state.reason === "no-goal" ? IDLE_NO_GOAL : IDLE_NO_DB;
    case "loading":
      return LOADING_HTML;
    case "success":
      return renderTemplate(template, state.data.rows);
    case "error":
      return errorHtml(state.failure);
  }
}

// `data-kind` lets consumers style network/auth/api/gated states distinctly without parsing text.
export function errorHtml(failure: AskFailure): string {
  const gated = gatedBody(failure);
  if (gated) return gatedHtml(gated);
  const message = errorMessage(failure);
  return `<div class="nlq-error" data-kind="${failure.kind}">${escapeHtml(message)}</div>`;
}

function errorMessage(failure: AskFailure): string {
  if (failure.kind === "network") return `Network error: ${failure.message}`;
  if (failure.kind === "auth") return "Authentication required.";
  // api: include the HTTP status + the API's `status` slug
  // (db_not_found, rate_limited, …) so the embedding page can branch
  // on either; full structured detail is on the `nlq-data:error` event.
  const err = failure.error;
  const slug = typeof err === "string" ? err : err.status;
  // Rate-limit: tell the user how many requests they've used so they
  // know when to retry (GLOBAL-012 — one sentence + next action).
  if (
    slug === "rate_limited" &&
    typeof err === "object" &&
    typeof err["limit"] === "number" &&
    typeof err["count"] === "number"
  ) {
    return `Rate limit reached (${err["count"] as number} of ${err["limit"] as number} requests used). Please wait a moment, then try again.`;
  }
  return `Error ${failure.status}: ${slug}`;
}

// Narrowed view of the `feature_gated` body (GLOBAL-027); optional fields tolerate API drift.
type GatedBody = {
  action: string;
  waitlistUrl: string;
  message?: string;
  bird?: LaneNumbers;
  spider?: LaneNumbers;
};
type LaneNumbers = { accuracy: number | null; target: number };

export function gatedBody(failure: AskFailure): GatedBody | null {
  if (failure.kind !== "api") return null;
  const err = failure.error;
  if (typeof err === "string" || err.status !== "feature_gated") return null;
  const waitlistUrl = safeUrl(err["waitlist_url"]);
  if (!waitlistUrl) return null;
  const gate = asRecord(err["gate"]);
  return {
    action: nonEmpty(err["action"]) ?? "Join the waitlist",
    waitlistUrl,
    message: nonEmpty(err["message"]),
    bird: gate ? laneNumbers(gate["bird_accuracy"], gate["bird_target"]) : undefined,
    spider: gate ? laneNumbers(gate["spider_accuracy"], gate["spider_target"]) : undefined,
  };
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function laneNumbers(accuracy: unknown, target: unknown): LaneNumbers | undefined {
  if (typeof target !== "number") return undefined;
  if (accuracy !== null && typeof accuracy !== "number") return undefined;
  return { accuracy, target };
}

// http(s)-only allowlist guards against `javascript:` / `data:` URIs reaching `href` (OWASP XSS cheat sheet).
function safeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function gatedHtml(body: GatedBody): string {
  const heading = body.message ?? "nlqdb is pre-alpha — join the waitlist for early access.";
  const progress = laneProgress(body);
  const progressHtml = progress
    ? `<div class="nlq-gated-progress">${escapeHtml(progress)}</div>`
    : "";
  return `<div class="nlq-error nlq-gated" data-kind="gated" role="status"><div class="nlq-gated-message">${escapeHtml(heading)}</div><a class="nlq-gated-cta" href="${escapeHtml(body.waitlistUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(body.action)}</a>${progressHtml}</div>`;
}

function laneProgress(body: { bird?: LaneNumbers; spider?: LaneNumbers }): string {
  return [formatLane("BIRD", body.bird), formatLane("Spider", body.spider)]
    .filter((s): s is string => s !== null)
    .join(" · ");
}

function formatLane(label: string, lane: LaneNumbers | undefined): string | null {
  if (!lane) return null;
  const target = `${Math.round(lane.target * 100)}% target`;
  if (lane.accuracy === null) return `${label}: not yet reporting (${target})`;
  return `${label}: ${(lane.accuracy * 100).toFixed(1)}% / ${target}`;
}
