// The pure resolver for the "Copy snippet" CTA button label (SK-WEB-007).
// Kept free of React so it's unit-testable on its own; CopySnippet and the
// test both import from here (the SK-WEB-005 pure-resolver pattern, mirrors
// free-model-nudge-gate.ts / model-picker-selection.ts / trace-steps.ts).
//
// SK-WEB-007 promises "Copy snippet" never requires sign-in. The failure
// label must therefore name the ACTUAL cause: "no-key" is the only case where
// signing in helps (no pk_live_ could be resolved for this device/DB); a
// clipboard write that threw despite a valid key ("copy-failed") must NOT tell
// a signed-in user with a key to "sign in" — that misdiagnoses a browser
// clipboard-permission/focus error as an auth wall.

export type CopySnippetState = "idle" | "copied" | "no-key" | "copy-failed";

export function copySnippetLabel(state: CopySnippetState): string {
  switch (state) {
    case "copied":
      return "Copied";
    case "no-key":
      return "Couldn't copy — sign in to load your key.";
    case "copy-failed":
      return "Couldn't copy to clipboard — try again.";
    default:
      return "Copy snippet";
  }
}
