import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Every public host must re-open the AI crawlers Cloudflare's *managed*
// robots.txt blocks by default. That block (ClaudeBot / GPTBot /
// Google-Extended / CCBot / …) is emitted above whatever the origin serves, so
// a host with no robots.txt of its own is closed to the crawlers behind
// Perplexity, ChatGPT and Claude — which is an acquisition channel, not a
// detail (AEO/GEO, `apps/web/public/robots.txt`).
//
// `docs.nlqdb.com` shipped that way and nobody noticed for months: measured
// 2026-07-26, the R-04 "Give your agent memory" guide — the page the whole
// coding-agent reach thesis routes through — was Disallowed to ClaudeBot and
// GPTBot, and Google had never crawled it. The marketing host had the override
// all along. This guard derives the requirement from the marketing host's own
// file, so re-opening a crawler there can't silently skip the docs host.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const HOSTS = {
  marketing: join(REPO_ROOT, "apps", "web", "public", "robots.txt"),
  docs: join(REPO_ROOT, "apps", "docs", "public", "robots.txt"),
} as const;

/**
 * User-agents the file grants `Allow: /`. Groups follow RFC 9309: consecutive
 * `User-agent:` lines share one rule block, and a new group only starts at the
 * first `User-agent:` after a rule — so rule order inside a group is
 * irrelevant, as it is to a real crawler.
 */
function allowedAgents(file: string): Set<string> {
  const allowed = new Set<string>();
  let agents: string[] = [];
  let sawRule = false;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const ua = /^user-agent:\s*(.+)$/i.exec(line);
    if (ua) {
      if (sawRule) [agents, sawRule] = [[], false];
      agents.push(ua[1].trim());
      continue;
    }
    sawRule = true;
    // Three spellings of allow-all: `Allow: /`, `Allow: /*`, and an empty
    // `Disallow:` (RFC 9309 §2.2.2). Missing one would make parity vacuous for
    // a crawler the marketing file re-opened in that form.
    if (/^allow:\s*\/\*?$/i.test(line) || /^disallow:\s*$/i.test(line))
      for (const a of agents) allowed.add(a);
  }
  return allowed;
}

describe("robots.txt AI-crawler parity across public hosts", () => {
  test("the docs host allows every crawler the marketing host allows", () => {
    const marketing = allowedAgents(HOSTS.marketing);
    // Guards the guard: a marketing file that stopped naming crawlers would
    // make the parity assertion below vacuously true.
    expect(marketing.has("ClaudeBot")).toBe(true);
    expect(marketing.has("GPTBot")).toBe(true);
    expect(marketing.has("*")).toBe(true);

    const docs = allowedAgents(HOSTS.docs);
    const missing = [...marketing].filter((a) => !docs.has(a));
    expect(missing).toEqual([]);
  });

  test("every host advertises its own sitemap so Google can discover it", () => {
    // Only `nlqdb.com/sitemap.xml` is submitted in the Search Console
    // property; a second submission is a console action, so the robots.txt
    // directive is the discovery path we control in code.
    for (const [host, file] of Object.entries(HOSTS)) {
      const sitemaps = readFileSync(file, "utf8")
        .split("\n")
        .filter((l) => /^sitemap:\s*https:\/\//i.test(l.trim()));
      expect(sitemaps.length, `${host} advertises no sitemap`).toBeGreaterThan(0);
    }
  });
});
