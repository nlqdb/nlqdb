import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AllProvidersFailedError,
  createLLMRouter,
  NoConfiguredProvidersError,
  NoProviderError,
} from "../src/router.ts";
import {
  type CallOpts,
  type ClassifyResponse,
  type DisambiguateResponse,
  type PlanResponse,
  type Provider,
  ProviderError,
  type ProviderName,
  type SchemaInferResponse,
  type SummarizeResponse,
} from "../src/types.ts";

// Fake provider — every operation returns or throws what the test
// stubs. Keeps router tests synchronous and free of HTTP mocks. Stubs
// can also be a function so tests exercise the CallOpts threading.
type Stub<R> =
  | R
  | ProviderError
  | Error
  | ((req: unknown, opts: CallOpts | undefined) => Promise<R>);

function fakeProvider(
  name: ProviderName,
  stubs: {
    classify?: Stub<ClassifyResponse>;
    plan?: Stub<PlanResponse>;
    summarize?: Stub<SummarizeResponse>;
    schemaInfer?: Stub<SchemaInferResponse>;
    disambiguate?: Stub<DisambiguateResponse>;
  } = {},
): Provider & { calls: { op: string; req: unknown; opts: CallOpts | undefined }[] } {
  const calls: { op: string; req: unknown; opts: CallOpts | undefined }[] = [];
  async function resolve<T>(
    stub: Stub<T> | undefined,
    fallback: T,
    req: unknown,
    opts: CallOpts | undefined,
  ): Promise<T> {
    if (typeof stub === "function")
      return (stub as (r: unknown, o: CallOpts | undefined) => Promise<T>)(req, opts);
    if (stub instanceof Error) throw stub;
    return stub ?? fallback;
  }
  return {
    name,
    calls,
    model: () => `${name}-model`,
    async classify(req, opts) {
      calls.push({ op: "classify", req, opts });
      return resolve(stubs.classify, { intent: "data_query", confidence: 1 }, req, opts);
    },
    async plan(req, opts) {
      calls.push({ op: "plan", req, opts });
      return resolve(stubs.plan, { sql: `-- ${name}` }, req, opts);
    },
    async summarize(req, opts) {
      calls.push({ op: "summarize", req, opts });
      return resolve(stubs.summarize, { summary: name }, req, opts);
    },
    async schemaInfer(req, opts) {
      calls.push({ op: "schemaInfer", req, opts });
      return resolve(stubs.schemaInfer, { plan: { provider: name } }, req, opts);
    },
    async disambiguate(req, opts) {
      calls.push({ op: "disambiguate", req, opts });
      return resolve(
        stubs.disambiguate,
        { chosenId: null, confidence: 0, reason: name },
        req,
        opts,
      );
    },
  };
}

function metric(t: TestTelemetry, name: string) {
  return t.metricExporter
    .getMetrics()
    .flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics))
    .find((m) => m.descriptor.name === name);
}

let telemetry: TestTelemetry;

beforeEach(() => {
  telemetry = createTestTelemetry();
});

afterEach(() => {
  telemetry.reset();
});

describe("createLLMRouter — happy path", () => {
  it("classify returns the first provider's response", async () => {
    const a = fakeProvider("groq", { classify: { intent: "meta", confidence: 0.5 } });
    const router = createLLMRouter({
      providers: [a],
      chains: { classify: ["groq"] },
    });
    const res = await router.classify({ utterance: "u" });
    expect(res).toEqual({ intent: "meta", confidence: 0.5 });
  });

  it("emits one llm.<op> span per attempt with provider/model attrs", async () => {
    const a = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a],
      chains: { plan: ["groq"] },
    });
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    const spans = telemetry.spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe("llm.plan");
    expect(spans[0]?.attributes["llm.provider"]).toBe("groq");
    expect(spans[0]?.attributes["llm.model"]).toBe("groq-model");
  });

  it("records nlqdb.llm.calls.total{status=ok} and duration", async () => {
    const a = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a],
      chains: { summarize: ["groq"] },
    });
    await router.summarize({ goal: "g", rows: [] });
    await telemetry.collectMetrics();
    const calls = metric(telemetry, "nlqdb.llm.calls.total");
    expect(calls?.dataPoints[0]?.attributes["status"]).toBe("ok");
    expect(metric(telemetry, "nlqdb.llm.duration_ms")).toBeDefined();
  });
});

describe("createLLMRouter — failover", () => {
  it("falls through on first provider failure and uses second", async () => {
    const a = fakeProvider("gemini", {
      plan: new ProviderError("rate limited", "http_4xx", 429),
    });
    const b = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a, b],
      chains: { plan: ["gemini", "groq"] },
    });
    const res = await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    expect(res.sql).toBe("-- groq");
    expect(b.calls).toHaveLength(1);
  });

  // PERFORMANCE §4 row 4 explicit CI assertion — failover counter
  // increments on forced provider failure.
  it("increments nlqdb.llm.failover.total{from,to,reason} once per fall-through", async () => {
    const a = fakeProvider("gemini", {
      plan: new ProviderError("boom", "http_5xx", 503),
    });
    const b = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a, b],
      chains: { plan: ["gemini", "groq"] },
    });
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    await telemetry.collectMetrics();
    const failover = metric(telemetry, "nlqdb.llm.failover.total");
    expect(failover, "nlqdb.llm.failover.total not emitted").toBeDefined();
    const point = failover?.dataPoints[0];
    expect(point?.value).toBe(1);
    expect(point?.attributes["from_provider"]).toBe("gemini");
    expect(point?.attributes["to_provider"]).toBe("groq");
    expect(point?.attributes["reason"]).toBe("http_5xx");
  });

  it("emits one span per attempt — failed attempt has ERROR status", async () => {
    const a = fakeProvider("gemini", {
      classify: new ProviderError("net", "network"),
    });
    const b = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a, b],
      chains: { classify: ["gemini", "groq"] },
    });
    await router.classify({ utterance: "u" });
    const spans = telemetry.spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(2);
    expect(spans[0]?.attributes["llm.provider"]).toBe("gemini");
    expect(spans[0]?.status.code).toBe(2); // ERROR
    expect(spans[1]?.attributes["llm.provider"]).toBe("groq");
  });

  it("non-ProviderError exceptions are classified reason=unknown", async () => {
    // Programmer-error throws (e.g. our parser blowing up) get tagged
    // `unknown`, not `network` — dashboards must distinguish them.
    const a = fakeProvider("gemini", { plan: new Error("random") });
    const b = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a, b],
      chains: { plan: ["gemini", "groq"] },
    });
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    await telemetry.collectMetrics();
    const failover = metric(telemetry, "nlqdb.llm.failover.total");
    expect(failover?.dataPoints[0]?.attributes["reason"]).toBe("unknown");
  });

  it("provider listed in chain but unregistered → reason=not_configured", async () => {
    const b = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [b],
      chains: { plan: ["gemini", "groq"] },
    });
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    await telemetry.collectMetrics();
    const failover = metric(telemetry, "nlqdb.llm.failover.total");
    expect(failover?.dataPoints[0]?.attributes["reason"]).toBe("not_configured");
  });

  it("all providers fail → throws AllProvidersFailedError with attempts", async () => {
    const aErr = new ProviderError("a", "http_5xx");
    const bErr = new ProviderError("b", "http_4xx");
    const a = fakeProvider("gemini", { classify: aErr });
    const b = fakeProvider("groq", { classify: bErr });
    const router = createLLMRouter({
      providers: [a, b],
      chains: { classify: ["gemini", "groq"] },
    });
    await expect(router.classify({ utterance: "u" })).rejects.toBeInstanceOf(
      AllProvidersFailedError,
    );
    try {
      await router.classify({ utterance: "u" });
    } catch (err) {
      const e = err as AllProvidersFailedError;
      expect(e.attempts.map((x) => x.reason)).toEqual(["http_5xx", "http_4xx"]);
      // EH-3: AttemptRecord carries the underlying error for debuggability.
      expect(e.attempts[0]?.error).toBe(aErr);
      expect(e.attempts[1]?.error).toBe(bErr);
    }
  });

  it("empty chain → throws NoProviderError", async () => {
    const router = createLLMRouter({ providers: [], chains: {} });
    await expect(router.classify({ utterance: "u" })).rejects.toBeInstanceOf(NoProviderError);
  });

  it("chain with no registered provider → NoConfiguredProvidersError before any attempt", async () => {
    // Dashboards should distinguish "every entry's API key is unset"
    // (config bug) from "every entry returned errors" (provider outage).
    const router = createLLMRouter({
      providers: [],
      chains: { plan: ["gemini", "groq"] },
    });
    await expect(
      router.plan({ goal: "g", schema: "s", dialect: "postgres" }),
    ).rejects.toBeInstanceOf(NoConfiguredProvidersError);
  });
});

describe("createLLMRouter — timeouts", () => {
  it("aborts a hung provider after the per-op timeout and falls through", async () => {
    // Provider hangs forever unless its signal aborts.
    const a = fakeProvider("gemini", {
      plan: (_req, opts) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    });
    const b = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a, b],
      chains: { plan: ["gemini", "groq"] },
      timeouts: { plan: 30 },
    });
    const result = await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    expect(result.sql).toBe("-- groq");
    await telemetry.collectMetrics();
    const failover = metric(telemetry, "nlqdb.llm.failover.total");
    expect(failover?.dataPoints[0]?.attributes["reason"]).toBe("timeout");
  });

  it("propagates the per-call signal so providers can wire it to fetch", async () => {
    let captured: AbortSignal | undefined;
    const a = fakeProvider("groq", {
      classify: async (_req, opts) => {
        captured = opts?.signal;
        return { intent: "meta", confidence: 1 };
      },
    });
    const router = createLLMRouter({
      providers: [a],
      chains: { classify: ["groq"] },
    });
    await router.classify({ utterance: "u" });
    expect(captured).toBeDefined();
    expect(captured).toBeInstanceOf(AbortSignal);
  });
});

describe("createLLMRouter — caller cancellation", () => {
  it("when caller's signal aborts mid-chain, propagates instead of falling through", async () => {
    const ctrl = new AbortController();
    const a = fakeProvider("gemini", {
      plan: async () => {
        // Caller cancels while the first provider is in flight; the
        // router must not start the next provider.
        ctrl.abort(new Error("user cancelled"));
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      },
    });
    const b = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a, b],
      chains: { plan: ["gemini", "groq"] },
    });
    await expect(
      router.plan({ goal: "g", schema: "s", dialect: "postgres" }, { signal: ctrl.signal }),
    ).rejects.toThrow();
    expect(b.calls).toHaveLength(0);
  });

  it("propagates the caller's abort reason verbatim (not the inner provider error)", async () => {
    // The router previously rethrew `result.error` (the inner
    // AbortError or wrapped ProviderError), losing the caller's
    // `controller.abort(reason)` value. Callers that check the
    // signal.reason for a UX-meaningful message would see a generic
    // timeout error instead.
    const ctrl = new AbortController();
    const cancelReason = new Error("user navigated away");
    const a = fakeProvider("gemini", {
      plan: async () => {
        ctrl.abort(cancelReason);
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      },
    });
    const router = createLLMRouter({
      providers: [a],
      chains: { plan: ["gemini"] },
    });
    await expect(
      router.plan({ goal: "g", schema: "s", dialect: "postgres" }, { signal: ctrl.signal }),
    ).rejects.toBe(cancelReason);
  });

  it("synthesises an AbortError when caller calls abort() with no reason", async () => {
    // `controller.abort()` with no argument leaves `signal.reason` as
    // a built-in DOMException("...", "AbortError"); the router should
    // either propagate that (as-is) or its own AbortError-named Error.
    const ctrl = new AbortController();
    const a = fakeProvider("gemini", {
      plan: async () => {
        ctrl.abort();
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      },
    });
    const router = createLLMRouter({
      providers: [a],
      chains: { plan: ["gemini"] },
    });
    let caught: unknown;
    try {
      await router.plan({ goal: "g", schema: "s", dialect: "postgres" }, { signal: ctrl.signal });
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).name).toBe("AbortError");
  });
});

describe("createLLMRouter — circuit breaker", () => {
  // Per-isolate state lives in the router; each test creates a fresh
  // router so breaker state doesn't leak between cases.

  it("opens after failureThreshold consecutive failures and skips the provider", async () => {
    const flaky = fakeProvider("gemini", {
      plan: new ProviderError("upstream 502", "http_5xx", 502),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [flaky, healthy],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 2, cooldownMs: 60_000 },
    });

    // Two failures from flaky → breaker opens. Healthy serves both.
    for (let i = 0; i < 2; i++) {
      const res = await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
      expect(res.sql).toBe("select 1");
    }
    expect(flaky.calls).toHaveLength(2);

    // Third request — flaky should NOT be called (circuit_open).
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    expect(flaky.calls).toHaveLength(2);
    expect(healthy.calls).toHaveLength(3);
  });

  it("a single success resets the failure counter", async () => {
    let mode: "fail" | "ok" = "fail";
    const flaky = fakeProvider("gemini", {
      plan: () =>
        mode === "fail"
          ? Promise.reject(new ProviderError("upstream 502", "http_5xx", 502))
          : Promise.resolve({ sql: "select 1" }),
    });
    const fallback = fakeProvider("groq", { plan: { sql: "fallback" } });
    const router = createLLMRouter({
      providers: [flaky, fallback],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 3, cooldownMs: 60_000 },
    });

    // 1 failure → breaker still closed
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    expect(flaky.calls).toHaveLength(1);

    // Switch flaky to ok; success resets counter
    mode = "ok";
    const res = await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    expect(res.sql).toBe("select 1");

    // Switch back to fail; the fresh counter needs 3 failures to trip.
    // The 3rd post-success failure DOES still hit flaky (the counter
    // increments to 3 inside that very call); only a hypothetical 4th
    // would be skipped via circuit_open.
    mode = "fail";
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // counter 0→1, attempted
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // counter 1→2, attempted
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // counter 2→3, attempted, breaker now open
    // 1 (initial fail) + 1 (success) + 3 (post-reset fails) = 5 total calls.
    expect(flaky.calls).toHaveLength(5);
  });

  it("emits llm.failover.total{reason: 'circuit_open'} when the breaker is open", async () => {
    const flaky = fakeProvider("gemini", {
      plan: new ProviderError("upstream 502", "http_5xx", 502),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [flaky, healthy],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 1, cooldownMs: 60_000 },
    });

    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // opens
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // skipped → groq

    await telemetry.collectMetrics();
    const counter = metric(telemetry, "nlqdb.llm.failover.total");
    const circuitPoint = counter?.dataPoints.find(
      (dp) => dp.attributes["reason"] === "circuit_open",
    );
    expect(circuitPoint).toBeDefined();
  });

  it("emits a circuit_open span for the skipped provider", async () => {
    // Without this span, traces show no evidence the breaker rejected
    // anything — operators can't tell the breaker fired vs. the request
    // never happening. Span carries gen_ai.* attrs + nlqdb.llm.circuit_open=true.
    const flaky = fakeProvider("gemini", {
      plan: new ProviderError("upstream 502", "http_5xx", 502),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [flaky, healthy],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 1, cooldownMs: 60_000 },
    });

    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // opens
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // gemini circuit_open → groq

    const spans = telemetry.spanExporter.getFinishedSpans();
    const skipSpan = spans.find(
      (s) =>
        s.attributes["llm.provider"] === "gemini" &&
        s.attributes["nlqdb.llm.circuit_open"] === true,
    );
    expect(skipSpan, "expected a circuit_open span for gemini").toBeDefined();
    expect(skipSpan?.name).toBe("llm.plan");
  });

  it("does NOT count 401/403 as breaker failures (config bug, not outage)", async () => {
    // A bad/missing API key surfaces as 401. Counting it against the
    // breaker just delays surfacing the real config error AND tricks
    // dashboards into thinking the upstream is unhealthy.
    const misconfigured = fakeProvider("gemini", {
      plan: new ProviderError("invalid_api_key", "http_4xx", 401),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [misconfigured, healthy],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 2, cooldownMs: 60_000 },
    });

    // Five consecutive 401s — well past the threshold of 2. If 401
    // counted, gemini would be skipped after request #2.
    for (let i = 0; i < 5; i++) {
      await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    }
    expect(misconfigured.calls).toHaveLength(5);
  });

  it("403 also bypasses the breaker (forbidden = config, not outage)", async () => {
    const forbidden = fakeProvider("gemini", {
      plan: new ProviderError("forbidden", "http_4xx", 403),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [forbidden, healthy],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 2, cooldownMs: 60_000 },
    });
    for (let i = 0; i < 4; i++) {
      await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    }
    expect(forbidden.calls).toHaveLength(4);
  });

  it("DOES count 429 as a breaker failure (rate limit signals real load)", async () => {
    // 429 stays in the breaker bucket — at sustained rate-limit-exhaustion
    // the provider IS effectively down for this caller and we want
    // failover to trigger. (If the user wants per-status policy they can
    // override at the router config.)
    const ratelimited = fakeProvider("gemini", {
      plan: new ProviderError("rate limited", "http_4xx", 429),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [ratelimited, healthy],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 2, cooldownMs: 60_000 },
    });
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // counter 1
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // counter 2 → opens
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // skipped
    expect(ratelimited.calls).toHaveLength(2);
  });
});
