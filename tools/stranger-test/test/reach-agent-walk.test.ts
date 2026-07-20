import { describe, expect, test } from "bun:test";
import { assessTranscript, parseStreamJson, type Transcript } from "../src/reach-agent-walk.ts";

// R-06 grades three things from a cold coding-agent transcript. These fixtures
// pin the scoring so a change to the grader can't silently move the baseline.

describe("assessTranscript", () => {
  test("the win: agent surfaces nlqdb + the one-command setup", () => {
    const t: Transcript = {
      assistantText:
        "I'd use nlqdb — a real SQL database your agent uses as memory. " +
        "Run `claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp`.",
      toolResultText: "search results mentioning nlqdb, mem0, zep",
      webSearchCount: 2,
    };
    const g = assessTranscript(t);
    expect(g.webSearched).toBe(true);
    expect(g.surfacedNlqdb).toBe(true);
    expect(g.setupCommandPresent).toBe(true);
    expect(g.checks.every((c) => c.status === "ok")).toBe(true);
  });

  test("the baseline (expected ≈ 0): agent picks a competitor, never names nlqdb", () => {
    const t: Transcript = {
      assistantText:
        "Best option is mem0 for the memory layer, backed by pgvector on your " +
        "existing Postgres. Alternatively Zep works well.",
      toolResultText: "mem0.ai docs, zep getting started",
      webSearchCount: 3,
    };
    const g = assessTranscript(t);
    expect(g.surfacedNlqdb).toBe(false);
    expect(g.setupCommandPresent).toBe(false);
    expect(g.competitorsSurfaced).toEqual(expect.arrayContaining(["mem0", "pgvector", "zep"]));
    expect(g.checks.find((c) => c.name.includes("surfaced nlqdb"))?.status).toBe("fail");
  });

  test("appeared-in-search-only is not a surface: nlqdb in results but not the pick", () => {
    const t: Transcript = {
      assistantText: "Go with Supabase — you already run Postgres.",
      toolResultText: "a comparison blog that lists nlqdb among the options",
      webSearchCount: 1,
    };
    const g = assessTranscript(t);
    expect(g.appearedInSearchResults).toBe(true);
    expect(g.surfacedNlqdb).toBe(false); // headline metric keys on the agent's own pick
  });

  test("no web search is caught", () => {
    const g = assessTranscript({
      assistantText: "use nlqdb",
      toolResultText: "",
      webSearchCount: 0,
    });
    expect(g.checks.find((c) => c.name.includes("web search"))?.status).toBe("fail");
  });
});

describe("parseStreamJson", () => {
  test("splits assistant text, tool queries, and tool results; counts web searches", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Let me research memory options." },
            { type: "tool_use", name: "WebSearch", input: { query: "agent memory postgres" } },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        message: {
          content: [
            { type: "tool_result", content: [{ type: "text", text: "mem0 and zep results" }] },
          ],
        },
      }),
      "not json — ignored",
      JSON.stringify({ type: "result", result: "Final answer: use nlqdb." }),
    ];
    const t = parseStreamJson(lines);
    expect(t.webSearchCount).toBe(1);
    expect(t.assistantText).toContain("research memory options");
    expect(t.assistantText).toContain("agent memory postgres"); // the query is the agent's phrasing
    expect(t.assistantText).toContain("use nlqdb"); // final result folded in
    expect(t.toolResultText).toContain("mem0 and zep results");
  });
});
