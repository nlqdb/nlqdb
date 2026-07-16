#!/usr/bin/env bun
// Google Search Console pull — the daily loop's Google-side distribution-yield
// input (scorecard rows #6–#7). Reads search performance (clicks, impressions,
// CTR, position; top queries + pages) and sitemap status for the domain
// property via a service account the founder added as a Restricted GSC user.
//
// Auth: `GSC_SERVICE_ACCOUNT_JSON` holds the service account's JSON key
// (single line). The script signs a RS256 JWT (scope webmasters.readonly),
// exchanges it for an access token, and calls the Search Analytics API.
// Setup steps for the founder live in docs/blocked-by-human.md.
//
// Usage:
//   bun scripts/gsc-pull.ts            # last 28 days
//   bun scripts/gsc-pull.ts --days 7
//
// Transport is curl, not `fetch`: the daily loop runs behind a TLS-terminating
// egress proxy that bun's fetch can't traverse, but curl already trusts
// (same reasoning as scripts/syndicate-devto.ts).

const SITE = "sc-domain:nlqdb.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}`;

function die(msg: string): never {
  console.error(`gsc-pull: ${msg}`);
  process.exit(1);
}

async function curlRequest(
  method: string,
  url: string,
  headers: string[],
  body?: string,
): Promise<{ status: number; body: string }> {
  const args = ["-sS", "-X", method, url, "-w", "\n%{http_code}"];
  for (const h of headers) args.push("-H", h);
  if (body !== undefined) args.push("--data-binary", body);
  const proc = Bun.spawn(["curl", ...args], { stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  await proc.exited;
  if (proc.exitCode !== 0) die(`curl ${method} ${url} failed (exit ${proc.exitCode}): ${err}`);
  const idx = out.lastIndexOf("\n");
  return { status: Number(out.slice(idx + 1)), body: out.slice(0, idx) };
}

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return Buffer.from(bytes).toString("base64url");
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function accessToken(): Promise<string> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw)
    die("GSC_SERVICE_ACCOUNT_JSON is unset — see docs/blocked-by-human.md for the one-time setup.");
  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(raw);
  } catch {
    die(
      "GSC_SERVICE_ACCOUNT_JSON is not valid JSON (paste the whole service-account key file as one line).",
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const jwt = `${header}.${claims}.${b64url(new Uint8Array(signature))}`;
  const res = await curlRequest(
    "POST",
    TOKEN_URL,
    ["Content-Type: application/x-www-form-urlencoded"],
    `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  );
  if (res.status !== 200) die(`token exchange failed (${res.status}): ${res.body}`);
  return JSON.parse(res.body).access_token;
}

type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

async function query(
  token: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit: number,
): Promise<Row[]> {
  const res = await curlRequest(
    "POST",
    `${API}/searchAnalytics/query`,
    [`Authorization: Bearer ${token}`, "Content-Type: application/json"],
    JSON.stringify({ startDate, endDate, dimensions, rowLimit }),
  );
  if (res.status === 403)
    die(
      `403 — the service account isn't a user on the ${SITE} property yet (GSC → Settings → Users and permissions → Add user → Restricted).`,
    );
  if (res.status !== 200) die(`searchAnalytics query failed (${res.status}): ${res.body}`);
  return JSON.parse(res.body).rows ?? [];
}

function fmtRow(r: Row): string {
  const key = r.keys?.join(" · ") ?? "(total)";
  return `${String(r.clicks).padStart(4)} clicks  ${String(r.impressions).padStart(6)} impr  pos ${r.position.toFixed(1).padStart(5)}  ${key}`;
}

const daysArg = process.argv.indexOf("--days");
const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 28;
if (!Number.isFinite(days) || days < 1) die("--days must be a positive number");

// GSC data lags ~2 days; end the window there so the last buckets aren't zeros.
const end = new Date(Date.now() - 2 * 86400_000);
const start = new Date(end.getTime() - days * 86400_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const token = await accessToken();

const totals = await query(token, iso(start), iso(end), [], 1);
console.info(`# GSC ${SITE} — ${iso(start)} → ${iso(end)} (${days}d)`);
console.info(totals.length ? fmtRow(totals[0]) : "no data in window");

console.info("\n## Top queries");
for (const r of await query(token, iso(start), iso(end), ["query"], 20)) console.info(fmtRow(r));

console.info("\n## Top pages");
for (const r of await query(token, iso(start), iso(end), ["page"], 20)) console.info(fmtRow(r));

const sm = await curlRequest("GET", `${API}/sitemaps`, [`Authorization: Bearer ${token}`]);
if (sm.status === 200) {
  console.info("\n## Sitemaps");
  for (const s of JSON.parse(sm.body).sitemap ?? []) {
    const counts = (s.contents ?? [])
      .map(
        (c: { type: string; submitted: string; indexed: string }) =>
          `${c.type}: ${c.submitted} submitted / ${c.indexed} indexed`,
      )
      .join(", ");
    console.info(
      `${s.path} — pending=${s.isPending} errors=${s.errors ?? 0} warnings=${s.warnings ?? 0} ${counts}`,
    );
  }
}
