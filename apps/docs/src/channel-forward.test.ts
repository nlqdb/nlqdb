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
    // a look-alike host must never receive our params either. Every entry is
    // a way an attacker-shaped href could try to read as the apex.
    for (const href of [
      "https://docs.nlqdb.com/agent-memory/",
      "https://mcp.nlqdb.com/mcp",
      "https://github.com/nlqdb/nlqdb",
      "https://nlqdb.com.evil.example/x", // apex as a subdomain prefix
      "https://notnlqdb.com/x", // apex as a host suffix
      "https://nlqdb.com@evil.example/", // apex as userinfo
      "https://nlqdb.com:pw@evil.example/", // apex as userinfo + password
      "https://evil.example/?x=nlqdb.com", // apex in the query
      "https://evil.example/nlqdb.com/", // apex in the path
      "https://evil.example/#https://nlqdb.com/", // apex in the fragment
      "https://nlqdb%2ecom.evil.example/", // percent-encoded dot
      "https://nlqdb.cоm/x", // IDN homograph (Cyrillic о)
      "https://xn--nlqdb-8cd.com/x", // its punycode form
      "https://nlqdb.com./x", // trailing-dot FQDN
      "//evil.example/x", // protocol-relative
    ]) {
      expect(forwardChannelParams(href, TAGGED)).toBe(href);
    }
  });

  test("matches the apex whatever the case, and resolves protocol-relative", () => {
    for (const href of ["HTTPS://NLQDB.COM/x", "https://NlQdB.CoM/x", "//nlqdb.com/x"]) {
      expect(forwardChannelParams(href, TAGGED)).toBe(
        "https://nlqdb.com/x?utm_source=agent-artifacts",
      );
    }
  });

  test("skips relative hrefs and every non-https scheme", () => {
    // `javascript:`'s "query string" is executable source, so a scheme this
    // rewrites must be one where appending a param is inert. Only https is.
    for (const href of [
      "/mcp/",
      "../sdk/",
      "#step-2",
      "",
      "mailto:hi@nlqdb.com",
      "tel:+15550100",
      "javascript:alert(1)",
      "javascript://nlqdb.com/%0aalert(1)",
      "data:text/html,<b>x</b>",
      "blob:https://nlqdb.com/abc",
      "http://nlqdb.com/x",
      "ftp://nlqdb.com/x",
    ]) {
      expect(forwardChannelParams(href, TAGGED)).toBe(href);
    }
  });

  test("param values are encoded, never able to add a param or break the URL", () => {
    const out = forwardChannelParams(
      "https://nlqdb.com/agents",
      `?utm_source=${encodeURIComponent('x"><img src=q onerror=alert(1)>')}&utm_medium=${encodeURIComponent("a&utm_source=evil#frag")}`,
    );
    const url = new URL(out);
    expect(url.origin + url.pathname).toBe("https://nlqdb.com/agents");
    expect(url.hash).toBe("");
    expect([...url.searchParams.keys()]).toEqual(["utm_source", "utm_medium"]);
    expect(url.searchParams.get("utm_source")).toBe('x"><img src=q onerror=alert(1)>');
    expect(out).not.toContain("<");
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
