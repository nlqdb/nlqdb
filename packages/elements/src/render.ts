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

// `data-kind` lets consumers style network/auth/api states distinctly without parsing text.
export function errorHtml(failure: AskFailure): string {
  const message = errorMessage(failure);
  return `<div class="nlq-error" data-kind="${failure.kind}">${escapeHtml(message)}</div>`;
}

// SK-ERR-001 — the API renders one sentence + the next action from the shared
// registry, so this is a pass-through, not a copy table. What used to be a
// bespoke per-code switch here is now zero maintenance: a new error code arrives
// already phrased. Full structured detail rides the `nlq-data:error` event.
function errorMessage(failure: AskFailure): string {
  if (failure.kind === "network") return `Network error: ${failure.message}`;
  if (failure.kind === "auth") return "Authentication required.";
  const err = failure.error;
  if (typeof err === "string") return `Error ${failure.status}: ${err}`;
  if (err.message) return err.action ? `${err.message} ${err.action}` : err.message;
  return `Error ${failure.status}: ${err.code}`;
}
