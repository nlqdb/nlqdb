import { describe, expect, test } from "bun:test";
import { GET } from "../pages/llms.txt.ts";
import { INTEGRATE } from "./integrate.ts";

// WS06-T1: the `## Integrate` section of nlqdb.com/llms.txt is the one
// answer a coding agent is there to get — "how do I integrate it". These
// checks pin that all five surfaces ship with a runnable snippet + a
// canonical docs link, and that the endpoint actually renders them.

const REQUIRED_SURFACES = ["html", "sdk", "cli", "mcp", "http"] as const;

describe("INTEGRATE recipe data", () => {
  test("covers exactly the five required surfaces", () => {
    expect([...INTEGRATE.map((r) => r.id)].sort()).toEqual([...REQUIRED_SURFACES].sort());
  });

  test("every recipe links to an absolute docs.nlqdb.com page", () => {
    for (const r of INTEGRATE) {
      expect(r.docs).toMatch(/^https:\/\/docs\.nlqdb\.com\//);
    }
  });

  test("every recipe has a non-empty snippet and subtitle", () => {
    for (const r of INTEGRATE) {
      expect(r.snippet.trim().length).toBeGreaterThan(0);
      expect(r.sub.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("llms.txt Integrate section", () => {
  test("renders the Integrate heading, every surface, and the docs llms.txt link", async () => {
    const body = await (await GET({} as never)).text();
    expect(body).toContain("## Integrate");
    expect(body).toContain("https://docs.nlqdb.com/llms.txt");
    for (const r of INTEGRATE) {
      expect(body).toContain(`### ${r.title}`);
      expect(body).toContain(r.docs);
    }
  });
});
