// WS5 fix C + WS8 SK-ANON-012 — peek + commit semantics on the per-
// device cap. The route-handler closures in `apps/api/src/index.ts`
// adapt these to a Hono Response and emit the X-RateLimit-* headers;
// the cap-counter semantics under test here are:
//   • peekAnonCreateGate returns the right typed verdict but does
//     NOT touch `recordDevice`.
//   • commitAnonCreate records exactly one increment on a single call.
//   • Both halves no-op for non-anon principals (SK-ANON-006).
//   • Turnstile runs unconditionally; SK-ANON-009 fail-open is intact.
//   • Turnstile failure trumps the cap — fresh-device + bad token
//     returns challenge_required, NOT auth_required (Turnstile is
//     the bot-floor; runs before the cap check).

import { describe, expect, it, vi } from "vitest";
import { commitAnonCreate, peekAnonCreateGate } from "../src/anon-create-gate.ts";
import type { AnonDeviceVerdict, AnonRateLimiter } from "../src/anon-rate-limit.ts";
import type { TurnstileVerifyResult, verifyTurnstile } from "../src/turnstile.ts";

function stubLimiter(
  peekResult: AnonDeviceVerdict = {
    ok: true,
    limit: 1,
    count: 0,
    resetAt: 9999,
  },
): {
  limiter: AnonRateLimiter;
  peekDevice: ReturnType<typeof vi.fn>;
  recordDevice: ReturnType<typeof vi.fn>;
  checkQuery: ReturnType<typeof vi.fn>;
} {
  const peekDevice = vi.fn(async () => peekResult);
  const recordDevice = vi.fn(async () => {});
  const checkQuery = vi.fn(async () => ({
    ok: true,
    limit: 30,
    count: 0,
    resetAt: 9999,
  }));
  return {
    limiter: { peekDevice, recordDevice, checkQuery } as unknown as AnonRateLimiter,
    peekDevice,
    recordDevice,
    checkQuery,
  };
}

const stubVerifyOk: typeof verifyTurnstile = vi.fn(
  async (): Promise<TurnstileVerifyResult> => ({ ok: true }),
);
const stubVerifyUnconfigured: typeof verifyTurnstile = vi.fn(
  async (): Promise<TurnstileVerifyResult> => ({ ok: false, reason: "unconfigured" }),
);
const stubVerifyInvalid: typeof verifyTurnstile = vi.fn(
  async (): Promise<TurnstileVerifyResult> => ({ ok: false, reason: "invalid" }),
);

const ANON_INPUT = {
  principalKind: "anon" as const,
  principalId: "anon:0123456789abcdef",
  ip: "1.2.3.4",
  turnstileSecret: "test_secret",
  turnstileToken: "test_token",
};

describe("peekAnonCreateGate", () => {
  it("authenticated principal short-circuits to skip without touching the limiter", async () => {
    const { limiter, peekDevice, recordDevice } = stubLimiter();
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyOk },
      { ...ANON_INPUT, principalKind: "user" },
    );
    expect(decision).toEqual({ kind: "skip" });
    expect(peekDevice).not.toHaveBeenCalled();
    expect(recordDevice).not.toHaveBeenCalled();
  });

  it("anon under cap + valid Turnstile returns allow + does NOT call recordDevice", async () => {
    const { limiter, peekDevice, recordDevice } = stubLimiter();
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyOk },
      ANON_INPUT,
    );
    expect(decision.kind).toBe("allow");
    if (decision.kind === "allow") {
      expect(decision.peek.limit).toBe(1);
      expect(decision.peek.count).toBe(0);
    }
    expect(peekDevice).toHaveBeenCalledTimes(1);
    expect(peekDevice).toHaveBeenCalledWith(ANON_INPUT.principalId);
    expect(recordDevice).not.toHaveBeenCalled();
  });

  it("anon over device cap returns auth_required without recording", async () => {
    const { limiter, recordDevice } = stubLimiter({
      ok: false,
      reason: "device_cap",
      retryAfter: 90 * 24 * 60 * 60,
      limit: 1,
      count: 1,
      resetAt: 12345,
    });
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyOk },
      ANON_INPUT,
    );
    expect(decision.kind).toBe("auth_required");
    if (decision.kind === "auth_required") {
      expect(decision.peek.reason).toBe("device_cap");
      expect(decision.peek.limit).toBe(1);
      expect(decision.peek.count).toBe(1);
      expect(decision.peek.resetAt).toBe(12345);
    }
    expect(recordDevice).not.toHaveBeenCalled();
  });

  it("Turnstile runs unconditionally — invalid token on fresh device returns challenge_required (no record)", async () => {
    const { limiter, recordDevice } = stubLimiter();
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyInvalid },
      ANON_INPUT,
    );
    expect(decision.kind).toBe("challenge_required");
    expect(recordDevice).not.toHaveBeenCalled();
  });

  it("Turnstile unconfigured (SK-ANON-009 fail-open) still returns allow", async () => {
    const { limiter, recordDevice } = stubLimiter();
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyUnconfigured },
      ANON_INPUT,
    );
    expect(decision.kind).toBe("allow");
    expect(recordDevice).not.toHaveBeenCalled();
  });

  it("Turnstile failure trumps device cap — bad token + at cap returns challenge_required", async () => {
    // Worksheet: Turnstile floor runs before cap check. Bots can mint
    // anon tokens trivially; the bot-floor must apply regardless of
    // the cap state.
    const { limiter, recordDevice } = stubLimiter({
      ok: false,
      reason: "device_cap",
      retryAfter: 90 * 24 * 60 * 60,
      limit: 1,
      count: 1,
      resetAt: 12345,
    });
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyInvalid },
      ANON_INPUT,
    );
    expect(decision.kind).toBe("challenge_required");
    expect(recordDevice).not.toHaveBeenCalled();
  });

  it("Turnstile verify receives the right args", async () => {
    const { limiter } = stubLimiter();
    const verify = vi.fn(stubVerifyOk);
    await peekAnonCreateGate({ limiter, verifyTurnstile: verify }, ANON_INPUT);
    expect(verify).toHaveBeenCalledWith(
      ANON_INPUT.turnstileToken,
      ANON_INPUT.turnstileSecret,
      ANON_INPUT.ip,
    );
  });
});

describe("commitAnonCreate", () => {
  it("anon principal records exactly one increment per call", async () => {
    const { limiter, recordDevice } = stubLimiter();
    await commitAnonCreate(
      { limiter },
      { principalKind: "anon", principalId: ANON_INPUT.principalId },
    );
    expect(recordDevice).toHaveBeenCalledTimes(1);
    expect(recordDevice).toHaveBeenCalledWith(ANON_INPUT.principalId);
  });

  it("authenticated principal is a no-op", async () => {
    const { limiter, recordDevice } = stubLimiter();
    await commitAnonCreate(
      { limiter },
      { principalKind: "user", principalId: "user_1" },
    );
    expect(recordDevice).not.toHaveBeenCalled();
  });
});

describe("peek + commit composed (WS5 fix C — failed creates do not consume the cap)", () => {
  it("3 failed creates (peek-only) + 1 successful (peek+commit) → exactly 1 increment", async () => {
    const { limiter, peekDevice, recordDevice } = stubLimiter();
    const deps = { limiter, verifyTurnstile: stubVerifyOk };
    // 3 attempts where the orchestrator would have failed → peek
    // only, never commit.
    for (let i = 0; i < 3; i++) {
      const decision = await peekAnonCreateGate(deps, ANON_INPUT);
      expect(decision.kind).toBe("allow");
    }
    // 1 success → peek + commit.
    const ok = await peekAnonCreateGate(deps, ANON_INPUT);
    expect(ok.kind).toBe("allow");
    await commitAnonCreate(
      { limiter },
      { principalKind: "anon", principalId: ANON_INPUT.principalId },
    );

    expect(peekDevice).toHaveBeenCalledTimes(4);
    expect(recordDevice).toHaveBeenCalledTimes(1);
  });
});
