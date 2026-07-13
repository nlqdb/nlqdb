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

  // SK-CMP-001: each "when to choose" bullet is capped at 16 words (the type
  // comment on `whenChooseUs`/`whenChooseThem`). AI search engines lift these
  // verbatim and the /vs card renders them as scannable bullets, so an
  // over-long bullet reads as a paragraph and degrades both. The Outerbase
  // entry once drifted to 7 over-budget bullets without surfacing in CI — this
  // guard fails loudly so a future entry can't repeat that.
  test("SK-CMP-001: every 'when to choose' bullet is ≤16 words", () => {
    const wordCount = (s: string) => s.trim().split(/\s+/).length;
    const over: string[] = [];
    for (const c of COMPETITORS) {
      for (const bullet of [...c.whenChooseUs, ...c.whenChooseThem]) {
        const n = wordCount(bullet);
        if (n > 16) over.push(`${c.slug} (${n}w): ${bullet}`);
      }
    }
    expect(over).toEqual([]);
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

  // SK-MCP-002 phantom-tool guard: comparison copy must only name MCP tools
  // that actually ship. This was competitors-only + a hard-coded tool set;
  // it is now superseded by `mcp-tool-integrity.test.ts`, which reads the
  // shipped catalog from the MCP server and sweeps *every* apps/web surface
  // (run-62's `nlqdb_recall` phantom shipped to /agents + /integrations,
  // which this file never scanned).

  // WS-07: the /vs template cross-links /agents on exactly the
  // agent-memory cluster, keyed on the P2 persona. Pin that membership so
  // the cross-link stays scoped to the memory comparisons (the four memory
  // layers + the vector-store wing — Pinecone (hosted), Chroma (OSS-first),
  // Weaviate (enterprise/hybrid-search), Qdrant (Rust/quantization,
  // Apache-2.0), and Milvus (open-source ANN at billion-vector scale) — plus
  // the knowledge-graph wing (Cognee) and the recall-API wing (Supermemory).
  test("WS-07: the agent-memory cluster is the P2-agent-builder persona", () => {
    const p2 = COMPETITORS.filter((c) => c.persona === "P2 agent builder").map((c) => c.slug);
    expect(new Set(p2)).toEqual(
      new Set([
        "mem0",
        "zep",
        "letta",
        "langmem",
        "pinecone",
        "chroma",
        "weaviate",
        "qdrant",
        "milvus",
        "cognee",
        "supermemory",
        "honcho",
      ]),
    );
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
