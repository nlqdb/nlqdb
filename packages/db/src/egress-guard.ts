// Pure SSRF / egress classifier for a user-supplied BYO connection host —
// the connect-time guard the BYO Postgres (`SK-DB-011`) and BYO ClickHouse
// (`SK-MULTIENG-005`) paths share (`GLOBAL-035`). It is the third member of
// the BYO connect-path primitive family, alongside the connection-URL
// parsers (`SK-DB-012`, `SK-MULTIENG-006`) and the at-rest envelope
// (`GLOBAL-031`): pure, zero-dependency, owned by `packages/db/`
// (`GLOBAL-021`), shipped ahead of its `connect.ts` callers.
//
// Why this is separate from the URL parsers: `parseConnectionUrl` /
// `parseClickhouseUrl` deliberately validate the URL *shape* and do **not**
// block a host (`SK-DB-012` / `SK-MULTIENG-006` say so explicitly). But a BYO
// ClickHouse query has the Worker `fetch()` an arbitrary user-supplied host
// directly (no Hyperdrive proxy, unlike the Neon PG path), and BYO Postgres
// connect-time introspection does the same — so a host that points at
// `127.0.0.1`, an RFC-1918 address, or the cloud-metadata endpoint
// (`169.254.169.254`) is a Server-Side Request Forgery vector straight into
// our own network. This module is the deterministic half of the defence.
//
// Contract (`GLOBAL-035`):
//   - A **literal IP** is decided here, fail-loud per `GLOBAL-012`: any
//     address in a loopback / private / link-local / unique-local /
//     carrier-grade-NAT / this-host / multicast / reserved range is
//     rejected (omitting multicast is the CVE-2025-8267 bypass). This
//     includes the
//     IPv6 transition forms that *embed* such a v4 — IPv4-mapped
//     (`::ffff:a.b.c.d`), IPv4-compatible (`::a.b.c.d`), 6to4 (`2002:V4::`)
//     and NAT64 (`64:ff9b::/32`, both well-known and local-use prefixes) —
//     which are the live 2026 SSRF-filter-bypass
//     class (Symfony CVE-2026-48736, Discourse / Twenty / openclaw
//     advisories). The alternate IPv4 encodings — decimal (`2130706433`),
//     hex (`0x7f000001`), octal (`0177.0.0.1`), mixed (`0xa.0.0.1`) and the
//     trailing-dot FQDN form — are folded by handing the host to the same
//     WHATWG `URL` parser the transport uses, rather than re-implementing a
//     bypass-prone decoder.
//   - A **hostname** can resolve to anything, and a pure function cannot
//     bound DNS rebinding, so a name returns `{ ok: true, needsDnsRecheck:
//     true }`: the connect-time caller must resolve it and re-run this guard
//     on every resolved address (the same function works on a resolved IP).
//     The two names a pure check *can* settle — `localhost` / `*.localhost`
//     (RFC 6761 loopback) and `metadata.google.internal` (GCP metadata) —
//     are rejected here.
// Zero new deps: WHATWG `URL` only, so it stays weightless in the Workers
// free-tier bundle (`GLOBAL-013`).

// `needsDnsRecheck` is `true` only for a DNS name the caller must resolve and
// re-guard; a literal IP that passes is `false` (nothing left to resolve), so
// the same function guards both the pre-flight host and each resolved address.
export type EgressGuardResult =
  | { ok: true; needsDnsRecheck: boolean }
  | { ok: false; message: string };

const NEXT_ACTION = "point the connection at a publicly reachable host.";

// Classify the target of a BYO connection host. Pure + I/O-free.
export function guardEgressHost(host: string): EgressGuardResult {
  const trimmed = host.trim();
  if (trimmed === "") {
    return { ok: false, message: `Connection host is empty; ${NEXT_ACTION}` };
  }

  // `url.hostname` wraps IPv6 in brackets (`[::1]`); resolved addresses may
  // not. Strip a bracket pair so both shapes reach the IPv6 path.
  const bare = trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;

  // IPv6 literal — the only host shape that carries a colon. Classify it
  // directly: a bare resolved IPv6 (`::1`) can't round-trip through `new URL`
  // (which demands brackets), and `ipv6ToBytes` already accepts both the
  // dotted-tail and hextet textual forms.
  if (bare.includes(":")) {
    const bytes = ipv6ToBytes(bare);
    if (!bytes) {
      return {
        ok: false,
        message: `Connection host "${bare}" is not a valid address; ${NEXT_ACTION}`,
      };
    }
    const label = classifyIpv6(bytes);
    return label ? blocked(bare, label) : { ok: true, needsDnsRecheck: false };
  }

  // Everything else: canonicalise through the same WHATWG `URL` parser the
  // transport uses, so every alternate IPv4 encoding — decimal
  // (`2130706433`), hex (`0x7f000001`), octal (`0177.0.0.1`), shorthand
  // (`127.1`), mixed (`0xa.0.0.1`), and the trailing-dot form — collapses to
  // the dotted quad `fetch` will actually connect to before we classify it.
  // Re-implementing that decoder is the bypass-prone path the OWASP SSRF
  // cheat-sheet warns against; deferring to `URL` keeps the guard and the
  // transport in lockstep on what a host resolves to.
  const canonical = canonicaliseHost(bare);
  if (canonical === null) {
    return {
      ok: false,
      message: `Connection host "${bare}" is not a valid address; ${NEXT_ACTION}`,
    };
  }

  const octets = parseIpv4Octets(canonical);
  if (octets) {
    const label = classifyIpv4(octets);
    return label ? blocked(canonical, label) : { ok: true, needsDnsRecheck: false };
  }

  // A DNS name: settle the well-known internal names a pure check can, and
  // defer everything else to the connect-time resolve-then-recheck. A
  // trailing dot (`localhost.`, the FQDN form) still resolves to the same
  // target, so strip one before matching.
  const name = canonical.endsWith(".") ? canonical.slice(0, -1) : canonical;
  if (name === "localhost" || name.endsWith(".localhost")) {
    return {
      ok: false,
      message: `Connection host "${canonical}" is a loopback name; ${NEXT_ACTION}`,
    };
  }
  if (name === "metadata.google.internal") {
    return {
      ok: false,
      message: `Connection host "${canonical}" is a cloud-metadata name; ${NEXT_ACTION}`,
    };
  }
  return { ok: true, needsDnsRecheck: true };
}

function blocked(host: string, label: string): EgressGuardResult {
  return {
    ok: false,
    message: `Connection host "${host}" is in a private or reserved range (${label}); ${NEXT_ACTION}`,
  };
}

// Canonicalise an alternate-encoding host through WHATWG `URL` (the parser
// `fetch` itself uses), returning the normalised `hostname` or null if it is
// not a usable host. Never throws.
function canonicaliseHost(host: string): string | null {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return null;
  }
}

function parseIpv4Octets(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    nums.push(n);
  }
  const [a = 0, b = 0, c = 0, d = 0] = nums;
  return [a, b, c, d];
}

// Returns a short range label for a non-routable IPv4, or null for a public
// one. Ranges per the OWASP SSRF Prevention Cheat-Sheet plus this-host
// (0.0.0.0/8) and shared address space (100.64.0.0/10).
function classifyIpv4(octets: [number, number, number, number]): string | null {
  const [a, b] = octets;
  if (a === 0) return "this-host 0.0.0.0/8";
  if (a === 10) return "private 10.0.0.0/8";
  if (a === 100 && b >= 64 && b <= 127) return "carrier-grade NAT 100.64.0.0/10";
  if (a === 127) return "loopback 127.0.0.0/8";
  if (a === 169 && b === 254) return "link-local 169.254.0.0/16 (cloud metadata)";
  if (a === 172 && b >= 16 && b <= 31) return "private 172.16.0.0/12";
  if (a === 192 && b === 168) return "private 192.168.0.0/16";
  // Multicast (224.0.0.0/4) + reserved/broadcast (240.0.0.0/4 incl.
  // 255.255.255.255): never a legitimate DB host, and omitting them is the
  // CVE-2025-8267 SSRF-filter-bypass class.
  if (a >= 224) return "multicast/reserved 224.0.0.0/3";
  return null;
}

// Returns a short range label for a non-routable IPv6, or null for a public
// one. Beyond the native loopback / unspecified / unique-local / link-local
// ranges, the four IPv4-embedding transition forms are unwrapped and their
// embedded v4 re-classified — the SSRF-filter-bypass class behind the 2026
// CVEs.
function classifyIpv6(bytes: number[]): string | null {
  const at = (i: number): number => bytes[i] ?? 0;
  const b0 = at(0);
  const b1 = at(1);

  if (bytes.slice(0, 15).every((x) => x === 0)) {
    if (at(15) === 1) return "IPv6 loopback ::1";
    if (at(15) === 0) return "IPv6 unspecified ::";
  }
  if (b0 === 0xff) return "IPv6 multicast ff00::/8";
  if ((b0 & 0xfe) === 0xfc) return "IPv6 unique-local fc00::/7";
  if (b0 === 0xfe && (b1 & 0xc0) === 0x80) return "IPv6 link-local fe80::/10";
  if (b0 === 0xfe && (b1 & 0xc0) === 0xc0) return "IPv6 site-local fec0::/10";

  const embedded = (octets: [number, number, number, number]): string | null => {
    const inner = classifyIpv4(octets);
    return inner ? `IPv6-embedded ${inner}` : null;
  };
  const last4: [number, number, number, number] = [at(12), at(13), at(14), at(15)];
  // ::ffff:0:0/96 IPv4-mapped and ::/96 IPv4-compatible (deprecated).
  if (bytes.slice(0, 10).every((x) => x === 0) && at(10) === 0xff && at(11) === 0xff) {
    return embedded(last4);
  }
  if (bytes.slice(0, 12).every((x) => x === 0)) return embedded(last4);
  // NAT64 — the well-known `64:ff9b::/96` *and* the local-use `64:ff9b:1::/48`
  // prefix (RFC 8215); both share the `64:ff9b::/32` umbrella and carry the
  // embedded v4 in the last 32 bits. Matching only the `/96` form is the
  // CVE-2026-46678 / HackerOne #3634400 bypass.
  if (b0 === 0x00 && b1 === 0x64 && at(2) === 0xff && at(3) === 0x9b) {
    return embedded(last4);
  }
  // 2002::/16 6to4 — embedded v4 in bytes 2..6.
  if (b0 === 0x20 && b1 === 0x02) return embedded([at(2), at(3), at(4), at(5)]);

  return null;
}

// Expand an IPv6 textual address (with `::` compression and an optional
// trailing embedded IPv4 dotted quad) to its 16 bytes, or null if malformed.
function ipv6ToBytes(addr: string): number[] | null {
  if (addr.includes("%")) return null; // a scope/zone id is not a connectable host

  // Fold a trailing embedded IPv4 (`::ffff:1.2.3.4`) into two hextets.
  let text = addr;
  const v4Match = /:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(text);
  if (v4Match) {
    const v4 = parseIpv4Octets(v4Match[1] ?? "");
    if (!v4) return null;
    const [a = 0, b = 0, c = 0, d = 0] = v4;
    const hi = ((a << 8) | b).toString(16);
    const lo = ((c << 8) | d).toString(16);
    text = `${text.slice(0, v4Match.index + 1)}${hi}:${lo}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const toHextets = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const group of part.split(":")) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
      out.push(Number.parseInt(group, 16));
    }
    return out;
  };

  const head = toHextets(halves[0] ?? "");
  if (!head) return null;

  let hextets: number[];
  if (halves.length === 2) {
    const tail = toHextets(halves[1] ?? "");
    if (!tail) return null;
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    hextets = [...head, ...Array.from({ length: fill }, () => 0), ...tail];
  } else {
    if (head.length !== 8) return null;
    hextets = head;
  }
  if (hextets.length !== 8) return null;

  const bytes: number[] = [];
  for (const h of hextets) bytes.push((h >> 8) & 0xff, h & 0xff);
  return bytes;
}
