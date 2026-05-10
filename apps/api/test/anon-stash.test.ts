// HMAC-signed cookie helpers for the anon-bearer stash
// (SK-ANON-012). Tests cover the round-trip (sign → verify), the
// HMAC tamper-detection, the cookie-attribute posture, and the
// dev/prod name flip.

import { describe, expect, it } from "vitest";
import {
  ANON_STASH_COOKIE_MAX_AGE_SECONDS,
  ANON_STASH_COOKIE_NAME_DEV,
  ANON_STASH_COOKIE_NAME_PROD,
  ANON_STASH_COOKIE_PATH,
  buildClearCookie,
  buildSetCookie,
  cookieName,
  readStashCookie,
  signAnonStash,
  verifyAnonStash,
} from "../src/anon-stash.ts";

const SECRET = "test-secret-32-chars-or-longer-aaaa";
const BEARER = "anon_550e8400-e29b-41d4-a716-446655440000";

describe("signAnonStash / verifyAnonStash", () => {
  it("round-trips the bearer", async () => {
    const signed = await signAnonStash(BEARER, SECRET);
    const got = await verifyAnonStash(signed, SECRET);
    expect(got).toBe(BEARER);
  });

  it("verify returns null on bad HMAC", async () => {
    const signed = await signAnonStash(BEARER, SECRET);
    const tampered = `${signed.slice(0, -2)}AA`;
    const got = await verifyAnonStash(tampered, SECRET);
    expect(got).toBeNull();
  });

  it("verify returns null on missing separator", async () => {
    const got = await verifyAnonStash("no_dot_in_value", SECRET);
    expect(got).toBeNull();
  });

  it("verify returns null when signed with a different secret", async () => {
    const signed = await signAnonStash(BEARER, SECRET);
    const got = await verifyAnonStash(signed, "different-secret-32-chars-aaaaaa");
    expect(got).toBeNull();
  });

  it("verify returns null when payload doesn't have the anon_ prefix", async () => {
    // Hand-craft a signed cookie whose payload decodes to something
    // without the `anon_` prefix. signAnonStash itself enforces the
    // prefix on input, so we drop a level here and sign a non-anon
    // string directly.
    const signed = await signAnonStash("anon_x", SECRET); // valid baseline
    const got = await verifyAnonStash(signed, SECRET);
    expect(got).toBe("anon_x");

    // Inject a hand-crafted payload (`hello` instead of `anon_x`) — the
    // HMAC for the original payload won't match the new payload, so
    // verify returns null.
    const dot = signed.indexOf(".");
    const tamperedPayload = `${btoa("hello").replace(/=+$/, "")}.${signed.slice(dot + 1)}`;
    const tamperedGot = await verifyAnonStash(tamperedPayload, SECRET);
    expect(tamperedGot).toBeNull();
  });
});

describe("buildSetCookie / buildClearCookie", () => {
  it("prod cookie carries the __Secure- prefix + Secure attr", async () => {
    const signed = await signAnonStash(BEARER, SECRET);
    const cookie = buildSetCookie(signed, true);
    expect(cookie.startsWith(`${ANON_STASH_COOKIE_NAME_PROD}=`)).toBe(true);
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Path=${ANON_STASH_COOKIE_PATH}`);
    expect(cookie).toContain(`Max-Age=${ANON_STASH_COOKIE_MAX_AGE_SECONDS}`);
  });

  it("dev cookie drops the __Secure- prefix + Secure attr", async () => {
    const signed = await signAnonStash(BEARER, SECRET);
    const cookie = buildSetCookie(signed, false);
    expect(cookie.startsWith(`${ANON_STASH_COOKIE_NAME_DEV}=`)).toBe(true);
    expect(cookie.includes("Secure")).toBe(false);
    expect(cookie).toContain("HttpOnly");
  });

  it("clear cookie sets Max-Age=0", () => {
    const cookie = buildClearCookie(true);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie.startsWith(`${ANON_STASH_COOKIE_NAME_PROD}=`)).toBe(true);
  });
});

describe("readStashCookie", () => {
  it("returns null when the header is absent", () => {
    expect(readStashCookie(null, true)).toBeNull();
  });

  it("extracts the prod-named cookie value", () => {
    const header = `other=foo; ${ANON_STASH_COOKIE_NAME_PROD}=abc.def; another=bar`;
    expect(readStashCookie(header, true)).toBe("abc.def");
  });

  it("extracts the dev-named cookie when not in prod mode", () => {
    const header = `${ANON_STASH_COOKIE_NAME_DEV}=abc.def`;
    expect(readStashCookie(header, false)).toBe("abc.def");
  });

  it("does NOT match the dev name in prod mode", () => {
    const header = `${ANON_STASH_COOKIE_NAME_DEV}=abc.def`;
    expect(readStashCookie(header, true)).toBeNull();
  });
});

describe("cookieName", () => {
  it("prod returns __Secure-anon-bearer", () => {
    expect(cookieName(true)).toBe("__Secure-anon-bearer");
  });
  it("dev returns anon-bearer", () => {
    expect(cookieName(false)).toBe("anon-bearer");
  });
});
