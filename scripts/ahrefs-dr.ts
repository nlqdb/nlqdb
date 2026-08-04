#!/usr/bin/env bun
// Ahrefs Domain Rating pull — the reach loop's authority read (`/reach` step 1,
// slice R-10). DR 0 ≈ zero referring domains, the measured explanation for
// indexed-pages-at-0-impressions; self vs mem0.ai is the delta NUMBERS.md
// tracks. Free public endpoint (docs.ahrefs.com/en/api/reference/public/
// get-domain-rating-free); auth mandatory from 2026-08-10. Internal
// measurement only — publishing the number requires "Domain Rating by Ahrefs"
// attribution per the endpoint's license.
//
// Auth: `AHREF_API_KEY` (no S) holds a free public-tier Ahrefs API v3 key.
// Usage: bun scripts/ahrefs-dr.ts   # prints `target<TAB>DR`, one per line

import { curlRequest } from "./lib/curl.ts";

const TARGETS = ["nlqdb.com", "docs.nlqdb.com", "mem0.ai"];
const API = "https://api.ahrefs.com/v3/public/domain-rating-free";

function die(msg: string): never {
  console.error(`ahrefs-dr: ${msg}`);
  process.exit(1);
}

const key = process.env.AHREF_API_KEY;
if (!key) die("AHREF_API_KEY is unset — the free public-tier Ahrefs API v3 key.");

for (const target of TARGETS) {
  const res = await curlRequest("GET", `${API}?target=${encodeURIComponent(target)}`, [
    "Accept: application/json",
    `Authorization: Bearer ${key}`,
  ]).catch((e: Error) => die(e.message));
  if (res.status !== 200) die(`${target}: HTTP ${res.status} — ${res.body.slice(0, 200)}`);
  const dr = JSON.parse(res.body)?.domain_rating?.domain_rating;
  if (typeof dr !== "number") die(`${target}: unexpected response shape (no domain_rating)`);
  console.info(`${target}\t${dr.toFixed(1)}`);
}
