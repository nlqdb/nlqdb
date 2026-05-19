import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _testing, loadSpider2Lite } from "../../src/datasets/spider2-lite.ts";

const { parseJsonl, isSqliteRow } = _testing;

// Three-row mixed sample (SQLite + BigQuery + Snowflake) exercising the
// `local###` prefix filter that turns 547 upstream rows into 135.
const SAMPLE_JSONL = [
  JSON.stringify({
    instance_id: "bq001",
    db: "google_ads",
    question: "Which campaign has the highest spend?",
    external_knowledge: null,
  }),
  JSON.stringify({
    instance_id: "local003",
    db: "E_commerce",
    question: "Calculate RFM scores",
    external_knowledge: "rfm_definition.md",
  }),
  JSON.stringify({
    instance_id: "sf042",
    db: "TPCH",
    question: "Top 5 customers",
  }),
  JSON.stringify({
    instance_id: "local005",
    db: "Baseball",
    question: "Career batting averages",
  }),
].join("\n");

describe("parseJsonl", () => {
  it("parses one JSON object per non-empty line", () => {
    const rows = parseJsonl(SAMPLE_JSONL);
    expect(rows).toHaveLength(4);
    expect(rows[0]?.instance_id).toBe("bq001");
    expect(rows[1]?.instance_id).toBe("local003");
    expect(rows[1]?.external_knowledge).toBe("rfm_definition.md");
    expect(rows[3]?.external_knowledge).toBeNull();
  });

  it("ignores blank lines (canonical JSONL flavour)", () => {
    const withBlanks = `${SAMPLE_JSONL}\n\n   \n`;
    expect(parseJsonl(withBlanks)).toHaveLength(4);
  });

  it("surfaces line number on a malformed entry so a partial-write upstream isn't silent", () => {
    const broken = `${SAMPLE_JSONL}\nthis is not json`;
    expect(() => parseJsonl(broken)).toThrow(/line 5 is not valid JSON/);
  });

  it("rejects rows missing required fields with a keys hint for debugging", () => {
    const partial = JSON.stringify({ instance_id: "local999", db: "x" }); // no `question`
    expect(() => parseJsonl(partial)).toThrow(/missing required fields/);
  });
});

describe("isSqliteRow", () => {
  it("matches the `local###` prefix and only that prefix", () => {
    expect(isSqliteRow({ instance_id: "local000", db: "x", question: "q" })).toBe(true);
    expect(isSqliteRow({ instance_id: "local999", db: "x", question: "q" })).toBe(true);
    expect(isSqliteRow({ instance_id: "bq010", db: "x", question: "q" })).toBe(false);
    expect(isSqliteRow({ instance_id: "sf_bq001", db: "x", question: "q" })).toBe(false);
    expect(isSqliteRow({ instance_id: "ga004", db: "x", question: "q" })).toBe(false);
  });

  it("rejects path-traversal smuggled in via a tampered `instance_id`", () => {
    expect(isSqliteRow({ instance_id: "local../etc/passwd", db: "x", question: "q" })).toBe(false);
    expect(isSqliteRow({ instance_id: "local003/../bq", db: "x", question: "q" })).toBe(false);
    expect(isSqliteRow({ instance_id: "local-003", db: "x", question: "q" })).toBe(false);
    expect(isSqliteRow({ instance_id: "local 003", db: "x", question: "q" })).toBe(false);
    expect(isSqliteRow({ instance_id: "localfoo", db: "x", question: "q" })).toBe(false);
  });
});

describe("loadSpider2Lite — file mode", () => {
  let dir: string;
  let jsonlPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-spider2-"));
    jsonlPath = join(dir, "spider2-lite.jsonl");
    writeFileSync(jsonlPath, SAMPLE_JSONL);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // A canned fetch that resolves a 404 for every gold-SQL URL — matches the
  // upstream reality for the 111 of 135 SQLite rows that have no gold-SQL
  // file (their gold lives in `evaluation_suite/gold/exec_result/*.csv`).
  // Same `as unknown as typeof fetch` cast pattern as `emit.test.ts` — Bun's
  // `typeof fetch` requires `preconnect`, which test stubs don't carry.
  const fetch404 = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;

  it("filters to local### rows, dropping bq/sf/ga (the 135-of-547 contract)", async () => {
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      fetchImpl: fetch404,
    });
    expect(loaded.questions).toHaveLength(2);
    expect(loaded.questions[0]?.instance_id).toBe("local003");
    expect(loaded.questions[1]?.instance_id).toBe("local005");
  });

  it("preserves `instance_id` + sets `evidence` to empty string for downstream code", async () => {
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      fetchImpl: fetch404,
    });
    expect(loaded.questions[0]?.instance_id).toBe("local003");
    expect(loaded.questions[0]?.evidence).toBe("");
  });

  it("assigns `question_id` as a positional index into the filtered list, not the upstream row index", async () => {
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      fetchImpl: fetch404,
    });
    // local003 (at upstream index 1) gets question_id 0;
    // local005 (at upstream index 3) gets question_id 1.
    expect(loaded.questions[0]?.question_id).toBe(0);
    expect(loaded.questions[1]?.question_id).toBe(1);
  });

  it("leaves `sql` empty when upstream returns 404 (no gold SQL — slice 3b runs CSV path)", async () => {
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      fetchImpl: fetch404,
    });
    expect(loaded.questions[0]?.sql).toBe("");
    expect(loaded.questions[1]?.sql).toBe("");
  });

  it("hydrates `sql` from upstream when the per-instance gold SQL file exists (the 24-of-135 subset)", async () => {
    const fetchWithGold = (async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.endsWith("local003.sql")) {
        return new Response("SELECT customer_id FROM orders;", { status: 200 });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      fetchImpl: fetchWithGold,
    });
    expect(loaded.questions[0]?.sql).toBe("SELECT customer_id FROM orders;");
    expect(loaded.questions[1]?.sql).toBe("");
  });

  it("prefers a local gold-sql cache over the upstream fetch (CI cache-hit path)", async () => {
    // Single-row fixture so the assertion is unambiguous — cache hit wins,
    // network never fires for the lone local instance.
    writeFileSync(
      jsonlPath,
      JSON.stringify({
        instance_id: "local005",
        db: "Baseball",
        question: "Career batting averages",
      }),
    );
    const goldDir = join(dir, "gold-sql");
    mkdirSync(goldDir);
    writeFileSync(join(goldDir, "local005.sql"), "SELECT * FROM players;");
    // Network would 500 — if the loader reads the cache, this never fires.
    const fetchFails = (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchFails,
    });
    expect(loaded.questions).toHaveLength(1);
    expect(loaded.questions[0]?.sql).toBe("SELECT * FROM players;");
  });

  it("propagates a non-404 upstream failure (so a GitHub outage doesn't silently zero the run)", async () => {
    const fetchOutage = (async () =>
      new Response("rate limited", { status: 503 })) as unknown as typeof fetch;
    await expect(
      loadSpider2Lite({
        questionsJsonlPath: jsonlPath,
        fetchImpl: fetchOutage,
      }),
    ).rejects.toThrow(/spider2-lite: .* returned 503/);
  });

  it("retries transient 429 / 5xx and recovers when upstream stabilises", async () => {
    // 429 → 503 → 200 across one instance; the second instance 404s immediately. Verifies the retry helper unsticks a flaky GitHub raw without burning the whole run.
    const statuses: Record<string, number[]> = { local003: [429, 503, 200], local005: [404] };
    let local003Calls = 0;
    const fetchFlaky = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("local003.sql")) {
        const status = statuses["local003"]?.[local003Calls++] ?? 200;
        return new Response(status === 200 ? "SELECT 1;" : "transient", { status });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      fetchImpl: fetchFlaky,
    });
    expect(local003Calls).toBe(3);
    expect(loaded.questions[0]?.sql).toBe("SELECT 1;");
    expect(loaded.questions[1]?.sql).toBe("");
  }, 30_000);

  it("applies --limit after the local### filter (limit counts SQLite rows, not upstream rows)", async () => {
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      limit: 1,
      fetchImpl: fetch404,
    });
    expect(loaded.questions).toHaveLength(1);
    expect(loaded.questions[0]?.instance_id).toBe("local003");
  });

  it("returns null from resolveDbPath when dataDir is absent", async () => {
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      fetchImpl: fetch404,
    });
    expect(await loaded.resolveDbPath("E_commerce")).toBeNull();
  });

  it("resolves the canonical `resource/databases/spider2-localdb/<db>.sqlite` layout", async () => {
    const dbDir = join(dir, "resource", "databases", "spider2-localdb");
    mkdirSync(dbDir, { recursive: true });
    const fixturePath = join(dbDir, "E_commerce.sqlite");
    writeFileSync(fixturePath, "");
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetch404,
    });
    expect(await loaded.resolveDbPath("E_commerce")).toBe(fixturePath);
  });

  it("falls back to a flat `<dataDir>/<db>.sqlite` layout for hand-curated caches", async () => {
    const flatPath = join(dir, "Baseball.sqlite");
    writeFileSync(flatPath, "");
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetch404,
    });
    expect(await loaded.resolveDbPath("Baseball")).toBe(flatPath);
  });

  it("returns null from resolveDbPath when the `db` field smuggles path-traversal (security guard)", async () => {
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetch404,
    });
    // `basename("../etc/passwd")` === "passwd" ≠ original → null.
    expect(await loaded.resolveDbPath("../etc/passwd")).toBeNull();
    expect(await loaded.resolveDbPath("/absolute/path")).toBeNull();
    expect(await loaded.resolveDbPath("E_commerce/../../etc")).toBeNull();
  });

  it("returns null from resolveDbPath when fixture missing (fail-soft same as BIRD)", async () => {
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetch404,
    });
    expect(await loaded.resolveDbPath("DoesNotExist")).toBeNull();
  });
});

describe("loadSpider2Lite — fetch mode", () => {
  it("propagates fetch failure with status + statusText after the retry budget is exhausted", async () => {
    const fetchImpl = (async () =>
      new Response("upstream rebooting", {
        status: 502,
        statusText: "Bad Gateway",
      })) as unknown as typeof fetch;
    await expect(loadSpider2Lite({ fetchImpl })).rejects.toThrow(
      /spider2-lite: .*spider2-lite\.jsonl returned 502 Bad Gateway/,
    );
  }, 10_000);

  it("uses the questionsJsonlUrl override (commit-pin / test stubbing)", async () => {
    let calledUrl = "";
    const fetchImpl = (async (url: RequestInfo | URL) => {
      calledUrl = url.toString();
      // Only the JSONL is requested when no local-prefixed rows survive
      // the filter (so no gold-SQL fetches fire).
      return new Response(JSON.stringify({ instance_id: "bq001", db: "x", question: "q" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const loaded = await loadSpider2Lite({
      questionsJsonlUrl: "https://example.test/pinned/spider2-lite.jsonl",
      fetchImpl,
    });
    expect(calledUrl).toBe("https://example.test/pinned/spider2-lite.jsonl");
    expect(loaded.questions).toHaveLength(0); // bq001 filtered out
  });
});
