// Pure-function tests for the OAuth bridge (`SK-MCP-013`). The state
// blob is the CSRF-defense surface — it round-trips an OAuth
// `AuthRequest` through the consent screen on `app.nlqdb.com`. Loss of
// fidelity here would let an attacker swap the `client_id` between
// `/authorize` and `/oauth/mcp-bridge-callback`.
//
// Worker-runtime behavior (handler routing, OAuthProvider integration)
// is exercised in `bearer-gate.test.ts` via the cloudflare vitest pool.

import { describe, expect, it } from "vitest";
import { decodeBlob, encodeBlob } from "../src/oauth-bridge.ts";

describe("oauth-bridge state blob", () => {
  it("round-trips a full AuthRequest", () => {
    const original = {
      rt: "code",
      ci: "client_xyz",
      ru: "https://host.example/callback",
      sc: ["mcp"],
      st: "csrf-token-123",
      cc: "challenge-abc",
      cm: "S256",
    };
    const encoded = encodeBlob(original);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
    const decoded = decodeBlob<typeof original>(encoded);
    expect(decoded).toEqual(original);
  });

  it("round-trips a minimal AuthRequest (no PKCE)", () => {
    const minimal = { rt: "code", ci: "c", ru: "https://h", sc: [], st: "" };
    const decoded = decodeBlob<typeof minimal>(encodeBlob(minimal));
    expect(decoded).toEqual(minimal);
  });

  it("throws on malformed input", () => {
    expect(() => decodeBlob("not-base64url!!!")).toThrow();
  });
});
