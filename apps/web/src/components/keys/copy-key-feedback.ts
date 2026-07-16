// Pure copy-state → UI resolver for the mint dialog's "Copy key" button.
// Extracted so the failure-feedback contract is unit-testable without a DOM
// (mirrors chat/copy-snippet-label.ts, the SK-WEB-005 pattern).
//
// A minted `sk_live_*` key is shown exactly once (SK-APIKEYS-012, "display
// once"). SK-APIKEYS-012's clipboard clause leans on the still-selectable
// plaintext as the fallback when `navigator.clipboard.writeText` rejects —
// but that only helps if the user *knows* the copy failed. A silent
// rejection let the user click "Done" (which discards the plaintext
// permanently) believing they had copied it, losing the key with no path to
// retrieve it. So "failed" must surface a visible, actionable warning.
export type CopyKeyState = "idle" | "copied" | "failed";

export interface CopyKeyFeedback {
  /** Copy-button label. */
  label: string;
  /** aria-label for the copy button. */
  ariaLabel: string;
  /**
   * Visible warning, shown only when the clipboard write failed — tells the
   * user to copy the still-selectable plaintext manually before closing.
   * `null` in every non-failed state.
   */
  warning: string | null;
}

export function copyKeyFeedback(state: CopyKeyState): CopyKeyFeedback {
  switch (state) {
    case "copied":
      return { label: "Copied", ariaLabel: "Key copied to clipboard", warning: null };
    case "failed":
      return {
        label: "Retry copy",
        ariaLabel: "Copy failed — retry copying the key to clipboard",
        warning:
          "Couldn't copy to the clipboard — select the key above and copy it manually before closing this dialog.",
      };
    case "idle":
      return { label: "Copy", ariaLabel: "Copy key to clipboard", warning: null };
  }
}
