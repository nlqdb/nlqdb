// Wrapper smoke test for `/api/auth/*` against real Better Auth under
// Miniflare. Exercises PERFORMANCE §4 row 5 — `nlqdb.auth.verify`
// span + `nlqdb.auth.events.total{type=verify, outcome=success}`
// counter on a non-callback path.
//
// **Coverage trade-off**: the previous test set also asserted the
// callback-failure path (4xx response → failure event) and the
// thrown-handler path (uncaught → 500). Both relied on `vi.mock` of
// `../src/auth.ts` to drive `auth.handler`'s response per case. That
// pattern doesn't propagate to the worker entrypoint loaded by
// SELF.fetch under `@cloudflare/vitest-pool-workers` — confirmed
// upstream bug `cloudflare/workers-sdk#10201` (open as of 2026-04).
// Reinstate when the upstream lands. Until then, commit 2's
// session-revocation integration tests exercise the wrapper end-to-end
// against real auth, which is stronger evidence than the dropped
// mocked unit tests.

import { SELF } from "cloudflare:test";
import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("/api/auth/* telemetry wrapper", () => {
  let telemetry: TestTelemetry;

  beforeEach(() => {
    telemetry = createTestTelemetry();
  });

  afterEach(() => {
    telemetry.reset();
  });

  async function metric(name: string) {
    await telemetry.collectMetrics();
    const all = telemetry.metricExporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics));
    return all.find((m) => m.descriptor.name === name);
  }

  it("emits nlqdb.auth.verify span + verify event on /api/auth/get-session", async () => {
    const res = await SELF.fetch("https://example.com/api/auth/get-session");
    expect(res.status).toBe(200);

    const spans = telemetry.spanExporter.getFinishedSpans();
    expect(spans.find((s) => s.name === "nlqdb.auth.verify")).toBeDefined();
    expect(spans.find((s) => s.name === "nlqdb.auth.oauth.callback")).toBeUndefined();

    const counter = await metric("nlqdb.auth.events.total");
    const point = counter?.dataPoints.find(
      (dp) => dp.attributes["type"] === "verify" && dp.attributes["outcome"] === "success",
    );
    expect(point).toBeDefined();
  });

  // Regression for the SK-AUTH-015 preview-auth bug. Top-level
  // cross-origin GET navigations (preview → app.nlqdb.com) don't
  // carry an `Origin` header. The wrapper builds an inner
  // `POST /sign-in/social` and Better Auth's `originCheckMiddleware`
  // rejects it with 403 MISSING_OR_NULL_ORIGIN unless the wrapper
  // synthesizes an Origin trusted by Better Auth. This test omits
  // the `Origin` header on the inbound GET to assert the synthesis
  // path; the `Location` assertion proves the inner POST cleared
  // the CSRF gate and produced a real OAuth redirect.
  it("/api/auth/oauth-init returns 302 to provider when inbound GET has no Origin", async () => {
    const callbackURL = "http://localhost:4321/";
    const res = await SELF.fetch(
      `https://example.com/api/auth/oauth-init/google?callbackURL=${encodeURIComponent(callbackURL)}`,
      { redirect: "manual" },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location") ?? "").toContain("accounts.google.com");

    const counter = await metric("nlqdb.auth.events.total");
    const point = counter?.dataPoints.find(
      (dp) => dp.attributes["type"] === "oauth_init" && dp.attributes["outcome"] === "success",
    );
    expect(point).toBeDefined();
  });
});
