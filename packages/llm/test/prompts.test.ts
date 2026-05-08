// Asserts the engine-classifier prompt embeds the SK-MULTIENG-002 fit
// table verbatim — that table is the canonical source per
// `docs/features/multi-engine-adapter/FEATURE.md`. Drift between the
// prompt and the table would fork the LLM's worldview from the docs.

import { describe, expect, it } from "vitest";
import { buildEngineClassifyUser, ENGINE_CLASSIFY_SYSTEM } from "../src/prompts.ts";

describe("ENGINE_CLASSIFY_SYSTEM (SK-DB-010 / SK-MULTIENG-002)", () => {
  it("embeds the SK-MULTIENG-002 engine-fit table header verbatim", () => {
    expect(ENGINE_CLASSIFY_SYSTEM).toContain(
      "| Engine | Strong fit | Avoid when | Free-tier ceiling |",
    );
  });

  it("includes the postgres row with Neon and the 'tracker / app data' default phrase", () => {
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("**postgres** (Neon)");
    expect(ENGINE_CLASSIFY_SYSTEM).toContain('default for "tracker / app data" goals');
  });

  it("includes the clickhouse row with Tinybird and the 10 GB free-tier ceiling", () => {
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("**clickhouse** (Tinybird)");
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("10 GB + 1 k reads/day");
  });

  it("flags sqlite + redis as deferred so the LLM can't pick them today", () => {
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("sqlite");
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("redis");
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("*deferred*");
    expect(ENGINE_CLASSIFY_SYSTEM).toMatch(/only return "postgres" or "clickhouse"/);
  });

  it("forces strict JSON output to keep parseJsonResponse happy", () => {
    expect(ENGINE_CLASSIFY_SYSTEM).toContain('"engine"');
    expect(ENGINE_CLASSIFY_SYSTEM).toContain('"confidence"');
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("No prose, no code fences.");
  });
});

describe("buildEngineClassifyUser", () => {
  it("formats the user-prompt as `Goal: <text>`", () => {
    expect(buildEngineClassifyUser({ goal: "an orders tracker" })).toBe("Goal: an orders tracker");
  });
});
