import { describe, expect, test } from "vitest";
import { isMarketingMirrorPath, marketingMirrorRedirect } from "./marketing-mirror.ts";

// SK-WEB-026 — the merged app host (app.nlqdb.com) serves the same build as the
// canonical marketing host, so it must 301 the marketing content trees to
// nlqdb.com to stop Google indexing a duplicate — WITHOUT touching the product
// (/app/*), auth (/auth/*), API (/v1/*), or the canonical host itself.
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

  test("never touches product, auth, or API paths on the app host", () => {
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/app/"))).toBeNull();
    expect(marketingMirrorRedirect(new URL("https://app.nlqdb.com/auth/sign-in/"))).toBeNull();
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
