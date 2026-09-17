import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.ts";

const INBOX = "omer.hochman@gmail.com";

interface Stub {
  message: ForwardableEmailMessage;
  forward: ReturnType<typeof vi.fn>;
  setReject: ReturnType<typeof vi.fn>;
}

function makeMessage(overrides?: {
  to?: string;
  from?: string;
  authResults?: string | null;
  arcAuthResults?: string | null;
  forwardRejects?: Error;
}): Stub {
  const headers = new Headers({ subject: "Hello" });
  if (overrides?.authResults) headers.set("Authentication-Results", overrides.authResults);
  if (overrides?.arcAuthResults) {
    headers.set("ARC-Authentication-Results", overrides.arcAuthResults);
  }

  const forward = vi.fn(async () => {
    if (overrides?.forwardRejects) throw overrides.forwardRejects;
  });
  const setReject = vi.fn();

  const message = {
    from: overrides?.from ?? "sender@example.com",
    to: overrides?.to ?? "hello@nlqdb.com",
    headers,
    rawSize: 1024,
    forward,
    setReject,
  } as unknown as ForwardableEmailMessage;

  return { message, forward, setReject };
}

function forwardedHeaders(forward: ReturnType<typeof vi.fn>): Headers {
  return forward.mock.calls[0]?.[1] as Headers;
}

describe("email router", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("forwards authenticated mail to the verified inbox", async () => {
    const { message, forward, setReject } = makeMessage({
      authResults: "spf=pass; dkim=pass; dmarc=pass",
    });

    await worker.email(message);

    expect(forward).toHaveBeenCalledWith(INBOX, expect.any(Headers));
    expect(forwardedHeaders(forward).get("X-Nlqdb-Auth-Verdict")).toBe("pass");
    expect(setReject).not.toHaveBeenCalled();
  });

  // The old handler called setReject() on a triple auth failure, which is a
  // permanent SMTP error — the only way a routing decision loses a message.
  it("labels failing authentication instead of rejecting it", async () => {
    const { message, forward, setReject } = makeMessage({
      authResults: "spf=softfail; dkim=fail; dmarc=fail",
    });

    await worker.email(message);

    expect(forward).toHaveBeenCalledWith(INBOX, expect.any(Headers));
    expect(forwardedHeaders(forward).get("X-Nlqdb-Auth-Verdict")).toBe("suspicious");
    expect(setReject).not.toHaveBeenCalled();
  });

  it("treats a missing Authentication-Results header as unknown, not as a failure", async () => {
    const { message, forward } = makeMessage({ arcAuthResults: "i=1; mx.google.com; arc=none" });

    await worker.email(message);

    expect(forwardedHeaders(forward).get("X-Nlqdb-Auth-Verdict")).toBe("unknown");
  });

  it("stamps the original recipient so catch-all mail stays sortable", async () => {
    const { message, forward } = makeMessage({ to: "security@nlqdb.com" });

    await worker.email(message);

    expect(forwardedHeaders(forward).get("X-Nlqdb-Original-To")).toBe("security@nlqdb.com");
  });

  // Forwarding these into Gmail is what tripped the 4.7.28 rate limiter and
  // put one report into an endless retry loop.
  it("keeps DMARC aggregate reports out of the inbox", async () => {
    const { message, forward, setReject } = makeMessage({
      to: "dmarc@nlqdb.com",
      from: "noreply-dmarc-support@google.com",
    });

    await worker.email(message);

    expect(forward).not.toHaveBeenCalled();
    expect(setReject).not.toHaveBeenCalled();
  });

  it("recognises the report mailbox through display-name and subaddress forms", async () => {
    for (const to of ['"DMARC" <dmarc@nlqdb.com>', "dmarc+google@nlqdb.com", "DMARC@nlqdb.com"]) {
      const { message, forward } = makeMessage({ to });
      await worker.email(message);
      expect(forward, to).not.toHaveBeenCalled();
    }
  });

  it("does not treat a normal mailbox as a report mailbox", async () => {
    const { message, forward } = makeMessage({ to: "dmarc-team@nlqdb.com" });

    await worker.email(message);

    expect(forward).toHaveBeenCalledWith(INBOX, expect.any(Headers));
  });

  // A throw makes Cloudflare return a temporary SMTP error, so the sending
  // server retries; swallowing it would drop the message.
  it("rethrows a forward failure so the sender retries", async () => {
    const { message, setReject } = makeMessage({
      forwardRejects: new Error("transient error (421): 4.7.28 rate limited"),
    });

    await expect(worker.email(message)).rejects.toThrow("4.7.28");
    expect(setReject).not.toHaveBeenCalled();
  });
});
