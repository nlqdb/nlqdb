// Unit tests for the Resend email sender shim. Verifies the
// dev-stub fallback (no API key), the prod fetch payload shape,
// the timeout path, and — critically — that Resend's response body
// (which echoes destination email + sender) does NOT leak into the
// thrown error.

import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEmailSender } from "../src/email.ts";

describe("makeEmailSender", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a console-logging stub when no API key is configured", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
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

  it("throws on non-2xx but does NOT echo the response body in the thrown error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          // Body deliberately includes the destination email so the
          // "no body in error message" invariant below means
          // something.
          '{"message":"recipient u-secret@example.com bounced"}',
          { status: 422 },
        ),
    );
    const send = makeEmailSender({
      apiKey: "re_bad",
      from: "x",
      fetch: fetchMock,
    });
    const thrown = await send({ to: "u-secret@example.com", subject: "x", text: "x" }).catch(
      (e: unknown) => e,
    );
    expect(thrown).toBeInstanceOf(Error);
    const errMsg = (thrown as Error).message;
    // Status code is in the error (caller needs *some* signal).
    expect(errMsg).toMatch(/HTTP 422/);
    // The Resend response body — which echoes the destination email
    // address and any other PII — must NOT appear in the thrown
    // error. The body goes to console.error for triage instead.
    expect(errMsg).not.toContain("u-secret@example.com");
    expect(errMsg).not.toContain("bounced");
  });

  it("aborts and rejects when the Resend fetch exceeds the timeout", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Honor AbortSignal so the timeout actually surfaces. Real fetch
    // does this; the test stub mirrors the contract.
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const send = makeEmailSender({
      apiKey: "re_x",
      from: "x",
      fetch: fetchMock,
      timeoutMs: 10,
    });
    await expect(send({ to: "u@e.com", subject: "x", text: "x" })).rejects.toThrow(
      /resend send failed/,
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
