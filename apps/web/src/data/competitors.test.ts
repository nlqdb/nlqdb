import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPETITORS, competitorBySlug } from "./competitors.ts";

const ogDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "og");

// Comparison-page data is loaded by 4 surfaces (page template, /vs
// index, sitemap, llms.txt). These checks pin the invariants the
// template + AEO best-practice (SK-CMP-001 / SK-CMP-003) rely on.

describe("COMPETITORS data integrity", () => {
  test("every competitor has a unique slug", () => {
    const slugs = COMPETITORS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every slug is URL-safe (lower-kebab)", () => {
    for (const c of COMPETITORS) {
      expect(c.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  test("every competitor URL is absolute https", () => {
    for (const c of COMPETITORS) {
      expect(c.url).toMatch(/^https:\/\//);
    }
  });

  test("SK-CMP-001: every competitor lists ≥3 'when to choose them' bullets", () => {
    for (const c of COMPETITORS) {
      expect(c.whenChooseThem.length).toBeGreaterThanOrEqual(3);
      expect(c.whenChooseUs.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("SK-CMP-003: every competitor has ≥4 FAQs", () => {
    for (const c of COMPETITORS) {
      expect(c.faqs.length).toBeGreaterThanOrEqual(4);
    }
  });

  test("SK-CMP-003: at least one FAQ question names the competitor verbatim", () => {
    for (const c of COMPETITORS) {
      const namedInFaq = c.faqs.some((f) => f.q.includes(c.name));
      expect(namedInFaq).toBe(true);
    }
  });

  test("every comparison table row uses valid claim values", () => {
    const valid = new Set(["shipped", "partial", "no"]);
    for (const c of COMPETITORS) {
      for (const row of c.features) {
        expect(valid.has(row.us)).toBe(true);
        expect(valid.has(row.them)).toBe(true);
      }
    }
  });

  test("competitorBySlug returns the matching entry", () => {
    for (const c of COMPETITORS) {
      expect(competitorBySlug(c.slug)).toBe(c);
    }
  });

  test("competitorBySlug returns undefined for unknown slug (404 path)", () => {
    expect(competitorBySlug("definitely-not-a-real-competitor")).toBeUndefined();
  });

  // SK-MCP-002: comparison FAQs are lifted verbatim by AI search engines, so
  // user-facing copy must only ever name MCP tools that actually exist —
  // `nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe` (+ `nlqdb_remember`).
  // There is no `nlqdb_create_database` verb (nlqdb_query materialises on first
  // reference). Pin both invariants so a future page can't reintroduce a phantom.
  const ALLOWED_MCP_TOOLS = new Set([
    "nlqdb_query",
    "nlqdb_list_databases",
    "nlqdb_describe",
    "nlqdb_remember",
  ]);
  const userFacingText = (c: (typeof COMPETITORS)[number]): string =>
    [
      c.oneLiner,
      ...c.whenChooseUs,
      ...c.whenChooseThem,
      ...c.features.flatMap((f) => [f.feature, f.note ?? ""]),
      ...c.faqs.flatMap((f) => [f.q, f.a]),
    ].join(" ");

  test("SK-MCP-002: no comparison page names a phantom `create_database` verb", () => {
    for (const c of COMPETITORS) {
      expect(userFacingText(c)).not.toContain("create_database");
    }
  });

  test("SK-MCP-002: every nlqdb_* tool named in copy is a real MCP tool", () => {
    for (const c of COMPETITORS) {
      const tokens = userFacingText(c).match(/nlqdb_[a-z_]+/g) ?? [];
      for (const tok of tokens) {
        expect(ALLOWED_MCP_TOOLS.has(tok)).toBe(true);
      }
    }
  });

  // WS-07: the /vs template cross-links /agents on exactly the
  // agent-memory cluster, keyed on the P2 persona. Pin that membership so
  // the cross-link stays scoped to the memory comparisons (the four memory
  // layers + the vector-store wing, Pinecone).
  test("WS-07: the agent-memory cluster is the P2-agent-builder persona", () => {
    const p2 = COMPETITORS.filter((c) => c.persona === "P2 agent builder").map((c) => c.slug);
    expect(new Set(p2)).toEqual(new Set(["mem0", "zep", "letta", "langmem", "pinecone"]));
  });

  // WS-08 (SK-PIVOT-012): vs/[slug].astro sets ogImage for every P2 page, so
  // each P2 slug must have a committed card or the social card 404s silently.
  // Pin the wiring to the artifact so adding a P2 competitor without
  // re-running `og:gen` fails here, not on a live share.
  test("WS-08: every P2-agent-builder competitor has a committed OG card", () => {
    for (const c of COMPETITORS.filter((c) => c.persona === "P2 agent builder")) {
      expect(existsSync(join(ogDir, `vs-${c.slug}.png`))).toBe(true);
    }
  });
});
