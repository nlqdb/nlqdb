import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _testing, loadSpider2Lite } from "../../src/datasets/spider2-lite.ts";

const { parseQuestionsJsonl, parseEvalJsonl, isSqliteRow, loadExternalKnowledge } = _testing;

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

const SAMPLE_EVAL_JSONL = [
  JSON.stringify({ instance_id: "local003", condition_cols: [0], ignore_order: true, toks: "316" }),
  JSON.stringify({ instance_id: "local005", condition_cols: [], ignore_order: true, toks: "100" }),
].join("\n");

describe("parseQuestionsJsonl", () => {
  it("parses one JSON object per non-empty line", () => {
    const rows = parseQuestionsJsonl(SAMPLE_JSONL);
    expect(rows).toHaveLength(4);
    expect(rows[0]?.instance_id).toBe("bq001");
    expect(rows[1]?.external_knowledge).toBe("rfm_definition.md");
    expect(rows[3]?.external_knowledge).toBeNull();
  });

  it("ignores blank lines (canonical JSONL flavour)", () => {
    expect(parseQuestionsJsonl(`${SAMPLE_JSONL}\n\n   \n`)).toHaveLength(4);
  });

  it("surfaces line number on a malformed entry", () => {
    expect(() => parseQuestionsJsonl(`${SAMPLE_JSONL}\nnot json`)).toThrow(
      /line 5 is not valid JSON/,
    );
  });

  it("rejects rows missing required fields", () => {
    const partial = JSON.stringify({ instance_id: "local999", db: "x" });
    expect(() => parseQuestionsJsonl(partial)).toThrow(/missing required fields/);
  });
});

describe("parseEvalJsonl", () => {
  it("parses one entry per line keyed by instance_id", () => {
    const rows = parseEvalJsonl(SAMPLE_EVAL_JSONL);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.instance_id).toBe("local003");
    expect(rows[0]?.condition_cols).toEqual([0]);
    expect(rows[1]?.ignore_order).toBe(true);
  });

  it("rejects entries missing instance_id", () => {
    expect(() => parseEvalJsonl('{"condition_cols": [0]}')).toThrow(/missing required fields/);
  });
});

describe("isSqliteRow", () => {
  it("matches the `local###` prefix and only that prefix", () => {
    expect(isSqliteRow({ instance_id: "local000", db: "x", question: "q" })).toBe(true);
    expect(isSqliteRow({ instance_id: "local999", db: "x", question: "q" })).toBe(true);
    expect(isSqliteRow({ instance_id: "bq010", db: "x", question: "q" })).toBe(false);
    expect(isSqliteRow({ instance_id: "sf_bq001", db: "x", question: "q" })).toBe(false);
  });

  it("rejects path-traversal smuggled in via a tampered `instance_id`", () => {
    expect(isSqliteRow({ instance_id: "local../etc/passwd", db: "x", question: "q" })).toBe(false);
    expect(isSqliteRow({ instance_id: "local-003", db: "x", question: "q" })).toBe(false);
    expect(isSqliteRow({ instance_id: "localfoo", db: "x", question: "q" })).toBe(false);
  });
});

describe("loadExternalKnowledge — SK-QUAL-016", () => {
  const never = (async () =>
    new Response("network must not be touched", { status: 500 })) as unknown as typeof fetch;

  it("returns null when no external_knowledge is set", async () => {
    expect(await loadExternalKnowledge(null, undefined, never)).toBeNull();
    expect(await loadExternalKnowledge(undefined, undefined, never)).toBeNull();
    expect(await loadExternalKnowledge("", undefined, never)).toBeNull();
  });

  it("rejects a path-traversal or non-.md filename without any read", async () => {
    expect(await loadExternalKnowledge("../../etc/passwd", undefined, never)).toBeNull();
    expect(await loadExternalKnowledge("sub/dir/doc.md", undefined, never)).toBeNull();
    expect(await loadExternalKnowledge("haversine_formula.txt", undefined, never)).toBeNull();
  });

  it("reads the doc body from the cache dir when dataDir is set (cache-authoritative, no network)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nlqdb-spider2-doc-"));
    try {
      writeFileSync(join(dir, "RFM.md"), "  The RFM model scores R, F, M.  \n");
      expect(await loadExternalKnowledge("RFM.md", dir, never)).toBe(
        "The RFM model scores R, F, M.",
      );
      // Missing doc degrades to null without touching the (throwing) network.
      expect(await loadExternalKnowledge("missing.md", dir, never)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fetches the doc body from upstream when no dataDir is set; 404 degrades to null", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/documents/haversine_formula.md")) {
        return new Response("# Haversine\n\nd = 2r·asin(...)\n", { status: 200 });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    expect(await loadExternalKnowledge("haversine_formula.md", undefined, fetchImpl)).toBe(
      "# Haversine\n\nd = 2r·asin(...)",
    );
    expect(await loadExternalKnowledge("gone.md", undefined, fetchImpl)).toBeNull();
  });
});

describe("loadSpider2Lite — disk cache layout (the CI cache-hit path)", () => {
  let dir: string;
  let jsonlPath: string;
  let evalDir: string;
  let execResultDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-spider2-"));
    jsonlPath = join(dir, "spider2-lite.jsonl");
    writeFileSync(jsonlPath, SAMPLE_JSONL);
    evalDir = join(dir, "evaluation_suite", "gold");
    execResultDir = join(evalDir, "exec_result");
    mkdirSync(execResultDir, { recursive: true });
    writeFileSync(join(evalDir, "spider2lite_eval.jsonl"), SAMPLE_EVAL_JSONL);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // Network would 500 — if the loader reads the cache, this never fires.
  const fetchAsserts = (async () =>
    new Response("loader hit network during a cache-hit test", {
      status: 500,
    })) as unknown as typeof fetch;

  it("filters to local### rows and assigns positional question_id (135-of-547 contract)", async () => {
    writeFileSync(join(execResultDir, "local003_a.csv"), "rfm\nA\nB\n");
    writeFileSync(join(execResultDir, "local005_a.csv"), "name\nWhisk\n");
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchAsserts,
    });
    expect(loaded.questions).toHaveLength(2);
    expect(loaded.questions[0]?.instance_id).toBe("local003");
    expect(loaded.questions[0]?.question_id).toBe(0);
    expect(loaded.questions[1]?.instance_id).toBe("local005");
    expect(loaded.questions[1]?.question_id).toBe(1);
  });

  it("hydrates spider2.gold_tables from multi-CSV variants in alphabetical order", async () => {
    // local003 has 4 variants — the upstream canonical scoring iterates them in lexicographic order.
    writeFileSync(join(execResultDir, "local003_a.csv"), "rfm\nA\n");
    writeFileSync(join(execResultDir, "local003_b.csv"), "rfm\nB\n");
    writeFileSync(join(execResultDir, "local003_c.csv"), "rfm\nC\n");
    writeFileSync(join(execResultDir, "local003_d.csv"), "rfm\nD\n");
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchAsserts,
    });
    const local003 = loaded.questions.find((q) => q.instance_id === "local003");
    expect(local003?.spider2?.gold_tables).toHaveLength(4);
    expect(local003?.spider2?.gold_tables[0]?.cells[0]).toEqual(["A"]);
    expect(local003?.spider2?.gold_tables[3]?.cells[0]).toEqual(["D"]);
  });

  it("hydrates spider2 from a bare `<id>.csv` when no multi-variant exists", async () => {
    writeFileSync(join(execResultDir, "local005.csv"), "name\nWhisk\n");
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchAsserts,
    });
    const local005 = loaded.questions.find((q) => q.instance_id === "local005");
    expect(local005?.spider2?.gold_tables).toHaveLength(1);
    expect(local005?.spider2?.gold_tables[0]?.cells[0]).toEqual(["Whisk"]);
  });

  it("attaches condition_cols + ignore_order from the eval JSONL when present", async () => {
    writeFileSync(join(execResultDir, "local003_a.csv"), "rfm\nA\n");
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchAsserts,
    });
    const local003 = loaded.questions.find((q) => q.instance_id === "local003");
    expect(local003?.spider2?.condition_cols).toEqual([0]);
    expect(local003?.spider2?.ignore_order).toBe(true);
  });

  it("defaults ignore_order to true when the eval JSONL is missing that row (every upstream entry sets true today, so the safer default is true)", async () => {
    writeFileSync(join(execResultDir, "local003_a.csv"), "rfm\nA\n");
    writeFileSync(join(evalDir, "spider2lite_eval.jsonl"), ""); // empty eval index
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchAsserts,
    });
    const local003 = loaded.questions.find((q) => q.instance_id === "local003");
    expect(local003?.spider2?.ignore_order).toBe(true);
    expect(local003?.spider2?.condition_cols).toEqual([]);
  });

  it("omits the spider2 payload entirely when no gold CSV is found (avoids a half-loaded scoring contract)", async () => {
    // No CSVs in execResultDir, just the eval JSONL.
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchAsserts,
    });
    const local003 = loaded.questions.find((q) => q.instance_id === "local003");
    expect(local003?.spider2).toBeUndefined();
    expect(local003?.sql).toBe("");
  });

  it("injects the external-knowledge doc body into evidence (SK-QUAL-016), empty when none", async () => {
    writeFileSync(join(execResultDir, "local003_a.csv"), "rfm\nA\n");
    writeFileSync(join(execResultDir, "local005.csv"), "name\nWhisk\n");
    const docsDir = join(dir, "resource", "documents");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "rfm_definition.md"), "RFM scores customers on R, F, M.\n");
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchAsserts,
    });
    const local003 = loaded.questions.find((q) => q.instance_id === "local003");
    const local005 = loaded.questions.find((q) => q.instance_id === "local005");
    expect(local003?.evidence).toBe("RFM scores customers on R, F, M.");
    expect(local005?.evidence).toBe(""); // SAMPLE_JSONL local005 has no external_knowledge
  });

  it("never populates EvalQuestion.sql for Spider rows (multi-CSV-only path per SK-QUAL-008)", async () => {
    writeFileSync(join(execResultDir, "local003_a.csv"), "x\n1\n");
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchAsserts,
    });
    for (const q of loaded.questions) expect(q.sql).toBe("");
  });

  it("reads the questions JSONL from the cache when only dataDir is set (no network)", async () => {
    // dataDir's `spider2-lite.jsonl` already exists from beforeEach; questionsJsonlPath is unset.
    writeFileSync(join(execResultDir, "local003_a.csv"), "x\n1\n");
    const loaded = await loadSpider2Lite({
      dataDir: dir,
      fetchImpl: fetchAsserts,
    });
    expect(loaded.questions.map((q) => q.instance_id)).toEqual(["local003", "local005"]);
  });
});

describe("loadSpider2Lite — network mode (fetches gold CSVs + eval JSONL from upstream)", () => {
  it("probes `<id>.csv` first, falls back to `_a.csv` / `_b.csv` ... up to the first 404", async () => {
    const tinyJsonl = JSON.stringify({
      instance_id: "local003",
      db: "x",
      question: "q",
    });
    const probes: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      probes.push(url);
      if (url.endsWith("spider2-lite.jsonl") && !url.endsWith("spider2lite_eval.jsonl")) {
        return new Response(tinyJsonl, { status: 200 });
      }
      if (url.endsWith("spider2lite_eval.jsonl")) {
        return new Response(
          JSON.stringify({ instance_id: "local003", condition_cols: [], ignore_order: true }),
          { status: 200 },
        );
      }
      if (url.endsWith("/local003.csv")) {
        return new Response("", { status: 404 });
      }
      if (url.endsWith("/local003_a.csv")) {
        return new Response("rfm\nA\n", { status: 200 });
      }
      if (url.endsWith("/local003_b.csv")) {
        return new Response("rfm\nB\n", { status: 200 });
      }
      // Any subsequent variant ends the probe.
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;

    const loaded = await loadSpider2Lite({ fetchImpl });
    expect(loaded.questions).toHaveLength(1);
    expect(loaded.questions[0]?.spider2?.gold_tables).toHaveLength(2);
    expect(loaded.questions[0]?.spider2?.gold_tables[0]?.cells[0]).toEqual(["A"]);
    expect(loaded.questions[0]?.spider2?.gold_tables[1]?.cells[0]).toEqual(["B"]);
    // Probed: questions, eval, local003.csv (404), _a (200), _b (200), _c (404 — terminator).
    expect(probes.some((p) => p.endsWith("/local003.csv"))).toBe(true);
    expect(probes.some((p) => p.endsWith("/local003_c.csv"))).toBe(true);
  });

  it("propagates a non-404 upstream failure on the eval JSONL fetch (so a GitHub outage isn't silent)", async () => {
    const tinyJsonl = JSON.stringify({ instance_id: "local003", db: "x", question: "q" });
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("spider2lite_eval.jsonl")) {
        return new Response("upstream rebooting", { status: 502, statusText: "Bad Gateway" });
      }
      if (url.endsWith("spider2-lite.jsonl")) return new Response(tinyJsonl, { status: 200 });
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    await expect(loadSpider2Lite({ fetchImpl })).rejects.toThrow(
      /spider2-lite-eval: line 1|spider2-lite: .*spider2lite_eval\.jsonl|spider2-lite: fetch .* failed: 502 Bad Gateway/,
    );
  }, 30_000);

  it("retries transient 5xx + recovers (verifies the network helper unsticks a flaky GitHub raw)", async () => {
    const tinyJsonl = JSON.stringify({ instance_id: "local003", db: "x", question: "q" });
    const evalStatuses = [503, 200];
    let evalCalls = 0;
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("spider2-lite.jsonl") && !url.endsWith("spider2lite_eval.jsonl")) {
        return new Response(tinyJsonl, { status: 200 });
      }
      if (url.endsWith("spider2lite_eval.jsonl")) {
        const status = evalStatuses[evalCalls++] ?? 200;
        return new Response(
          status === 200
            ? JSON.stringify({ instance_id: "local003", condition_cols: [], ignore_order: true })
            : "transient",
          { status },
        );
      }
      if (url.endsWith("/local003.csv")) return new Response("c\n1\n", { status: 200 });
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const loaded = await loadSpider2Lite({ fetchImpl });
    expect(evalCalls).toBe(2);
    expect(loaded.questions[0]?.spider2?.gold_tables).toHaveLength(1);
  }, 30_000);

  it("applies --limit after the local### filter (limit counts SQLite rows, not upstream rows)", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("spider2-lite.jsonl") && !url.endsWith("spider2lite_eval.jsonl")) {
        return new Response(SAMPLE_JSONL, { status: 200 });
      }
      if (url.endsWith("spider2lite_eval.jsonl")) {
        return new Response(SAMPLE_EVAL_JSONL, { status: 200 });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const loaded = await loadSpider2Lite({ limit: 1, fetchImpl });
    expect(loaded.questions).toHaveLength(1);
    expect(loaded.questions[0]?.instance_id).toBe("local003");
  });
});

describe("loadSpider2Lite — resolveDbPath", () => {
  let dir: string;
  let jsonlPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-spider2-db-"));
    jsonlPath = join(dir, "spider2-lite.jsonl");
    writeFileSync(jsonlPath, SAMPLE_JSONL);
    mkdirSync(join(dir, "evaluation_suite", "gold", "exec_result"), { recursive: true });
    writeFileSync(join(dir, "evaluation_suite", "gold", "spider2lite_eval.jsonl"), "");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // Empty eval JSONL is enough for resolveDbPath-only tests — they don't exercise the scoring path.
  const fetchEvalOnly = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.endsWith("spider2lite_eval.jsonl")) return new Response("", { status: 200 });
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;

  it("returns null when dataDir is absent", async () => {
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      fetchImpl: fetchEvalOnly,
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
      fetchImpl: fetchEvalOnly,
    });
    expect(await loaded.resolveDbPath("E_commerce")).toBe(fixturePath);
  });

  it("falls back to a flat `<dataDir>/<db>.sqlite` layout for hand-curated caches", async () => {
    const flatPath = join(dir, "Baseball.sqlite");
    writeFileSync(flatPath, "");
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchEvalOnly,
    });
    expect(await loaded.resolveDbPath("Baseball")).toBe(flatPath);
  });

  it("returns null when the `db` field smuggles path-traversal", async () => {
    const loaded = await loadSpider2Lite({
      questionsJsonlPath: jsonlPath,
      dataDir: dir,
      fetchImpl: fetchEvalOnly,
    });
    expect(await loaded.resolveDbPath("../etc/passwd")).toBeNull();
    expect(await loaded.resolveDbPath("/absolute/path")).toBeNull();
    expect(await loaded.resolveDbPath("E_commerce/../../etc")).toBeNull();
  });
});
