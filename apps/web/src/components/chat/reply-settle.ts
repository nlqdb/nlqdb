// Pure resolver that settles a reply interrupted before it reached a terminal
// state. Kept free of React/ChatPanel imports so it's unit-testable on its own;
// ChatPanel and the test both import from here (same discipline as
// `trace-steps.ts`).
//
// GLOBAL-011 (honest latency — never spinner-lie): a reply left in a
// non-terminal state renders a perpetual "pending" skeleton — or a stale
// interactive chip — above the user's real answer, and because the history
// save effect skips while any reply is pending, it silently blocks the whole
// session from persisting to localStorage. Two paths interrupt a reply:
//   - reload: `loadHistory` rewrites stored non-terminal replies to
//     "Session ended." (a restored request can never resume).
//   - live abort: a newer send aborts the in-flight request (SK-SDK-003);
//     the superseded reply must settle to "Cancelled — …" instead of
//     spinning forever.
// Both go through this one predicate so the settled-kind set can't drift apart.

// Reply-state kinds still awaiting resolution: a running request, or an
// interactive chip the user hasn't answered. Every other kind (ok, created,
// error) is terminal and must be left untouched.
const NON_TERMINAL_KINDS = new Set(["pending", "needs-confirm", "clarify", "ambiguous"]);

export function isNonTerminalReplyKind(kind: string): boolean {
  return NON_TERMINAL_KINDS.has(kind);
}

export type TerminalErrorState = { kind: "error"; message: string };

// Returns the terminal error state to replace an interrupted reply with, or
// null when the reply is already terminal and must be left as-is.
export function settleInterruptedReply(kind: string, message: string): TerminalErrorState | null {
  return isNonTerminalReplyKind(kind) ? { kind: "error", message } : null;
}
