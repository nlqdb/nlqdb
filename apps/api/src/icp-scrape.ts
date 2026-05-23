// SK-ICP-001 (HN+Reddit) + SK-ICP-004 (GitHub Issues) + SK-ICP-005 (Stack Exchange) + SK-ICP-006 (Indie Hackers). Writes raw items to KV at icp:seen:<source>:<id> (90d) + icp:item:<YYYYMMDD>:<source>:<id> (30d).

import { type Span, trace } from "@opentelemetry/api";

// Per-fetch wall-clock cap; protects the cron from a stalled upstream.
const FETCH_TIMEOUT_MS = 10_000;

export type IcpScrapeDeps = {
  kv: KVNamespace;
  logsnagToken?: string;
  logsnagProject?: string;
  ghToken?: string;
  fetch?: typeof fetch;
  tracer?: {
    startActiveSpan: (name: string, fn: (span: Span) => Promise<unknown>) => Promise<unknown>;
  };
};

export type IcpScrapeResult = {
  newItems: number;
  skipped: number;
  sources: Record<string, number>;
  items: IcpItem[];
};

export type IcpItem = {
  id: string;
  source: string;
  title: string;
  url: string;
  text?: string;
  score?: number;
  ts: number;
};

const SEEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
const ITEM_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function yyyymmdd(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// --- HN Algolia ---

type HnHit = {
  objectID: string;
  title?: string;
  url?: string;
  story_text?: string;
  comment_text?: string;
  points?: number;
  created_at_i: number;
};

const HN_QUERIES = [
  "text+to+sql",
  "natural+language+database",
  "ai+agent+memory",
  "hate+writing+sql",
  "sql+is+too+hard",
  "MCP+server",
  "Postgres+setup",
  "Retool+alternative",
  "vector+DB",
  "pgvector",
];

async function fetchHn(
  fetcher: typeof fetch,
  sevenDaysAgoUnix: number,
  tracer: IcpScrapeDeps["tracer"],
): Promise<IcpItem[]> {
  const items: IcpItem[] = [];

  for (const q of HN_QUERIES) {
    const url =
      `https://hn.algolia.com/api/v1/search?query=${q}&tags=story,comment` +
      `&numericFilters=created_at_i>${sevenDaysAgoUnix}&hitsPerPage=10`;

    const doFetch = async (span: Span) => {
      try {
        const res = await fetcher(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        span.setAttribute("http.response.status_code", res.status);
        if (!res.ok) {
          console.warn(JSON.stringify({ msg: "icp_hn_fetch_error", query: q, status: res.status }));
          span.end();
          return;
        }
        const json = (await res.json()) as { hits?: HnHit[] };
        const hits = json.hits ?? [];
        span.setAttribute("nlqdb.icp.source", "hn");
        span.setAttribute("nlqdb.icp.items", hits.length);
        for (const hit of hits) {
          items.push({
            id: hit.objectID,
            source: "hn",
            title: hit.title ?? "",
            url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
            text: hit.story_text ?? hit.comment_text,
            score: hit.points,
            ts: hit.created_at_i,
          });
        }
      } catch (err) {
        span.recordException(err as Error);
        console.error(
          JSON.stringify({
            msg: "icp_hn_fetch_exception",
            query: q,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        span.end();
      }
    };

    if (tracer) {
      await tracer.startActiveSpan("nlqdb.icp.fetch.hn", doFetch);
    } else {
      const noopSpan = {
        setAttribute: () => {},
        recordException: () => {},
        end: () => {},
      } as unknown as Span;
      await doFetch(noopSpan);
    }
  }

  return items;
}

// --- GitHub Issues ---

type GhIssue = {
  id: number;
  title: string;
  body?: string;
  html_url: string;
  created_at: string;
};

const GH_ISSUE_QUERIES = [
  'is:issue "text to sql"',
  'is:issue "natural language" database',
  'is:issue "ai agent" memory store',
  'is:issue "query builder" too verbose',
  "is:issue prisma migration overhead",
];

const GH_SEARCH_URL = "https://api.github.com/search/issues";
const GH_DATE_FILTER = "created:>2025-11-01";
// GitHub rejects requests with no User-Agent (403) per their REST API contract.
const GH_USER_AGENT = "nlqdb-icp-bot";

async function fetchGitHubIssues(
  fetcher: typeof fetch,
  ghToken: string,
  tracer: IcpScrapeDeps["tracer"],
): Promise<IcpItem[]> {
  const items: IcpItem[] = [];

  for (const q of GH_ISSUE_QUERIES) {
    const query = encodeURIComponent(`${q} ${GH_DATE_FILTER}`);
    const url = `${GH_SEARCH_URL}?q=${query}&sort=created&order=desc&per_page=10`;

    const doFetch = async (span: Span) => {
      try {
        const res = await fetcher(url, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${ghToken}`,
            "User-Agent": GH_USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        span.setAttribute("http.response.status_code", res.status);
        if (!res.ok) {
          console.warn(JSON.stringify({ msg: "icp_gh_fetch_error", query: q, status: res.status }));
          span.end();
          return;
        }
        const json = (await res.json()) as { items?: GhIssue[]; incomplete_results?: boolean };
        const issues = json.items ?? [];
        if (json.incomplete_results) {
          console.warn(JSON.stringify({ msg: "icp_gh_incomplete_results", query: q }));
        }
        span.setAttribute("nlqdb.icp.source", "github");
        span.setAttribute("nlqdb.icp.items", issues.length);
        for (const issue of issues) {
          const ms = new Date(issue.created_at).getTime();
          if (!Number.isFinite(ms)) continue;
          items.push({
            id: `gh-${issue.id}`,
            source: "github",
            title: issue.title,
            url: issue.html_url,
            text: issue.body?.slice(0, 500) || undefined,
            ts: Math.floor(ms / 1000),
          });
        }
      } catch (err) {
        span.recordException(err as Error);
        console.error(
          JSON.stringify({
            msg: "icp_gh_fetch_exception",
            query: q,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        span.end();
      }
    };

    if (tracer) {
      await tracer.startActiveSpan("nlqdb.icp.fetch.github", doFetch);
    } else {
      const noopSpan = {
        setAttribute: () => {},
        recordException: () => {},
        end: () => {},
      } as unknown as Span;
      await doFetch(noopSpan);
    }
  }

  return items;
}

// --- Reddit ---

type RedditPost = {
  id: string;
  title: string;
  permalink: string;
  selftext?: string;
  score: number;
  created_utc: number;
};

const REDDIT_QUERIES: Array<{ subreddit: string; query: string }> = [
  { subreddit: "sideproject", query: "database" },
  { subreddit: "LocalLLaMA", query: "memory agent" },
  { subreddit: "dataengineering", query: "sql" },
  { subreddit: "SaaS", query: "database" },
  { subreddit: "webdev", query: "database" },
  { subreddit: "nextjs", query: "database" },
  { subreddit: "SQL", query: "alternative" },
  { subreddit: "PostgreSQL", query: "natural language" },
  { subreddit: "programming", query: "sql alternative" },
  { subreddit: "learnprogramming", query: "sql help" },
  { subreddit: "devops", query: "database" },
  { subreddit: "ClaudeAI", query: "memory" },
  { subreddit: "LangChain", query: "database" },
  { subreddit: "MachineLearning", query: "vector store" },
  { subreddit: "Database", query: "natural language" },
  { subreddit: "clickhouse", query: "query" },
];

const REDDIT_UA = "nlqdb-icp-bot/1.0 (+https://nlqdb.com; contact: hello@nlqdb.com)";

async function fetchReddit(
  fetcher: typeof fetch,
  tracer: IcpScrapeDeps["tracer"],
): Promise<IcpItem[]> {
  const items: IcpItem[] = [];

  for (const { subreddit, query } of REDDIT_QUERIES) {
    const encodedQuery = encodeURIComponent(query);
    // restrict_sr=on scopes the search to the subreddit; without it Reddit
    // returns site-wide results even on the /r/<sub>/search.json endpoint.
    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodedQuery}&restrict_sr=on&sort=new&limit=25&t=week`;

    const doFetch = async (span: Span) => {
      try {
        const res = await fetcher(url, {
          headers: { "User-Agent": REDDIT_UA },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        span.setAttribute("http.response.status_code", res.status);
        if (!res.ok) {
          console.warn(
            JSON.stringify({
              msg: "icp_reddit_fetch_error",
              subreddit,
              query,
              status: res.status,
            }),
          );
          span.end();
          return;
        }
        const json = (await res.json()) as {
          data?: { children?: Array<{ data: RedditPost }> };
        };
        const children = json.data?.children ?? [];
        span.setAttribute("nlqdb.icp.source", "reddit");
        span.setAttribute("nlqdb.icp.items", children.length);
        for (const { data: post } of children) {
          items.push({
            id: post.id,
            source: "reddit",
            title: post.title,
            url: `https://www.reddit.com${post.permalink}`,
            text: post.selftext || undefined,
            score: post.score,
            ts: post.created_utc,
          });
        }
      } catch (err) {
        span.recordException(err as Error);
        console.error(
          JSON.stringify({
            msg: "icp_reddit_fetch_exception",
            subreddit,
            query,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        span.end();
      }
    };

    if (tracer) {
      await tracer.startActiveSpan("nlqdb.icp.fetch.reddit", doFetch);
    } else {
      const noopSpan = {
        setAttribute: () => {},
        recordException: () => {},
        end: () => {},
      } as unknown as Span;
      await doFetch(noopSpan);
    }
  }

  return items;
}

// --- Stack Exchange (Stack Overflow) ---

type SeQuestion = {
  question_id: number;
  title: string;
  body?: string;
  link: string;
  creation_date: number;
  score?: number;
  tags?: string[];
};

type SeResponse = {
  items?: SeQuestion[];
  has_more?: boolean;
  quota_remaining?: number;
  // Stack Exchange returns `backoff` (seconds) on throttling; honour it.
  backoff?: number;
};

// 5 queries × 1/week is trivially inside the anonymous 300/IP/day quota.
const STACKEXCHANGE_QUERIES: Array<{ tagged: string; q?: string }> = [
  { tagged: "postgresql", q: "setup" },
  { tagged: "sqlalchemy", q: "verbose" },
  { tagged: "sql", q: "natural language" },
  { tagged: "prisma", q: "migration" },
  { tagged: "duckdb;clickhouse" },
];

const SE_SEARCH_URL = "https://api.stackexchange.com/2.3/search/advanced";
const SE_SITE = "stackoverflow";

async function fetchStackExchange(
  fetcher: typeof fetch,
  sevenDaysAgoUnix: number,
  tracer: IcpScrapeDeps["tracer"],
): Promise<IcpItem[]> {
  const items: IcpItem[] = [];

  for (const { tagged, q } of STACKEXCHANGE_QUERIES) {
    const params = new URLSearchParams({
      site: SE_SITE,
      tagged,
      sort: "creation",
      order: "desc",
      pagesize: "10",
      fromdate: String(sevenDaysAgoUnix),
    });
    if (q) params.set("q", q);
    const url = `${SE_SEARCH_URL}?${params.toString()}`;

    const doFetch = async (span: Span) => {
      try {
        const res = await fetcher(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        span.setAttribute("http.response.status_code", res.status);
        if (!res.ok) {
          console.warn(JSON.stringify({ msg: "icp_se_fetch_error", tagged, status: res.status }));
          span.end();
          return;
        }
        const json = (await res.json()) as SeResponse;
        const hits = json.items ?? [];
        // Surface backoff so an operator notices throttling before the quota burns.
        if (typeof json.backoff === "number" && json.backoff > 0) {
          console.warn(JSON.stringify({ msg: "icp_se_backoff", tagged, backoff: json.backoff }));
        }
        span.setAttribute("nlqdb.icp.source", "stackoverflow");
        span.setAttribute("nlqdb.icp.items", hits.length);
        if (typeof json.quota_remaining === "number") {
          span.setAttribute("nlqdb.icp.se.quota_remaining", json.quota_remaining);
        }
        for (const hit of hits) {
          items.push({
            id: `so-${hit.question_id}`,
            source: "stackoverflow",
            title: hit.title,
            url: hit.link,
            text: hit.body?.slice(0, 500) || undefined,
            score: hit.score,
            ts: hit.creation_date,
          });
        }
      } catch (err) {
        span.recordException(err as Error);
        console.error(
          JSON.stringify({
            msg: "icp_se_fetch_exception",
            tagged,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        span.end();
      }
    };

    if (tracer) {
      await tracer.startActiveSpan("nlqdb.icp.fetch.stackoverflow", doFetch);
    } else {
      const noopSpan = {
        setAttribute: () => {},
        recordException: () => {},
        end: () => {},
      } as unknown as Span;
      await doFetch(noopSpan);
    }
  }

  return items;
}

// --- Indie Hackers (unofficial JSON feed) ---

// `feed.indiehackers.world` is the only no-auth path into IH; SK-ICP-006 explains the trade-offs.
type IhItem = {
  url?: string;
  title?: string;
  content_html?: string;
  date_modified?: string;
  author?: { name?: string };
};

type IhFeed = {
  version?: string;
  items?: IhItem[];
};

// 5 P1-pain queries; the mirror runs full-text search across title + content_html, not tags.
const INDIEHACKERS_QUERIES = ["database", "boilerplate", "side+project", "first+paying", "stack"];

const IH_FEED_URL = "https://feed.indiehackers.world/posts.json";
const IH_USER_AGENT = "nlqdb-icp-bot/1.0 (+https://nlqdb.com; contact: hello@nlqdb.com)";

function ihIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/post\/([a-zA-Z0-9-]+)/);
  return m?.[1] ?? null;
}

async function fetchIndieHackers(
  fetcher: typeof fetch,
  sevenDaysAgoUnix: number,
  tracer: IcpScrapeDeps["tracer"],
): Promise<IcpItem[]> {
  const items: IcpItem[] = [];

  for (const q of INDIEHACKERS_QUERIES) {
    const url = `${IH_FEED_URL}?q=${q}&exclude=link-post`;

    const doFetch = async (span: Span) => {
      try {
        span.setAttribute("nlqdb.icp.source", "indiehackers");
        const res = await fetcher(url, {
          headers: { "User-Agent": IH_USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        span.setAttribute("http.response.status_code", res.status);
        if (!res.ok) {
          span.setAttribute("nlqdb.icp.items", 0);
          console.warn(JSON.stringify({ msg: "icp_ih_fetch_error", query: q, status: res.status }));
          return;
        }
        const json = (await res.json()) as IhFeed;
        const hits = json.items ?? [];
        span.setAttribute("nlqdb.icp.items", hits.length);
        for (const hit of hits) {
          const id = ihIdFromUrl(hit.url);
          if (!id) continue;
          const ms = hit.date_modified ? Date.parse(hit.date_modified) : NaN;
          if (!Number.isFinite(ms)) continue;
          const ts = Math.floor(ms / 1000);
          // Mirror has no fromdate param; enforce the 7-day window client-side.
          if (ts < sevenDaysAgoUnix) continue;
          items.push({
            id,
            source: "indiehackers",
            title: hit.title ?? "",
            url: hit.url ?? "",
            text: hit.content_html?.slice(0, 500) || undefined,
            ts,
          });
        }
      } catch (err) {
        span.recordException(err as Error);
        console.error(
          JSON.stringify({
            msg: "icp_ih_fetch_exception",
            query: q,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        span.end();
      }
    };

    if (tracer) {
      await tracer.startActiveSpan("nlqdb.icp.fetch.indiehackers", doFetch);
    } else {
      const noopSpan = {
        setAttribute: () => {},
        recordException: () => {},
        end: () => {},
      } as unknown as Span;
      await doFetch(noopSpan);
    }
  }

  return items;
}

// --- LogSnag notification ---

async function notifyLogSnag(
  fetcher: typeof fetch,
  token: string,
  project: string,
  result: IcpScrapeResult,
): Promise<void> {
  try {
    const res = await fetcher("https://api.logsnag.com/v1/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        project,
        channel: "icp-mining",
        event: "Weekly Scrape",
        description: `${result.newItems} new pain signals (HN: ${result.sources["hn"] ?? 0}, Reddit: ${result.sources["reddit"] ?? 0}, GH: ${result.sources["github"] ?? 0}, SO: ${result.sources["stackoverflow"] ?? 0}, IH: ${result.sources["indiehackers"] ?? 0})`,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(JSON.stringify({ msg: "icp_logsnag_error", status: res.status }));
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "icp_logsnag_exception",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

// --- Main entry point ---

export async function runIcpScrape(deps: IcpScrapeDeps): Promise<IcpScrapeResult> {
  const fetcher = deps.fetch ?? fetch;
  const tracer =
    deps.tracer ??
    (() => {
      const t = trace.getTracer("@nlqdb/api");
      return {
        startActiveSpan: (name: string, fn: (span: Span) => Promise<unknown>) =>
          t.startActiveSpan(name, fn),
      };
    })();

  const now = Date.now();
  const sevenDaysAgoUnix = Math.floor(now / 1000) - 7 * 24 * 60 * 60;
  const dateStr = yyyymmdd(now);

  // Fetch all sources; per-source errors are already caught inside each helper.
  const [hnItems, redditItems, ghItems, seItems, ihItems] = await Promise.all([
    fetchHn(fetcher, sevenDaysAgoUnix, tracer).catch((err) => {
      console.error(
        JSON.stringify({
          msg: "icp_hn_source_failed",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      return [] as IcpItem[];
    }),
    fetchReddit(fetcher, tracer).catch((err) => {
      console.error(
        JSON.stringify({
          msg: "icp_reddit_source_failed",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      return [] as IcpItem[];
    }),
    deps.ghToken
      ? fetchGitHubIssues(fetcher, deps.ghToken, tracer).catch((err) => {
          console.error(
            JSON.stringify({
              msg: "icp_gh_source_failed",
              message: err instanceof Error ? err.message : String(err),
            }),
          );
          return [] as IcpItem[];
        })
      : ([] as IcpItem[]),
    fetchStackExchange(fetcher, sevenDaysAgoUnix, tracer).catch((err) => {
      console.error(
        JSON.stringify({
          msg: "icp_se_source_failed",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      return [] as IcpItem[];
    }),
    fetchIndieHackers(fetcher, sevenDaysAgoUnix, tracer).catch((err) => {
      console.error(
        JSON.stringify({
          msg: "icp_ih_source_failed",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      return [] as IcpItem[];
    }),
  ]);

  const allItems = [...hnItems, ...redditItems, ...ghItems, ...seItems, ...ihItems];

  // Batch dedup check in parallel.
  const seenKeys = allItems.map((item) => `icp:seen:${item.source}:${item.id}`);
  const seenValues = await Promise.all(seenKeys.map((key) => deps.kv.get(key)));

  let newItems = 0;
  let skipped = 0;
  const sources: Record<string, number> = {};
  const storedItems: IcpItem[] = [];

  const writePromises: Promise<void>[] = [];

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (!item || seenValues[i] !== null) {
      skipped++;
      continue;
    }

    // New item — write seen-key and item-key in parallel.
    const seenKey = `icp:seen:${item.source}:${item.id}`;
    const itemKey = `icp:item:${dateStr}:${item.source}:${item.id}`;

    writePromises.push(
      deps.kv.put(seenKey, "1", { expirationTtl: SEEN_TTL_SECONDS }).then(() => {}),
      deps.kv
        .put(itemKey, JSON.stringify(item), { expirationTtl: ITEM_TTL_SECONDS })
        .then(() => {}),
    );

    newItems++;
    sources[item.source] = (sources[item.source] ?? 0) + 1;
    storedItems.push(item);
  }

  await Promise.all(writePromises);

  const result: IcpScrapeResult = { newItems, skipped, sources, items: storedItems };

  // LogSnag notification — failure is non-fatal.
  if (deps.logsnagToken && deps.logsnagProject) {
    await notifyLogSnag(fetcher, deps.logsnagToken, deps.logsnagProject, result);
  }

  return result;
}
