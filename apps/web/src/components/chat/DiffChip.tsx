// Destructive-op preview chip (SK-ONBOARD-004). Renders the
// API's plain-English diff and exposes Approve / Cancel. The
// composer is responsible for re-sending the same request with
// `confirm: true` once the user approves; this component is
// presentation-only so the keyboard handler in ChatPanel can
// branch on the chip's presence without prop-drilling state.

import type { AskDiff } from "@nlqdb/sdk";

interface DiffChipProps {
  diff: AskDiff;
  onApprove: () => void;
  onCancel: () => void;
}

export default function DiffChip({ diff, onApprove, onCancel }: DiffChipProps) {
  return (
    <div className="diff-chip" role="alertdialog" aria-label="Confirm destructive change">
      <p className="diff-chip__summary">
        This will <strong>{diff.verb}</strong> {diff.affectedRows.toLocaleString()} row
        {diff.affectedRows === 1 ? "" : "s"} in <code>{diff.table}</code> — approve?
      </p>
      {diff.summary && diff.summary !== buildFallbackSummary(diff) ? (
        <p className="diff-chip__detail">{diff.summary}</p>
      ) : null}
      <div className="diff-chip__actions">
        <button type="button" className="btn btn--accent" onClick={onApprove}>
          Approve
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <span className="diff-chip__hint">Press Enter to approve.</span>
      </div>
    </div>
  );
}

function buildFallbackSummary(diff: AskDiff): string {
  return `${diff.verb} ${diff.affectedRows} rows in ${diff.table}`;
}
