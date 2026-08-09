// GET /api/tawk/identity (SK-WEB-025) — the support-chat widget's identity +
// Secure Mode hash source. Tawk only accepts a visitor's name/email when an
// HMAC-SHA256(email, TAWK_TO_API_KEY) hash accompanies them; this endpoint
// computes it server-side so the key never reaches the browser. The test signs
// in through the real magic-link flow (same as magic-link.test.ts), then asserts
// the endpoint returns the account email plus the exact hash Tawk will verify.

import { SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hmacHex } from "../src/api-keys.ts";

const ORIGIN = "https://example.com";
// Must equal the miniflare binding in vitest.config.ts — the endpoint HMACs with it.
const TAWK_TO_API_KEY = "test-tawk-secret-key";

function extractMagicLinkUrl(logs: string[]): string {
  const joined = logs.join("\n");
  const wrapped = joined.match(/https?:\/\/[^\s"]+\/auth\/continue\?next=([^\s"]+)/);
  if (wrapped?.[1]) return decodeURIComponent(wrapped[1]);
  throw new Error(`no magic-link continue URL found in console output:\n${joined}`);
}

async function signInCookie(email: string, logs: string[]): Promise<string> {
  const sendRes = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ email, callbackURL: `${ORIGIN}/app` }),
  });
  if (sendRes.status !== 200) throw new Error(`magic-link send failed: ${sendRes.status}`);
  const verifyRes = await SELF.fetch(extractMagicLinkUrl(logs), { redirect: "manual" });
  const setCookie = verifyRes.headers.get("set-cookie");
  if (!setCookie) throw new Error("expected set-cookie on verify response");
  const cookie = setCookie.split(";")[0];
  if (!cookie) throw new Error("expected cookie value before first `;`");
  return cookie;
}

describe("GET /api/tawk/identity", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let logs: string[];

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      logs.push(args.map((a) => String(a)).join(" "));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("returns null for an unauthenticated request (widget bails, no crash)", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/tawk/identity`);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("returns the signed-in email + the exact HMAC-SHA256(email) Secure Mode hash", async () => {
    const email = `t-${crypto.randomUUID()}@example.com`;
    const cookie = await signInCookie(email, logs);

    const res = await SELF.fetch(`${ORIGIN}/api/tawk/identity`, { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id?: string;
      email?: string;
      hash?: string;
    };

    expect(body.email).toBe(email);
    expect(body.id).toBeTruthy();
    // The value Tawk Secure Mode verifies before it will show name/email.
    expect(body.hash).toBe(await hmacHex(TAWK_TO_API_KEY, email));
    expect(body.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
