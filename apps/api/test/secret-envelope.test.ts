// Unit coverage for the BYO secret-at-rest envelope (`GLOBAL-031`,
// `src/secret-envelope.ts`). Runs under the workers pool so `crypto.subtle`
// is the real workerd Web Crypto — the same engine production seals on.

import { describe, expect, it } from "vitest";
import { kekFromEnv, openSecret, sealSecret } from "../src/secret-envelope.ts";

const KEK = "test-kek-this-is-a-high-entropy-string-aaaa";
const CTX = "byollm:user_abc";

describe("sealSecret / openSecret round-trip", () => {
  it("recovers the exact plaintext under the same KEK + context", async () => {
    const secret = "sk-ant-api03-abc.def:ghi"; // colon inside a real key value
    const sealed = await sealSecret(secret, { kek: KEK, context: CTX });
    expect(sealed.startsWith("nbe1.")).toBe(true);
    expect(sealed).not.toContain(secret); // never plaintext in the envelope
    expect(await openSecret(sealed, { kek: KEK, context: CTX })).toBe(secret);
  });

  it("emits a fresh IV per seal — same input never produces the same envelope", async () => {
    const a = await sealSecret("same", { kek: KEK, context: CTX });
    const b = await sealSecret("same", { kek: KEK, context: CTX });
    expect(a).not.toBe(b);
    expect(await openSecret(a, { kek: KEK, context: CTX })).toBe("same");
    expect(await openSecret(b, { kek: KEK, context: CTX })).toBe("same");
  });

  it("round-trips unicode and long secrets", async () => {
    const secret = `héllo-🔐-${"x".repeat(4096)}`;
    const sealed = await sealSecret(secret, { kek: KEK, context: CTX });
    expect(await openSecret(sealed, { kek: KEK, context: CTX })).toBe(secret);
  });
});

describe("authentication and context binding", () => {
  it("refuses to open under a different context (anti-replay AAD)", async () => {
    const sealed = await sealSecret("secret", { kek: KEK, context: "dbconn:db_1" });
    await expect(openSecret(sealed, { kek: KEK, context: "dbconn:db_2" })).rejects.toThrow(
      /could not decrypt/,
    );
  });

  it("refuses to open under a different KEK", async () => {
    const sealed = await sealSecret("secret", { kek: KEK, context: CTX });
    await expect(openSecret(sealed, { kek: `${KEK}-other`, context: CTX })).rejects.toThrow(
      /could not decrypt/,
    );
  });

  it("detects tampering with the ciphertext", async () => {
    const sealed = await sealSecret("secret", { kek: KEK, context: CTX });
    // Mutate the first payload char (top bits of the IV's first byte) so a
    // real decoded byte changes — flipping the *last* char can be a no-op
    // since trailing base64 bits are truncated.
    const head = sealed.slice(0, 5); // "nbe1."
    const first = sealed[5];
    const flipped = `${head}${first === "A" ? "B" : "A"}${sealed.slice(6)}`;
    expect(flipped).not.toBe(sealed);
    await expect(openSecret(flipped, { kek: KEK, context: CTX })).rejects.toThrow(
      /could not decrypt/,
    );
  });
});

describe("malformed envelopes", () => {
  it("rejects a value without the version prefix", async () => {
    await expect(openSecret("plain-text", { kek: KEK, context: CTX })).rejects.toThrow(
      /not a v1 sealed-secret envelope/,
    );
  });

  it("rejects a truncated payload", async () => {
    await expect(openSecret("nbe1.AAAA", { kek: KEK, context: CTX })).rejects.toThrow(/truncated/);
  });

  it("rejects a non-base64url payload", async () => {
    await expect(openSecret("nbe1.***not base64***", { kek: KEK, context: CTX })).rejects.toThrow(
      /base64url/,
    );
  });
});

describe("fail-loud on blank inputs (GLOBAL-012)", () => {
  it("refuses to seal an empty secret", async () => {
    await expect(sealSecret("", { kek: KEK, context: CTX })).rejects.toThrow(/empty secret/);
  });

  it("refuses a blank KEK on seal and open", async () => {
    await expect(sealSecret("x", { kek: "  ", context: CTX })).rejects.toThrow(/KEK is empty/);
    await expect(openSecret("nbe1.x", { kek: "", context: CTX })).rejects.toThrow(/KEK is empty/);
  });

  it("refuses a blank context on seal and open", async () => {
    await expect(sealSecret("x", { kek: KEK, context: "" })).rejects.toThrow(/context .* is empty/);
    await expect(openSecret("nbe1.x", { kek: KEK, context: "" })).rejects.toThrow(
      /context .* is empty/,
    );
  });
});

describe("kekFromEnv", () => {
  it("returns the trimmed KEK when set, undefined when absent or blank", () => {
    expect(kekFromEnv({ BYO_SECRET_KEK: "  abc  " })).toBe("abc");
    expect(kekFromEnv({ BYO_SECRET_KEK: "   " })).toBeUndefined();
    expect(kekFromEnv({})).toBeUndefined();
  });
});
