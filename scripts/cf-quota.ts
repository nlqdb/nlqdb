#!/usr/bin/env bun
// Free-tier headroom on the shared Cloudflare account — the scorecard's Ops
// read. D1 rows read and Workers KV operations are capped per *account* per
// UTC day; past a cap every call fails until midnight UTC, so a project
// outside nlqdb can take nlqdb down (2026-11-18: another project's D1 read
// 132.9 M rows and failed Deploy API, Deploy — Canary and CI's rateme12
// attach job). KV writes back Better Auth's session storage, so its cap is a
// sign-in outage too. Limits: developers.cloudflare.com/d1/platform/limits/,
// developers.cloudflare.com/kv/platform/limits/
//
// Auth: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (the token rum-pull uses).
// Usage: bun scripts/cf-quota.ts [--days 7]   # exits 1 when the latest day is over a cap

import { curlRequest } from "./lib/curl.ts";

const API = "https://api.cloudflare.com/client/v4";
const DAILY_ROWS_READ_CAP = 5_000_000;
const KV_DAILY_CAPS: Record<string, number> = {
  read: 100_000,
  write: 1_000,
  delete: 1_000,
  list: 1_000,
};
/** D1 databases nlqdb owns or attaches; every other one shares the cap. */
const NLQDB_DBS = new Set(["nlqdb-app", "nlqdb-canary", "rateme12", "rateme12-botfeedback"]);

function die(msg: string): never {
  console.error(`cf-quota: ${msg}`);
  process.exit(1);
}

const account = process.env["CLOUDFLARE_ACCOUNT_ID"] || die("CLOUDFLARE_ACCOUNT_ID is not set");
const token = process.env["CLOUDFLARE_API_TOKEN"] || die("CLOUDFLARE_API_TOKEN is not set");
const auth = [`Authorization: Bearer ${token}`, "Content-Type: application/json"];
const daysArg = process.argv.indexOf("--days");
const days = daysArg > 0 ? Number(process.argv[daysArg + 1]) : 7;
if (!Number.isInteger(days) || days < 1 || days > 30) die("--days takes 1–30");

async function call(method: string, url: string, body?: string): Promise<unknown> {
  const res = await curlRequest(method, url, auth, body).catch((e: Error) => die(e.message));
  if (res.status !== 200) die(`${url}: HTTP ${res.status} — ${res.body.slice(0, 200)}`);
  return JSON.parse(res.body);
}

const list = (await call("GET", `${API}/accounts/${account}/d1/database?per_page=100`)) as {
  result: { uuid: string; name: string }[];
};
const names = new Map(list.result.map((d) => [d.uuid, d.name]));

const since = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
const query = `query{viewer{accounts(filter:{accountTag:"${account}"}){d1AnalyticsAdaptiveGroups(limit:1000,filter:{date_geq:"${since}"}){sum{rowsRead}dimensions{date databaseId}}}}}`;
const gql = (await call("POST", `${API}/graphql`, JSON.stringify({ query }))) as {
  errors?: unknown[];
  data?: {
    viewer: {
      accounts: {
        d1AnalyticsAdaptiveGroups: {
          sum: { rowsRead: number };
          dimensions: { date: string; databaseId: string };
        }[];
      }[];
    };
  };
};
if (gql.errors?.length || !gql.data) die(`GraphQL: ${JSON.stringify(gql.errors).slice(0, 300)}`);

const groups = gql.data.viewer.accounts[0]?.d1AnalyticsAdaptiveGroups ?? [];
// nlqdb's own DBs read every day, so an empty answer is a wrong account or scope, not 0 %.
if (groups.length === 0)
  die(`no D1 analytics since ${since} — check the account id and token scope`);
const byDay = new Map<string, Map<string, number>>();
for (const g of groups) {
  const name = names.get(g.dimensions.databaseId) ?? g.dimensions.databaseId;
  const day = byDay.get(g.dimensions.date) ?? new Map<string, number>();
  day.set(name, (day.get(name) ?? 0) + g.sum.rowsRead);
  byDay.set(g.dimensions.date, day);
}

const m = (n: number) => `${(n / 1e6).toFixed(2)} M`;
console.info(`# D1 rows read per UTC day — account cap ${m(DAILY_ROWS_READ_CAP)}`);
for (const date of [...byDay.keys()].sort()) {
  const dbs = [...(byDay.get(date) ?? [])].sort((a, b) => b[1] - a[1]);
  const total = dbs.reduce((s, [, n]) => s + n, 0);
  const ours = dbs.filter(([n]) => NLQDB_DBS.has(n)).reduce((s, [, n]) => s + n, 0);
  const top = dbs[0];
  console.info(
    `${date}  ${m(total).padStart(9)}  ${((100 * total) / DAILY_ROWS_READ_CAP).toFixed(0).padStart(4)} %  nlqdb ${m(ours)}  top ${top?.[0]} ${m(top?.[1] ?? 0)}${total > DAILY_ROWS_READ_CAP ? "  OVER CAP" : ""}`,
  );
}
// Only the latest day blocks deploys; an older breach is history, not a red gate.
const latest = [...byDay.keys()].sort().at(-1);
const latestTotal = [...(byDay.get(latest ?? "") ?? [])].reduce((s, [, n]) => s + n, 0);
let over = latestTotal > DAILY_ROWS_READ_CAP;

const kvNs = (await call(
  "GET",
  `${API}/accounts/${account}/storage/kv/namespaces?per_page=100`,
)) as {
  result: { id: string; title: string }[];
};
const kvNames = new Map(kvNs.result.map((n) => [n.id, n.title]));
const kvQuery = `query{viewer{accounts(filter:{accountTag:"${account}"}){kvOperationsAdaptiveGroups(limit:1000,filter:{date_geq:"${since}"}){sum{requests}dimensions{date namespaceId actionType}}}}}`;
const kvGql = (await call("POST", `${API}/graphql`, JSON.stringify({ query: kvQuery }))) as {
  errors?: unknown[];
  data?: {
    viewer: {
      accounts: {
        kvOperationsAdaptiveGroups: {
          sum: { requests: number };
          dimensions: { date: string; namespaceId: string; actionType: string };
        }[];
      }[];
    };
  };
};
if (kvGql.errors?.length || !kvGql.data)
  die(`GraphQL (KV): ${JSON.stringify(kvGql.errors).slice(0, 300)}`);
// date → action → namespace → ops
const kvByDay = new Map<string, Map<string, Map<string, number>>>();
for (const g of kvGql.data.viewer.accounts[0]?.kvOperationsAdaptiveGroups ?? []) {
  const { date, actionType, namespaceId } = g.dimensions;
  const day = kvByDay.get(date) ?? new Map<string, Map<string, number>>();
  const ns = day.get(actionType) ?? new Map<string, number>();
  const name = kvNames.get(namespaceId) ?? namespaceId;
  ns.set(name, (ns.get(name) ?? 0) + g.sum.requests);
  day.set(actionType, ns);
  kvByDay.set(date, day);
}
const pct = (n: number, cap: number) => `${((100 * n) / cap).toFixed(0)} %`;
console.info(
  `\n# Workers KV ops per UTC day — caps ${Object.entries(KV_DAILY_CAPS)
    .map(([a, c]) => `${a} ${c.toLocaleString("en")}`)
    .join(", ")}`,
);
const kvLatest = [...kvByDay.keys()].sort().at(-1);
for (const date of [...kvByDay.keys()].sort()) {
  const cells = Object.entries(KV_DAILY_CAPS).map(([action, cap]) => {
    const ns = [...(kvByDay.get(date)?.get(action) ?? [])].sort((a, b) => b[1] - a[1]);
    const total = ns.reduce((s, [, n]) => s + n, 0);
    if (date === kvLatest && total > cap) over = true;
    const top = action === "write" && ns[0] ? ` (top ${ns[0][0]} ${ns[0][1]})` : "";
    return `${action} ${total} = ${pct(total, cap)}${top}${total > cap ? " OVER CAP" : ""}`;
  });
  console.info(`${date}  ${cells.join("  ")}`);
}
if (over) process.exit(1);
