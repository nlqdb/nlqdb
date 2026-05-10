// WS5 fix C — peek + commit semantics. The route-handler closures
// in `apps/api/src/index.ts` adapt these to a Hono Response and emit
// the X-RateLimit-* headers; the cap-counter semantics under test
// here are: peek never records, commit records only when called.
//
// Locks the worksheet's testable contracts:
//   • peekAnonCreateGate returns the right typed verdict but does
//     NOT touch `recordCreate`.
//   • commitAnonCreate records exactly one increment on a single call.
//   • Both halves no-op for non-anon principals (SK-ANON-006).
//   • The Turnstile fail-open path (SK-ANON-009) flows through.

import { describe, expect, it, vi } from "vitest";
import { commitAnonCreate, peekAnonCreateGate } from "../src/anon-create-gate.ts";
import type { AnonCreateVerdict, AnonRateLimiter } from "../src/anon-rate-limit.ts";
import type { TurnstileVerifyResult, verifyTurnstile } from "../src/turnstile.ts";

function stubLimiter(
  peekResult: AnonCreateVerdict = {
    ok: true,
    needsChallenge: false,
    limit: 5,
    count: 0,
    resetAt: 9999,
  },
): {
  limiter: AnonRateLimiter;
  peekCreate: ReturnType<typeof vi.fn>;
  recordCreate: ReturnType<typeof vi.fn>;
  checkQuery: ReturnType<typeof vi.fn>;
} {
  const peekCreate = vi.fn(async () => peekResult);
  const recordCreate = vi.fn(async () => {});
  const checkQuery = vi.fn(async () => ({
    ok: true,
    limit: 30,
    count: 0,
    resetAt: 9999,
  }));
  return {
    limiter: { peekCreate, recordCreate, checkQuery } as unknown as AnonRateLimiter,
    peekCreate,
    recordCreate,
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
  ip: "1.2.3.4",
  turnstileSecret: "test_secret",
  turnstileToken: "test_token",
};

describe("peekAnonCreateGate", () => {
  it("authenticated principal short-circuits to skip without touching the limiter", async () => {
    const { limiter, peekCreate, recordCreate } = stubLimiter();
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyOk },
      { ...ANON_INPUT, principalKind: "user" },
    );
    expect(decision).toEqual({ kind: "skip" });
    expect(peekCreate).not.toHaveBeenCalled();
    expect(recordCreate).not.toHaveBeenCalled();
  });

  it("anon under cap returns allow + does NOT call recordCreate (WS5 fix C)", async () => {
    const { limiter, peekCreate, recordCreate } = stubLimiter();
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyOk },
      ANON_INPUT,
    );
    expect(decision.kind).toBe("allow");
    if (decision.kind === "allow") {
      expect(decision.peek.limit).toBe(5);
      expect(decision.peek.count).toBe(0);
    }
    expect(peekCreate).toHaveBeenCalledTimes(1);
    expect(peekCreate).toHaveBeenCalledWith(ANON_INPUT.ip);
    expect(recordCreate).not.toHaveBeenCalled();
  });

  it("anon over hour cap returns rate_limited without recording", async () => {
    const { limiter, recordCreate } = stubLimiter({
      ok: false,
      reason: "ip_create_cap",
      retryAfter: 3600,
      limit: 5,
      count: 5,
      resetAt: 12345,
    });
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyOk },
      ANON_INPUT,
    );
    expect(decision.kind).toBe("rate_limited");
    if (decision.kind === "rate_limited") {
      expect(decision.peek.limit).toBe(5);
      expect(decision.peek.count).toBe(5);
      expect(decision.peek.resetAt).toBe(12345);
    }
    expect(recordCreate).not.toHaveBeenCalled();
  });

  it("burst-gate triggers Turnstile; valid token returns allow", async () => {
    const { limiter, recordCreate } = stubLimiter({
      ok: true,
      needsChallenge: true,
      limit: 5,
      count: 3,
      resetAt: 9999,
    });
    const verify = vi.fn(stubVerifyOk);
    const decision = await peekAnonCreateGate({ limiter, verifyTurnstile: verify }, ANON_INPUT);
    expect(decision.kind).toBe("allow");
    expect(verify).toHaveBeenCalledWith(
      ANON_INPUT.turnstileToken,
      ANON_INPUT.turnstileSecret,
      ANON_INPUT.ip,
    );
    expect(recordCreate).not.toHaveBeenCalled();
  });

  it("burst-gate + invalid Turnstile returns challenge_required (no record)", async () => {
    const { limiter, recordCreate } = stubLimiter({
      ok: true,
      needsChallenge: true,
      limit: 5,
      count: 3,
      resetAt: 9999,
    });
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyInvalid },
      ANON_INPUT,
    );
    expect(decision.kind).toBe("challenge_required");
    expect(recordCreate).not.toHaveBeenCalled();
  });

  it("burst-gate + unconfigured Turnstile fails open (SK-ANON-009)", async () => {
    const { limiter, recordCreate } = stubLimiter({
      ok: true,
      needsChallenge: true,
      limit: 5,
      count: 3,
      resetAt: 9999,
    });
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyUnconfigured },
      ANON_INPUT,
    );
    expect(decision.kind).toBe("allow");
    expect(recordCreate).not.toHaveBeenCalled();
  });
});

describe("commitAnonCreate", () => {
  it("anon principal records exactly one increment per call", async () => {
    const { limiter, recordCreate } = stubLimiter();
    await commitAnonCreate({ limiter }, { principalKind: "anon", ip: "1.2.3.4" });
    expect(recordCreate).toHaveBeenCalledTimes(1);
    expect(recordCreate).toHaveBeenCalledWith("1.2.3.4");
  });

  it("authenticated principal is a no-op", async () => {
    const { limiter, recordCreate } = stubLimiter();
    await commitAnonCreate({ limiter }, { principalKind: "user", ip: "1.2.3.4" });
    expect(recordCreate).not.toHaveBeenCalled();
  });
});

describe("peek + commit composed (WS5 fix C — failed creates do not consume the cap)", () => {
  it("3 failed creates (peek-only) + 1 successful (peek+commit) → exactly 1 increment", async () => {
    const { limiter, peekCreate, recordCreate } = stubLimiter();
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
    await commitAnonCreate({ limiter }, { principalKind: "anon", ip: ANON_INPUT.ip });

    expect(peekCreate).toHaveBeenCalledTimes(4);
    expect(recordCreate).toHaveBeenCalledTimes(1);
  });
});
