// WS5 fix C + WS8 SK-ANON-012 — peek + commit semantics on the per-
// device cap.
//
// Post-WS8: the device cap is enforced at the TOP of `/v1/ask` (see
// `apps/api/src/index.ts`), not inside this gate. The gate now only
// runs the Turnstile bot-floor on the create path. The cap-counter
// commit semantics under test here:
//   • peekAnonCreateGate verifies Turnstile and returns allow /
//     challenge_required / skip. No `recordDevice` side effect.
//   • commitAnonCreate records exactly one increment on a single call.
//   • Both halves no-op for non-anon principals (SK-ANON-006).
//   • Turnstile runs unconditionally; SK-ANON-009 fail-open is intact.

import { describe, expect, it, vi } from "vitest";
import { commitAnonCreate, peekAnonCreateGate } from "../src/anon-create-gate.ts";
import type { AnonRateLimiter } from "../src/anon-rate-limit.ts";
import type { TurnstileVerifyResult, verifyTurnstile } from "../src/turnstile.ts";

function stubLimiter(): {
  limiter: AnonRateLimiter;
  peekDevice: ReturnType<typeof vi.fn>;
  recordDevice: ReturnType<typeof vi.fn>;
  checkQuery: ReturnType<typeof vi.fn>;
} {
  const peekDevice = vi.fn(async () => ({
    ok: true as const,
    limit: 1,
    count: 0,
    resetAt: 9999,
  }));
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

describe("peekAnonCreateGate (Turnstile-only post-SK-ANON-012)", () => {
  it("authenticated principal short-circuits to skip", async () => {
    const { limiter, peekDevice, recordDevice } = stubLimiter();
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyOk },
      { ...ANON_INPUT, principalKind: "user" },
    );
    expect(decision).toEqual({ kind: "skip" });
    expect(peekDevice).not.toHaveBeenCalled();
    expect(recordDevice).not.toHaveBeenCalled();
  });

  it("anon + valid Turnstile returns allow without recording", async () => {
    const { limiter, recordDevice } = stubLimiter();
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyOk },
      ANON_INPUT,
    );
    expect(decision).toEqual({ kind: "allow" });
    expect(recordDevice).not.toHaveBeenCalled();
  });

  it("anon + invalid Turnstile returns challenge_required", async () => {
    const { limiter, recordDevice } = stubLimiter();
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyInvalid },
      ANON_INPUT,
    );
    expect(decision).toEqual({ kind: "challenge_required" });
    expect(recordDevice).not.toHaveBeenCalled();
  });

  it("Turnstile unconfigured fails OPEN in every environment (SK-ANON-009)", async () => {
    const { limiter, recordDevice } = stubLimiter();
    const decision = await peekAnonCreateGate(
      { limiter, verifyTurnstile: stubVerifyUnconfigured },
      ANON_INPUT,
    );
    expect(decision).toEqual({ kind: "allow" });
    expect(recordDevice).not.toHaveBeenCalled();
  });

  it("Turnstile verify receives the right args (token, secret, ip)", async () => {
    const { limiter } = stubLimiter();
    const verify = vi.fn(stubVerifyOk);
    await peekAnonCreateGate({ limiter, verifyTurnstile: verify }, ANON_INPUT);
    expect(verify).toHaveBeenCalledWith(
      ANON_INPUT.turnstileToken,
      ANON_INPUT.turnstileSecret,
      ANON_INPUT.ip,
    );
  });

  it("does NOT call peekDevice — the cap lives at the route top-level now", async () => {
    const { limiter, peekDevice } = stubLimiter();
    await peekAnonCreateGate({ limiter, verifyTurnstile: stubVerifyOk }, ANON_INPUT);
    expect(peekDevice).not.toHaveBeenCalled();
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
    await commitAnonCreate({ limiter }, { principalKind: "user", principalId: "user_1" });
    expect(recordDevice).not.toHaveBeenCalled();
  });
});

describe("peek + commit composed (WS5 fix C — failed creates do not consume the cap)", () => {
  it("3 Turnstile-passes (peek-only) + 1 commit → exactly 1 increment", async () => {
    const { limiter, recordDevice } = stubLimiter();
    const deps = { limiter, verifyTurnstile: stubVerifyOk };
    for (let i = 0; i < 3; i++) {
      const decision = await peekAnonCreateGate(deps, ANON_INPUT);
      expect(decision).toEqual({ kind: "allow" });
    }
    const ok = await peekAnonCreateGate(deps, ANON_INPUT);
    expect(ok).toEqual({ kind: "allow" });
    await commitAnonCreate(
      { limiter },
      { principalKind: "anon", principalId: ANON_INPUT.principalId },
    );
    expect(recordDevice).toHaveBeenCalledTimes(1);
  });
});
