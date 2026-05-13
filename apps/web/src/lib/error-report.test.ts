import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// `reportClientError` is the only client-side path that talks to
// `/v1/errors/web`. It must:
//   - POST with `credentials: "omit"` (no session cookie ride —
//     the endpoint is unauthenticated and we shrink the attack
//     surface by not sending one).
//   - Dedup by `surface + message + stack[0..200]` so a reload loop
//     on the same crash doesn't fan out to the OTel sink.
//   - Swallow fetch failures silently — error reporting must never
//     itself surface a new error.

type CapturedInit = {
  url: string;
  credentials?: RequestCredentials;
  body?: string;
};

const originalFetch = globalThis.fetch;
let captures: CapturedInit[] = [];

function mockFetch(response: Response | (() => Response | Promise<Response>)) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captures.push({
      url: typeof input === "string" ? input : input.toString(),
      credentials: init?.credentials,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return typeof response === "function" ? response() : response;
  }) as typeof fetch;
}

beforeEach(() => {
  captures = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("reportClientError", () => {
  test("POSTs to /v1/errors/web with credentials: 'omit'", async () => {
    mockFetch(new Response(null, { status: 204 }));
    const { reportClientError, _resetReportClientErrorForTests } = await import(
      "./error-report.ts"
    );
    _resetReportClientErrorForTests();

    reportClientError({ surface: "test", message: "boom", stack: "at foo", href: "/x" });
    // The fetch is fire-and-forget — give the microtask queue a tick.
    await new Promise((r) => setTimeout(r, 0));

    expect(captures).toHaveLength(1);
    expect(captures[0]?.url).toMatch(/\/v1\/errors\/web$/);
    expect(captures[0]?.credentials).toBe("omit");
    const body = JSON.parse(captures[0]?.body ?? "{}");
    expect(body.surface).toBe("test");
    expect(body.message).toBe("boom");
    expect(body.stack).toBe("at foo");
  });

  test("dedups by surface+message+stack head — same crash only POSTs once", async () => {
    mockFetch(new Response(null, { status: 204 }));
    const { reportClientError, _resetReportClientErrorForTests } = await import(
      "./error-report.ts"
    );
    _resetReportClientErrorForTests();

    for (let i = 0; i < 5; i++) {
      reportClientError({ surface: "ChatPanel", message: "x is undefined", stack: "at A\nat B" });
    }
    await new Promise((r) => setTimeout(r, 0));

    expect(captures).toHaveLength(1);
  });

  test("different fingerprints POST separately", async () => {
    mockFetch(new Response(null, { status: 204 }));
    const { reportClientError, _resetReportClientErrorForTests } = await import(
      "./error-report.ts"
    );
    _resetReportClientErrorForTests();

    reportClientError({ surface: "ChatPanel", message: "A", stack: "at one" });
    reportClientError({ surface: "ChatPanel", message: "B", stack: "at one" });
    reportClientError({ surface: "CreateForm", message: "A", stack: "at one" });
    await new Promise((r) => setTimeout(r, 0));

    expect(captures).toHaveLength(3);
  });

  test("swallows fetch rejection — caller never sees the error", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const { reportClientError, _resetReportClientErrorForTests } = await import(
      "./error-report.ts"
    );
    _resetReportClientErrorForTests();

    // This must not throw.
    expect(() => reportClientError({ surface: "x", message: "y" })).not.toThrow();
    // Drain the rejected microtask so the next test starts clean.
    await new Promise((r) => setTimeout(r, 0));
  });

  test("sends a W3C-shaped traceparent header so the server span joins the trace", async () => {
    const captureHeaders: Record<string, string>[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const h = (init?.headers ?? {}) as Record<string, string>;
      captureHeaders.push(h);
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    const { reportClientError, _resetReportClientErrorForTests } = await import(
      "./error-report.ts"
    );
    _resetReportClientErrorForTests();

    reportClientError({ surface: "ChatPanel", message: "x is undefined" });
    await new Promise((r) => setTimeout(r, 0));

    const tp = captureHeaders[0]?.["traceparent"];
    expect(tp).toBeDefined();
    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });
});

describe("newTraceparent", () => {
  test("emits a v00 traceparent with random trace + span ids on each call", async () => {
    const { newTraceparent } = await import("./error-report.ts");
    const a = newTraceparent();
    const b = newTraceparent();
    expect(a).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(b).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(a).not.toBe(b);
  });
});
