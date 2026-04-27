// Unit tests for the Resend email sender shim. Verifies the
// dev-stub fallback (no API key) and the prod fetch payload shape.

import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEmailSender } from "../src/email.ts";

describe("makeEmailSender", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a console-logging stub when no API key is configured", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const send = makeEmailSender({ apiKey: undefined, from: "x@example.com" });
    await send({ to: "user@example.com", subject: "hi", text: "click" });
    expect(log).toHaveBeenCalledOnce();
    const call = log.mock.calls[0]?.[0] ?? "";
    expect(call).toContain("user@example.com");
    expect(call).toContain("click");
  });

  it("posts a JSON envelope to api.resend.com when configured", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ id: "ok" }), { status: 200 }),
    );
    const send = makeEmailSender({
      apiKey: "re_test_key",
      from: "nlqdb <hello@nlqdb.com>",
      fetch: fetchMock,
    });
    await send({
      to: "user@example.com",
      subject: "Sign in",
      text: "click",
      html: "<a>click</a>",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("https://api.resend.com/emails");
    expect(call[1].method).toBe("POST");
    const headers = call[1].headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer re_test_key");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(call[1].body as string);
    expect(body).toEqual({
      from: "nlqdb <hello@nlqdb.com>",
      to: "user@example.com",
      subject: "Sign in",
      text: "click",
      html: "<a>click</a>",
    });
  });

  it("throws on a non-2xx Resend response so callers surface the failure", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response('{"message":"invalid api key"}', { status: 401 }),
    );
    const send = makeEmailSender({
      apiKey: "re_bad",
      from: "x",
      fetch: fetchMock,
    });
    await expect(send({ to: "u@e.com", subject: "x", text: "x" })).rejects.toThrow(
      /resend send failed: HTTP 401/,
    );
  });

  it("omits the html field when caller did not pass one", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
    const send = makeEmailSender({ apiKey: "re_x", from: "x", fetch: fetchMock });
    await send({ to: "a@b.com", subject: "s", text: "t" });
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body).not.toHaveProperty("html");
  });
});
