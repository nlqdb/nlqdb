import { describe, expect, test } from "bun:test";
import { GET } from "../llms.txt.ts";

// `llms.txt` is the markdown index LLM-IDE crawlers (Claude Desktop,
// Perplexity, Cursor, …) fetch. These checks pin the primary routes we
// must advertise — notably `/agents` (the GLOBAL-036 analytical-memory
// wedge) and `/pricing`, which the index silently omitted before — so a
// future edit can't drop the pivot's headline page from the machine-
// readable map (SK-CMP-004).

const body = await (GET({} as never) as Response).text();

describe("llms.txt index", () => {
  test("advertises the /agents pivot landing page", () => {
    expect(body).toContain("(https://nlqdb.com/agents/)");
  });

  test("advertises the /pricing page", () => {
    expect(body).toContain("(https://nlqdb.com/pricing/)");
  });

  test("surfaces the R-07 drop-in artifacts to coding agents (reach Channel #12)", () => {
    // llms.txt is a surface coding agents fetch directly, so it must point
    // them at every ready-to-drop repo artifact, not just the connect command.
    expect(body).toContain("https://nlqdb.com/agent-artifacts/AGENTS.snippet.md");
    expect(body).toContain("https://nlqdb.com/agent-artifacts/nlqdb-memory/SKILL.md");
    expect(body).toContain("https://nlqdb.com/agent-artifacts/nlqdb-memory.mdc");
    expect(body).toContain("https://nlqdb.com/agent-artifacts/codex-config.toml");
    // The SK-PIVOT-017 docs→memory pack — same channel, fifth artifact.
    expect(body).toContain("https://nlqdb.com/agent-artifacts/nlqdb-docs-memory/SKILL.md");
  });

  test("advertises the /blog hub and every published post", async () => {
    const { BLOG_POSTS } = await import("../../data/blog.ts");
    expect(body).toContain("(https://nlqdb.com/blog/)");
    for (const p of BLOG_POSTS) {
      expect(body).toContain(`(https://nlqdb.com/blog/${p.slug}/)`);
    }
  });

  test("status reflects the open product, not a closed beta", () => {
    expect(body).not.toContain("closed beta");
    expect(body).toContain("start anonymously");
  });

  test("advertises the agent_memory_v1 preset as live, not 'coming'", () => {
    // The preset ships behind `MEMORY_PRESET=1`, set in prod (apps/api/wrangler.toml),
    // and every drop-in artifact already tells agents it is live for signed-in keys.
    // llms.txt is the machine-readable index answer engines + coding-agent IDEs fetch;
    // a stale "coming" here sends them down the slower `nlqdb_query` NL path instead of
    // the fast typed-write preset path. Pin it so it can't drift back.
    expect(body).not.toMatch(/preset is coming/i);
    expect(body).toContain("nlqdb_remember");
    expect(body).toContain('POST /v1/databases { "preset": "agent_memory_v1" }');
  });
});
