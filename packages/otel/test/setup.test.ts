import { metrics, trace } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dbDurationMs } from "../src/index.ts";
import { createTestTelemetry, type TestTelemetry } from "../src/test.ts";

let telemetry: TestTelemetry;

beforeEach(() => {
  telemetry = createTestTelemetry();
});

afterEach(() => {
  telemetry.reset();
});

describe("createTestTelemetry", () => {
  it("installs a global tracer that records to the in-memory exporter", async () => {
    const tracer = trace.getTracer("test");
    tracer.startActiveSpan("test.span", (span) => {
      span.setAttribute("k", "v");
      span.end();
    });
    const spans = telemetry.spanExporter.getFinishedSpans();
    expect(spans.map((s) => s.name)).toEqual(["test.span"]);
    expect(spans[0]?.attributes["k"]).toBe("v");
  });

  it("installs a global meter that surfaces collected histograms", async () => {
    const histogram = metrics.getMeter("test").createHistogram("test.duration_ms", { unit: "ms" });
    histogram.record(42, { route: "/v1/test" });
    await telemetry.collectMetrics();
    const all = telemetry.metricExporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics));
    const found = all.find((m) => m.descriptor.name === "test.duration_ms");
    expect(found).toBeDefined();
    expect(found?.dataPoints[0]?.attributes["route"]).toBe("/v1/test");
  });

  it("dbDurationMs() returns the canonical histogram bound to the global meter", async () => {
    dbDurationMs().record(7, { operation: "SELECT" });
    await telemetry.collectMetrics();
    const all = telemetry.metricExporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics));
    const found = all.find((m) => m.descriptor.name === "nlqdb.db.duration_ms");
    expect(found).toBeDefined();
    expect(found?.descriptor.unit).toBe("ms");
  });
});
