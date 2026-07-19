import { describe, expect, test } from "bun:test";
import { isNonTerminalReplyKind, settleInterruptedReply } from "./reply-settle";

describe("isNonTerminalReplyKind", () => {
  test("a running request and unanswered chips are non-terminal", () => {
    for (const kind of ["pending", "needs-confirm", "clarify", "ambiguous"]) {
      expect(isNonTerminalReplyKind(kind)).toBe(true);
    }
  });

  test("settled replies are terminal", () => {
    for (const kind of ["ok", "created", "error"]) {
      expect(isNonTerminalReplyKind(kind)).toBe(false);
    }
  });
});

describe("settleInterruptedReply", () => {
  // The bug this guards: a newer send aborts the in-flight request, and the
  // aborted reply was left in "pending" forever — a perpetual skeleton above
  // the newer answer that also blocked the whole session from persisting.
  test("an aborted in-flight (pending) reply settles to a terminal error", () => {
    expect(settleInterruptedReply("pending", "Cancelled — replaced by a newer question.")).toEqual({
      kind: "error",
      message: "Cancelled — replaced by a newer question.",
    });
  });

  test("unanswered interactive chips settle too (reload path)", () => {
    for (const kind of ["needs-confirm", "clarify", "ambiguous"]) {
      expect(settleInterruptedReply(kind, "Session ended.")).toEqual({
        kind: "error",
        message: "Session ended.",
      });
    }
  });

  test("an already-terminal reply is left untouched", () => {
    for (const kind of ["ok", "created", "error"]) {
      expect(settleInterruptedReply(kind, "Session ended.")).toBeNull();
    }
  });
});
