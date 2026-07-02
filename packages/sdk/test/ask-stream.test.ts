import { describe, expect, it } from "vitest";
import { createClient, type FetchLike, NlqdbApiError, type TraceEvent } from "../src/index.ts";

// askStream() is the SSE variant of ask() — the most complex logic in
// the client (frame parsing, event accumulation, error demux). The
// existing suite only proved the byollm header rides it; these cover
// the assembly, the trust-contract (`SK-TRUST-002` trace block), and
// every failure path a real stream can take.

const TRACE = {
  sql: "select 1",
  plan_id: "h:q",
  confidence: 1,
  model: "stub",
  cache_hit: false,
};

// Build a Response whose body streams `chunks` as separate reads, so a
// test can force a frame boundary to land mid-chunk (buffering path).
function sseResponse(chunks: string[], init?: ResponseInit): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
    ...init,
  });
}

describe("askStream", () => {
  it("assembles an AskOk from plan + rows + summary events and fires onTrace per step", async () => {
    const frames =
      `event: plan_pending\ndata: {}\n\n` +
      `event: plan\ndata: ${JSON.stringify({ trace: TRACE })}\n\n` +
      `event: rows\ndata: ${JSON.stringify({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 })}\n\n` +
      `event: summary\ndata: ${JSON.stringify({ summary: "two users" })}\n\n` +
      `event: done\ndata: {"status":"ok"}\n\n`;
    const fakeFetch: FetchLike = async () => sseResponse([frames]);

    const seen: TraceEvent[] = [];
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    const out = await client.askStream(
      { goal: "users", dbId: "db_1" },
      { onTrace: (e) => seen.push(e) },
    );

    expect(out.status).toBe("ok");
    expect(out.rows).toEqual([{ id: 1 }, { id: 2 }]);
    expect(out.rowCount).toBe(2);
    expect(out.summary).toBe("two users");
    expect(out.trace.sql).toBe("select 1");
    expect(seen.map((e) => e.type)).toEqual(["plan_pending", "plan", "rows", "summary", "done"]);
  });

  it("surfaces confirm_required + selected_db on the assembled AskOk", async () => {
    const frames =
      `event: plan\ndata: ${JSON.stringify({ trace: TRACE })}\n\n` +
      `event: selected_db\ndata: ${JSON.stringify({
        db: { id: "db_1", slug: "orders", confidence: 0.92, reason: "only db" },
      })}\n\n` +
      `event: confirm_required\ndata: ${JSON.stringify({
        diff: { verb: "DELETE", table: "orders", affectedRows: 3, summary: "deletes 3 rows" },
      })}\n\n` +
      `event: done\ndata: {"status":"ok"}\n\n`;
    const fakeFetch: FetchLike = async () => sseResponse([frames]);

    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    const out = await client.askStream({ goal: "delete orders", dbId: "db_1" }, {});

    expect(out.requires_confirm).toBe(true);
    expect(out.diff).toMatchObject({ verb: "DELETE", affectedRows: 3 });
    expect(out.selected_db).toMatchObject({ id: "db_1", confidence: 0.92 });
  });

  it("buffers a frame split across two stream reads", async () => {
    const whole =
      `event: plan\ndata: ${JSON.stringify({ trace: TRACE })}\n\n` +
      `event: rows\ndata: ${JSON.stringify({ rows: [{ id: 9 }], rowCount: 1 })}\n\n` +
      `event: done\ndata: {"status":"ok"}\n\n`;
    // Split at an arbitrary byte inside the first frame's data line.
    const cut = 20;
    const fakeFetch: FetchLike = async () => sseResponse([whole.slice(0, cut), whole.slice(cut)]);

    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    const out = await client.askStream({ goal: "x", dbId: "db_1" }, {});
    expect(out.rows).toEqual([{ id: 9 }]);
    expect(out.trace.plan_id).toBe("h:q");
  });

  it("throws the API error carried on an SSE `error` event (httpStatus 200)", async () => {
    const frames =
      `event: plan\ndata: ${JSON.stringify({ trace: TRACE })}\n\n` +
      `event: error\ndata: ${JSON.stringify({ error: { status: "llm_failed", message: "boom" } })}\n\n`;
    const fakeFetch: FetchLike = async () => sseResponse([frames]);

    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    try {
      await client.askStream({ goal: "x", dbId: "db_1" }, {});
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NlqdbApiError);
      const e = err as NlqdbApiError;
      expect(e.code).toBe("llm_failed");
      expect(e.httpStatus).toBe(200);
      expect(e.body?.message).toBe("boom");
    }
  });

  it("throws 'missing trace block' when `done` arrives with no `plan` event (SK-TRUST-002)", async () => {
    const frames =
      `event: rows\ndata: ${JSON.stringify({ rows: [], rowCount: 0 })}\n\n` +
      `event: done\ndata: {"status":"ok"}\n\n`;
    const fakeFetch: FetchLike = async () => sseResponse([frames]);

    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    await expect(client.askStream({ goal: "x", dbId: "db_1" }, {})).rejects.toMatchObject({
      name: "NlqdbApiError",
      code: "non_json_response",
    });
  });

  it("maps a non-2xx JSON error returned before the stream opens", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(JSON.stringify({ error: { status: "rate_limited", limit: 5, count: 6 } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    try {
      await client.askStream({ goal: "x", dbId: "db_1" }, {});
      expect.fail("should have thrown");
    } catch (err) {
      const e = err as NlqdbApiError;
      expect(e.code).toBe("rate_limited");
      expect(e.httpStatus).toBe(429);
      expect(e.body?.limit).toBe(5);
    }
  });

  it("does not leak an HTML error body into the thrown message on a non-2xx", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response("<html><body>CDN-SECRET-INTERNALS</body></html>", { status: 503 });
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    try {
      await client.askStream({ goal: "x", dbId: "db_1" }, {});
      expect.fail("should have thrown");
    } catch (err) {
      const e = err as NlqdbApiError;
      expect(e.code).toBe("non_json_response");
      expect(e.httpStatus).toBe(503);
      expect(e.message).not.toContain("CDN-SECRET-INTERNALS");
    }
  });

  it("throws when a 200 arrives with no stream body", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(null, { status: 200, headers: { "content-type": "text/event-stream" } });
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    await expect(client.askStream({ goal: "x", dbId: "db_1" }, {})).rejects.toMatchObject({
      code: "non_json_response",
      httpStatus: 200,
    });
  });

  it("wraps a transport failure into NlqdbApiError(network_error, httpStatus 0)", async () => {
    const fakeFetch: FetchLike = async () => {
      throw new TypeError("Failed to fetch");
    };
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    try {
      await client.askStream({ goal: "x", dbId: "db_1" }, {});
      expect.fail("should have thrown");
    } catch (err) {
      const e = err as NlqdbApiError;
      expect(e.code).toBe("network_error");
      expect(e.httpStatus).toBe(0);
      expect(e.cause).toBeInstanceOf(TypeError);
    }
  });

  it("wraps an aborted stream request into NlqdbApiError(aborted)", async () => {
    const controller = new AbortController();
    const fakeFetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    const p = client.askStream({ goal: "x", dbId: "db_1" }, { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ code: "aborted", httpStatus: 0 });
  });

  it("swallows an onTrace hook that throws — the stream still completes (SK-SDK-007)", async () => {
    const frames =
      `event: plan\ndata: ${JSON.stringify({ trace: TRACE })}\n\n` +
      `event: done\ndata: {"status":"ok"}\n\n`;
    const fakeFetch: FetchLike = async () => sseResponse([frames]);
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    const out = await client.askStream(
      { goal: "x", dbId: "db_1" },
      {
        onTrace: () => {
          throw new Error("buggy hook");
        },
      },
    );
    expect(out.status).toBe("ok");
    expect(out.trace.sql).toBe("select 1");
  });

  it("ignores comment-only frames and malformed JSON payloads without crashing", async () => {
    const frames =
      `: keep-alive comment\n\n` +
      `event: plan\ndata: ${JSON.stringify({ trace: TRACE })}\n\n` +
      `event: rows\ndata: {not valid json\n\n` +
      `event: done\ndata: {"status":"ok"}\n\n`;
    const fakeFetch: FetchLike = async () => sseResponse([frames]);
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    const out = await client.askStream({ goal: "x", dbId: "db_1" }, {});
    // The malformed rows frame is skipped; rows stay empty, trace present.
    expect(out.rows).toEqual([]);
    expect(out.trace.sql).toBe("select 1");
  });
});
