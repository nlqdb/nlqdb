// The D1 Tier 1 observer (`GLOBAL-043` item 7, roadmap 1a's D1 slice): the
// query-insights client on a recorded GraphQL Analytics answer, and the
// observer's plans and catalog against a local D1 through `d1RestBatch`
// (`fixtures/local-d1.ts`).

import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyD1Proposal,
  type D1QueryInsight,
  D1RestError,
  observeD1Workload,
  readD1QueryInsights,
} from "../src/index.ts";
import { D1_TARGET, localD1 } from "./fixtures/local-d1.ts";

const d1 = localD1();
let telemetry: TestTelemetry;
afterAll(() => d1.dispose());
beforeEach(() => {
  telemetry = createTestTelemetry();
});
afterEach(() => telemetry.reset());

// A recorded answer in the shape `wrangler d1 insights` selects.
type Avg = { queryDurationMs: number; rowsRead: number; rowsWritten: number; rowsReturned: number };
const group = (query: string, count: number, avg: Avg) => ({
  sum: {
    queryDurationMs: avg.queryDurationMs * count,
    rowsRead: avg.rowsRead * count,
    rowsWritten: avg.rowsWritten * count,
    rowsReturned: avg.rowsReturned * count,
  },
  avg,
  count,
  dimensions: { query, databaseId: D1_TARGET.databaseId },
});

describe("readD1QueryInsights", () => {
  it("asks for the attached database's window and maps each query text", async () => {
    let sent: { url: string; body: Record<string, unknown> } | undefined;
    const fetchFn = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return Response.json({
        data: {
          viewer: {
            accounts: [
              {
                d1QueriesAdaptiveGroups: [
                  group("SELECT * FROM posts WHERE user_id = ?", 40, {
                    queryDurationMs: 2.5,
                    rowsRead: 5000,
                    rowsWritten: 0,
                    rowsReturned: 50,
                  }),
                  group("", 1, {
                    queryDurationMs: 1,
                    rowsRead: 1,
                    rowsWritten: 0,
                    rowsReturned: 1,
                  }),
                ],
              },
            ],
          },
        },
        errors: null,
      });
    }) as typeof fetch;

    const target = { ...D1_TARGET, token: "cf-token-never-logged" };
    const insights = await readD1QueryInsights(
      target,
      { since: "2026-11-02T00:00:00Z", until: "2026-11-03T00:00:00Z" },
      fetchFn,
    );
    expect(insights).toEqual([
      {
        query: "SELECT * FROM posts WHERE user_id = ?",
        calls: 40,
        meanMs: 2.5,
        rowsRead: 5000,
        rowsReturned: 50,
        rowsWritten: 0,
        totalRowsRead: 200_000,
      },
    ]);
    expect(sent?.url).toBe("https://api.cloudflare.com/client/v4/graphql");
    expect(sent?.body["variables"]).toEqual({
      accountTag: D1_TARGET.accountId,
      filter: {
        AND: [
          {
            datetimeHour_geq: "2026-11-02T00:00:00Z",
            datetimeHour_leq: "2026-11-03T00:00:00Z",
            databaseId: D1_TARGET.databaseId,
          },
        ],
      },
    });
    expect(String(sent?.body["query"])).toContain("orderBy: [sum_rowsRead_DESC]");
    const span = telemetry.spanExporter.getFinishedSpans().find((s) => s.name === "db.query");
    expect(span?.attributes["nlqdb.transport"]).toBe("d1-graphql");
    expect(JSON.stringify(span?.attributes)).not.toContain(target.token);
  });

  it("throws on a GraphQL error (a 200 with `errors`) and on a refused token", async () => {
    const answer = (body: unknown, status = 200) =>
      (async () => Response.json(body, { status })) as unknown as typeof fetch;
    const window = { since: "a", until: "b" };
    await expect(
      readD1QueryInsights(
        D1_TARGET,
        window,
        answer({ data: null, errors: [{ message: "not authorized for that account" }] }),
      ),
    ).rejects.toThrow(/not authorized/);
    await expect(
      readD1QueryInsights(D1_TARGET, window, answer({ success: false }, 403)),
    ).rejects.toBeInstanceOf(D1RestError);
  });
});

// The app's workload on 5,000 posts: the hot lookup by author is unindexed.
const APP = `
  CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, team TEXT);
  CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, status TEXT, title TEXT);
  CREATE INDEX posts_title ON posts(title);
  CREATE INDEX posts_status_recent ON posts(status) WHERE id > 4000;
  WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 5000)
    INSERT INTO posts (user_id, status, title) SELECT i % 100, CASE i % 3 WHEN 0 THEN 'draft' ELSE 'live' END, 't' || i FROM n;
  WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 100)
    INSERT INTO users (email, team) SELECT 'u' || i, 'team' || (i % 10) FROM n;
`;

const insight = (
  query: string,
  calls: number,
  rowsRead: number,
  rowsReturned: number,
  rowsWritten = 0,
): D1QueryInsight => ({
  query,
  calls,
  meanMs: 1.5,
  rowsRead,
  rowsReturned,
  rowsWritten,
  totalRowsRead: rowsRead * calls,
});

// What the analytics show for that app over a day (bound params stripped to `?`).
const WORKLOAD = [
  insight(
    "SELECT id, title FROM posts p WHERE p.user_id = ? ORDER BY id DESC LIMIT 20",
    900,
    5000,
    20,
  ),
  insight("SELECT * FROM posts WHERE user_id = ? AND status = ?", 300, 5000, 17),
  insight("UPDATE posts SET title = ? WHERE user_id = ?", 50, 5000, 0, 50),
  insight("DELETE FROM users WHERE team = ?", 10, 100, 0, 10), // keeps 10 %: the scan is fine
  insight("SELECT * FROM posts WHERE title = ?", 500, 1, 1), // already indexed
  insight("SELECT * FROM posts WHERE status = ?", 200, 5000, 1), // only a partial index
  insight("SELECT * FROM posts WHERE user_id > ?", 100, 5000, 2), // a range: out of scope
  insight(
    "SELECT * FROM posts JOIN users ON users.id = posts.user_id WHERE users.team = ?",
    80,
    5100,
    50,
  ),
  insight("SELECT * FROM gone WHERE x = ?", 70, 5000, 1), // dropped since
  insight("SELECT * FROM posts WHERE missing = ?", 60, 5000, 1), // not a column
];

describe("observeD1Workload on a local D1", () => {
  it("proposes an index for each heavy scanned equality filter, and none for the rest", async () => {
    const { batch } = await d1.open(APP);
    const requestsBefore = d1.requests();
    const proposals = await observeD1Workload(batch, WORKLOAD);

    expect(proposals.map((p) => `${p.table}(${p.columns.join(",")})`)).toEqual([
      "posts(user_id)",
      "posts(user_id,status)",
      "posts(status)",
    ]);
    expect(proposals[0]).toMatchObject({
      kind: "create_index",
      tier: 1,
      schema: "main",
      ddl: 'CREATE INDEX IF NOT EXISTS "nlqdb_posts_user_id_dac06227" ON "posts" (`user_id`)',
      evidence: {
        rowEstimate: 5000,
        tableBytes: 0,
        d1Workload: { calls: 900, rowsRead: 5000, rowsReturned: 20 },
      },
    });
    // The plans fail as one request (a dropped table), so each goes alone;
    // then one catalog request and one for the index keys.
    const span = telemetry.spanExporter
      .getFinishedSpans()
      .find(
        (s) => s.name === "db.observe" && s.attributes["db.operation.name"] === "observe_workload",
      );
    expect(span?.attributes["nlqdb.dba.unplanned"]).toBe(2);
    expect(span?.attributes["nlqdb.dba.proposals"]).toBe(3);
    expect(d1.requests() - requestsBefore).toBe(1 + 6 + 2);
  });

  it("an applied proposal turns its scan into a search, so it is not proposed again", async () => {
    const { batch } = await d1.open(APP);
    const [first] = await observeD1Workload(batch, WORKLOAD.slice(0, 1));
    if (!first) throw new Error("expected a proposal");
    const [before] = await batch(["SELECT id FROM posts WHERE user_id = 7"]);
    await applyD1Proposal(batch, first);
    expect(await observeD1Workload(batch, WORKLOAD.slice(0, 1))).toEqual([]);
    expect(before).toHaveLength(50);
  });

  it("an auth or network failure throws instead of reading as nothing to change", async () => {
    const refused = async () => {
      throw new D1RestError("D1 query failed: Authentication error", 403);
    };
    await expect(observeD1Workload(refused, WORKLOAD)).rejects.toThrow(/Authentication/);
  });
});
