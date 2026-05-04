import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../src/turnstile.ts";

function makeFetch(response: { ok: boolean; body?: unknown }) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(response.body ?? {}), {
        status: response.ok ? 200 : 500,
      }),
  ) as unknown as typeof fetch;
}

describe("verifyTurnstile", () => {
  it("returns unconfigured when the secret is missing", async () => {
    const out = await verifyTurnstile("token", undefined, "1.2.3.4");
    expect(out).toEqual({ ok: false, reason: "unconfigured" });
  });

  it("returns invalid when the token is missing", async () => {
    const out = await verifyTurnstile(null, "secret", "1.2.3.4");
    expect(out).toEqual({ ok: false, reason: "invalid" });
  });

  it("returns ok when siteverify says success: true", async () => {
    const fetchMock = makeFetch({ ok: true, body: { success: true } });
    const out = await verifyTurnstile("token", "secret", "1.2.3.4", { fetch: fetchMock });
    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns invalid when siteverify says success: false", async () => {
    const fetchMock = makeFetch({ ok: true, body: { success: false } });
    const out = await verifyTurnstile("token", "secret", "1.2.3.4", { fetch: fetchMock });
    expect(out).toEqual({ ok: false, reason: "invalid" });
  });

  it("returns verify_failed on a 5xx siteverify response", async () => {
    const fetchMock = makeFetch({ ok: false });
    const out = await verifyTurnstile("token", "secret", "1.2.3.4", { fetch: fetchMock });
    expect(out).toEqual({ ok: false, reason: "verify_failed" });
  });

  it("returns verify_failed when fetch throws", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    const out = await verifyTurnstile("token", "secret", "1.2.3.4", { fetch: fetchMock });
    expect(out).toEqual({ ok: false, reason: "verify_failed" });
  });

  it("posts secret + response + remoteip to the siteverify URL", async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
      expect(init?.method).toBe("POST");
      const body = init?.body as URLSearchParams;
      expect(body.get("secret")).toBe("s3cret");
      expect(body.get("response")).toBe("tk");
      expect(body.get("remoteip")).toBe("1.2.3.4");
      return new Response(JSON.stringify({ success: true }));
    }) as unknown as typeof fetch;
    await verifyTurnstile("tk", "s3cret", "1.2.3.4", { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
