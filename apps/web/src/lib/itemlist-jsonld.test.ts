import { describe, expect, test } from "bun:test";

import { itemListJsonLd } from "./itemlist-jsonld.ts";

const site = new URL("https://nlqdb.com");

describe("itemListJsonLd", () => {
  test("emits a schema.org ItemList with one positioned ListItem per entry", () => {
    const ld = itemListJsonLd(
      "Compare nlqdb to alternatives",
      [
        { name: "nlqdb vs Supabase", path: "/vs/supabase" },
        { name: "nlqdb vs Pinecone", path: "/vs/pinecone" },
      ],
      site,
    );
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("ItemList");
    expect(ld.name).toBe("Compare nlqdb to alternatives");
    expect(ld.numberOfItems).toBe(2);
    expect(ld.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "nlqdb vs Supabase",
        url: "https://nlqdb.com/vs/supabase/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "nlqdb vs Pinecone",
        url: "https://nlqdb.com/vs/pinecone/",
      },
    ]);
  });

  test("trailing-slash-normalises every url to the 200, never the bare-path 307", () => {
    const ld = itemListJsonLd(
      "Solve a specific problem with nlqdb",
      [
        { name: "no slash", path: "/solve/a" },
        { name: "already slashed", path: "/solve/b/" },
      ],
      site,
    );
    const urls = ld.itemListElement.map((e) => e.url);
    expect(urls).toEqual(["https://nlqdb.com/solve/a/", "https://nlqdb.com/solve/b/"]);
    for (const u of urls) expect(u.endsWith("/")).toBe(true);
  });

  test("an empty collection yields a valid, empty ItemList (no crash, numberOfItems 0)", () => {
    const ld = itemListJsonLd("Empty", [], site);
    expect(ld.numberOfItems).toBe(0);
    expect(ld.itemListElement).toEqual([]);
  });
});
