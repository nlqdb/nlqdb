// PKCE primitives — verifier length, base64url alphabet, and S256 correctness
// against an RFC 7636 known-answer vector.

import { describe, expect, it } from "vitest";
import { codeChallengeS256, generateCodeVerifier, generateState } from "./pkce.ts";

const B64URL = /^[A-Za-z0-9_-]+$/;

describe("pkce", () => {
  it("generates base64url state + verifier of the right shape", () => {
    expect(generateState()).toMatch(B64URL);
    const v = generateCodeVerifier();
    expect(v).toMatch(B64URL);
    // 32 bytes → 43 base64url chars (RFC 7636 requires 43–128).
    expect(v.length).toBe(43);
  });

  it("state + verifier are random per call", () => {
    expect(generateState()).not.toBe(generateState());
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it("computes the RFC 7636 S256 challenge known-answer", async () => {
    // RFC 7636 Appendix B: verifier → challenge.
    const challenge = await codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
