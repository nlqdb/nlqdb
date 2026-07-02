// `/blog/<slug>` source of truth. One object per post; `blog/[slug].astro`,
// `blog/index.astro`, `sitemap.xml.ts`, and `llms.txt.ts` all read from this
// file — publishing a post is a one-file edit.
//
// The blog is the canonical home for the evergreen SQL / data-layer lessons
// the daily loop drafts into docs/research/distribution-queue.md. Community
// venues (dev.to, r/SQL, …) get a pointer; the canonical copy lives here on a
// URL we own and llms.txt advertises. Posts are editorial prose, not embed
// demos — that's what /solve pages are for. A post that anchors a /solve or
// /vs page links to it rather than duplicating the demo.
//
// Body is a small block union rather than raw HTML: paragraphs carry
// `backtick` inline code (rendered via lib/blog-inline.ts, escaped — no
// set:html), and code fences carry a language + verbatim source. This keeps
// the data typed and testable and the template XSS-free.

export type BlogBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "code"; lang: string; code: string }
  // A quiet aside — used for the honest "here's where nlqdb fits" footnote so
  // it reads as a note, not a paragraph. Same inline-code rules as `p`.
  | { kind: "note"; text: string };

export type BlogSource = {
  // Enduring URL (docs, a search-result page, a subreddit) — not a
  // single-thread URL that may rot. Mirrors SolveSource.
  url: string;
  label: string;
};

export type BlogPost = {
  // URL-safe lower-kebab; appears in the canonical URL.
  slug: string;
  // <title> + <h1>. Keep it a real sentence — it's the SERP + LLM headline.
  title: string;
  // ≤160-char meta description / og:description / one-line index blurb.
  description: string;
  // ISO date (YYYY-MM-DD). Rendered as datePublished in BlogPosting JSON-LD.
  date: string;
  // Short evergreen tags for the index; no taxonomy pages yet.
  tags: string[];
  // The one sentence a reader should leave with — rendered as the lede + the
  // BlogPosting `abstract`.
  takeaway: string;
  // The /solve or /vs page this post anchors, if any. Rendered as a "read next"
  // link so the editorial post feeds the AEO surface.
  anchors?: { path: string; label: string };
  // Ordered body blocks.
  body: BlogBlock[];
  // ≥1 enduring reference so a reader can verify the claims.
  sources: BlogSource[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "not-in-returned-zero-rows-it-was-one-null",
    title: "NOT IN returned zero rows. It wasn't your data — it was one NULL.",
    description:
      "Why NOT IN (subquery) silently returns nothing when the subquery has one NULL, and the two anti-join shapes that don't lie to you.",
    date: "2026-07-01",
    tags: ["sql", "postgres", "anti-join", "null"],
    takeaway:
      'Reach for NOT EXISTS (or LEFT JOIN … IS NULL) for "rows with no match," and treat NOT IN (subquery) as a smell unless you\'re certain the subquery is NULL-free.',
    anchors: {
      path: "/solve/find-rows-with-no-match-in-another-table",
      label: "Solve: find rows with no match in another table",
    },
    body: [
      {
        kind: "p",
        text: '"Which customers never placed an order?" is a question you ask constantly — products never sold, users with no login this month, invoices with no payment. It\'s a set difference, and the obvious query is a quiet trap:',
      },
      {
        kind: "code",
        lang: "sql",
        code: "SELECT * FROM customers\nWHERE id NOT IN (SELECT customer_id FROM orders);   -- returns nothing. why?",
      },
      {
        kind: "p",
        text: "If a single `customer_id` in that subquery is NULL, you get zero rows — no error, no warning. Here's why: `NOT IN (a, b, NULL)` expands to `id <> a AND id <> b AND id <> NULL`. That last comparison is never `true` — comparing anything to NULL is `unknown` — so the whole `AND` chain can never be `true`, and every row is rejected. One NULL in the inner table silently empties your result.",
      },
      { kind: "h2", text: "The two shapes that actually work" },
      {
        kind: "code",
        lang: "sql",
        code: "-- LEFT JOIN ... IS NULL: keep the customers that found no matching order\nSELECT c.* FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;\n\n-- NOT EXISTS: a correlated anti-join, NULL-safe by construction\nSELECT * FROM customers c\nWHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);",
      },
      {
        kind: "p",
        text: "Both return the same rows for a plain anti-join. `NOT EXISTS` stops at the first match and never trips over NULLs. The `LEFT JOIN ... IS NULL` form is just as correct — but if the join key isn't unique it can multiply rows before the filter, so know your grain. What neither of them does is silently lie to you the way `NOT IN` does.",
      },
      {
        kind: "p",
        text: 'The rule worth keeping: reach for `NOT EXISTS` (or `LEFT JOIN ... IS NULL`) for "rows with no match," and treat `NOT IN (subquery)` as a smell unless you\'re certain the subquery is NULL-free.',
      },
      {
        kind: "note",
        text: "If you'd rather not re-derive which shape is safe every time: nlqdb takes \"customers who never placed an order\" in English, compiles the NULL-safe anti-join, runs it read-only, and shows the SQL so you can confirm it isn't a `NOT IN`. Honest limit — it owns the Postgres it answers; bring-your-own-Postgres is signed-in only, not the public embed.",
      },
    ],
    sources: [
      {
        url: "https://www.postgresql.org/docs/current/functions-subquery.html",
        label: "PostgreSQL docs — Subquery expressions (IN / NOT IN / EXISTS)",
      },
      {
        url: "https://www.postgresql.org/docs/current/functions-comparison.html",
        label: "PostgreSQL docs — Comparison functions and operators (NULL semantics)",
      },
      {
        url: "https://www.reddit.com/r/SQL/search/?q=not+in+null",
        label: 'r/SQL — recurring "NOT IN returns no rows" threads',
      },
    ],
  },
];

export function blogBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

// Newest first — index render order + JSON-LD order.
export const BLOG_POSTS_BY_DATE: BlogPost[] = [...BLOG_POSTS].sort((a, b) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
);
