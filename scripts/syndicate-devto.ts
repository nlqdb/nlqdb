#!/usr/bin/env bun
// Autonomous dev.to syndication for /blog posts (SK-BLOG-003).
//
// The /daily loop publishes every distribution-queue draft to nlqdb.com/blog
// (SK-BLOG-001). This script drains the community-venue leg for dev.to: it
// mirrors a /blog post to dev.to as a cross-post whose `canonical_url` points
// back at /blog, so the first-party copy keeps SEO authority (the officially
// supported Forem cross-post pattern — rel=canonical). Reddit / HN / lobste.rs
// stay human-gated (platform norms); only dev.to is automated here.
//
// Usage:
//   bun scripts/syndicate-devto.ts --list
//   bun scripts/syndicate-devto.ts --post <slug> --tags a,b,c [--force]
//
// Contract (Forem API v1 — developers.forem.com/api/v1):
//   POST https://dev.to/api/articles  body { article: { title, body_markdown,
//     published, canonical_url, tags, description } }, header `api-key`,
//     Accept: application/vnd.forem.api-v1+json. Tags: 1–4, alphanumeric.
//   Article-creation is rate-limited (published_article_creation, 30s window);
//   a 429 advertises `retry-after` (default 30s) — we retry once.
//
// Idempotent: refuses to post a slug whose canonical_url already exists on the
// account (trailing slash normalised). Drip guard: refuses if the account's
// newest article published < 20h ago (one venue post per day), --force skips.
//
// Transport is curl, not `fetch`: the daily loop runs behind a TLS-terminating
// egress proxy that bun's fetch can't traverse, but curl already trusts.

import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BlogBlock, BlogPost } from "../apps/web/src/data/blog.ts";
import { BLOG_POSTS } from "../apps/web/src/data/blog.ts";

const API = "https://dev.to/api";
const ACCEPT_V1 = "application/vnd.forem.api-v1+json";
const DRIP_HOURS = 20;
// acquisition-channels.md row 2 utm_source key — every externally published
// nlqdb URL carries its ledger key (SK-GTM-007), so dev.to click-throughs are
// first-touch attributable instead of relying on a referrer readers often strip.
const DEVTO_SOURCE = "devto";

interface DevToArticle {
  canonical_url: string | null;
  published_at: string | null;
  url: string;
  title: string;
}

interface HttpResponse {
  status: number;
  retryAfter: number | null;
  text: string;
}

const canonicalFor = (slug: string): string => `https://nlqdb.com/blog/${slug}/`;
const canonKey = (url: string): string => url.replace(/\/+$/, "");

function die(message: string): never {
  console.error(`syndicate-devto: ${message}`);
  process.exit(1);
}

function requireKey(): string {
  const key = process.env["DEV_TO_API_KEY"];
  if (!key) die("DEV_TO_API_KEY is not set — export the founder's dev.to key before syndicating.");
  return key;
}

const authHeaders = (key: string): Record<string, string> => ({
  "api-key": key,
  Accept: ACCEPT_V1,
});

async function curlRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
): Promise<HttpResponse> {
  const hdrFile = join(tmpdir(), `devto-h-${randomUUID()}`);
  const bodyFile = join(tmpdir(), `devto-b-${randomUUID()}`);
  const args = ["-sS", "-X", method, "-D", hdrFile, "-o", bodyFile, "-w", "%{http_code}"];
  for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
  if (body !== undefined) args.push("--data-binary", "@-");
  args.push(url);
  try {
    const proc = Bun.spawn(["curl", ...args], {
      stdin: body !== undefined ? new TextEncoder().encode(body) : undefined,
      stdout: "pipe",
      stderr: "pipe",
    });
    const status = Number((await new Response(proc.stdout).text()).trim());
    const err = (await new Response(proc.stderr).text()).trim();
    await proc.exited;
    if (proc.exitCode !== 0) die(`curl ${method} ${url} failed (exit ${proc.exitCode}): ${err}`);
    const text = await Bun.file(bodyFile).text();
    const retryRaw = (await Bun.file(hdrFile).text()).match(/^retry-after:\s*(\d+)/im)?.[1];
    return { status, retryAfter: retryRaw ? Number(retryRaw) : null, text };
  } finally {
    await unlink(hdrFile).catch(() => {});
    await unlink(bodyFile).catch(() => {});
  }
}

async function fetchMyArticles(key: string): Promise<DevToArticle[]> {
  const all: DevToArticle[] = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const url = `${API}/articles/me/all?per_page=${perPage}&page=${page}`;
    const res = await curlRequest("GET", url, authHeaders(key));
    if (res.status !== 200) die(`GET /articles/me/all failed: ${res.status} ${res.text}`);
    const batch = JSON.parse(res.text) as DevToArticle[];
    all.push(...batch);
    if (batch.length < perPage) break;
  }
  return all;
}

function postedCanonicals(articles: DevToArticle[]): Set<string> {
  return new Set(
    articles
      .map((a) => a.canonical_url)
      .filter((u): u is string => Boolean(u))
      .map(canonKey),
  );
}

function pendingPosts(articles: DevToArticle[]): BlogPost[] {
  const posted = postedCanonicals(articles);
  // BLOG_POSTS is newest-first; reverse to list/pick the oldest pending first.
  return [...BLOG_POSTS].reverse().filter((p) => !posted.has(canonKey(canonicalFor(p.slug))));
}

function assertDripOk(articles: DevToArticle[], force: boolean): void {
  const times = articles
    .map((a) => a.published_at)
    .filter((d): d is string => Boolean(d))
    .map((d) => Date.parse(d))
    .filter((n) => !Number.isNaN(n));
  if (times.length === 0) return;
  const hoursSince = (Date.now() - Math.max(...times)) / 3_600_000;
  if (hoursSince < DRIP_HOURS && !force) {
    // Exit 0: a throttled run is the EXPECTED outcome on all but the first
    // /daily run of the day (it fires ~6×/day) — an agent must read this as
    // a clean no-op, never as an error to work around.
    console.info(
      `drip guard: newest dev.to article was ${hoursSince.toFixed(1)}h ago (< ${DRIP_HOURS}h) — ` +
        "skipping; one venue post per day. Expected no-op on all but the first run of the day.",
    );
    process.exit(0);
  }
}

function parseTags(raw: string): string[] {
  // Forem's v1 create endpoint takes `tags` as an ARRAY (a comma string is
  // silently dropped — it only reads `tag_list`). Max 4, alphanumeric only.
  const tags = raw
    .split(",")
    .map((t) => t.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);
  if (tags.length === 0 || tags.length > 4) {
    die(`dev.to allows 1–4 tags; got ${tags.length} from "${raw}".`);
  }
  for (const t of tags) {
    if (!/^[a-z0-9]+$/.test(t)) die(`invalid tag "${t}": dev.to tags must be alphanumeric only.`);
  }
  return tags;
}

function blockToMarkdown(block: BlogBlock): string {
  switch (block.kind) {
    case "p":
      return block.text;
    case "h2":
      return `## ${block.text}`;
    case "code":
      return `\`\`\`${block.lang}\n${block.code}\n\`\`\``;
    case "ul":
      return block.items.map((it) => `- ${it}`).join("\n");
    case "ol":
      return block.items.map((it, i) => `${i + 1}. ${it}`).join("\n");
  }
}

export function buildBody(post: BlogPost, canonical: string): string {
  // The API `canonical_url` field stays the clean URL (rel=canonical for SEO
  // dedup); the human-facing read-through link carries ?utm_source=devto so a
  // dev.to→nlqdb.com visit is captured as `devto`, not the flaky referrer host.
  const readThrough = `${canonical}?utm_source=${DEVTO_SOURCE}`;
  const header = `*Originally published at [nlqdb.com/blog](${readThrough})*`;
  return [header, ...post.body.map(blockToMarkdown)].join("\n\n");
}

async function createArticle(key: string, article: Record<string, unknown>): Promise<DevToArticle> {
  const headers = { ...authHeaders(key), "Content-Type": "application/json" };
  const payload = JSON.stringify({ article });
  let res = await curlRequest("POST", `${API}/articles`, headers, payload);
  if (res.status === 429) {
    const wait = res.retryAfter ?? 30;
    console.warn(`dev.to 429 — retrying once after ${wait}s`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    res = await curlRequest("POST", `${API}/articles`, headers, payload);
  }
  if (res.status !== 200 && res.status !== 201) {
    die(`POST /articles failed: ${res.status} ${res.text}`);
  }
  return JSON.parse(res.text) as DevToArticle;
}

async function runList(key: string): Promise<void> {
  const pending = pendingPosts(await fetchMyArticles(key));
  console.info(`${pending.length} dev.to variant(s) pending (oldest first):`);
  for (const p of pending) console.info(p.slug);
}

async function runPost(key: string, slug: string, tagsRaw: string, force: boolean): Promise<void> {
  if (!slug) die("--post needs a slug.");
  if (!tagsRaw) die("--post needs --tags a,b,c (1–4 alphanumeric tags).");
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) die(`no /blog post with slug "${slug}".`);
  const tags = parseTags(tagsRaw);

  const articles = await fetchMyArticles(key);
  const canonical = canonicalFor(slug);
  const already = articles.find(
    (a) => a.canonical_url && canonKey(a.canonical_url) === canonKey(canonical),
  );
  if (already) die(`already syndicated: ${already.url} (canonical ${canonical}).`);
  assertDripOk(articles, force);

  const created = await createArticle(key, {
    title: post.title,
    body_markdown: buildBody(post, canonical),
    published: true,
    canonical_url: canonical,
    description: post.description,
    tags,
  });
  console.info(`posted: ${created.url}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let mode: "list" | "post" | null = null;
  let slug = "";
  let tagsRaw = "";
  let force = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--list") mode = "list";
    else if (a === "--post") {
      mode = "post";
      slug = args[++i] ?? "";
    } else if (a === "--tags") tagsRaw = args[++i] ?? "";
    else if (a === "--force") force = true;
  }

  const key = requireKey();
  if (mode === "list") await runList(key);
  else if (mode === "post") await runPost(key, slug, tagsRaw, force);
  else die("usage: --list | --post <slug> --tags a,b,c [--force]");
}

if (import.meta.main) await main();
