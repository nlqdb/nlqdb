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
});
