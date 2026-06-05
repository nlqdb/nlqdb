// Pure parse / validate / redact for a user-supplied ClickHouse HTTP
// connection URL — the wire-boundary primitive the BYO ClickHouse connect
// path (`SK-MULTIENG-005`, `SK-MULTIENG-006`, `architecture.md §3.6.7`) is
// built on. It is the deliberate ClickHouse parallel of the Postgres
// `connection-url.ts` primitive (`SK-DB-012`), not a generalisation of it:
// ClickHouse over Workers speaks its native **HTTP interface** (`fetch` per
// query, no TCP socket — `SK-MULTIENG-005`), so the wire shape is an
// `http(s)://` endpoint with the database in a `?database=` query param,
// not a libpq `postgres://…/database` URI. `packages/db/` is the canonical
// owner of the ClickHouse engine (`GLOBAL-021`), so the connection shape
// lives here rather than re-implemented inside the route handler.
//
// Contract (`SK-MULTIENG-006`):
//   - validate at the wire boundary and fail loud with a one-sentence next
//     action (`GLOBAL-012`) before the URL is handed to `fetch` or sealed
//     (`GLOBAL-031`) — a clear 400 beats an opaque connect-time error;
//   - reject the native-protocol schemes (`clickhouse:` / `tcp:`): Workers
//     can only reach the HTTP interface, so a `clickhouse://` paste is an
//     actionable mistake, not a transport we silently drop;
//   - the redacted display form is rebuilt from an allowlist of safe parts
//     (scheme, user, host:port, database) only — never copied through — so
//     the password (carried in the userinfo *and*/or the `?password=` query
//     param per the ClickHouse HTTP docs) and any other query setting can't
//     survive into it. That redacted form is the only representation allowed
//     on a span, log, CLI prompt, or SDK envelope; the full original URL
//     rides the `GLOBAL-031` seal so any TLS / settings query params still
//     apply at connect time.
// Zero new deps: WHATWG `URL` only, so it stays weightless in the Workers
// free-tier bundle (`GLOBAL-013`).

const CLICKHOUSE_SCHEMES = new Set(["http:", "https:"]);

// ClickHouse's native-protocol schemes — valid ClickHouse URLs, but they
// address the TCP interface (ports 9000 / 9440) which Workers can't open
// (`SK-MULTIENG-005`). Named so the rejection can point at the fix.
const NATIVE_PROTOCOL_SCHEMES = new Set(["clickhouse:", "clickhousedb:", "clickhouses:", "tcp:"]);

const SHAPE_HINT = "https://user:password@host:8443/?database=name";

// ClickHouse defaults the target database to `default` when the request
// carries no `database` param (ClickHouse HTTP interface docs). Resolving it
// here makes the redacted form show the database the queries will actually
// hit, rather than an empty value.
const DEFAULT_DATABASE = "default";

export type ParsedClickhouseUrl = {
  // Password- and query-stripped display form, rebuilt from safe parts:
  // `https://user@host:8443/?database=analytics`. Safe to log, attach to a
  // span, and echo back to the user.
  redacted: string;
  // `true` for https:// (port 8443 by convention), `false` for http://.
  secure: boolean;
  host: string;
  port: number | null;
  // Resolved target database — the `?database=` param, or `"default"`.
  database: string;
  // The connecting user from the userinfo or the `?user=` param, or null
  // (ClickHouse then uses the `default` user). Never the password.
  user: string | null;
};

export type ParseClickhouseUrlResult =
  | { ok: true; parsed: ParsedClickhouseUrl }
  | { ok: false; message: string };

// `decodeURIComponent` throws on a malformed percent-escape; for a
// display-only field we'd rather show the raw token than reject the whole
// URL, so failures fall back to the input unchanged.
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Parse + validate a ClickHouse HTTP connection URL. Pure + I/O-free.
// Accepts the `http(s)://[user[:password]@]host[:port]/[?database=…]` HTTP
// interface shape (an absent port, absent credentials, and extra settings
// query params all stay valid — they ride the sealed blob) and rejects only
// what `fetch` could not use, so a malformed paste fails here, loudly,
// instead of as an opaque connect-time error.
export function parseClickhouseUrl(raw: string): ParseClickhouseUrlResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return {
      ok: false,
      message: "Connection URL is empty; pass an http(s):// ClickHouse endpoint.",
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: `Connection URL is malformed; use ${SHAPE_HINT}.` };
  }

  if (!CLICKHOUSE_SCHEMES.has(url.protocol)) {
    // `url.protocol` is normalised and credential-free, so echoing it is safe.
    const scheme = url.protocol.replace(/:$/, "");
    if (NATIVE_PROTOCOL_SCHEMES.has(url.protocol)) {
      return {
        ok: false,
        message: `Connection URL scheme "${scheme}" is the native TCP protocol, which isn't reachable here; use the HTTP interface — http:// (port 8123) or https:// (port 8443).`,
      };
    }
    return {
      ok: false,
      message: `Connection URL scheme "${scheme}" is unsupported; use http:// or https://.`,
    };
  }
  if (url.hostname === "") {
    return { ok: false, message: `Connection URL is missing a host; use ${SHAPE_HINT}.` };
  }
  // A comma-separated host list (ClickHouse failover) survives in WHATWG
  // `URL`'s `hostname` as a literal comma, which `fetch` would never accept.
  // Reject it deterministically rather than seal an unreachable host —
  // multi-host BYO is a later slice, mirroring `SK-DB-012`'s Postgres rule.
  if (url.hostname.includes(",")) {
    return {
      ok: false,
      message: `Connection URL has more than one host, which isn't supported yet; pass a single host (${SHAPE_HINT}).`,
    };
  }

  // The database lives in the `?database=` param for the HTTP interface — a
  // path segment is ignored by ClickHouse, so we never read one as the db.
  const dbParam = url.searchParams.get("database");
  const database = dbParam && dbParam !== "" ? dbParam : DEFAULT_DATABASE;

  // User: prefer the userinfo (URL-encoded, so decode for display), else the
  // `?user=` param (already decoded by `URLSearchParams`). Never the password.
  let user: string | null = null;
  if (url.username !== "") {
    user = safeDecode(url.username);
  } else {
    const userParam = url.searchParams.get("user");
    if (userParam) user = userParam;
  }

  const port = url.port === "" ? null : Number(url.port);
  // Rebuilt from an allowlist — `url.host` is `hostname[:port]`, already
  // bracketed for IPv6 (`[::1]:8443`) and credential-free. Building the
  // redacted form from scratch (rather than mutating `url`) guarantees no
  // unanticipated secret-bearing query param leaks through.
  const userPart = user ? `${encodeURIComponent(user)}@` : "";
  const redacted = `${url.protocol}//${userPart}${url.host}/?database=${encodeURIComponent(database)}`;

  return {
    ok: true,
    parsed: {
      redacted,
      secure: url.protocol === "https:",
      host: url.hostname,
      port,
      database,
      user,
    },
  };
}

// Sentinel returned by `redactClickhouseUrl` when the input can't be parsed
// — a fixed string, never the raw input, so an unparseable value that still
// embeds a secret can't leak through a log line.
export const UNPARSEABLE_CLICKHOUSE_URL = "<unparseable ClickHouse URL>";

// Best-effort redaction for log / error paths: the password- and
// query-stripped display form, or the sentinel above on a parse failure.
// Never throws and never echoes the raw input.
export function redactClickhouseUrl(raw: string): string {
  const result = parseClickhouseUrl(raw);
  return result.ok ? result.parsed.redacted : UNPARSEABLE_CLICKHOUSE_URL;
}
