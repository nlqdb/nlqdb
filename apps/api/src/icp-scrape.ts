// ICP pain-signal scraper — weekly cron (`0 6 * * 1`).
//
// Queries HN Algolia and Reddit for ICP-relevant pain signals (SQL
// friction, NL-to-database UX, AI memory) and stores raw items in KV
// for downstream analysis. One bad source never kills the others —
// per-source errors are caught and counted.
//
// KV key schema:
//   icp:seen:<source>:<id>  → "1"         TTL 90 days  (dedup)
//   icp:item:<YYYYMMDD>:<source>:<id> → JSON  TTL 30 days  (raw item)

import { type Span, trace } from "@opentelemetry/api";

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
        const res = await fetcher(url);
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
    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodedQuery}&sort=new&limit=25&t=week`;

    const doFetch = async (span: Span) => {
      try {
        const res = await fetcher(url, {
          headers: { "User-Agent": REDDIT_UA },
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
        description: `${result.newItems} new pain signals (HN: ${result.sources["hn"] ?? 0}, Reddit: ${result.sources["reddit"] ?? 0})`,
      }),
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
  const [hnItems, redditItems] = await Promise.all([
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
  ]);

  const allItems = [...hnItems, ...redditItems];

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
