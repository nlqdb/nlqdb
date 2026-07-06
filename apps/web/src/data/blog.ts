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
    slug: "llm-concatenates-columns-text-to-sql",
    title: "Your LLM fused the two columns you asked for — and the eval marked it wrong",
    description:
      "Gold SQL returns first_name, last_name as two columns; the model returns one concatenated full name. Positional-tuple EX scoring can never match them, so a semantically right answer scores as a miss.",
    date: "2026-07-06",
    body: [
      {
        kind: "p",
        text: "You ask a text-to-SQL model to \"list the members' names\". The benchmark's gold query returns `first_name, last_name` — two columns. The model returns one: a helpfully assembled full name. Read side by side, the model's answer is arguably the better one. The scorer marks it wrong, every single time, and your engine number reads lower than the engine is.",
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- gold: two columns\nSELECT first_name, last_name FROM member WHERE ...;\n\n-- model: one column, same information\nSELECT first_name || ' ' || last_name FROM member WHERE ...;",
      },
      { kind: "h2", text: "Why every execution-accuracy scorer does this" },
      {
        kind: "p",
        text: "Execution accuracy — the metric behind BIRD, Spider, and most private text-to-SQL evals — runs both queries and compares *positional value tuples*: canonical BIRD literally compares `set(fetchall())`. Column names are ignored on purpose (aliases shouldn't matter), which means the *shape* of each row is all that's left. A one-column result can never equal a two-column gold, no matter how right the content is.",
      },
      {
        kind: "p",
        text: 'This is the mirror image of the extra-columns failure everyone already knows about — where the model SELECTs a helpful extra field and the added column breaks tuple equality. Fusing two requested columns into one is exactly as fatal as adding one nobody asked for. The scorer has no notion of "close": the tuple matches or it doesn\'t.',
      },
      { kind: "h2", text: "The loss is real, measurable, and lopsided" },
      {
        kind: "p",
        text: "We bucketed a full 500-question BIRD-dev run of our free-lane engine with a structural differ before touching the prompt. The concatenation signature was unambiguous:",
      },
      {
        kind: "ul",
        items: [
          "**7 of 238 losses** concatenated columns where the gold query kept them separate.",
          "**0 of 256 wins** used `||` at all — the operator appeared only in losing answers.",
          "Gold itself used `||` in **1 of 500** questions.",
        ],
      },
      {
        kind: "p",
        text: "That last line is the decision. When a construct shows up in 3% of your losses, none of your wins, and almost none of the gold answers, discouraging it is near-pure upside — there is essentially nothing on the other side of the trade to regress.",
      },
      { kind: "h2", text: "The fix is one sentence in the planner prompt" },
      {
        kind: "p",
        text: "No fine-tune, no reranker: one projection directive — *return each requested attribute as its own column unless the question explicitly asks for a single combined string*. Before shipping it we de-concatenated the 7 flagged predictions by hand and re-executed them against the real SQLite databases to get a deterministic ceiling: **+3 questions** flip wrong-to-right, zero regressions. The live re-measure confirmed the direction: run-wide `||` concatenations dropped from 7 to 3, and 2 of the 3 ceiling questions flipped to matches.",
      },
      {
        kind: "p",
        text: "The general method matters more than this one directive: bucket your loss mass with a structural differ *first*, compute the deterministic ceiling of a candidate fix *second*, and only then edit the prompt. Prompt directives written from vibes overfit; directives written from a 7-losses/0-wins histogram are as close to a free lunch as engine work gets.",
      },
      { kind: "h2", text: "The rule" },
      {
        kind: "p",
        text: "The model's job is to match the shape of the answer, not to make it pretty. A helpful concatenation is still a wrong result set — and unless you bucket your losses, you'll never notice that some of your \"wrong\" answers were the model being more helpful than your gold.",
      },
      {
        kind: "p",
        text: "(This directive now ships in [nlqdb](https://nlqdb.com), the data layer you ask in English. The eval harness that found it — structural mismatch classifier, deterministic-ceiling re-scorer — runs against public BIRD/Spider plus our own ICP-shaped persona benchmark, so prompt changes land with a measured delta, not a hunch.)",
      },
    ],
  },
  {
    slug: "http-200-error-in-body",
    title:
      "Your text-to-SQL eval is lying: the gateway returns HTTP 200 with the error in the body",
    description:
      "A gateway commits 200 OK before the upstream model fails, so the error rides in the 200 body. A res.ok-only client counts it as a wrong answer, not an outage. res.ok is necessary, not sufficient.",
    date: "2026-07-05",
    body: [
      {
        kind: "p",
        text: "We were reading a text-to-SQL benchmark score that looked too low. Seven questions per 150-question run came back tagged `no_sql` — the model, we thought, had simply failed to produce a query. On a frontier lane that is a jarring number. So we opened the raw responses, and the model had failed to produce *nothing*. The HTTP status was `200 OK`. The body was an error.",
      },
      { kind: "h2", text: "A 200 is a promise the gateway makes before it knows the answer" },
      {
        kind: "p",
        text: "This is a property of gateways, not a bug in one vendor. When you call an LLM through an aggregator like OpenRouter, two machines are involved: the gateway you connect to, and the upstream provider it routes your request to. The gateway has to decide its HTTP status *when it starts streaming a response to you* — and at that moment the upstream request may still be in flight. So it commits to `200 OK`, opens the stream, and then the upstream call rate-limits, times out, or errors. The status line already went out. The only place left to report the failure is the response body.",
      },
      {
        kind: "p",
        text: "OpenRouter documents exactly this: an error can arrive with a `200` status and a top-level `error` object *instead of* `choices` ([errors reference](https://openrouter.ai/docs/api/reference/errors-and-debugging)). The shape looks like a normal completion envelope right up until you go looking for the content that isn't there.",
      },
      {
        kind: "code",
        lang: "json",
        code: '// HTTP/1.1 200 OK  ← the status lies\n{\n  "error": {\n    "code": 429,\n    "message": "Provider returned error",\n    "metadata": { "provider_name": "..." }\n  }\n}\n// no "choices" — the completion never happened',
      },
      { kind: "h2", text: "Why res.ok quietly corrupts an eval" },
      {
        kind: "p",
        text: 'The natural client is a two-branch one: if `res.ok`, parse the completion; otherwise, it\'s an infrastructure error — pause, back off, retry. That branch is where the damage happens. A `200` with an error body takes the *success* branch. Your parser reaches for `choices[0].message.content`, finds nothing, and hands back an empty string. Downstream, an empty completion is indistinguishable from "the model answered but produced no SQL" — so it gets scored as a **wrong answer**.',
      },
      {
        kind: "p",
        text: "That single misclassification does two bad things to a benchmark. It undercounts your engine's true accuracy — the model was never given a chance to answer, yet it eats the loss. And it hides a real capacity problem — those seven failures were rate-limits the harness should have paused and retried, not quality losses to investigate. You end up staring at planner prompts trying to fix an accuracy gap that is actually an outage in disguise.",
      },
      { kind: "h2", text: "The fix: res.ok is necessary, not sufficient" },
      {
        kind: "p",
        text: "Inspect the body for a top-level `error` before you trust the `choices`. A response is only a real completion if the transport succeeded *and* the payload carries content. Everything else is infrastructure — classify it as such so your retry logic and your metrics both see it correctly.",
      },
      {
        kind: "code",
        lang: "ts",
        code: 'const body = await res.json();\n\n// A 200 is not enough — the error can ride inside it.\nif (!res.ok || body?.error) {\n  const status = body?.error?.code ?? res.status;\n  // 429 → capacity: pause + retry, don\'t score it\n  // 5xx → provider error: retryable, still not a quality loss\n  throw new UpstreamError(status, body?.error?.message);\n}\n\nconst sql = body.choices?.[0]?.message?.content;\nif (!sql) throw new UpstreamError(200, "empty completion");',
      },
      {
        kind: "p",
        text: 'In our own eval harness this was a seven-line change to the response classifier, and it moved the frontier lane\'s ceiling immediately: seven `no_sql` "losses" per 150-question run reclassified from *engine failure* to *capacity pause*, which the tail-retry already covers. The accuracy number stopped lying, and the retry logic started catching the failures it was written for.',
      },
      { kind: "h2", text: "The general rule" },
      {
        kind: "p",
        text: "Any time you talk to a model through a gateway — an aggregator, a proxy, a load balancer, your own edge worker — the HTTP status describes the *hop you completed*, not the *work you asked for*. The two can disagree, and they disagree exactly when things are going wrong, which is the worst time to be blind. Read the body before you believe the status. If you're building an eval or an agent on top of a routed LLM, this one check is the difference between a metric you can trust and a metric that flatters your infrastructure by blaming your model.",
      },
      {
        kind: "p",
        text: "(This is one of the classifier rules behind [nlqdb](https://nlqdb.com), the data layer you ask in English: a rate-limited upstream is paused and retried, not counted as a query the engine couldn't answer — so the accuracy we report is the engine's, not the gateway's.)",
      },
    ],
  },
  {
    slug: "top-n-rows-per-group",
    title: "Top N per group is the query `LIMIT` can't write",
    description:
      '"Top 3 per category" reads like ORDER BY … LIMIT 3, but LIMIT caps the whole result set, not each group. The fix is ROW_NUMBER() OVER (PARTITION BY …) — and the hidden decision is how ties break.',
    date: "2026-07-04",
    anchor: {
      label: "Find the top N rows per group — the full guide",
      path: "/solve/find-top-n-rows-per-group",
    },
    body: [
      {
        kind: "p",
        text: 'You want the top 3 best-selling products *in each category*. Or the most recent order *per customer*. Or the highest-scoring attempt *per user*. The English is so plain it feels like it should compile to something you already know — `ORDER BY revenue DESC LIMIT 3` — and that is exactly the trap. `LIMIT` caps the *whole result set*. Ask it for the top 3 and it hands you the 3 best rows across every category combined, not 3 per category. The word "per" quietly moved the query somewhere `LIMIT` cannot follow.',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- What you wrote (wrong): 3 rows total, not 3 per category\nSELECT category, name, revenue\nFROM products\nORDER BY revenue DESC\nLIMIT 3;",
      },
      { kind: "h2", text: '"Per group" is a partition, not a limit' },
      {
        kind: "p",
        text: 'This is the classic "greatest-N-per-group" problem, and the reason it gets re-Googled every time is that the correct shape looks nothing like the question. You are not limiting rows — you are *ranking within each group and keeping the top of each rank*. That is a window function: number the rows inside each partition, then filter to the rank you want.',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- Rank inside each category, then keep the top 3 of each\nSELECT category, name, revenue\nFROM (\n  SELECT category, name, revenue,\n         ROW_NUMBER() OVER (\n           PARTITION BY category\n           ORDER BY revenue DESC\n         ) AS rn\n  FROM products\n) t\nWHERE rn <= 3;",
      },
      {
        kind: "p",
        text: 'The `PARTITION BY` is the "per category" the English asked for; the `ORDER BY` inside the window is the "best-selling"; the outer `WHERE rn <= 3` is the "top 3." You cannot filter on `rn` in the same SELECT that computes it — window functions are evaluated after `WHERE` — so it has to be a subquery (or a CTE). That structural jump, from a flat query to a nested ranked one, is the whole difficulty. Nothing here is hard; it just doesn\'t resemble the sentence you started with.',
      },
      { kind: "h2", text: 'The decision hiding in "top 3": what happens to ties' },
      {
        kind: "p",
        text: 'There is a second choice buried in that query, and it is the one that bites in production. If two products tie for third place by revenue, do you want exactly 3 rows, or all the rows tied at rank 3? `ROW_NUMBER()` breaks ties arbitrarily and gives you exactly 3 — but which of the tied rows it drops is undefined unless your `ORDER BY` is fully deterministic. `RANK()` keeps every tied row (so "top 3" might return 4). `DENSE_RANK()` keeps ties but doesn\'t skip rank numbers. Same English, three different answers, and the query never tells you which one you picked — you have to have decided.',
      },
      {
        kind: "ul",
        items: [
          "`ROW_NUMBER()` — **exactly N rows** per group; ties broken by the `ORDER BY` (add a tiebreak column, or the drop is nondeterministic).",
          "`RANK()` — **every tied row** at the cutoff is included, and rank numbers skip after a tie (1, 2, 2, 4).",
          "`DENSE_RANK()` — **ties included, no gaps** in the numbering (1, 2, 2, 3).",
        ],
      },
      { kind: "h2", text: "Ask in English — then read the SQL it ran" },
      {
        kind: "p",
        text: 'This is a good case for asking in plain English and *reading the query back*, precisely because the failure mode is silent: the wrong-`LIMIT` version runs fine and returns rows — just the wrong ones — and the tie behaviour never announces itself. "Top 3 products per category by revenue" should hand you back both the ranked rows and the `ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC)` it compiled, so you can confirm it partitioned by the column you meant and see how ties resolve before you trust the numbers in a deck.',
      },
      {
        kind: "p",
        text: "(That is the half we built [nlqdb](https://nlqdb.com) for: ask the top-N question in English over a Postgres it provisions, or one you already run via a signed-in connect, and get the ranked rows plus the compiled window-function SQL. Honest split — it returns a read-only ranked answer, not a live leaderboard that updates on its own; and if you want ties included, say so and it switches `ROW_NUMBER` to `RANK` or `DENSE_RANK`.)",
      },
      {
        kind: "p",
        text: 'The general lesson: when a question says "per" or "in each," the grain moved from the result set to a group inside it, and set-level tools like `LIMIT` stop applying. Reach for a window function — and decide the tie rule on purpose, because the query will pick one for you whether or not you meant to.',
      },
    ],
  },
  {
    slug: "your-bi-tool-got-acquired-data-layer",
    title: "Your BI tool got acquired. Your data layer shouldn't have to care.",
    description:
      "BI notebooks get rolled up — Mode → ThoughtSpot, Looker → Google, Periscope → Sisense. Fine when it's a destination humans log into; a liability when your product's runtime calls its API.",
    date: "2026-07-04",
    anchor: {
      label: "nlqdb vs Mode — the full side-by-side",
      path: "/vs/mode",
    },
    body: [
      {
        kind: "p",
        text: "The analytics-notebook category is a roll-up. Mode went to ThoughtSpot in 2023 for a reported $200M. Looker went to Google. Periscope Data went to Sisense. This is normal — good analytics companies get bought, and the tool keeps working the morning after. The question that decides whether the acquisition is *news* or a *problem* for you is where you put the tool: a place your people log into, or a dependency inside your product's runtime.",
      },
      { kind: "h2", text: "A destination survives an acquisition. A dependency inherits it." },
      {
        kind: "p",
        text: "When a BI tool is a **destination** — a workspace analysts open to write SQL, build a notebook, publish a dashboard — an acquisition is somebody else's roadmap. You get a new login screen, an eventual migration email, maybe a repriced tier. Annoying, bounded, and it happens on your analysts' time, not your users'. The tool is where humans go to look; the acquirer changing it is a thing humans notice and adapt to.",
      },
      {
        kind: "p",
        text: "When that same tool is a **dependency** — you wired its API, its embed, or its AI endpoint into the thing your product does at runtime — the acquisition is now your roadmap too. Whatever the buyer decides about that API's shape, its pricing, its rate limits, and especially its AI direction, your runtime inherits. Mode is a clean example: post-acquisition its AI arrives as ThoughtSpot Sage — LLM search over Mode Datasets, aimed at analysts. That's a reasonable direction for a destination analytics suite. It is a *different* direction than pre-acquisition Mode, and if your product had leaned on Mode's AI answering a specific way, the acquisition rewrote that for you, on the acquirer's schedule.",
      },
      { kind: "h2", text: "Two altitudes: where humans look vs. what your software calls" },
      {
        kind: "p",
        text: "The split worth naming is altitude, not vendor. A **destination analytics app** is a SQL IDE plus notebooks plus shareable reports — a surface an analyst drives to explore and publish. A **runtime data layer** is the thing your product or agent calls per request to turn a question into an answer, unattended, in the hot path. The first is where humans look; the second is what your software calls. A destination can be acquired and rebranded and your users never feel it; a runtime dependency's ownership *is* felt, because it's on the critical path of a request your app is making right now.",
      },
      {
        kind: "p",
        text: "So the durable move isn't \"pick the vendor least likely to be acquired\" — you can't predict that, and the good ones get bought. It's to keep the acquisition-exposed thing at the altitude where an acquisition is bounded. Use the destination as a destination. If a capability has to live in your runtime, own that layer or buy it from something whose entire contract *is* the runtime call — English in, compiled SQL and typed rows out — so there's no notebook, embed surface, or analyst-facing AI story for an acquirer to redirect underneath you.",
      },
      {
        kind: "p",
        text: "(That runtime layer is what [nlqdb](https://nlqdb.com) is: ask in English over a Postgres it provisions, or one you already run via a signed-in connect, and get the compiled SQL plus typed rows back over an SDK, an HTML element, or MCP. Honest caveat — it is *not* a notebook or a BI suite. For collaborative SQL, Python/R cells, charts, and shareable dashboards, a Mode or a Hex is the right tool, and the two compose cleanly: the notebook is where your analysts explore, nlqdb is the data layer your product calls at runtime.)",
      },
      {
        kind: "p",
        text: "The general lesson: an acquisition doesn't break a tool — it transfers the roadmap. Whether that matters to you is a function of altitude. Anything a human logs into can change hands quietly; anything your runtime calls should be owned, or bought as a runtime, so a deal you didn't sign can't rewrite a request your product is already making.",
      },
    ],
  },
  {
    slug: "find-duplicate-rows-you-re-google-every-time",
    title: "The duplicate-rows query you re-Google every six weeks",
    description:
      "Find duplicates hasn't changed in thirty years: GROUP BY the suspect columns, HAVING COUNT(*) > 1. Wanting the whole row, not just the key, quietly changes it to a window function.",
    date: "2026-07-03",
    anchor: {
      label: "Find duplicate rows in my data — the full guide",
      path: "/solve/find-duplicate-rows-in-my-data",
    },
    body: [
      {
        kind: "p",
        text: "There is a query nobody memorises and everybody needs: find the rows that are duplicated. A customer signed up twice, an import ran twice, a join fanned out and doubled every row. The answer has been the same for thirty years — `GROUP BY` the suspect columns, `HAVING COUNT(*) > 1` — and yet if you are not writing SQL daily you look it up *every single time*, because the shape is just unusual enough to not stick.",
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- Which emails appear more than once?\nSELECT email, COUNT(*) AS n\nFROM customers\nGROUP BY email\nHAVING COUNT(*) > 1;",
      },
      { kind: "h2", text: "The trap is not difficulty — it is that the shape changes under you" },
      {
        kind: "p",
        text: 'It bites in quiet ways. Group by the wrong columns and you under- or over-count — the grain of the query *is* the definition of "duplicate," and it is easy to pick the wrong one. And the moment you want the *whole duplicate row* rather than just the duplicated key, the query you Googled stops being the query you need. `GROUP BY` collapses each group to one summary row; to keep every offending row you reach for a window function instead:',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- Keep the full rows, tag the extras\nSELECT *\nFROM (\n  SELECT *,\n         ROW_NUMBER() OVER (\n           PARTITION BY email\n           ORDER BY created_at\n         ) AS rn\n  FROM customers\n) t\nWHERE rn > 1;",
      },
      {
        kind: "p",
        text: 'Same question — "where are my duplicates?" — two structurally different queries, and which one you want depends on whether you need the *count* or the *rows*. It is a yes/no question wearing a SQL costume, and the costume changes every time.',
      },
      { kind: "h2", text: "Ask in English — then read the SQL it ran" },
      {
        kind: "p",
        text: 'This is exactly the case for asking in plain English and *reading the SQL it generates*. Not because SQL is beneath you — because the grain matters here and you want to verify it. "Which customers appear more than once by email?" should hand you back both the rows and the `GROUP BY email HAVING COUNT(*) > 1` it ran, so you can confirm it grouped on the column you meant before you trust the count. A chat model can write you that query; it cannot run it against your data, and if you paste rows into a prompt and ask it to count, it will confidently hallucinate the tally.',
      },
      {
        kind: "p",
        text: "(That is the half we built [nlqdb](https://nlqdb.com) for: ask the duplicate question in English over a Postgres it provisions, or one you already run via a signed-in connect, and get the rows plus the compiled SQL. Honest split — it *reports* duplicates with a read-only query; which row to keep and how to merge is a write you run deliberately, and matching is exact, not fuzzy.)",
      },
    ],
  },
  {
    slug: "text-to-sql-build-vs-buy",
    title: "The text-to-SQL demo takes an afternoon. The other 90% is why you should buy it.",
    description:
      "Prompt + model + run the SQL is 10% of an 'ask your data' feature. The fail-closed validator, plan cache, and eval harness are the rest — yours forever. The real question: do you want that stack?",
    date: "2026-07-03",
    anchor: {
      label: "Add 'ask your data' without building text-to-SQL — the full guide",
      path: "/solve/add-ask-your-data-feature-without-building-text-to-sql",
    },
    body: [
      {
        kind: "p",
        text: "The demo really is an afternoon. Pull the table definitions out of `information_schema`, template them into a prompt with the user's question, call a model, run whatever SQL comes back, render the rows. Every stack has a tutorial for this now, and they all work — \"let our users ask their data in English\" goes from ticket to working prototype before the day ends. That's the 10%.",
      },
      { kind: "h2", text: "The other 90% shows up after the first real user" },
      {
        kind: "p",
        text: "The prototype's job was to produce SQL. The feature's job is to run model-authored SQL against your production database, on your users' behalf, unattended. Those are different jobs, and the gap between them is a stack of infrastructure the tutorial never mentions:",
      },
      {
        kind: "ul",
        items: [
          "**A validator that fails closed.** The model will eventually emit a write — a `DELETE` inside a CTE, a `DROP` behind a comment, a join onto a table the asker should never see. You need a parser-level allow-list that rejects everything except the reads you meant to permit, and rejects anything it can't parse. A regex denylist is the bug report you haven't received yet.",
          "**A plan cache keyed on question + schema version.** The same question shouldn't cost a model call twice, so you cache compiled plans — but a cached plan is only valid until the schema moves, so the key has to carry a schema fingerprint and invalidation becomes your problem. Skip this and every dashboard load bills you fresh tokens at p95 model latency.",
          "**An eval harness over a labelled set.** Prompts get edited, models get swapped or silently updated, and NL→SQL accuracy moves when either happens. Without a scored question→gold-answer set you find the regression when a customer does. Building the harness is a project; keeping the labelled set honest as your schema evolves is a chore with no finish line.",
        ],
      },
      {
        kind: "p",
        text: "None of this is exotic — every piece is buildable. The catch is that every piece is *maintainable*: production infrastructure with your on-call rotation's name on it, in service of a feature that probably isn't your product.",
      },
      { kind: "h2", text: "The honest build-vs-buy test" },
      {
        kind: "p",
        text: "The wrong question is \"can I generate SQL from English?\" Yes — in an afternoon, that's the point. The right question is \"do I want to own that stack?\" If natural-language querying *is* your product — you're building a BI tool, a data platform, an agent framework — own it; the validator and the eval harness are your moat. If it's a reporting tab, a search box over each user's own rows, an in-app assistant — a feature inside a product that's about something else — buy the pipeline and embed it, the way you'd buy auth or email instead of running an SMTP server.",
      },
      {
        kind: "p",
        text: "(That second case is the one [nlqdb](https://nlqdb.com) exists for: drop in one element or one `POST /v1/ask`, the English compiles against the live schema, the compiled SQL is shown before anyone trusts it, reads pass a fail-closed allow-list, and the validator/cache/eval stack is our maintenance burden instead of yours. Honest limits: it's a hosted pipeline you embed, not a library you vendor — and \"many users over their own rows\" still means a database or an isolation scope per tenant, because per-user row-level security inside one shared database isn't shipped.)",
      },
      {
        kind: "p",
        text: "The general lesson: a demo prices the first afternoon; a feature prices the years after it. When an AI capability collapses the demo cost to nearly zero — and text-to-SQL has — the build-vs-buy decision doesn't disappear. It just moves to the part of the stack the demo never showed you.",
      },
    ],
  },
  {
    slug: "sitemap-advertising-redirects",
    title: "Your sitemap is advertising redirects — and your canonical tag points at one",
    description:
      "A static host that serves route/index.html 307-redirects the bare path. Our sitemap advertised 27 redirecting URLs and every canonical tag pointed at one. The fix is one path-normalize helper.",
    date: "2026-07-03",
    body: [
      {
        kind: "p",
        text: "Run `curl -sI` over the URLs in your own sitemap. We did, and 27 of ours answered **307 Temporary Redirect** — every route on the site. The canonical tag was worse: each page declared a canonical URL that redirected to the page itself. We were telling crawlers, on every single page, that the authoritative copy lives one hop away.",
      },
      { kind: "h2", text: "How a static host quietly forks every URL in two" },
      {
        kind: "p",
        text: "The mechanics are mundane, which is why this survives review. A static build writes each route as `route/index.html`. The host serves `/route/` directly — and answers the bare `/route` with a 307 to the slash form. So every route on the site has two URLs: one real, one a redirect. Which one your HTML advertises depends on whoever typed the link.",
      },
      {
        kind: "p",
        text: "Our templates typed the bare form everywhere it matters most: the `canonical` tag, `og:url`, the sitemap generator, and `llms.txt` — the four surfaces whose entire job is to name the authoritative URL. All four advertised the redirect.",
      },
      { kind: "h2", text: "Why a self-referential redirecting canonical is worth fixing" },
      {
        kind: "ul",
        items: [
          "**A canonical pointing at a redirect is a mixed signal.** The tag exists to end URL ambiguity; making crawlers resolve a hop to find the 'canonical' copy reintroduces exactly the ambiguity it was meant to close.",
          "**Sitemap URLs are supposed to be final.** Search engines tolerate redirects there, but every hop is a chance for a URL to get indexed in the form you didn't pick — and split whatever authority the page earns across two spellings.",
          "**AI crawlers fetch exactly what you wrote.** `llms.txt` consumers and answer-engine bots are literal; an extra 307 on every fetch is latency you chose, on the surface built for machines.",
        ],
      },
      { kind: "h2", text: "The fix is a policy plus one helper, not a link hunt" },
      {
        kind: "p",
        text: 'Chasing individual links is the wrong altitude. The durable fix was three moves: pick the slash form as policy (`trailingSlash: "always"`, so the build itself rejects the other spelling); route every emitted URL — canonical, `og:url`, sitemap, `llms.txt` — through one path-normalize helper in the head layout and URL generators; and re-audit with `curl -sI` over every sitemap URL, expecting nothing but 200s.',
      },
      {
        kind: "p",
        text: "The one-helper rule is what made the follow-up cheap: once advertised URLs were normalized in one place, sweeping the remaining 1,100+ bare-path hrefs inside page bodies was a mechanical pass, and a link check in the build now fails on any regression. ([nlqdb](https://nlqdb.com) is the database you talk to; this is one of the engineering notes from building it in the open.)",
      },
      {
        kind: "p",
        text: "The general lesson: every surface that names a URL — canonical, `og:url`, sitemap, `llms.txt`, internal hrefs — should call the same normalize function. If two of them can disagree about your own address, they eventually will, and you'll advertise the disagreement to every crawler that visits.",
      },
    ],
  },
  {
    slug: "offline-llm-eval-rate-limits",
    title: "Your offline LLM eval isn't measuring your model — it's measuring your rate limits",
    description:
      "A free-model NL-to-SQL bench scored 17/20, then 6/20 ninety seconds later. The model didn't change — the providers got tired. How to keep availability out of your accuracy number.",
    date: "2026-07-03",
    body: [
      {
        kind: "p",
        text: "Our small NL-to-SQL benchmark — twenty questions, one gold query each, scored by executing the SQL and comparing result sets — came back **17/20** on a greedy pass. An immediate second run on the same commit, drawing three samples per question instead of one, came back **6/20**, with 14 of the 20 questions returning no SQL at all. Ninety seconds apart, same engine, same prompts, an eleven-answer collapse.",
      },
      {
        kind: "p",
        text: "Nothing regressed. The engine behind [nlqdb](https://nlqdb.com) runs on a chain of free-tier LLM providers, and the second run tripled the request volume the first run had already spent. The providers got tired. The score didn't measure the model's reasoning — it measured the moment the free quota ran out.",
      },
      { kind: "h2", text: "The failure signature: instant, empty, off the books" },
      {
        kind: "p",
        text: "The tell is in the error tally, not the score. Those 14 no-SQL answers were `circuit_open` fast-fails: an earlier 429 had opened the provider's circuit breaker for its `Retry-After` window, so the call failed before any tokens were generated — the p50 latency of a failing question was ~0 ms. A model that reasons badly takes seconds to be wrong; a rate limit is wrong instantly. When your failures are instant, you are measuring availability, not accuracy.",
      },
      {
        kind: "p",
        text: "On a multi-provider chain the collapse compounds: the 429 opens one breaker, the chain falls through to the next provider (also cooling down), and within a few questions every attempt fails without reaching a model. We hit the same wall at scale — our first full 500-question BIRD dispatch scored a dismal 0.214, and 246 of its 283 no-SQL failures were breaker fast-fails. We discarded the number. It measured the wall, not the engine.",
      },
      { kind: "h2", text: "Three rules that keep availability out of the accuracy number" },
      {
        kind: "ul",
        items: [
          "**Throttle to measure reasoning.** Spacing questions ~4 s apart keeps the run inside the free tiers' request rates. Our first clean throttled pass scored 21/23 — consistent with the healthy 17/20, nowhere near the starved 6/20. Slower, but the number means what it claims to mean.",
          "**Budget-stop and resume; don't push through.** When every attempt in a stretch fails with `rate_limited` or `circuit_open` after one bounded capacity wait, stop scoring and write a checkpoint keyed on the commit SHA. A full 500-question pass now runs as a handful of ~15-minute windows resumed across the day, instead of one starved marathon that scores the outage.",
          "**Keep the smoke test away from the powered run.** The quick greedy smoke and the windowed canonical run drain the same shared quota; back-to-back, the second one measures the first one's exhaust. Anything else that borrows the free chain — for us, an e2e suite whose driver is an LLM — belongs on a different day than a full eval.",
        ],
      },
      {
        kind: "p",
        text: "The general lesson: if a benchmark number moves more between 9:00 and 9:02 than it does between two commits, read the error tally before the diff. An execution-accuracy score is only meaningful over questions that actually reached a model, so report attempted-versus-total next to the headline number — and treat instant failures as a capacity problem to engineer around (throttles, breakers, resumable windows), not a reasoning regression to bisect.",
      },
    ],
  },
  {
    slug: "ai-internal-tool-builder-faster",
    title: "AI made the internal-tool builder faster. It didn't ask whether you needed the tool.",
    description:
      "Low-code AI scaffolds the admin tool in a prompt. But the output is still a destination a human operates — and often the answer belongs inline in your product, or the asker is an agent.",
    date: "2026-07-03",
    anchor: {
      label: "nlqdb vs Retool — the full side-by-side",
      path: "/vs/retool",
    },
    body: [
      {
        kind: "p",
        text: "Every low-code platform now has an AI layer. Describe the app, it scaffolds the screens against your schema. Ask in English, it writes the SQL. Point an agent at it and it plans, calls tools, and queries your data with guardrails. This is real and it's good — the thing that used to take an afternoon of dragging components and wiring queries takes a prompt.",
      },
      { kind: "h2", text: "What got faster is building the tool" },
      {
        kind: "p",
        text: 'But notice what got faster: *building the tool*. The output is still a destination — an internal app a human opens, logs into, and reads. AI shortened the path from "I need a dashboard" to "I have a dashboard." It didn\'t question the premise that the answer to a data question is a dashboard you build.',
      },
      {
        kind: "p",
        text: "A lot of the time it isn't. The data question lives *inside* a product you're already shipping — \"show this customer their last five orders,\" \"what did this account spend this quarter\" — and the honest deliverable isn't a separate admin app, it's an answer rendered inline, on the page the user is already on. Or the asker isn't a human at all: it's an agent that needs to provision a database, write to it, and query it programmatically on every request, with no UI in the loop ever. Neither of those wants a built tool. They want a backend primitive.",
      },
      { kind: "h2", text: "Builder or backend primitive" },
      {
        kind: "p",
        text: "That's the fork. A builder — even an AI-supercharged one — assumes a human will assemble and operate the result. A backend primitive assumes nobody will: you embed one element or call one API, pass an English goal, and get typed rows back. (At [nlqdb](https://nlqdb.com) we took the second side on purpose — English compiles to SQL over a Postgres the product or agent *provisions and owns*, writes diff-previewed, no app to assemble first — which is exactly why we don't ship a drag-drop canvas. Different job.) The builder wins when the deliverable genuinely is a standalone tool a team will run; the primitive wins when the answer belongs in the product, or the asker is code.",
      },
      {
        kind: "p",
        text: "Lesson: when an AI feature makes an old workflow 10× faster, check whether it made the *workflow* faster or the *outcome* faster. Scaffolding an internal tool faster is a real win — but if what you actually needed was the answer in your own app, or a database your agent stands up itself, the fastest builder is still building something you didn't need.",
      },
    ],
  },
  {
    slug: "text-to-sql-accuracy-schemas-your-users-never-build",
    title: "Your text-to-SQL accuracy is measured on schemas your users will never build",
    description:
      "BIRD and Spider score NL-to-SQL over messy academic schemas. The same free-model chain that scores 0.52 on BIRD scores 0.96 on the schema shapes our users actually build — so we report both.",
    date: "2026-07-02",
    body: [
      {
        kind: "p",
        text: "Every text-to-SQL engine publishes the same two numbers: BIRD and Spider. Ours are not flattering — the strict-$0 free-model chain behind nlqdb currently scores **0.52** on BIRD Mini-Dev and **0.19** on the Spider 2.0-lite SQLite subset. We track both weekly, against a pinned baseline, with a paired significance test, because those benchmarks are the honesty instrument of this field: hard, public, and comparable to every research paper.",
      },
      {
        kind: "p",
        text: "But look at what they actually measure. BIRD's databases are real-world dumps — dozens of tables, cryptic column names, dirty values, questions that hinge on external knowledge notes. Spider 2.0 is enterprise-analytics scale on purpose; its authors built it because models had gotten too good at the small clean stuff. Both are the right kind of hard for a research leaderboard. Neither looks anything like the database a user of a product like ours ever touches.",
      },
      { kind: "h2", text: "The schema your users build is the one you never scored" },
      {
        kind: "p",
        text: "Our users describe a goal in plain English and get a small, freshly-provisioned Postgres: a form-submissions table, a four-table agent-memory schema, a webhook event log. Five tables, honest column names, no fifteen-year accretion of legacy views. That shape — the one 100% of production queries actually run against — had zero rows in either benchmark. Which means the headline accuracy number described a workload we don't serve, in both directions: it undercounts what users experience, and it can hide regressions on the queries they really ask.",
      },
      { kind: "h2", text: "persona-bench: gold queries over the ICP shape, same scorer" },
      {
        kind: "p",
        text: "So we added a third benchmark and open-sourced it into the repo: **persona-bench**, 23 hand-authored question/gold-SQL pairs over the two schema shapes our personas actually build (a SaaS app DB and the agent-memory preset). Three rules kept it honest:",
      },
      {
        kind: "ul",
        items: [
          "**Same execution-accuracy scorer as BIRD/Spider.** A result-set match against gold, not an LLM judge — the number is comparable across all three datasets.",
          "**Gold is literal-date, never relative.** No `now()` in gold SQL, so a question's answer never drifts with the clock and a run today reproduces a run in March.",
          "**A gold-executability invariant runs first.** Every gold query must execute against the fixture and return non-degenerate rows before any model is scored. A benchmark with broken gold measures nothing — the ruler gets checked before the thing it measures.",
        ],
      },
      {
        kind: "p",
        text: "The result: the same free chain that scores 0.52 on BIRD and 0.19 on Spider scores **0.96 (22/23)** on persona-bench. That is not a brag — small clean schemas are exactly where NL-to-SQL is easy, which is the point: the difficulty distribution of a benchmark is a product decision, and defaulting to the academic one silently pins your roadmap to someone else's workload. The one persona-bench miss told us more about our planner than fifty BIRD misses over schemas we will never host.",
      },
      { kind: "h2", text: "Keep both numbers" },
      {
        kind: "p",
        text: "The failure mode to avoid is swapping the hard public benchmark for your flattering private one. We report all three: BIRD and Spider for comparability and as the hard floor that keeps us honest, persona-bench for the workload users hit. Two caveats we attach every time: 23 questions is small — one flipped answer moves the score about 4 points — and a benchmark you author yourself has an obvious conflict of interest, which the executability invariant and publishing the fixture mitigate but do not remove.",
      },
      {
        kind: "p",
        text: "If you ship an NL-to-data feature, the take-away is one afternoon of work: write twenty gold queries over the schema shape your users actually have, score them with the same execution-accuracy check the papers use, and run it beside the public benchmarks — not instead of them. ([nlqdb](https://nlqdb.com) is the database you talk to; the harness, fixture, and all three scores live in the open repo.)",
      },
    ],
  },
  {
    slug: "mcp-server-what-does-the-agent-own",
    title:
      "Every data tool shipped an MCP server this year. Your agent still can't build on most of them.",
    description:
      "Two shapes of MCP server look identical in a feature matrix: a window into a human's app, or infrastructure the agent owns. The tell is what the agent owns after the call returns.",
    date: "2026-07-02",
    anchor: {
      label: "nlqdb vs Hex — the full side-by-side",
      path: "/vs/hex",
    },
    body: [
      {
        kind: "p",
        text: 'MCP is the new "we have an API." Writing a competitor comparison recently, I went to mark "agent-callable" as our differentiator against an AI data-notebook tool — and stopped, because they\'d shipped an MCP server too. So had the BI tool two rows up. The honest move was to concede the checkbox. But conceding it surfaced the real axis, and it\'s one worth naming.',
      },
      { kind: "h2", text: "Two shapes of MCP server" },
      {
        kind: "p",
        text: 'There are two shapes of MCP server, and they look identical in a feature matrix. The first wraps a **destination app**: "ask my published notebook a question," "answer from my dashboard in Slack." The human\'s workflow, now reachable by an agent. The second exposes **infrastructure the agent owns**: provision a database, write rows, query them, migrate the schema. Both speak MCP. Only the second lets an agent build something that outlives the conversation.',
      },
      {
        kind: "p",
        text: "The tell is to ask what the agent *owns* after the call returns. If the answer is \"a view into a human's analysis,\" that's a genuinely useful human-in-the-loop surface — and a dead end for an autonomous agent, because the agent can read but can't accumulate. It has nowhere to put the row it just computed. An agent that can query but not persist is a calculator, not a coworker.",
      },
      { kind: "h2", text: '"Does it have MCP" is the wrong question' },
      {
        kind: "p",
        text: "So the question to ask a tool's MCP server isn't \"does it exist\" — by 2026 it always does. It's **\"what does it let the agent own?\"** Read-only over someone else's app, or a substrate the agent can write to and come back to. The matrix can't tell them apart; you have to read what the verbs actually do.",
      },
      {
        kind: "p",
        text: "(At [nlqdb](https://nlqdb.com) the MCP verb `nlqdb_query` materialises a Postgres on first reference — omit the database id with none provisioned and it creates one from the goal, so the agent gets a database it owns, not a window into ours. The comparison that prompted this is at [nlqdb vs Hex](/vs/hex/).)",
      },
    ],
  },
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
