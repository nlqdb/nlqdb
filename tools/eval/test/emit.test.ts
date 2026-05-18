import { describe, expect, it, mock } from "bun:test";

import { emitEvalReport } from "../src/emit.ts";
import type { EvalReport } from "../src/types.ts";

function reportFixture(): EvalReport {
  return {
    run_at: "2026-05-18T04:00:00Z",
    dataset: "bird-mini-dev-sqlite",
    question_count: 50,
    lanes: [
      {
        lane: "free",
        attempted: 50,
        match: 20,
        mismatch: 30,
        exec_error: 0,
        no_sql: 0,
        gold_error: 0,
        execution_accuracy: 0.4,
        p50_latency_ms: 100,
        p95_latency_ms: 200,
      },
    ],
    free_vs_frontier_delta: null,
    results: [],
  };
}

describe("emitEvalReport", () => {
  it("POSTs the report with bearer auth and content-type JSON", async () => {
    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify({ accepted: true, emitted: 1 }), {
          status: 202,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await emitEvalReport(reportFixture(), {
      apiUrl: "https://api.test/",
      token: "tok_abc",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.accepted).toBe(true);
    expect(result.emitted).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    if (!firstCall) throw new Error("expected fetch call");
    const [url, init] = firstCall;
    expect(url).toBe("https://api.test/v1/events/eval");
    const headers = init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer tok_abc");
    expect(headers["content-type"]).toBe("application/json");
    const sent = JSON.parse(init.body as string) as { report: EvalReport };
    expect(sent.report.dataset).toBe("bird-mini-dev-sqlite");
  });

  it("returns accepted=false and the trimmed error body on a non-2xx", async () => {
    const fetchMock = mock(async () => new Response("nope", { status: 401 }));
    const result = await emitEvalReport(reportFixture(), {
      apiUrl: "https://api.test",
      token: "wrong",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.accepted).toBe(false);
    expect(result.status).toBe(401);
    expect(result.errorBody).toBe("nope");
  });

  it("trims a trailing slash on apiUrl so the final URL is deterministic", async () => {
    const fetchMock = mock(async () => new Response("{}", { status: 202 }));
    await emitEvalReport(reportFixture(), {
      apiUrl: "https://api.test/////",
      token: "tok",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    if (!firstCall) throw new Error("expected fetch call");
    expect(firstCall[0]).toBe("https://api.test/v1/events/eval");
  });
});
