import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AllProvidersFailedError,
  createLLMRouter,
  NoConfiguredProvidersError,
  NoProviderError,
} from "../src/router.ts";
import {
  type CallOpts,
  type EngineClassifyResponse,
  type PlanResponse,
  type Provider,
  ProviderError,
  type ProviderName,
  type RouteRequest,
  type RouteResponse,
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

const ROUTE_OK: RouteResponse = {
  kind: "query",
  targetDbId: null,
  referencedTables: [],
  confidence: 1,
  reason: "stub",
};

const ROUTE_REQ: RouteRequest = {
  goal: "g",
  dbs: [],
  recentTables: [],
};

// `plan` stubs accept a partial PlanResponse (just `sql`); the
// SK-TRUST-002 `model` + `confidence` fields default to the fake's
// name + 1.0 so existing tests stay terse.
type PlanStubShape = Partial<PlanResponse> & Pick<PlanResponse, "sql">;
function fakeProvider(
  name: ProviderName,
  stubs: {
    route?: Stub<RouteResponse>;
    plan?: Stub<PlanStubShape>;
    summarize?: Stub<SummarizeResponse>;
    schemaInfer?: Stub<SchemaInferResponse>;
    engineClassify?: Stub<EngineClassifyResponse>;
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
    async route(req, opts) {
      calls.push({ op: "route", req, opts });
      return resolve(stubs.route, ROUTE_OK, req, opts);
    },
    async plan(req, opts) {
      calls.push({ op: "plan", req, opts });
      const out = await resolve<PlanStubShape>(stubs.plan, { sql: `-- ${name}` }, req, opts);
      return { model: `${name}-model`, confidence: 1.0, ...out };
    },
    async summarize(req, opts) {
      calls.push({ op: "summarize", req, opts });
      return resolve(stubs.summarize, { summary: name }, req, opts);
    },
    async schemaInfer(req, opts) {
      calls.push({ op: "schemaInfer", req, opts });
      return resolve(stubs.schemaInfer, { plan: { provider: name } }, req, opts);
    },
    async engineClassify(req, opts) {
      calls.push({ op: "engineClassify", req, opts });
      return resolve(stubs.engineClassify, { engine: "postgres", confidence: 1 }, req, opts);
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
  it("route returns the first provider's response", async () => {
    const a = fakeProvider("groq", {
      route: { ...ROUTE_OK, kind: "create", confidence: 0.9, reason: "no_dbs" },
    });
    const router = createLLMRouter({
      providers: [a],
      chains: { route: ["groq"] },
    });
    const res = await router.route(ROUTE_REQ);
    expect(res.kind).toBe("create");
    expect(res.confidence).toBe(0.9);
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

  it("route emits an llm.route span (SK-ASK-009)", async () => {
    const a = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a],
      chains: { route: ["groq"] },
    });
    await router.route(ROUTE_REQ);
    const span = telemetry.spanExporter.getFinishedSpans().find((s) => s.name === "llm.route");
    expect(span).toBeDefined();
    expect(span?.attributes["llm.provider"]).toBe("groq");
  });

  it("engineClassify routes through the engine_classify chain (SK-DB-010)", async () => {
    const a = fakeProvider("groq", { engineClassify: { engine: "clickhouse", confidence: 0.9 } });
    const router = createLLMRouter({
      providers: [a],
      chains: { engine_classify: ["groq"] },
    });
    const res = await router.engineClassify({ goal: "events tracker" });
    expect(res).toEqual({ engine: "clickhouse", confidence: 0.9 });
    expect(a.calls.map((c) => c.op)).toEqual(["engineClassify"]);
  });

  it("engineClassify emits an llm.engine_classify span", async () => {
    const a = fakeProvider("groq", { engineClassify: { engine: "postgres", confidence: 0.95 } });
    const router = createLLMRouter({
      providers: [a],
      chains: { engine_classify: ["groq"] },
    });
    await router.engineClassify({ goal: "tracker app" });
    const span = telemetry.spanExporter
      .getFinishedSpans()
      .find((s) => s.name === "llm.engine_classify");
    expect(span).toBeDefined();
    expect(span?.attributes["llm.provider"]).toBe("groq");
  });
});

describe("createLLMRouter — failover", () => {
  it("falls through on first provider failure and uses second", async () => {
    const a = fakeProvider("gemini", {
      plan: new ProviderError("rate limited", "rate_limited", {
        status: 429,
        retryAfterMs: 30_000,
      }),
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
      plan: new ProviderError("boom", "http_5xx", { status: 503 }),
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
      route: new ProviderError("net", "network"),
    });
    const b = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a, b],
      chains: { route: ["gemini", "groq"] },
    });
    await router.route(ROUTE_REQ);
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
    const a = fakeProvider("gemini", { route: aErr });
    const b = fakeProvider("groq", { route: bErr });
    const router = createLLMRouter({
      providers: [a, b],
      chains: { route: ["gemini", "groq"] },
    });
    await expect(router.route(ROUTE_REQ)).rejects.toBeInstanceOf(AllProvidersFailedError);
    try {
      await router.route(ROUTE_REQ);
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
    await expect(router.route(ROUTE_REQ)).rejects.toBeInstanceOf(NoProviderError);
  });

  // SK-LLM-038 — the chain tail has no fallback, so a transient blip on
  // it (the `mistral:network` on the planner-tier backstop, SK-LLM-028)
  // is retried once before the router declares total failure.
  describe("tail transient retry (SK-LLM-038)", () => {
    const PLAN_REQ = { goal: "g", schema: "s", dialect: "postgres" as const };

    it("retries the tail once on `network` and recovers", async () => {
      let n = 0;
      const tail = fakeProvider("mistral", {
        plan: async () => {
          n += 1;
          if (n === 1) throw new ProviderError("blip", "network");
          return { sql: "SELECT 1" };
        },
      });
      const router = createLLMRouter({ providers: [tail], chains: { plan: ["mistral"] } });
      const res = await router.plan(PLAN_REQ);
      expect(res.sql).toBe("SELECT 1");
      expect(tail.calls).toHaveLength(2); // first attempt + one retry
    });

    it("retries the tail once on `http_5xx` too", async () => {
      let n = 0;
      const tail = fakeProvider("mistral", {
        plan: async () => {
          n += 1;
          if (n === 1) throw new ProviderError("503", "http_5xx", { status: 503 });
          return { sql: "SELECT 2" };
        },
      });
      const router = createLLMRouter({ providers: [tail], chains: { plan: ["mistral"] } });
      const res = await router.plan(PLAN_REQ);
      expect(res.sql).toBe("SELECT 2");
      expect(tail.calls).toHaveLength(2);
    });

    it("retries at most once — a persistently failing tail still throws", async () => {
      const tail = fakeProvider("mistral", { plan: new ProviderError("down", "network") });
      const router = createLLMRouter({ providers: [tail], chains: { plan: ["mistral"] } });
      await expect(router.plan(PLAN_REQ)).rejects.toBeInstanceOf(AllProvidersFailedError);
      expect(tail.calls).toHaveLength(2); // bounded: original + single retry, no loop
    });

    it("does not retry non-transient tail reasons (http_4xx / rate_limited)", async () => {
      const tail = fakeProvider("mistral", { plan: new ProviderError("bad", "http_4xx") });
      const router = createLLMRouter({ providers: [tail], chains: { plan: ["mistral"] } });
      await expect(router.plan(PLAN_REQ)).rejects.toBeInstanceOf(AllProvidersFailedError);
      expect(tail.calls).toHaveLength(1); // request-shaped → no retry
    });

    it("only the tail retries — a mid-chain transient failure fails over instead", async () => {
      const head = fakeProvider("gemini", { plan: new ProviderError("blip", "network") });
      const tail = fakeProvider("groq", { plan: { sql: "SELECT 3" } });
      const router = createLLMRouter({
        providers: [head, tail],
        chains: { plan: ["gemini", "groq"] },
      });
      const res = await router.plan(PLAN_REQ);
      expect(res.sql).toBe("SELECT 3");
      expect(head.calls).toHaveLength(1); // failed over, not retried in place
      expect(tail.calls).toHaveLength(1);
    });
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
      route: async (_req, opts) => {
        captured = opts?.signal;
        return ROUTE_OK;
      },
    });
    const router = createLLMRouter({
      providers: [a],
      chains: { route: ["groq"] },
    });
    await router.route(ROUTE_REQ);
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
      plan: new ProviderError("upstream 502", "http_5xx", { status: 502 }),
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
          ? Promise.reject(new ProviderError("upstream 502", "http_5xx", { status: 502 }))
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
      plan: new ProviderError("upstream 502", "http_5xx", { status: 502 }),
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
      plan: new ProviderError("upstream 502", "http_5xx", { status: 502 }),
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

  it("SK-LLM-039 — does NOT count auth_denied (401/403) as breaker failures (config bug, not outage)", async () => {
    // A bad/missing API key surfaces as auth_denied. Counting it against
    // the breaker just delays surfacing the real config error AND tricks
    // dashboards into thinking the upstream is unhealthy. The distinct
    // reason already makes the dead provider legible without the breaker.
    const misconfigured = fakeProvider("gemini", {
      plan: new ProviderError("invalid_api_key", "auth_denied", { status: 401 }),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [misconfigured, healthy],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 2, cooldownMs: 60_000 },
    });

    // Five consecutive denials — well past the threshold of 2. If
    // auth_denied counted, gemini would be skipped after request #2.
    for (let i = 0; i < 5; i++) {
      await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    }
    expect(misconfigured.calls).toHaveLength(5);
  });

  it("SK-LLM-039 — a denied provider surfaces reason=auth_denied in the chain-failure summary", async () => {
    // The observability win: when the whole chain fails, a denied
    // provider reads as `gemini:auth_denied` (project locked out), not an
    // opaque `gemini:http_4xx` lumped with per-question bad requests.
    const denied = fakeProvider("gemini", {
      plan: new ProviderError("project denied access", "auth_denied", { status: 403 }),
    });
    const alsoDown = fakeProvider("groq", {
      plan: new ProviderError("boom", "http_5xx", { status: 503 }),
    });
    const router = createLLMRouter({
      providers: [denied, alsoDown],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 3, cooldownMs: 60_000 },
    });
    await expect(router.plan({ goal: "g", schema: "s", dialect: "postgres" })).rejects.toMatchObject(
      {
        attempts: [
          expect.objectContaining({ provider: "gemini", reason: "auth_denied" }),
          expect.objectContaining({ provider: "groq", reason: "http_5xx" }),
        ],
      },
    );
  });

  it("SK-LLM-030 — a non-429 4xx still uses the 3-strike path (not the 429 immediate-open path)", async () => {
    // 400/422 etc. are not "back off now" signals — they go through the
    // normal failureThreshold counter, unlike a 429 (covered below).
    const flaky = fakeProvider("gemini", {
      plan: new ProviderError("bad request", "http_4xx", { status: 400 }),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [flaky, healthy],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 3, cooldownMs: 60_000 },
    });
    // Three attempts hit gemini (counter 1→2→3, opens on the 3rd); a 429
    // would have opened after the very first.
    for (let i = 0; i < 3; i++) {
      await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    }
    expect(flaky.calls).toHaveLength(3);
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // breaker open → skipped
    expect(flaky.calls).toHaveLength(3);
  });
});

describe("createLLMRouter — rate-limit cooldown (SK-LLM-030)", () => {
  it("a 429 opens the breaker immediately for the Retry-After window and rotates", async () => {
    // A 429 is an unambiguous "back off now": unlike a flaky 5xx (which
    // needs failureThreshold strikes), one 429 opens the breaker for the
    // server's window. The next call within the window skips the
    // rate-limited provider and rotates; after it, the provider is retried.
    vi.useFakeTimers();
    try {
      // Base at a realistic epoch — the breaker's "never opened" sentinel
      // is openedAt===0, so a fake clock at 0 would alias it.
      const t0 = 1_700_000_000_000;
      vi.setSystemTime(t0);
      const limited = fakeProvider("gemini", {
        plan: new ProviderError("rate limited", "rate_limited", {
          status: 429,
          retryAfterMs: 30_000,
        }),
      });
      const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
      const router = createLLMRouter({
        providers: [limited, healthy],
        chains: { plan: ["gemini", "groq"] },
        // Low default cooldown so the test proves the 30s Retry-After
        // window (not the 1s default) governs the breaker.
        circuitBreaker: { failureThreshold: 3, cooldownMs: 1_000 },
      });

      // One 429 → breaker opens (no 3-strike wait), rotate to groq.
      const r1 = await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
      expect(r1.sql).toBe("select 1");
      expect(limited.calls).toHaveLength(1);
      expect(healthy.calls).toHaveLength(1);

      // Still inside the 30s window (and well past the 1s default): skipped.
      vi.setSystemTime(t0 + 29_000);
      await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
      expect(limited.calls).toHaveLength(1);

      // After the window: breaker closed, gemini retried.
      vi.setSystemTime(t0 + 31_000);
      await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
      expect(limited.calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("caps the honored cooldown so a long Retry-After can't wedge the router", async () => {
    // A provider sending a 1-hour Retry-After must not pin the prod
    // router for an hour — maxRateLimitCooldownMs caps it (default 5 min;
    // 2s here). After the cap elapses the provider is retried.
    vi.useFakeTimers();
    try {
      const t0 = 1_700_000_000_000;
      vi.setSystemTime(t0);
      const limited = fakeProvider("gemini", {
        plan: new ProviderError("slow down", "rate_limited", {
          status: 429,
          retryAfterMs: 60 * 60_000, // 1 hour
        }),
      });
      const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
      const router = createLLMRouter({
        providers: [limited, healthy],
        chains: { plan: ["gemini", "groq"] },
        circuitBreaker: { failureThreshold: 3, cooldownMs: 1_000 },
        maxRateLimitCooldownMs: 2_000,
      });
      await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
      expect(limited.calls).toHaveLength(1);
      // Past the 2s cap (but nowhere near the hour the server asked for).
      vi.setSystemTime(t0 + 2_500);
      await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
      expect(limited.calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a 429 (status 429) is NOT treated as an auth-bypass — the breaker opens", async () => {
    // Regression guard: the breaker-skip keys off reason==='auth_denied'
    // (SK-LLM-039). A rate_limited error carries a 4xx-class status (429)
    // but its reason is not auth_denied, so it must NOT fall into the
    // auth-bypass branch — it has to open the breaker. (If it were
    // bypassed, gemini would be retried every call.)
    const limited = fakeProvider("gemini", {
      plan: new ProviderError("rate limited", "rate_limited", { status: 429 }),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [limited, healthy],
      chains: { plan: ["gemini", "groq"] },
      circuitBreaker: { failureThreshold: 3, cooldownMs: 60_000 },
    });
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // opens immediately
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }); // gemini skipped
    expect(limited.calls).toHaveLength(1);
  });

  it("emits nlqdb.llm.failover.total{reason: 'rate_limited'} on rotation", async () => {
    const limited = fakeProvider("gemini", {
      plan: new ProviderError("rate limited", "rate_limited", {
        status: 429,
        retryAfterMs: 30_000,
      }),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [limited, healthy],
      chains: { plan: ["gemini", "groq"] },
    });
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    await telemetry.collectMetrics();
    const failover = metric(telemetry, "nlqdb.llm.failover.total");
    const point = failover?.dataPoints.find((dp) => dp.attributes["reason"] === "rate_limited");
    expect(point, "expected a rate_limited failover point").toBeDefined();
    expect(point?.attributes["from_provider"]).toBe("gemini");
    expect(point?.attributes["to_provider"]).toBe("groq");
  });

  it("sets nlqdb.llm.retry_after_ms on the rate-limited attempt span", async () => {
    const limited = fakeProvider("gemini", {
      plan: new ProviderError("rate limited", "rate_limited", {
        status: 429,
        retryAfterMs: 30_000,
      }),
    });
    const healthy = fakeProvider("groq", { plan: { sql: "select 1" } });
    const router = createLLMRouter({
      providers: [limited, healthy],
      chains: { plan: ["gemini", "groq"] },
    });
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    const span = telemetry.spanExporter
      .getFinishedSpans()
      .find((s) => s.attributes["llm.provider"] === "gemini");
    expect(span?.attributes["nlqdb.llm.retry_after_ms"]).toBe(30_000);
  });
});

describe("createLLMRouter — hedged race (SK-LLM-014)", () => {
  it("primary fast: skips the hedge entirely (no secondary call)", async () => {
    const primary = fakeProvider("gemini", {
      schemaInfer: { plan: { from: "gemini" } },
    });
    const secondary = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [primary, secondary],
      chains: { schema_infer: ["gemini", "groq"] },
      hedge: { schema_infer: { afterMs: 50 } },
    });
    const res = await router.schemaInfer({ goal: "g" });
    expect(res.plan).toEqual({ from: "gemini" });
    expect(secondary.calls).toHaveLength(0);
  });

  it("primary slow: hedge fires after the delay; secondary wins", async () => {
    // Primary hangs forever; secondary returns fast. With a 30ms
    // head-start the hedge fires and secondary's answer wins.
    const primary = fakeProvider("gemini", {
      schemaInfer: (_req, opts) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    });
    const secondary = fakeProvider("groq", {
      schemaInfer: { plan: { from: "groq" } },
    });
    const router = createLLMRouter({
      providers: [primary, secondary],
      chains: { schema_infer: ["gemini", "groq"] },
      hedge: { schema_infer: { afterMs: 30 } },
    });
    const res = await router.schemaInfer({ goal: "g" });
    expect(res.plan).toEqual({ from: "groq" });
    // Primary's signal got aborted with HEDGE_LOST — its leg returned
    // hedge_lost, NOT timeout. (The circuit-breaker test below pins
    // this: hedge_lost mustn't open the breaker.)
  });

  it("primary fails inside head-start: skips hedge, falls through sequentially", async () => {
    // Primary fails fast (well within head-start). With only 2 providers
    // in chain, we just see primary fail and we return that. (No 3rd
    // provider to fall through to.)
    const primary = fakeProvider("gemini", {
      schemaInfer: new ProviderError("boom", "http_5xx", { status: 500 }),
    });
    const secondary = fakeProvider("groq", {
      schemaInfer: { plan: { from: "groq" } },
    });
    const router = createLLMRouter({
      providers: [primary, secondary],
      chains: { schema_infer: ["gemini", "groq"] },
      hedge: { schema_infer: { afterMs: 100 } },
    });
    const res = await router.schemaInfer({ goal: "g" });
    expect(res.plan).toEqual({ from: "groq" });
    // Primary attempted; secondary attempted sequentially after primary
    // failed within the head-start.
    expect(primary.calls).toHaveLength(1);
    expect(secondary.calls).toHaveLength(1);
  });

  it("hedge_lost on secondary does NOT open the circuit breaker", async () => {
    // Primary returns OK quickly; secondary fired (head-start short) then
    // got aborted with HEDGE_LOST. The aborted leg must not count
    // against the secondary's breaker — otherwise repeated successful
    // hedges would trip every fallback provider in the chain.
    const primary = fakeProvider("gemini", {
      schemaInfer: async () => {
        // Delay just enough that secondary fires.
        await new Promise((r) => setTimeout(r, 40));
        return { plan: { from: "gemini" } };
      },
    });
    let secondaryAborts = 0;
    const secondary = fakeProvider("groq", {
      schemaInfer: (_req, opts) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            secondaryAborts++;
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    });
    const router = createLLMRouter({
      providers: [primary, secondary],
      chains: { schema_infer: ["gemini", "groq"] },
      hedge: { schema_infer: { afterMs: 10 } },
      circuitBreaker: { failureThreshold: 1, cooldownMs: 60_000 },
    });

    // Run twice — if hedge_lost opened the breaker on round 1, round 2
    // would skip secondary entirely (circuit_open). secondary.calls
    // would only see 1 attempt.
    await router.schemaInfer({ goal: "g" });
    await router.schemaInfer({ goal: "g" });

    expect(secondary.calls).toHaveLength(2);
    expect(secondaryAborts).toBe(2);
  });

  it("emits llm.failover.total{reason: 'hedge_lost'} when the hedge actually fires", async () => {
    const primary = fakeProvider("gemini", {
      schemaInfer: async () => {
        await new Promise((r) => setTimeout(r, 40));
        return { plan: { from: "gemini" } };
      },
    });
    const secondary = fakeProvider("groq", {
      schemaInfer: (_req, opts) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    });
    const router = createLLMRouter({
      providers: [primary, secondary],
      chains: { schema_infer: ["gemini", "groq"] },
      hedge: { schema_infer: { afterMs: 10 } },
    });
    await router.schemaInfer({ goal: "g" });
    await telemetry.collectMetrics();
    const failover = metric(telemetry, "nlqdb.llm.failover.total");
    const hedgeFire = failover?.dataPoints.find((dp) => dp.attributes["reason"] === "hedge_lost");
    expect(hedgeFire).toBeDefined();
    expect(hedgeFire?.attributes["from_provider"]).toBe("groq");
    expect(hedgeFire?.attributes["to_provider"]).toBe("gemini");
  });

  it("non-hedged ops still run sequentially (no race when hedge cfg omits the op)", async () => {
    // `plan` is hedged below; `route` is not. Even though both share
    // the same chain shape, only the configured ops race.
    const primary = fakeProvider("gemini", {
      route: { ...ROUTE_OK, kind: "create", confidence: 0.9, reason: "no_dbs" },
    });
    const secondary = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [primary, secondary],
      chains: { route: ["gemini", "groq"], plan: ["gemini", "groq"] },
      hedge: { plan: { afterMs: 10 } }, // only plan, not route
    });
    await router.route(ROUTE_REQ);
    expect(primary.calls).toHaveLength(1);
    expect(secondary.calls).toHaveLength(0);
  });

  it("only one eligible provider → no hedge, normal sequential", async () => {
    // Chain has 2 entries but only one is configured (`workers-ai`
    // missing from providers list). The hedge code finds only one
    // eligible and falls through to the sequential path.
    const a = fakeProvider("gemini", { schemaInfer: { plan: { from: "gemini" } } });
    const router = createLLMRouter({
      providers: [a],
      chains: { schema_infer: ["gemini", "workers-ai"] },
      hedge: { schema_infer: { afterMs: 10 } },
    });
    const res = await router.schemaInfer({ goal: "g" });
    expect(res.plan).toEqual({ from: "gemini" });
    expect(a.calls).toHaveLength(1);
  });

  it("hedge loser's span has hedge_lost attribute and NOT ERROR status", async () => {
    // Regression for the dashboards-over-count-errors issue.
    // Cancelled hedge legs must mark the span with
    // `nlqdb.llm.hedge_lost: true` and leave status non-ERROR so
    // Tempo's error filter doesn't count them, and the
    // `llm.calls.total{status}` metric records `"hedge_lost"`, not
    // `"error"`, on the cancelled leg.
    const primary = fakeProvider("gemini", {
      schemaInfer: async () => {
        await new Promise((r) => setTimeout(r, 30));
        return { plan: { from: "gemini" } };
      },
    });
    const secondary = fakeProvider("groq", {
      schemaInfer: (_req, opts) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    });
    const router = createLLMRouter({
      providers: [primary, secondary],
      chains: { schema_infer: ["gemini", "groq"] },
      hedge: { schema_infer: { afterMs: 10 } },
    });
    await router.schemaInfer({ goal: "g" });

    const spans = telemetry.spanExporter.getFinishedSpans();
    const secondarySpan = spans.find(
      (s) => s.attributes["llm.provider"] === "groq" && s.name === "llm.schema_infer",
    );
    expect(secondarySpan).toBeDefined();
    expect(secondarySpan?.attributes["nlqdb.llm.hedge_lost"]).toBe(true);
    // SpanStatusCode.ERROR === 2 in @opentelemetry/api. Hedge cancel
    // must NOT carry ERROR status — successful hedge would otherwise
    // light up "errors" panels in Tempo.
    expect(secondarySpan?.status.code).not.toBe(2);

    await telemetry.collectMetrics();
    const callsMetric = metric(telemetry, "nlqdb.llm.calls.total");
    const hedgeLostBump = callsMetric?.dataPoints.find(
      (dp) => dp.attributes["status"] === "hedge_lost",
    );
    expect(hedgeLostBump).toBeDefined();
    expect(hedgeLostBump?.attributes["provider"]).toBe("groq");
  });

  it("removes the caller-signal 'abort' listener after the race completes", async () => {
    // Regression for the leak called out in PR #171 self-review (N1):
    // the bridge-listener `outer.addEventListener("abort", ...)` was
    // never paired with `removeEventListener`. With many hedged ops on
    // a long-lived caller signal, listeners accumulated. The fix
    // detaches the listener in a `finally` block after `Promise.all`.
    // Tested by spying on the AbortSignal proto methods.
    const ctrl = new AbortController();
    const addSpy = vi.spyOn(ctrl.signal, "addEventListener");
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");

    const primary = fakeProvider("gemini", {
      schemaInfer: { plan: { from: "gemini" } },
    });
    const secondary = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [primary, secondary],
      chains: { schema_infer: ["gemini", "groq"] },
      hedge: { schema_infer: { afterMs: 50 } },
    });
    await router.schemaInfer({ goal: "g" }, { signal: ctrl.signal });

    const abortAdds = addSpy.mock.calls.filter(([type]) => type === "abort");
    const abortRemoves = removeSpy.mock.calls.filter(([type]) => type === "abort");
    expect(abortAdds.length).toBeGreaterThan(0);
    // Every "abort" addEventListener must have a matching removeEventListener.
    expect(abortRemoves.length).toBe(abortAdds.length);
  });

  it("both hedged legs fail (slow): falls through to chain[2]", async () => {
    // Both primary AND secondary slow-fail (after head-start). The
    // sequential loop must resume from chain[2] — verifies
    // `chainStart = b.chainIdx + 1` accounting in dispatch.
    const primary = fakeProvider("gemini", {
      schemaInfer: async () => {
        await new Promise((r) => setTimeout(r, 20));
        throw new ProviderError("boom1", "http_5xx", { status: 503 });
      },
    });
    const secondary = fakeProvider("groq", {
      schemaInfer: async () => {
        await new Promise((r) => setTimeout(r, 30));
        throw new ProviderError("boom2", "http_5xx", { status: 503 });
      },
    });
    const third = fakeProvider("workers-ai", {
      schemaInfer: { plan: { from: "workers-ai" } },
    });
    const router = createLLMRouter({
      providers: [primary, secondary, third],
      chains: { schema_infer: ["gemini", "groq", "workers-ai"] },
      hedge: { schema_infer: { afterMs: 5 } },
    });
    const res = await router.schemaInfer({ goal: "g" });
    expect(res.plan).toEqual({ from: "workers-ai" });
    expect(primary.calls).toHaveLength(1);
    expect(secondary.calls).toHaveLength(1);
    expect(third.calls).toHaveLength(1);
  });
});
