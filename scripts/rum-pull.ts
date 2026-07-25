#!/usr/bin/env bun
// Cloudflare RUM pull — the daily loop's first-party distribution-yield input
// (scorecard rows #1 and #7), the counterpart to scripts/gsc-pull.ts.
//
// Why it exists: row #1 ("visits") and row #7's *referral* half ("referral
// visits landing on the shipped surfaces") were read as one account-level
// total plus a hand-applied browser cut, because the scorecard recorded that
// "account-level RUM can't split per-path". It can — rumPageloadEventsAdaptive
// Groups exposes requestHost, requestPath, refererHost, requestScheme and bot,
// so every number below is a live read instead of an estimate.
//
// Auth: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (the same Workers/DNS/D1
// token CI already carries — RUM lives under account analytics, not zone
// settings, so no new scope is needed).
//
// Usage:
//   bun scripts/rum-pull.ts            # last 7 days (row #1's window)
//   bun scripts/rum-pull.ts --days 28  # match the GSC window (sampled — see below)

import { curlRequest } from "./lib/curl.ts";

const ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

/** Hosts that are our own — a referrer from these is navigation, not a channel. */
const INTERNAL_HOST_SUFFIXES = ["nlqdb.com", "localhost", "127.0.0.1"];

// The synthetic-client cut, stated as a rule rather than applied by hand.
// The stranger-test walker drives Playwright Chromium from a GitHub-Actions
// runner; Cloudflare maps that UA to `Unknown` (or `ChromeHeadless` when the
// headless token survives). The cut is deliberately conservative — it also
// drops a genuine visitor whose UA Cloudflare can't map — so the "Synthetic
// cut" section prints every row it removes, and real-browser is a floor.
const SYNTHETIC_BROWSERS = new Set(["Unknown", "ChromeHeadless"]);

// A capped pull silently drops the tail, and every section is a fold over the
// same rows — so the cap has to ride every header rather than be assumed away.
const ROW_LIMIT = 5000;
const SHOW = 20;

function die(msg: string): never {
  console.error(`rum-pull: ${msg}`);
  process.exit(1);
}

interface Group {
  count: number;
  sum: { visits: number };
  avg: { sampleInterval: number };
  dimensions: {
    requestHost: string;
    requestPath: string;
    requestScheme: string;
    refererHost: string;
    userAgentBrowser: string;
    countryName: string;
    bot: number;
  };
}

async function pull(accountTag: string, token: string, since: string, until: string) {
  // One grouping, every dimension: at this traffic volume the full cross-product
  // is a few hundred rows, and every section below is a fold over it — so the
  // report can never show two sections disagreeing about the same pageload.
  const query = `query($a:String!,$s:Time!,$e:Time!,$n:Int!){viewer{accounts(filter:{accountTag:$a}){
    rumPageloadEventsAdaptiveGroups(
      filter:{datetime_geq:$s,datetime_leq:$e}
      limit:$n
      orderBy:[count_DESC]
    ){
      count sum{visits} avg{sampleInterval}
      dimensions{requestHost requestPath requestScheme refererHost userAgentBrowser countryName bot}
    }
  }}}`;

  const res = await curlRequest(
    "POST",
    ENDPOINT,
    [`Authorization: Bearer ${token}`, "Content-Type: application/json"],
    JSON.stringify({
      query,
      variables: { a: accountTag, s: since, e: until, n: ROW_LIMIT },
    }),
  ).catch((e: Error) => die(e.message));

  if (res.status !== 200) die(`GraphQL HTTP ${res.status}: ${res.body.slice(0, 300)}`);

  const parsed = JSON.parse(res.body);
  // A GraphQL 200 can still carry errors beside partial data; reporting a
  // partial total as if it were whole is the failure mode worth dying on.
  if (parsed.errors?.length) die(`GraphQL: ${parsed.errors[0].message}`);
  const accounts = parsed.data?.viewer?.accounts ?? [];
  if (!accounts.length) die(`no account matched accountTag ${accountTag}`);
  return (accounts[0].rumPageloadEventsAdaptiveGroups ?? []) as Group[];
}

function isInternalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return INTERNAL_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

const isSynthetic = (g: Group) =>
  g.dimensions.bot === 1 || SYNTHETIC_BROWSERS.has(g.dimensions.userAgentBrowser);

/** External referrer host, or "" for direct / internal navigation. */
const externalReferrer = (g: Group) =>
  g.dimensions.refererHost && !isInternalHost(g.dimensions.refererHost)
    ? g.dimensions.refererHost
    : "";

const surface = (g: Group) => `${g.dimensions.requestHost}${g.dimensions.requestPath}`;

/** Fold groups into `key -> {pageloads, visits}`, ranked by pageloads. */
function tally(groups: Group[], key: (g: Group) => string) {
  const acc = new Map<string, { pageloads: number; visits: number }>();
  for (const g of groups) {
    const k = key(g);
    const cur = acc.get(k) ?? { pageloads: 0, visits: 0 };
    cur.pageloads += g.count;
    cur.visits += g.sum.visits;
    acc.set(k, cur);
  }
  return [...acc].sort((a, b) => b[1].pageloads - a[1].pageloads);
}

const sumOf = (groups: Group[]) => ({
  pageloads: groups.reduce((n, g) => n + g.count, 0),
  visits: groups.reduce((n, g) => n + g.sum.visits, 0),
});

const fmt = (n: { pageloads: number; visits: number }) =>
  `${String(n.pageloads).padStart(5)} pl ${String(n.visits).padStart(5)} vis`;

type Tallied = [string, { pageloads: number; visits: number }][];

const daysArg = process.argv.indexOf("--days");
const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 7;
if (!Number.isFinite(days) || days < 1) die("--days must be a positive number");

const accountTag = process.env["CLOUDFLARE_ACCOUNT_ID"] ?? die("CLOUDFLARE_ACCOUNT_ID is not set");
const token = process.env["CLOUDFLARE_API_TOKEN"] ?? die("CLOUDFLARE_API_TOKEN is not set");

const until = new Date();
const since = new Date(until.getTime() - days * 86400_000);
const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;

const groups = await pull(accountTag, token, iso(since), iso(until));

const raw = sumOf(groups);

// Cloudflare's adaptive datasets extrapolate server-side: `count` already equals
// sampleSize × sampleInterval, so it must NOT be multiplied again. What sampling
// costs is resolution — at interval 10 every count is a multiple of 10, so a
// bucket whose true value is under ~10 reads as 0 or 10.
const maxInterval = groups.reduce((m, g) => Math.max(m, g.avg.sampleInterval), 0);
const sampling =
  maxInterval > 1
    ? `SAMPLED (interval up to ${maxInterval}) — counts are estimates already scaled by Cloudflare; do NOT multiply, and treat buckets below the interval as noise`
    : "unsampled (sampleInterval 1) — counts are exact";

// The cap rides every section header, because a truncated pull distorts all of
// them equally: they are folds over one row set.
const capped = groups.length >= ROW_LIMIT;
const capNotice = capped
  ? ` !! HIT rowLimit ${ROW_LIMIT} — the tail is missing, every total here is a floor`
  : "";

/** Print a section whose header states how many rows exist, so a slice is never silent. */
function section(title: string, rows: Tallied, limit = SHOW, empty = "(none)"): void {
  const shown = rows.slice(0, limit);
  const of = shown.length < rows.length ? ` — showing top ${shown.length} of ${rows.length}` : "";
  console.info(`\n## ${title}${of}${capNotice}`);
  if (!rows.length) console.info(`  ${empty}`);
  for (const [k, n] of shown) console.info(`${fmt(n)}  ${k}`);
}

console.info(`# CF RUM — ${iso(since)} → ${iso(until)} (${days}d), ${sampling}`);
console.info(`${fmt(raw)}   raw, every host${capNotice}`);

const synthetic = groups.filter(isSynthetic);
const real = groups.filter((g) => !isSynthetic(g));
console.info(`${fmt(sumOf(real))}   real-browser (a floor — see the synthetic cut below)`);
console.info(
  `${fmt(sumOf(synthetic))}   synthetic: stranger-test walker + Cloudflare-classified bots`,
);

// Row #7's referral half: which channel sent a visitor, and where they landed.
// Independent of the synthetic cut — an external referrer is a real navigation.
const referred = groups.filter((g) => externalReferrer(g) !== "");
const byReferrer = tally(referred, externalReferrer);
section(
  `Referral yield — ${sumOf(referred).pageloads} pageloads from ${byReferrer.length} external referrers [scorecard row #7]`,
  byReferrer,
  byReferrer.length, // the published number: never truncated
  "(none — no externally-referred pageload in the window)",
);

section(
  "Referral landings — which surface each referral actually opened",
  tally(referred, (g) => `${externalReferrer(g)} → ${surface(g)}`),
  Number.POSITIVE_INFINITY, // ditto — row #7 publishes this list
);

section("Landing surfaces, real-browser", tally(real, surface));

section(
  "Client mix, real-browser",
  tally(real, (g) => `${g.dimensions.userAgentBrowser} · ${g.dimensions.countryName}`),
);

// Print what the cut removed rather than asserting it was all synthetic: the
// rule is a client class, so any genuinely-human row it swallows shows up here.
// Uncapped, because the header claims completeness.
section(
  "Synthetic cut — every row removed above",
  tally(
    synthetic,
    (g) => `${g.dimensions.userAgentBrowser} · ${g.dimensions.countryName} · ${surface(g)}`,
  ),
  Number.POSITIVE_INFINITY,
);

// GLOBAL-039's residual gap, quantified: the static-asset surfaces answer
// plaintext http until the zone toggle (blocked-by-human), and Google indexes
// what it can reach. This is the size of that leak, not an estimate of it.
const plaintext = groups.filter((g) => g.dimensions.requestScheme === "http");
section(
  `Plaintext http pageloads — ${sumOf(plaintext).pageloads} [GLOBAL-039 residual]`,
  tally(plaintext, surface),
  Number.POSITIVE_INFINITY,
  "(none — every pageload arrived over https)",
);
