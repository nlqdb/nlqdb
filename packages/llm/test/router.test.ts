import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AllProvidersFailedError, createLLMRouter, NoProviderError } from "../src/router.ts";
import {
  type ClassifyRequest,
  type ClassifyResponse,
  type PlanRequest,
  type PlanResponse,
  type Provider,
  ProviderError,
  type ProviderName,
  type SummarizeRequest,
  type SummarizeResponse,
} from "../src/types.ts";

// Fake provider — every operation returns or throws what the test
// stubs. Keeps router tests synchronous and free of HTTP mocks.
type Stub<R> = R | ProviderError | Error;

function fakeProvider(
  name: ProviderName,
  stubs: {
    classify?: Stub<ClassifyResponse>;
    plan?: Stub<PlanResponse>;
    summarize?: Stub<SummarizeResponse>;
  } = {},
): Provider & { calls: { op: string; req: unknown }[] } {
  const calls: { op: string; req: unknown }[] = [];
  function maybeThrow<T>(stub: Stub<T> | undefined, fallback: T): T {
    if (stub instanceof Error) throw stub;
    return stub ?? fallback;
  }
  return {
    name,
    calls,
    model: () => `${name}-model`,
    async classify(req: ClassifyRequest) {
      calls.push({ op: "classify", req });
      return maybeThrow(stubs.classify, { intent: "data_query", confidence: 1 });
    },
    async plan(req: PlanRequest) {
      calls.push({ op: "plan", req });
      return maybeThrow(stubs.plan, { sql: `-- ${name}` });
    },
    async summarize(req: SummarizeRequest) {
      calls.push({ op: "summarize", req });
      return maybeThrow(stubs.summarize, { summary: name });
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

  it("non-ProviderError exceptions are classified reason=network", async () => {
    const a = fakeProvider("gemini", { plan: new Error("random") });
    const b = fakeProvider("groq");
    const router = createLLMRouter({
      providers: [a, b],
      chains: { plan: ["gemini", "groq"] },
    });
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" });
    await telemetry.collectMetrics();
    const failover = metric(telemetry, "nlqdb.llm.failover.total");
    expect(failover?.dataPoints[0]?.attributes["reason"]).toBe("network");
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
    const a = fakeProvider("gemini", {
      classify: new ProviderError("a", "http_5xx"),
    });
    const b = fakeProvider("groq", {
      classify: new ProviderError("b", "http_4xx"),
    });
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
    }
  });

  it("empty chain → throws NoProviderError", async () => {
    const router = createLLMRouter({ providers: [], chains: {} });
    await expect(router.classify({ utterance: "u" })).rejects.toBeInstanceOf(NoProviderError);
  });
});
