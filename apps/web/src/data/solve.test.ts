import { describe, expect, test } from "bun:test";
import { SOLVE_ENTRIES, relatedSolveEntries, solveBySlug } from "./solve.ts";

// `/solve/<slug>` data is loaded by 4 surfaces (page template, /solve
// index, sitemap, llms.txt). These checks pin the invariants the
// template + AEO best-practice (SK-SOLVE-001 / SK-SOLVE-002 /
// SK-SOLVE-003) rely on.

describe("SOLVE_ENTRIES data integrity", () => {
  test("every solve entry has a unique slug", () => {
    const slugs = SOLVE_ENTRIES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every slug is URL-safe (lower-kebab)", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  test("searchTitle is non-empty and under 90 chars (LLM citation-panel width)", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.searchTitle.length).toBeGreaterThan(0);
      expect(s.searchTitle.length).toBeLessThanOrEqual(90);
    }
  });

  test("oneLiner stays under the 60-word AEO direct-answer ceiling", () => {
    for (const s of SOLVE_ENTRIES) {
      const wordCount = s.oneLiner.trim().split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(60);
    }
  });

  test("painContext is non-empty (sets the search-intent context)", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.painContext.length).toBeGreaterThan(0);
    }
  });

  test("demoGoal is non-empty (drives <nlq-data> + draft-storage seed)", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.demoGoal.length).toBeGreaterThan(0);
    }
  });

  test("SK-SOLVE-001: every entry has ≥3 howNlqdbAnswers bullets", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.howNlqdbAnswers.length).toBeGreaterThanOrEqual(3);
    }
  });

  // The howNlqdbAnswers "Each ≤25 words" rule (solve.ts) is an AEO scannability
  // invariant — these bullets are lifted onto the card and into LLM citation
  // panels, where a 35-word "bullet" reads as a paragraph and gets demoted. It
  // lived only in a code comment and had silently drifted (25 of ~50 bullets
  // over budget); this guard moves it into the one layer that can't forget, and
  // names the offenders on failure so the next over-long bullet fails in the PR
  // that writes it (mirrors the /vs SK-CMP-001 bullet guard).
  test("every howNlqdbAnswers bullet stays under the 25-word AEO scannability ceiling", () => {
    const over: string[] = [];
    for (const s of SOLVE_ENTRIES) {
      s.howNlqdbAnswers.forEach((b, i) => {
        const words = b.trim().split(/\s+/).length;
        if (words > 25) over.push(`${s.slug} [bullet ${i}] (${words}w): ${b}`);
      });
    }
    expect(over).toEqual([]);
  });

  test("SK-SOLVE-002: every entry has ≥2 honest 'whatItDoesnt' bullets", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.whatItDoesnt.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("SK-SOLVE-001: every entry has ≥3 FAQs", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.faqs.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("SK-SOLVE-003: every entry cites ≥2 enduring discussion-hub URLs", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.sources.length).toBeGreaterThanOrEqual(2);
      for (const src of s.sources) {
        expect(src.url).toMatch(/^https:\/\//);
        expect(src.label.length).toBeGreaterThan(0);
      }
    }
  });

  // The persona guard lives in `personas.test.ts` — one home for both AEO
  // surfaces (/solve, /vs).

  test("FAQ answers stay under 80 words each (LLM lift-verbatim sweet spot)", () => {
    for (const s of SOLVE_ENTRIES) {
      for (const f of s.faqs) {
        const wordCount = f.a.trim().split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(80);
      }
    }
  });

  test("solveBySlug returns the matching entry", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(solveBySlug(s.slug)).toBe(s);
    }
  });

  test("solveBySlug returns undefined for unknown slug (404 path)", () => {
    expect(solveBySlug("definitely-not-a-real-pain")).toBeUndefined();
  });

  // Rendered prose (oneLiner, painContext, howNlqdbAnswers, whatItDoesnt,
  // faqs, source labels) is public-facing copy — the /solve pages are the
  // highest-impression organic surface. Internal tracking IDs (SK-*, GLOBAL-*,
  // E-0x roadmap codes, docs/features repo paths) are meaningless to a stranger
  // and read as a leak; they must never reach rendered HTML (same norm the
  // P1..P4 persona-code guard above enforces). Named on failure so the next
  // leak fails in the PR that writes it.
  test("no internal tracking IDs leak into rendered /solve prose", () => {
    const leak = /\b(?:SK-[A-Z]+-\d+|GLOBAL-\d+|E-0\d)\b|docs\/features\//;
    for (const s of SOLVE_ENTRIES) {
      const prose = [
        s.searchTitle,
        s.oneLiner,
        s.painContext,
        s.demoGoal,
        s.demoWhy,
        ...s.howNlqdbAnswers,
        ...s.whatItDoesnt,
        ...s.faqs.flatMap((f) => [f.q, f.a]),
        ...s.sources.map((src) => src.label),
      ];
      for (const text of prose) {
        const hit = text.match(leak);
        expect(hit ? `${s.slug}: ${hit[0]} — "${text.slice(0, 60)}…"` : "").toBe("");
      }
    }
  });

  // `related` is the `/solve ↔ /solve` internal-link mesh (crawl-priority
  // remedy for "Discovered - currently not indexed"). Every listed slug must
  // resolve to a real sibling, never point at itself, and carry no dupes — a
  // dangling anchor renders a 404 link and wastes the crawl signal.
  test("every `related` slug resolves, is not self-referential, and is unique", () => {
    for (const s of SOLVE_ENTRIES) {
      if (!s.related) continue;
      expect(new Set(s.related).size).toBe(s.related.length);
      expect(s.related).not.toContain(s.slug);
      for (const slug of s.related) {
        expect(solveBySlug(slug) ? "" : `${s.slug} → missing ${slug}`).toBe("");
      }
      expect(relatedSolveEntries(s).length).toBe(s.related.length);
    }
  });

  // The stuck wedge pages (`build-vs-buy-agent-memory`, `expire-old-agent-memory`)
  // were "Discovered - currently not indexed": known to Google but crawl-
  // deprioritised because their only inbound links were the flat `/solve/`
  // index + sitemap. The documented fix is contextual links from indexed,
  // topically-relevant siblings — so each must receive ≥1 inbound `related`
  // link, or the crawl-priority lever silently regresses.
  test("stage-0 wedge pages receive contextual inbound `related` links", () => {
    const needsInbound = ["build-vs-buy-agent-memory", "expire-old-agent-memory"];
    for (const target of needsInbound) {
      const inbound = SOLVE_ENTRIES.filter((s) => s.related?.includes(target));
      expect(
        inbound.length > 0 ? "" : `${target} has no inbound related link (orphaned)`,
      ).toBe("");
    }
  });
});
