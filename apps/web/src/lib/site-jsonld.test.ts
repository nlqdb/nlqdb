import { describe, expect, test } from "bun:test";

import { organizationJsonLd, webSiteJsonLd } from "./site-jsonld.ts";

const site = new URL("https://nlqdb.com");

describe("organizationJsonLd", () => {
  test("emits a schema.org Organization with a stable @id, logo, and GitHub sameAs", () => {
    const ld = organizationJsonLd(site);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Organization");
    expect(ld["@id"]).toBe("https://nlqdb.com/#organization");
    expect(ld.name).toBe("nlqdb");
    expect(ld.url).toBe("https://nlqdb.com/");
    expect(ld.logo).toBe("https://nlqdb.com/og-default.png");
    expect(ld.sameAs).toEqual(["https://github.com/nlqdb/nlqdb"]);
  });
});

describe("webSiteJsonLd", () => {
  test("emits a schema.org WebSite naming the Organization as publisher by @id", () => {
    const ld = webSiteJsonLd(site);
    expect(ld["@type"]).toBe("WebSite");
    expect(ld["@id"]).toBe("https://nlqdb.com/#website");
    expect(ld.name).toBe("nlqdb");
    expect(ld.url).toBe("https://nlqdb.com/");
    // Publisher binds the site entity to the Organization by @id, so crawlers
    // consolidate both nodes (and the per-page SoftwareApplication publisher).
    expect(ld.publisher).toEqual({ "@id": "https://nlqdb.com/#organization" });
  });

  test("omits SearchAction until a GET query entrypoint exists (SK-WEB-002)", () => {
    expect("potentialAction" in webSiteJsonLd(site)).toBe(false);
  });
});
