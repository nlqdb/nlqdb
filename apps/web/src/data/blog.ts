// `/blog/<slug>` source of truth. One object per post; `blog/[slug].astro`,
// `blog/index.astro`, `sitemap.xml.ts`, and `llms.txt.ts` all read from
// this file — publishing a post is a one-file edit (same pattern as
// `data/solve.ts` / `data/competitors.ts`).
//
// Posts are the canonical copies of `docs/research/distribution-queue.md`
// drafts, published autonomously by the /daily loop (SK-BLOG-001 — no
// founder review gate). Community-venue variants (dev.to, Reddit, HN)
// point back here as the canonical URL.
//
// Body model: typed blocks, not markdown files (SK-BLOG-002). Paragraph /
// list text carries the inline-markdown subset `lib/inline-md.ts` renders
// (`code`, **strong**, *em*, [links](…)); note its documented limit —
// strong/em/links must not wrap a code span.

export type BlogBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "code"; lang: string; code: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

export type BlogPost = {
  // URL-safe lower-kebab; appears in the canonical URL /blog/<slug>/.
  slug: string;
  // <h1> and the BlogPosting JSON-LD headline. Written like the queue
  // draft titles — a concrete engineering claim, not marketing copy.
  title: string;
  // Direct-answer capsule (≤200 chars) — the meta description, the index
  // one-liner, and the llms.txt line.
  description: string;
  // Publication date, ISO yyyy-mm-dd (the day the post went live on
  // /blog, not the day the draft entered the queue).
  date: string;
  // The /vs or /solve page this post anchors, if any — rendered as a
  // "read the full guide" link under the CTA.
  anchor?: { label: string; path: string };
  body: BlogBlock[];
};

// Newest first — the index page and llms.txt render in array order.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "agent-memory-vector-store-aggregation-gap",
    title: 'Your agent\'s memory is a vector store. Ask it "how many" and watch it fall over.',
    description:
      "A vector store returns the top-k most similar memories — there is no GROUP BY, COUNT, or JOIN. Recall is similarity; reporting is aggregation. Agent memory needs both machines, not one.",
    date: "2026-07-02",
    anchor: {
      label: "nlqdb vs Pinecone — the full side-by-side",
      path: "/vs/pinecone",
    },
    body: [
      {
        kind: "p",
        text: 'The standard agent-memory build is an afternoon of work: embed every fact worth keeping, upsert it into a vector store, and before each reply pull the top-k most similar memories back into context. And for what it\'s built for, it works. Ask "what did this user say about the Berlin migration" and the right snippets come back, ranked by cosine distance. Recall is solved enough that it feels like *memory* is solved.',
      },
      {
        kind: "p",
        text: 'Then the agent has been running for a month, and you ask its memory a different kind of question: "how many users asked about pricing this month?" "Average deal size per stage?" "Top 10 topics I logged, ranked by count?" The store dutifully returns the twenty memories most *similar to the question text*, the LLM eyeballs them, and you get a confident, specific, wrong number.',
      },
      { kind: "h2", text: "Recall is similarity. Reporting is aggregation." },
      {
        kind: "p",
        text: "Nothing malfunctioned — the two questions want different machines. A vector store's primitive is nearest-neighbour search: embed the query, rank stored vectors by distance, return the top-k, optionally narrowed by a metadata filter. That is the whole contract. There is no `COUNT`, no `GROUP BY`, no `JOIN`, no `HAVING` — a similarity engine ships no query planner, and even the metadata filter only narrows candidates *around* the approximate search, so what comes back is still a ranking of similar items, never a computed result set.",
      },
      {
        kind: "p",
        text: '"How many" has to touch **every matching row**. If the agent logged 4,000 memories and top-k is 20, the context the LLM sees is structurally incapable of producing the count — and an LLM doing arithmetic over a retrieved sample is a hallucination generator, not a query engine. The failure is quiet, too: the answer arrives fluent and plausible, and nothing flags that it was computed from half a percent of the data.',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- \"top topics this month, ranked by count\" is not a similarity query.\n-- It's this — and it must scan every matching row, not the top-k:\nSELECT topic, count(*) AS mentions\nFROM memories\nWHERE created_at >= date_trunc('month', now())\nGROUP BY topic\nORDER BY mentions DESC\nLIMIT 10;",
      },
      {
        kind: "p",
        text: 'So the split worth keeping: when the question is **"find what\'s like this"** — RAG context, related-document lookup, fuzzy recall over conversation — a vector store is exactly the right machine, and a managed one like Pinecone is genuinely good at it. When the question is **"count, group, or rank what I stored"**, the memory needs to be typed rows behind a real query planner. Neither machine substitutes for the other, and bolting a bigger LLM onto the first one doesn\'t turn it into the second.',
      },
      {
        kind: "p",
        text: "They compose cleanly: vector store as the recall layer, relational store as the analytical one. That second layer is what [nlqdb](https://nlqdb.com) is — a real Postgres the agent provisions itself over MCP and queries in plain English, with the compiled SQL shown so you can read exactly what ran. The honest caveat cuts the other way too: nlqdb ships no embedding search, so it is not your recall layer. Pick the store per question shape — the full side-by-side is at [nlqdb vs Pinecone](/vs/pinecone/).",
      },
    ],
  },
  {
    slug: "store-form-submissions-without-a-backend",
    title:
      'You don\'t need a backend to store form submissions. You need a place to ask "how many."',
    description:
      'Storing a signup is a trivial insert — no server needed. The part that wants a database is the reporting: "signups per day," "which referrer converted" — aggregations that want a query planner.',
    date: "2026-07-02",
    anchor: {
      label: "Store form submissions without a backend",
      path: "/solve/store-form-submissions-without-backend",
    },
    body: [
      {
        kind: "p",
        text: 'Every landing page hits the same wall around hour three: the signup form works, but where do the emails actually *go*? The reflex is to stand up a server and a database for what is, honestly, an `INSERT` and an occasional `COUNT`. So most people reach for a form service instead — and that solves storage, but quietly splits your data from your questions. The submissions live in someone else\'s dashboard; the moment you want "signups per day since launch" or "which referrer actually converted," you\'re exporting a CSV and pivoting it by hand.',
      },
      { kind: "h2", text: "Two problems hiding in one, with different shapes" },
      {
        kind: "p",
        text: '**Capture** is a write — a small one, and it genuinely doesn\'t need a server: an insert call from the page\'s own `fetch`, or a ten-line serverless function, is enough, as long as the write key isn\'t sitting in your client HTML. **Reporting** is a read, and it\'s the part that actually wants a database — because "how many per day," "top source this week," and "conversion by campaign" are aggregations, and aggregations want a query planner, not a spreadsheet and a human.',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- capture: one small insert per submission (no server required)\nINSERT INTO signups (email, referrer, created_at)\nVALUES ($1, $2, now());\n\n-- reporting: the part that actually wants a query planner\nSELECT date_trunc('day', created_at) AS day, count(*) AS signups\nFROM signups\nGROUP BY day\nORDER BY day;",
      },
      {
        kind: "p",
        text: 'The mistake is picking a tool that\'s great at the write and leaves you alone with the read. A form service nails capture and hands you a list. A spreadsheet-via-webhook nails capture and hands you a tab you pivot by hand. What you want is for the place the rows land to also be a place you can *ask questions of* — ideally in plain English, so the day-one question ("did anyone sign up?") and the week-two question ("which tweet drove it?") are the same two-second action, not a data chore.',
      },
      {
        kind: "p",
        text: "That's the shape worth looking for, whatever you build it on: **storage you can also interrogate.** Each submission is a row in a real Postgres, and the reporting question is one English goal — `signups grouped by day with a count` — that compiles to SQL you can read before you trust it.",
      },
      {
        kind: "p",
        text: "That's how [nlqdb](https://nlqdb.com) works, but the point isn't the tool — it's refusing to let your form data land somewhere you can't ask it anything. The honest caveat that applies to *any* version of this: the public read widget isn't a write endpoint, so capture still goes through a key the browser never sees, and email delivery plus spam filtering stay your front-end's and your ESP's job. Storage isn't the hard part. Not being able to ask your own data a question is.",
      },
    ],
  },
  {
    slug: "not-in-subquery-null-trap",
    title: "NOT IN returned zero rows. It wasn't your data — it was one NULL.",
    description:
      "Why WHERE id NOT IN (SELECT …) silently returns nothing when the subquery contains a NULL, and the two anti-join shapes (NOT EXISTS, LEFT JOIN … IS NULL) that never lie to you.",
    date: "2026-07-01",
    anchor: {
      label: "Find rows with no match in another table",
      path: "/solve/find-rows-with-no-match-in-another-table",
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
        text: "If a single `customer_id` in that subquery is NULL, you get **zero rows** — no error, no warning. Here's why: `NOT IN (a, b, NULL)` expands to `id <> a AND id <> b AND id <> NULL`. That last comparison is never `true` — comparing anything to NULL is `unknown` — so the whole `AND` chain can never be `true`, and every row is rejected. One NULL in the inner table silently empties your result.",
      },
      { kind: "h2", text: "The two shapes that actually work" },
      {
        kind: "code",
        lang: "sql",
        code: "-- LEFT JOIN ... IS NULL: keep the customers that found no matching order\nSELECT c.* FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;\n\n-- NOT EXISTS: a correlated anti-join, NULL-safe by construction\nSELECT * FROM customers c\nWHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);",
      },
      {
        kind: "p",
        text: "Both return the same rows for a plain anti-join. `NOT EXISTS` stops at the first match and never trips over NULLs. The `LEFT JOIN ... IS NULL` form is just as correct — but if the join key isn't unique it can multiply rows *before* the filter, so know your grain. What neither of them does is silently lie to you the way `NOT IN` does.",
      },
      {
        kind: "p",
        text: 'The rule worth keeping: reach for `NOT EXISTS` (or `LEFT JOIN ... IS NULL`) for "rows with no match," and treat `NOT IN (subquery)` as a smell unless you\'re certain the subquery is NULL-free.',
      },
      {
        kind: "p",
        text: "If you'd rather not re-derive which shape is safe every time: [nlqdb](https://nlqdb.com) takes \"customers who never placed an order\" in English, compiles the NULL-safe anti-join, runs it read-only, and shows the SQL so you can confirm it isn't a `NOT IN`. Honest limit — it owns the Postgres it answers; bring-your-own-Postgres is signed-in only, not the public embed.",
      },
    ],
  },
  {
    slug: "zep-recall-vs-analytical-agent-memory",
    title:
      'Zep gives my agent perfect recall. It still can\'t answer "average per group" about its own memory.',
    description:
      "A temporal knowledge graph is genuinely good at recall — and has no query planner. When the question about agent memory is a GROUP BY, retrieval and aggregation are different machines.",
    date: "2026-07-01",
    anchor: { label: "nlqdb vs Zep — the full side-by-side", path: "/vs/zep" },
    body: [
      {
        kind: "p",
        text: "If you've wired up [Zep](https://www.getzep.com) you know the pitch: it's the Context Lake — a temporal knowledge graph (Graphiti, 27k+ stars) that stores every fact your agent learns as a node with a validity window, resolves entities, and hands back the most relevant facts at query time. For *recall* it's genuinely good, and it publishes benchmarks (LongMemEval, DMR) to prove it.",
      },
      {
        kind: "p",
        text: "But we kept hitting the same wall. Once the agent had logged a few hundred things, we wanted to ask questions *about* the memory, not retrieve from it:",
      },
      {
        kind: "ul",
        items: [
          '"Top 10 topics I logged this month, ranked by count."',
          '"Average deal size per stage for enterprise customers."',
        ],
      },
      {
        kind: "p",
        text: "A knowledge graph has no query planner. It returns relevant facts and hopes the LLM does the arithmetic — which is a hallucination generator, not a `GROUP BY`.",
      },
      {
        kind: "p",
        text: "The honest split (the full side-by-side lives at [nlqdb vs Zep](/vs/zep/)): Zep wins on temporal validity, entity resolution, and vector recall over conversation. nlqdb wins when the agent needs to **aggregate** its memory — it's a real Postgres the agent provisions and queries in English, so `GROUP BY / JOIN / HAVING` actually work. They compose: Zep the recall layer, nlqdb the analytical store. Pick the one that matches the question you actually need answered.",
      },
      {
        kind: "p",
        text: "(Landscape facts verified 2026-06-19; both products' weaknesses are in the comparison, not just ours.)",
      },
    ],
  },
  {
    slug: "null-timestamp-ttl-sweep-funnel-metric",
    title: "The NULL timestamp that broke a TTL sweep and a funnel metric at the same time",
    description:
      "A backfill is not a default: one nullable timestamp column made an age-based eviction a silent no-op and pinned a funnel metric at zero — the same NULL, two different failure modes.",
    date: "2026-07-01",
    body: [
      {
        kind: "p",
        text: 'A row in our `databases` registry has a `last_queried_at` column. Two unrelated systems read it: a daily sweep that evicts anonymous DBs whose `last_queried_at` is older than 90 days, and a funnel metric that counts "DBs that have ever returned an answer." Both quietly broke for the same reason, and the bug is worth sharing because it\'s a whole *class* of mistake, not a one-off.',
      },
      {
        kind: "p",
        text: "We added the column in a migration that backfilled existing rows (`UPDATE … SET last_queried_at = updated_at WHERE last_queried_at IS NULL`) — textbook. What we forgot: the `INSERT` on the create path never set the column. So every row created *after* the migration was `NULL`.",
      },
      { kind: "p", text: "Now watch both readers fail, differently:" },
      {
        kind: "ul",
        items: [
          "**The sweep silently keeps everything.** `WHERE last_queried_at < :cutoff` looks like it evicts old rows. But in SQL, `NULL < anything` is `NULL`, which is not `TRUE`, so a `NULL` row never matches a `<` predicate. The age-based eviction became a no-op for every new row. No error, no log — the table just grows.",
          '**The metric silently reads zero.** "DBs that returned an answer" was `COUNT(*) WHERE last_queried_at IS NOT NULL`. Every new row is `NULL`, so the metric is pinned at 0 regardless of what users actually did. We nearly shipped a "fix" for a conversion problem that didn\'t exist — the *instrument* was broken, not the funnel.',
        ],
      },
      { kind: "h2", text: "Three takeaways" },
      {
        kind: "ol",
        items: [
          "**A backfill is not a default.** If a column needs a value, set it at write time (a `DEFAULT`, or in every `INSERT`). A one-time backfill fixes the past and nothing else.",
          '**NULL is not "old" or "zero" — it\'s "unknown," and it poisons comparisons.** Any `<` / `>` / `!=` against a nullable column has a third outcome you have to design for. `COALESCE` at the read, or forbid the `NULL`.',
          '**Before "fixing" a metric that reads 0, prove the instrument can ever read non-zero.** Ours structurally couldn\'t.',
        ],
      },
      {
        kind: "p",
        text: "(Context: this was in [nlqdb](https://nlqdb.com), a service that turns plain-English HTML components into SQL — the anonymous-DB sweep is how we keep the free tier's storage bounded. The fix was two lines: seed the column at create, re-run the backfill once.)",
      },
    ],
  },
];

export function blogBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
