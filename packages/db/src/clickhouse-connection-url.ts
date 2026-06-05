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
//   - reject the ClickHouse client DSN schemes (`clickhouse:` /
//     `clickhousedb:` / `tcp:` / `clickhouse+http:` …) with a pointer to the
//     plain HTTP endpoint: those are driver / SQLAlchemy connection schemes,
//     not the HTTP-interface URL nlqdb fetches, so the paste is an actionable
//     mistake rather than a transport we silently accept;
//   - reject a database-bearing path with no `?database=` (a clickhouse-connect
//     / SQLAlchemy DSN paste like `…/mydb`): the HTTP interface reads the
//     database from `?database=` and ignores the path, so adopting it would
//     query a database the sealed URL never selects — fail loud instead;
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

// ClickHouse client DSN schemes (driver / SQLAlchemy). They're valid for a
// ClickHouse client library but aren't the plain HTTP endpoint nlqdb fetches —
// `clickhouse://` may even mean native TCP (port 9000) in `clickhouse-driver`,
// while `clickhousedb://` / `clickhouse+http://` are the SQLAlchemy HTTP
// dialect. Named so the rejection can point at the fix without asserting a
// transport that depends on which library produced the URL.
const CLICKHOUSE_CLIENT_SCHEMES = new Set([
  "clickhouse:",
  "clickhousedb:",
  "clickhouses:",
  "clickhouse+http:",
  "clickhouse+https:",
  "tcp:",
]);

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
    if (CLICKHOUSE_CLIENT_SCHEMES.has(url.protocol)) {
      return {
        ok: false,
        message: `Connection URL scheme "${scheme}" is a ClickHouse client DSN scheme; pass the plain HTTP endpoint — http:// (port 8123) or https:// (port 8443).`,
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

  // A database-bearing path with no `?database=` is a clickhouse-connect /
  // SQLAlchemy DSN paste (`…/mydb`). ClickHouse's HTTP interface reads the db
  // from the query param and ignores the path, so the queries would silently
  // hit `default`, not `mydb` — reject rather than connect to the wrong db. A
  // path *with* an explicit `?database=` is treated as a reverse-proxy prefix
  // and kept (the query param is authoritative).
  if (!dbParam && url.pathname !== "/" && url.pathname !== "") {
    return {
      ok: false,
      message: `Connection URL puts the database in the path; ClickHouse's HTTP interface reads it from a query param, so use ${SHAPE_HINT}.`,
    };
  }

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
  // bracketed for IPv6 (`[::1]:8443`) and credential-free; `url.pathname` (a
  // reverse-proxy prefix, `/` for the common case) is path-only and carries no
  // credential, so it is preserved. Building the redacted form from scratch
  // (rather than mutating `url`) guarantees no unanticipated secret-bearing
  // query param leaks through — the whole query is dropped bar the re-encoded
  // database.
  const userPart = user ? `${encodeURIComponent(user)}@` : "";
  const redacted = `${url.protocol}//${userPart}${url.host}${url.pathname}?database=${encodeURIComponent(database)}`;

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
