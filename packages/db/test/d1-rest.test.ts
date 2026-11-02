import { describe, expect, it } from "vitest";
import { D1RestError, d1RestBatch } from "../src/index.ts";

const target = {
  accountId: "0123456789abcdef0123456789abcdef",
  databaseId: "01234567-89ab-cdef-0123-456789abcdef",
  token: "secret",
};

function recording(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Response.json(body, { status });
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe("d1RestBatch", () => {
  it("sends one batch request and returns one row set per statement", async () => {
    // Shape of the REST `query` endpoint's answer to a two-statement batch.
    const { calls, fetchFn } = recording(200, {
      success: true,
      errors: [],
      messages: [],
      result: [
        { results: [{ name: "posts" }], success: true, meta: { rows_read: 1 } },
        { results: [], success: true, meta: { rows_read: 0 } },
      ],
    });
    const rows = await d1RestBatch(
      target,
      fetchFn,
    )(["PRAGMA table_list", "PRAGMA index_list('posts')"]);

    expect(rows).toEqual([[{ name: "posts" }], []]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/d1/database/01234567-89ab-cdef-0123-456789abcdef/query",
    );
    expect(calls[0]?.init.headers).toMatchObject({ authorization: "Bearer secret" });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      batch: [{ sql: "PRAGMA table_list" }, { sql: "PRAGMA index_list('posts')" }],
    });
  });

  it("throws the API's error sentence with its status", async () => {
    const { fetchFn } = recording(403, {
      success: false,
      errors: [{ code: 10000, message: "Authentication error" }],
    });
    const err = await d1RestBatch(target, fetchFn)(["PRAGMA table_list"]).catch((e) => e);
    expect(err).toBeInstanceOf(D1RestError);
    expect(err).toMatchObject({ message: "D1 query failed: Authentication error", status: 403 });
  });

  it("refuses ids that are not an account id or a UUID before any request", () => {
    const { calls, fetchFn } = recording(200, {});
    expect(() => d1RestBatch({ ...target, accountId: "../../user" }, fetchFn)).toThrow(
      /account id/,
    );
    expect(() => d1RestBatch({ ...target, databaseId: "x/../y" }, fetchFn)).toThrow(/UUID/);
    expect(calls).toHaveLength(0);
  });
});
