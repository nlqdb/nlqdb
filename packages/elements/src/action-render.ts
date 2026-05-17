// State → HTML for `<nlq-action>`; the rendered diff card is the
// SK-TRUST-001 render-before-commit gate (Apply is the confirmation).

import type { AskDiff, AskFailure } from "./fetch.ts";
import { escapeHtml } from "./templates.ts";

export type NlqActionState =
  | { kind: "idle"; label: string }
  | { kind: "previewing"; label: string }
  | { kind: "confirm"; diff: AskDiff; label: string }
  | { kind: "applying"; diff: AskDiff; label: string }
  | { kind: "success"; rowCount: number; label: string }
  | { kind: "error"; failure: AskFailure; label: string };

export function renderActionState(state: NlqActionState): string {
  switch (state.kind) {
    case "idle":
      return buttonHtml(state.label, "idle", false);
    case "previewing":
      return buttonHtml("Preparing…", "previewing", true);
    case "confirm":
      return confirmHtml(state.diff);
    case "applying":
      return applyingHtml(state.diff);
    case "success":
      return successHtml(state.rowCount, state.label);
    case "error":
      return errorHtml(state.failure, state.label);
  }
}

function buttonHtml(label: string, kind: string, disabled: boolean): string {
  const dis = disabled ? " disabled" : "";
  return `<button type="button" class="nlq-action-btn" data-action-state="${kind}"${dis}>${escapeHtml(label)}</button>`;
}

function confirmHtml(diff: AskDiff): string {
  return `<div class="nlq-action-diff" data-action-state="confirm" data-verb="${escapeHtml(diff.verb)}" role="group" aria-label="Confirm change">
<div class="nlq-action-diff-summary">${escapeHtml(diff.summary)}</div>
<div class="nlq-action-diff-meta"><code>${escapeHtml(diff.verb)}</code> on <code>${escapeHtml(diff.table)}</code> · ${diff.affectedRows} row${diff.affectedRows === 1 ? "" : "s"}</div>
<div class="nlq-action-diff-buttons">
<button type="button" class="nlq-action-cancel" data-action="cancel">Cancel</button>
<button type="button" class="nlq-action-apply" data-action="apply" autofocus>Apply</button>
</div>
</div>`;
}

function applyingHtml(diff: AskDiff): string {
  return `<div class="nlq-action-diff" data-action-state="applying" data-verb="${escapeHtml(diff.verb)}" aria-busy="true">
<div class="nlq-action-diff-summary">${escapeHtml(diff.summary)}</div>
<div class="nlq-action-diff-meta">Applying…</div>
</div>`;
}

function successHtml(rowCount: number, label: string): string {
  return `<div class="nlq-action-success" data-action-state="success">Done — ${rowCount} row${rowCount === 1 ? "" : "s"} affected.</div>
<button type="button" class="nlq-action-btn" data-action-state="reset" data-action="reset">${escapeHtml(label)}</button>`;
}

function errorHtml(failure: AskFailure, label: string): string {
  const message = errorMessage(failure);
  return `<div class="nlq-action-error" data-action-state="error" data-kind="${failure.kind}">${escapeHtml(message)}</div>
<button type="button" class="nlq-action-btn" data-action-state="retry" data-action="retry">${escapeHtml(label)}</button>`;
}

function errorMessage(failure: AskFailure): string {
  if (failure.kind === "network") return `Network error: ${failure.message}`;
  if (failure.kind === "auth") return "Sign in required to make changes.";
  const err = failure.error;
  const slug = typeof err === "string" ? err : err.status;
  if (
    slug === "rate_limited" &&
    typeof err === "object" &&
    typeof err["limit"] === "number" &&
    typeof err["count"] === "number"
  ) {
    return `Rate limit reached (${err["count"] as number} of ${err["limit"] as number} used). Wait a moment, then retry.`;
  }
  return `Error ${failure.status}: ${slug}`;
}
