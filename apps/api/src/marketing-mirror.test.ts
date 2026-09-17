import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  isMarketingMirrorPath,
  MARKETING_MIRROR_PREFIXES,
  marketingMirrorRedirect,
} from "./marketing-mirror.ts";

// SK-WEB-026 — the merged app host (app.nlqdb.com) serves the same build as the
// canonical marketing host, so it must 301 the WHOLE marketing surface (trees,
// singles, aggregators) to nlqdb.com to stop Google indexing a duplicate —
// WITHOUT touching the product (/app/*), auth (/auth/*, /oauth/*), API (/v1/*),
// the root, or the canonical host itself.
describe("marketingMirrorRedirect", () => {
  test("301-targets blog/solve/vs on the merged app host to the canonical host", () => {
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/blog/some-post/"))).toBe(
      "https://nlqdb.com/blog/some-post/",
    );
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/solve/streak/"))).toBe(
      "https://nlqdb.com/solve/streak/",
    );
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/vs/metabase/"))).toBe(
      "https://nlqdb.com/vs/metabase/",
    );
  });

  test("301-targets marketing singles on the merged app host", () => {
    for (const [path, want] of [
      ["/agents/", "https://nlqdb.com/agents/"],
      ["/architecture/", "https://nlqdb.com/architecture/"],
      ["/integrations/", "https://nlqdb.com/integrations/"],
      ["/manifesto/", "https://nlqdb.com/manifesto/"],
      ["/pricing/", "https://nlqdb.com/pricing/"],
      ["/privacy/", "https://nlqdb.com/privacy/"],
      ["/terms/", "https://nlqdb.com/terms/"],
      ["/security/hall-of-fame/", "https://nlqdb.com/security/hall-of-fame/"],
    ] as const) {
      expect(marketingMirrorRedirect(new URL(`https://app.nlqdb.com${path}`))).toBe(want);
    }
  });

  test("301-targets the SEO/discovery aggregators (exact files) on the merged app host", () => {
    for (const file of ["/llms.txt", "/rss.xml", "/sitemap.xml"] as const) {
      expect(marketingMirrorRedirect(new URL(`https://app.nlqdb.com${file}`))).toBe(
        `https://nlqdb.com${file}`,
      );
    }
  });

  test("targets the tree root exactly", () => {
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/blog"))).toBe(
      "https://nlqdb.com/blog",
    );
  });

  test("preserves the query string", () => {
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/blog/?utm_source=x"))).toBe(
      "https://nlqdb.com/blog/?utm_source=x",
    );
  });

  test("never touches product, auth, oauth, API, or the root on the app host", () => {
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/"))).toBeNull();
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/app/"))).toBeNull();
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/auth/sign-in/"))).toBeNull();
    expect(
      marketingMirrorRedirect(new URL("https://app.nlqdb.com/oauth/mcp-authorize/")),
    ).toBeNull();
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/v1/ask"))).toBeNull();
  });

  test("does not touch the canonical marketing host (no loop)", () => {
    expect(marketingMirrorRedirect(new URL("https://nlqdb.com/blog/some-post/"))).toBeNull();
  });

  test("does not redirect on preview / workers.dev hosts", () => {
    expect(
      marketingMirrorRedirect(new URL("https://pr-5-nlqdb-api.example.workers.dev/blog/x/")),
    ).toBeNull();
  });

  test("does not match lookalike paths", () => {
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/blogroll"))).toBeNull();
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/vspecial"))).toBeNull();
    // A single's prefix must not swallow a longer product-ish path.
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/agents-api"))).toBeNull();
    // Aggregator files are matched exactly — no sub-path or suffix lookalikes.
    // (`run_worker_first` only routes their bare entry, so the matcher must
    // agree, else its model would diverge from the wrangler routing.)
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/llms.txt/foo"))).toBeNull();
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/sitemap.xml.bak"))).toBeNull();
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/rss.xmlsomething"))).toBeNull();
  });
});

// The `run_worker_first` array in wrangler.toml decides which app-host paths
// even reach this front-controller; if it drifts from MARKETING_MIRROR_PREFIXES
// a marketing route silently serves a crawlable duplicate again (the exact
// regression that SK-WEB-026's trees-only scope risked). Derive the expected
// array from the prefixes and assert equality, so adding a route is a one-list
// edit the test proves complete.
describe("wrangler run_worker_first stays in sync with MARKETING_MIRROR_PREFIXES", () => {
  test("every prefix is routed through the worker, and nothing extra is", () => {
    const toml = readFileSync(fileURLToPath(new URL("../wrangler.toml", import.meta.url)), "utf8");
    const block = toml.match(/run_worker_first\s*=\s*\[([\s\S]*?)\]/);
    expect(block).not.toBeNull();
    const actual = new Set(Array.from((block?.[1] ?? "").matchAll(/"([^"]+)"/g), (m) => m[1]));

    // A prefix whose last segment has a dot is an exact file (`/llms.txt`);
    // it needs only its own entry. Every other prefix is a path tree and
    // needs both the bare entry and the `/*` glob.
    const expected = new Set<string>();
    for (const p of MARKETING_MIRROR_PREFIXES) {
      const isFile = p.slice(p.lastIndexOf("/") + 1).includes(".");
      expected.add(p);
      if (!isFile) expected.add(`${p}/*`);
    }

    expect([...actual].sort()).toEqual([...expected].sort());
  });
});

describe("isMarketingMirrorPath", () => {
  test("matches the tree roots and their descendants only", () => {
    expect(isMarketingMirrorPath("/blog")).toBe(true);
    expect(isMarketingMirrorPath("/blog/post/")).toBe(true);
    expect(isMarketingMirrorPath("/solve/x")).toBe(true);
    expect(isMarketingMirrorPath("/vs/y")).toBe(true);
    expect(isMarketingMirrorPath("/blogroll")).toBe(false);
    expect(isMarketingMirrorPath("/app/")).toBe(false);
    expect(isMarketingMirrorPath("/")).toBe(false);
  });
});
