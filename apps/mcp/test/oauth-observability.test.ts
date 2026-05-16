// SK-MCP-009 — OTel coverage for the OAuth-gate auth-failure counter (bearer-gate.test.ts covers the HTTP behaviour).

import type { TestTelemetry } from "@nlqdb/otel/test";
import { createTestTelemetry } from "@nlqdb/otel/test";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordOAuthError } from "../src/auth-failure.ts";

type CountPoint = { value: number; attributes: Record<string, string | number> };

function readMcpAuthFailures(telemetry: TestTelemetry): CountPoint[] {
  const out: CountPoint[] = [];
  for (const batch of telemetry.metricExporter.getMetrics()) {
    for (const scope of batch.scopeMetrics) {
      for (const m of scope.metrics) {
        if (m.descriptor.name !== "nlqdb.mcp.auth.failures.total") continue;
        for (const dp of m.dataPoints) {
          out.push({
            value: Number(dp.value),
            attributes: dp.attributes as Record<string, string | number>,
          });
        }
      }
    }
  }
  return out;
}

describe("recordOAuthError", () => {
  let telemetry: TestTelemetry;
  beforeEach(() => {
    telemetry = createTestTelemetry({ serviceName: "nlqdb-mcp-server" });
  });
  afterEach(async () => {
    await telemetry.handle.shutdown();
  });

  it("increments nlqdb.mcp.auth.failures.total with error_code + status labels", async () => {
    recordOAuthError({
      code: "invalid_token",
      description: "Bearer required",
      status: 401,
      headers: {},
    });
    recordOAuthError({
      code: "invalid_grant",
      description: "Code expired",
      status: 400,
      headers: {},
    });
    recordOAuthError({
      code: "invalid_token",
      description: "Bearer required",
      status: 401,
      headers: {},
    });
    await telemetry.collectMetrics();

    const points = readMcpAuthFailures(telemetry);
    const byKey = new Map(
      points.map((p) => [`${p.attributes["error_code"]}:${p.attributes["status"]}`, p.value]),
    );
    expect(byKey.get("invalid_token:401")).toBe(2);
    expect(byKey.get("invalid_grant:400")).toBe(1);
  });

  it("decorates the active request span with error_* attrs and flips it to ERROR", () => {
    const tracer = trace.getTracer("test");
    let attrs: Record<string, unknown> = {};
    let statusCode: SpanStatusCode | undefined;
    tracer.startActiveSpan("nlqdb.mcp.http.request", (span) => {
      recordOAuthError({
        code: "invalid_token",
        description: "Bearer required",
        status: 401,
        headers: {},
      });
      const finished = telemetry.spanExporter.getFinishedSpans();
      span.end();
      const last = telemetry.spanExporter.getFinishedSpans().at(-1);
      attrs = (last?.attributes ?? {}) as Record<string, unknown>;
      statusCode = last?.status.code;
      expect(finished.length).toBeLessThanOrEqual(1);
    });

    expect(attrs["nlqdb.mcp.auth.error_code"]).toBe("invalid_token");
    expect(attrs["nlqdb.mcp.auth.error_status"]).toBe(401);
    expect(attrs["nlqdb.mcp.auth.error_description"]).toBe("Bearer required");
    expect(statusCode).toBe(SpanStatusCode.ERROR);
  });
});
