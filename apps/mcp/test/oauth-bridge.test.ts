// Pure-function tests for the OAuth bridge (`SK-MCP-013`). The signed
// state blob is the CSRF + integrity surface — it round-trips an
// OAuth `AuthRequest` through the consent screen on `app.nlqdb.com`.
// Without HMAC verification an attacker could substitute their own
// `redirectUri` or strip the PKCE challenge mid-flow.
//
// Worker-runtime behavior (handler routing, OAuthProvider integration)
// is exercised in `bearer-gate.test.ts` via the cloudflare vitest pool.

import { describe, expect, it } from "vitest";
import { signBlob, verifyBlob } from "../src/crypto.ts";

const SECRET = "test-secret-do-not-use-in-prod";

describe("oauth-bridge signed state blob", () => {
  it("round-trips a full AuthRequest", async () => {
    const original = {
      rt: "code",
      ci: "client_xyz",
      ru: "https://host.example/callback",
      sc: ["mcp"],
      st: "csrf-token-123",
      cc: "challenge-abc",
      cm: "S256",
    };
    const signed = await signBlob(original, SECRET);
    expect(signed).not.toContain("+");
    expect(signed).not.toContain("/");
    expect(signed).not.toContain("=");
    expect(signed).toContain("."); // payload.signature
    const verified = await verifyBlob<typeof original>(signed, SECRET);
    expect(verified).toEqual(original);
  });

  it("round-trips a minimal AuthRequest (no PKCE)", async () => {
    const minimal = { rt: "code", ci: "c", ru: "https://h", sc: [], st: "" };
    const verified = await verifyBlob<typeof minimal>(await signBlob(minimal, SECRET), SECRET);
    expect(verified).toEqual(minimal);
  });

  it("rejects a tampered payload", async () => {
    const original = { rt: "code", ci: "good", ru: "https://good", sc: ["mcp"], st: "s" };
    const signed = await signBlob(original, SECRET);
    const [, sig] = signed.split(".");
    // Forge a new payload with attacker-controlled redirectUri but
    // keep the original signature.
    const tampered = { rt: "code", ci: "good", ru: "https://evil", sc: ["mcp"], st: "s" };
    const tamperedPayload = btoa(JSON.stringify(tampered))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await expect(verifyBlob(`${tamperedPayload}.${sig}`, SECRET)).rejects.toThrow();
  });

  it("rejects a signature minted with a different secret", async () => {
    const signed = await signBlob({ a: 1 }, "secret-A");
    await expect(verifyBlob(signed, "secret-B")).rejects.toThrow();
  });

  it("rejects a blob missing the signature segment", async () => {
    await expect(verifyBlob("just-a-payload-no-dot", SECRET)).rejects.toThrow();
  });
});
