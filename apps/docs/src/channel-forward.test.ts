import { describe, expect, test } from "bun:test";
import { forwardChannelParams, forwardChannelParamsOnLinks } from "./channel-forward.ts";

/** A stand-in anchor — the rewrite only needs get/setAttribute. */
function link(href: string) {
  const attrs: Record<string, string> = { href };
  return {
    getAttribute: (name: string) => attrs[name] ?? null,
    setAttribute: (name: string, value: string) => {
      attrs[name] = value;
    },
    get href() {
      return attrs.href as string;
    },
  };
}

const TAGGED = "?utm_source=agent-artifacts";

describe("forwardChannelParams", () => {
  test("carries the channel onto an apex link", () => {
    expect(forwardChannelParams("https://nlqdb.com/integrations/", TAGGED)).toBe(
      "https://nlqdb.com/integrations/?utm_source=agent-artifacts",
    );
  });

  test("carries medium and campaign too, and only those", () => {
    const out = new URL(
      forwardChannelParams(
        "https://nlqdb.com/agents",
        "?utm_source=mcp-registry&utm_medium=listing&utm_campaign=q3&gclid=x&ref=y",
      ),
    );
    expect(out.searchParams.get("utm_source")).toBe("mcp-registry");
    expect(out.searchParams.get("utm_medium")).toBe("listing");
    expect(out.searchParams.get("utm_campaign")).toBe("q3");
    expect(out.searchParams.get("gclid")).toBeNull();
    expect(out.searchParams.get("ref")).toBeNull();
  });

  test("preserves an apex link's own query", () => {
    expect(forwardChannelParams("https://nlqdb.com/app/new?q=hello", TAGGED)).toBe(
      "https://nlqdb.com/app/new?q=hello&utm_source=agent-artifacts",
    );
  });

  test("never overwrites a link that already names its channel", () => {
    const hand = "https://nlqdb.com/agents?utm_source=agent-artifacts";
    expect(forwardChannelParams(hand, "?utm_source=mcp-registry")).toBe(hand);
  });

  test("does nothing without an incoming utm_source", () => {
    for (const search of ["", "?", "?utm_medium=listing", "?utm_source="]) {
      expect(forwardChannelParams("https://nlqdb.com/integrations/", search)).toBe(
        "https://nlqdb.com/integrations/",
      );
    }
  });

  test("skips every host that does not capture first touch", () => {
    // Subdomains are `isInternalHost` to attribution.ts and run no capture;
    // a look-alike host must never receive our params either.
    for (const href of [
      "https://docs.nlqdb.com/agent-memory/",
      "https://mcp.nlqdb.com/mcp",
      "https://github.com/nlqdb/nlqdb",
      "https://nlqdb.com.evil.example/x",
      "https://notnlqdb.com/x",
    ]) {
      expect(forwardChannelParams(href, TAGGED)).toBe(href);
    }
  });

  test("skips relative and non-http hrefs", () => {
    for (const href of ["/mcp/", "../sdk/", "#step-2", "mailto:hi@nlqdb.com", ""]) {
      expect(forwardChannelParams(href, TAGGED)).toBe(href);
    }
  });
});

describe("forwardChannelParamsOnLinks", () => {
  test("rewrites only the apex links and reports the count", () => {
    const links = [
      link("https://nlqdb.com/integrations/"),
      link("https://docs.nlqdb.com/sdk/"),
      link("/mcp/"),
      link("https://nlqdb.com/agent-artifacts/README.md"),
    ];
    expect(forwardChannelParamsOnLinks(links, TAGGED)).toBe(2);
    expect(links[0]?.href).toBe("https://nlqdb.com/integrations/?utm_source=agent-artifacts");
    expect(links[1]?.href).toBe("https://docs.nlqdb.com/sdk/");
    expect(links[2]?.href).toBe("/mcp/");
    expect(links[3]?.href).toBe(
      "https://nlqdb.com/agent-artifacts/README.md?utm_source=agent-artifacts",
    );
  });

  test("is a no-op for an untagged visit", () => {
    const links = [link("https://nlqdb.com/integrations/")];
    expect(forwardChannelParamsOnLinks(links, "")).toBe(0);
    expect(links[0]?.href).toBe("https://nlqdb.com/integrations/");
  });

  test("ignores anchors with no href", () => {
    const anchor = { getAttribute: () => null, setAttribute: () => {} };
    expect(forwardChannelParamsOnLinks([anchor], TAGGED)).toBe(0);
  });
});
