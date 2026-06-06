import { describe, expect, it } from "vitest";
import { guardEgressHost } from "../src/index.ts";

// GLOBAL-035 — the BYO connect-time egress guard. Two guarantees under test:
// (1) every literal IP in a loopback / private / link-local / unique-local /
// CGNAT / this-host range is rejected fail-loud (GLOBAL-012), *including* the
// IPv6 transition forms that embed such a v4 and the decimal/hex/octal IPv4
// encodings (the live SSRF-filter-bypass class); and (2) a DNS name the pure
// guard can't settle returns needsDnsRecheck so the connect-time caller
// resolves and re-guards it.

const expectBlocked = (host: string) => {
  const result = guardEgressHost(host);
  expect(result.ok, `${host} should be blocked`).toBe(false);
  if (result.ok) return;
  // GLOBAL-012: one sentence, with the next action.
  expect(result.message).toContain("publicly reachable host");
};

const expectPublicLiteral = (host: string) => {
  const result = guardEgressHost(host);
  expect(result.ok, `${host} should be allowed`).toBe(true);
  if (!result.ok) return;
  expect(result.needsDnsRecheck).toBe(false);
};

describe("guardEgressHost — blocks non-routable IPv4 literals", () => {
  it.each([
    "127.0.0.1",
    "127.255.255.255",
    "10.0.0.5",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // AWS / GCP / Azure metadata endpoint
    "169.254.0.1",
    "100.64.0.1", // carrier-grade NAT (RFC 6598)
    "0.0.0.0",
    "224.0.0.1", // multicast (224.0.0.0/4)
    "239.255.255.250", // SSDP multicast
    "240.0.0.1", // reserved (240.0.0.0/4)
    "255.255.255.255", // broadcast
  ])("blocks %s", (host) => expectBlocked(host));

  it("names the cloud-metadata range so the error is actionable", () => {
    const result = guardEgressHost("169.254.169.254");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("169.254.0.0/16");
  });
});

describe("guardEgressHost — allows public IPv4 literals", () => {
  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.15.0.1",
    "172.32.0.1",
    "192.169.0.1",
    "100.63.0.1",
    "100.128.0.1",
  ])("allows %s", (host) => expectPublicLiteral(host));
});

describe("guardEgressHost — folds alternate IPv4 encodings before classifying", () => {
  it.each([
    "2130706433", // decimal 127.0.0.1
    "0x7f000001", // hex 127.0.0.1
    "0177.0.0.1", // octal 127.0.0.1
    "127.1", // shorthand 127.0.0.1
    "0xa000005", // hex 10.0.0.5
    "2852039166", // decimal 169.254.169.254
    "0xa.0.0.1", // mixed hex + dotted → 10.0.0.1
    "127.0x0.0.1", // mixed dotted + hex → 127.0.0.1
    "169.254.169.254.", // trailing-dot FQDN form of the metadata endpoint
  ])("blocks %s (canonicalises to a private address)", (host) => expectBlocked(host));

  it("allows a public decimal-encoded address", () => {
    // 134744072 === 8.8.8.8
    expectPublicLiteral("134744072");
  });
});

describe("guardEgressHost — blocks non-routable IPv6 literals", () => {
  it.each([
    "::1", // loopback
    "[::1]", // bracketed (url.hostname form)
    "::", // unspecified
    "fc00::1", // unique-local
    "fd12:3456::1", // unique-local
    "fe80::1", // link-local
    "[fe80::1]",
    "ff02::1", // multicast (ff00::/8)
    "fec0::1", // site-local (deprecated, fec0::/10)
  ])("blocks %s", (host) => expectBlocked(host));
});

describe("guardEgressHost — unwraps IPv6 transition forms (CVE-2026 bypass class)", () => {
  it.each([
    "::ffff:127.0.0.1", // IPv4-mapped, dotted tail
    "::ffff:7f00:1", // IPv4-mapped, hextet tail (the url.hostname form)
    "[::ffff:7f00:1]",
    "::ffff:169.254.169.254", // IPv4-mapped metadata
    "::ffff:10.0.0.1",
    "::127.0.0.1", // IPv4-compatible (deprecated)
    "64:ff9b::127.0.0.1", // NAT64 well-known prefix
    "2002:7f00:1::", // 6to4 embedding 127.0.0.1
    "2002:a00:1::", // 6to4 embedding 10.0.0.1
  ])("blocks %s", (host) => expectBlocked(host));

  it("allows an IPv4-mapped public address", () => {
    expectPublicLiteral("::ffff:8.8.8.8");
  });

  it("allows a 6to4 address embedding a public v4", () => {
    // 2002:0808:0808:: embeds 8.8.8.8
    expectPublicLiteral("2002:808:808::");
  });
});

describe("guardEgressHost — DNS names", () => {
  it("flags an ordinary hostname for a connect-time resolve-then-recheck", () => {
    const result = guardEgressHost("db.example.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.needsDnsRecheck).toBe(true);
  });

  it("blocks the loopback names a pure check can settle", () => {
    expectBlocked("localhost");
    expectBlocked("LOCALHOST");
    expectBlocked("localhost."); // trailing-dot FQDN form
    expectBlocked("foo.localhost");
    expectBlocked("metadata.google.internal");
  });

  it("treats a normal hostname containing 'localhost' as a substring as a name", () => {
    // Only an exact match or a `.localhost` suffix is the reserved TLD.
    const result = guardEgressHost("localhost.example.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.needsDnsRecheck).toBe(true);
  });
});

describe("guardEgressHost — malformed input fails safe", () => {
  it("rejects an empty / whitespace host", () => {
    for (const host of ["", "   "]) {
      const result = guardEgressHost(host);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects a colon-bearing string that is not a valid IPv6 address", () => {
    expectBlocked(":::1");
    expectBlocked("12345::g");
  });

  it("rejects a numeric-looking host that canonicalises to nothing", () => {
    expectBlocked("999.999.999.999");
  });

  it("trims surrounding whitespace", () => {
    const result = guardEgressHost("  10.0.0.1  ");
    expect(result.ok).toBe(false);
  });
});
