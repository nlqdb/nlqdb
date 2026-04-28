// Auto-carousel content for the homepage. Twenty examples spanning
// the surfaces nlqdb claims to cover: create-DB, schema-edit, insert,
// aggregate, filter, join, time-bucket, write/refund, agent-memory,
// CRM, leaderboard, feedback inbox.
//
// Kept separate from `Carousel.astro` so adding/editing an example
// is a single-file diff with no markup churn. Each entry should
// stand on its own — the carousel renders one at a time and a
// visitor may see only a few before scrolling away, so every slide
// is the strongest version of its concept.
//
// Order: lead with the strongest READ (revenue-by-drink — populated
// table, immediately legible payoff) so a visitor's first 8 seconds
// land on a real "the AI just answered me" moment. Mix CREATE /
// SCHEMA / WRITE through the first half so each category gets seen
// before the user scrolls away; trailing reads pad the long tail.
//
// `id` is stable, used for keys + pause-on-share-link in the future.
// `category` drives the result block: `read` shows a table,
// `write` / `schema` / `create` show a status line.
//
// `embed` is the "drop-this-in-your-code" snippet — now the only
// typewriter target on each slide. The literal `{goal}` placeholder
// marks where the user-typed goal text lands; the typewriter
// populates that slot directly inside the snippet. Surrounding text
// renders verbatim (Astro auto-escapes HTML special chars).
//
// We rotate across FOUR surfaces so visitors see the breadth of
// integration shapes nlqdb covers — not just "it's a web embed":
//   html → `<nlq-data>` / `<nlq-action>` (drop-in custom elements,
//          best for read widgets and click-to-submit forms)
//   bash → `nlq new` / `nlq schema`     (admin CLI for create +
//          schema; the right shape when there's no embedding page)
//   rest → `curl api.nlqdb.com/v1/ask`  (backend-triggered reads +
//          writes — webhooks, cron, server code)
//   mcp  → `nlqdb.ask({ db, goal })`    (AI-assistant tool call via
//          mcp.nlqdb.com — the agent-callable surface)
//
// Distribution across the 20 slides: ~9 HTML / 4 CLI / 4 REST / 3 MCP.
// Picked per-example for the *most evocative* shape — agent-memory
// reads land on MCP, refund-the-last-order writes land on REST,
// schema migrations land on CLI, etc.

export type ShowcaseRow = Record<string, string | number | null>;

export type ShowcaseEmbed = {
  // Surface kind — drives the chip label on the slide ("HTML" / "CLI"
  // / "REST" / "MCP") and aria-label, plus future syntax coloring.
  lang: "html" | "bash" | "rest" | "mcp";
  template: string;
};

export type ShowcaseExample = {
  id: string;
  category: "create" | "schema" | "write" | "read";
  goal: string;
  sql: string;
  embed: ShowcaseEmbed;
  // Read examples render a small table. Cap at ~6 rows per slide so
  // the layout doesn't reflow unpredictably across breakpoints.
  rows?: ShowcaseRow[];
  // Write / schema / create examples render a status badge instead.
  status?: string;
  // Optional one-liner under the result. Often cheaper than another row.
  summary?: string;
};

export const SHOWCASE_EXAMPLES: ShowcaseExample[] = [
  // 1 — READ: showpiece. Populated revenue table is the most
  // immediate "the AI answered me" moment.
  {
    id: "read-revenue-by-drink",
    category: "read",
    goal: "today's revenue by drink",
    sql: "SELECT drink, COUNT(*) AS orders, ROUND(SUM(total), 2) AS revenue\n  FROM orders\n WHERE created_at > date_trunc('day', now())\n GROUP BY drink\n ORDER BY revenue DESC;",
    embed: { lang: "html", template: '<nlq-data goal="{goal}" db="db_coffee"></nlq-data>' },
    rows: [
      { drink: "flat white", orders: 14, revenue: 64.4 },
      { drink: "cortado", orders: 11, revenue: 47.3 },
      { drink: "americano", orders: 9, revenue: 35.1 },
      { drink: "cold brew", orders: 8, revenue: 36.8 },
      { drink: "espresso", orders: 6, revenue: 19.2 },
      { drink: "latte", orders: 4, revenue: 18.0 },
    ],
    summary: "today aggregated · sorted by revenue",
  },
  // 2 — CREATE
  {
    id: "create-coffee-db",
    category: "create",
    goal: "an orders tracker for my coffee shop",
    sql: "CREATE DATABASE db_coffee;\nCREATE TABLE orders (id, customer, drink, total, created_at);",
    embed: { lang: "bash", template: 'nlq new "{goal}"' },
    status: "✓ created db_coffee · 1 table inferred",
    summary: "schema = orders(id, customer, drink, total, created_at)",
  },
  // 3 — SCHEMA
  {
    id: "schema-add-column",
    category: "schema",
    goal: "add an allergens column to the drinks table",
    sql: "ALTER TABLE drinks\n  ADD COLUMN allergens TEXT[] DEFAULT '{}';",
    embed: { lang: "bash", template: 'nlq schema db_coffee "{goal}"' },
    status: "✓ column added · 47 rows backfilled to default",
  },
  // 4 — READ
  {
    id: "read-busiest-hour",
    category: "read",
    goal: "what's my busiest hour today?",
    sql: "SELECT EXTRACT(HOUR FROM created_at) AS hour, COUNT(*) AS orders\n  FROM orders\n WHERE created_at > date_trunc('day', now())\n GROUP BY 1\n ORDER BY orders DESC\n LIMIT 1;",
    embed: {
      lang: "rest",
      template: 'curl api.nlqdb.com/v1/ask -d \'{"db":"db_coffee","goal":"{goal}"}\'',
    },
    rows: [{ hour: 11, orders: 47 }],
    summary: "11:00 — 47 orders, 22% of the day's volume",
  },
  // 5 — WRITE
  {
    id: "write-insert-order",
    category: "write",
    goal: "log a new order: latte for sarah, $4.50",
    sql: "INSERT INTO orders (customer, drink, total)\n VALUES ('sarah', 'latte', 4.50)\nRETURNING id;",
    embed: {
      lang: "html",
      template: '<nlq-action goal="{goal}" db="db_coffee">Log order</nlq-action>',
    },
    status: "✓ inserted order #4128",
  },
  // 6 — READ (anti-join — strong "AI understood the negation" beat)
  {
    id: "read-stale-customers",
    category: "read",
    goal: "customers who haven't ordered in 30 days",
    sql: "SELECT name, last_order_at\n  FROM customers c\n WHERE NOT EXISTS (\n   SELECT 1 FROM orders o\n    WHERE o.customer = c.name\n      AND o.created_at > now() - interval '30 days'\n )\n ORDER BY last_order_at;",
    embed: { lang: "html", template: '<nlq-data goal="{goal}" db="db_coffee"></nlq-data>' },
    rows: [
      { name: "noah", last_order_at: "2026-02-14" },
      { name: "priya", last_order_at: "2026-02-28" },
      { name: "marcus", last_order_at: "2026-03-08" },
      { name: "kira", last_order_at: "2026-03-19" },
    ],
  },
  // 7 — CREATE
  {
    id: "create-crm-db",
    category: "create",
    goal: "a CRM for two-person startups",
    sql: "CREATE DATABASE db_crm;\nCREATE TABLE contacts (...);\nCREATE TABLE deals (...);",
    embed: { lang: "bash", template: 'nlq new "{goal}"' },
    status: "✓ created db_crm · 2 tables inferred",
    summary: "schema = contacts(name, company, email), deals(contact_id, value, stage)",
  },
  // 8 — SCHEMA
  {
    id: "schema-tag-high-caffeine",
    category: "schema",
    goal: "tag drinks with caffeine over 100mg as high-caffeine",
    sql: "UPDATE drinks\n   SET tags = array_append(tags, 'high-caffeine')\n WHERE caffeine_mg > 100;",
    embed: {
      lang: "mcp",
      template: 'nlqdb.ask({ db: "db_coffee", goal: "{goal}" })',
    },
    status: "✓ updated 8 of 47 rows",
  },
  // 9 — READ (join — basket-style analysis)
  {
    id: "read-co-ordered",
    category: "read",
    goal: "drinks ordered together with cake",
    sql: "SELECT drink, COUNT(*) AS together\n  FROM orders o\n  JOIN order_items i ON i.order_id = o.id\n WHERE i.item = 'cake'\n GROUP BY drink\n ORDER BY together DESC\n LIMIT 4;",
    embed: { lang: "html", template: '<nlq-data goal="{goal}" db="db_coffee"></nlq-data>' },
    rows: [
      { drink: "latte", together: 87 },
      { drink: "espresso", together: 62 },
      { drink: "americano", together: 41 },
      { drink: "cold brew", together: 18 },
    ],
  },
  // 10 — WRITE
  {
    id: "write-refund",
    category: "write",
    goal: "refund the last order",
    sql: "UPDATE orders\n   SET status = 'refunded', refunded_at = now()\n WHERE id = (SELECT MAX(id) FROM orders)\nRETURNING id, total;",
    embed: {
      lang: "rest",
      template: 'curl api.nlqdb.com/v1/ask -d \'{"db":"db_coffee","goal":"{goal}"}\'',
    },
    status: "✓ refunded order #4127 · $6.20",
  },
  // 11 — READ (time-bucket)
  {
    id: "read-aov-by-hour",
    category: "read",
    goal: "average order value by hour today",
    sql: "SELECT EXTRACT(HOUR FROM created_at) AS hour,\n       ROUND(AVG(total), 2) AS avg_order\n  FROM orders\n WHERE created_at > date_trunc('day', now())\n GROUP BY 1\n ORDER BY 1;",
    embed: { lang: "html", template: '<nlq-data goal="{goal}" db="db_coffee"></nlq-data>' },
    rows: [
      { hour: 7, avg_order: 4.1 },
      { hour: 8, avg_order: 4.6 },
      { hour: 9, avg_order: 4.4 },
      { hour: 10, avg_order: 4.9 },
      { hour: 11, avg_order: 5.4 },
      { hour: 12, avg_order: 6.1 },
    ],
    summary: "AOV climbs into lunch · pastries kick in at 11",
  },
  // 12 — SCHEMA
  {
    id: "schema-add-birthday",
    category: "schema",
    goal: "add a birthday field to customers",
    sql: "ALTER TABLE customers\n  ADD COLUMN birthday DATE;",
    embed: { lang: "bash", template: 'nlq schema db_coffee "{goal}"' },
    status: "✓ column added",
    summary: "1,247 rows · default NULL · backfill via /v1/ask later",
  },
  // 13 — READ (data quality / NULL hunt)
  {
    id: "read-customers-no-info",
    category: "read",
    goal: "orders missing customer info",
    sql: "SELECT id, drink, total, created_at\n  FROM orders\n WHERE customer IS NULL\n    OR customer = ''\n ORDER BY created_at DESC;",
    embed: {
      lang: "rest",
      template: 'curl api.nlqdb.com/v1/ask -d \'{"db":"db_coffee","goal":"{goal}"}\'',
    },
    rows: [
      { id: 4118, drink: "americano", total: 3.8, created_at: "2026-04-27 09:14" },
      { id: 4101, drink: "latte", total: 4.5, created_at: "2026-04-26 18:32" },
      { id: 4087, drink: "cortado", total: 4.3, created_at: "2026-04-26 11:10" },
    ],
    summary: "3 anonymous orders this week",
  },
  // 14 — WRITE (subquery + grouping — most complex write)
  {
    id: "write-bulk-promote",
    category: "write",
    goal: "promote everyone with > 100 orders to 'gold' tier",
    sql: "UPDATE customers\n   SET tier = 'gold', updated_at = now()\n WHERE id IN (\n   SELECT customer_id FROM orders\n    GROUP BY customer_id\n   HAVING COUNT(*) > 100\n );",
    embed: {
      lang: "mcp",
      template: 'nlqdb.ask({ db: "db_coffee", goal: "{goal}" })',
    },
    status: "✓ updated 23 rows",
  },
  // 15 — READ
  {
    id: "read-top-orders-week",
    category: "read",
    goal: "5 most-ordered drinks this month",
    sql: "SELECT drink, COUNT(*) AS orders\n  FROM orders\n WHERE created_at > date_trunc('month', now())\n GROUP BY drink\n ORDER BY orders DESC\n LIMIT 5;",
    embed: { lang: "html", template: '<nlq-data goal="{goal}" db="db_coffee"></nlq-data>' },
    rows: [
      { drink: "flat white", orders: 412 },
      { drink: "americano", orders: 298 },
      { drink: "cortado", orders: 244 },
      { drink: "cold brew", orders: 188 },
      { drink: "espresso", orders: 162 },
    ],
  },
  // 16 — READ (different vertical — feedback inbox)
  {
    id: "read-feedback-recent",
    category: "read",
    goal: "last 24h of feedback by channel",
    sql: "SELECT submitted_at, channel, body, tags\n  FROM feedback\n WHERE submitted_at > now() - interval '24 hours'\n ORDER BY submitted_at DESC\n LIMIT 5;",
    embed: { lang: "html", template: '<nlq-data goal="{goal}" db="db_feedback"></nlq-data>' },
    rows: [
      {
        submitted_at: "2026-04-27 09:14",
        channel: "email",
        body: "Tabbed code panel is great!",
        tags: "praise",
      },
      {
        submitted_at: "2026-04-27 08:02",
        channel: "intercom",
        body: "Can't find sign-in",
        tags: "bug",
      },
      {
        submitted_at: "2026-04-27 06:48",
        channel: "twitter",
        body: "Try not to feel like Postgres",
        tags: "perf",
      },
      {
        submitted_at: "2026-04-26 22:30",
        channel: "email",
        body: "Need a Python SDK",
        tags: "feature",
      },
    ],
    summary: "mixed signal — 1 bug, 1 feature, 2 praise/observation",
  },
  // 17 — READ (different vertical — leaderboard)
  {
    id: "read-leaderboard",
    category: "read",
    goal: "top 5 by score on the hackathon leaderboard",
    sql: "SELECT player, score, region\n  FROM hackathon_scores\n ORDER BY score DESC\n LIMIT 5;",
    embed: { lang: "html", template: '<nlq-data goal="{goal}" db="db_hackathon"></nlq-data>' },
    rows: [
      { player: "axolotl-prime", score: 9412, region: "EU" },
      { player: "kestrel", score: 9180, region: "NA" },
      { player: "mochi-net", score: 8847, region: "APAC" },
      { player: "vela", score: 8214, region: "EU" },
      { player: "owl-club", score: 7902, region: "NA" },
    ],
  },
  // 18 — READ (different vertical — agent memory)
  {
    id: "read-agent-memory",
    category: "read",
    goal: "last 6 turns across all my agent threads",
    sql: "SELECT thread_id, role, content, created_at\n  FROM agent_memory\n WHERE created_at > now() - interval '1 day'\n ORDER BY created_at DESC\n LIMIT 6;",
    embed: {
      lang: "mcp",
      template: 'nlqdb.ask({ db: "db_agents", goal: "{goal}" })',
    },
    rows: [
      {
        thread_id: "t-204",
        role: "user",
        content: "summarize last week's invoices",
        created_at: "2026-04-26 18:42",
      },
      {
        thread_id: "t-204",
        role: "assistant",
        content: "12 invoices, $14,802 total",
        created_at: "2026-04-26 18:42",
      },
      {
        thread_id: "t-198",
        role: "user",
        content: "switch focus to support tickets",
        created_at: "2026-04-26 14:10",
      },
      {
        thread_id: "t-198",
        role: "assistant",
        content: "ok, scoping to /support",
        created_at: "2026-04-26 14:10",
      },
      {
        thread_id: "t-187",
        role: "user",
        content: "what changed in db schema?",
        created_at: "2026-04-26 09:32",
      },
      {
        thread_id: "t-187",
        role: "assistant",
        content: "added `tags` column on `feedback`",
        created_at: "2026-04-26 09:32",
      },
    ],
    summary: "6 turns · 3 threads · last day",
  },
  // 19 — READ (different vertical — CRM)
  {
    id: "read-crm-recent",
    category: "read",
    goal: "5 most-recent contacts by last touch",
    sql: "SELECT name, company, last_touch, status\n  FROM contacts\n ORDER BY last_touch DESC\n LIMIT 5;",
    embed: {
      lang: "rest",
      template: 'curl api.nlqdb.com/v1/ask -d \'{"db":"db_crm","goal":"{goal}"}\'',
    },
    rows: [
      { name: "Maya Chen", company: "Vellum Coffee", last_touch: "2026-04-26", status: "warm" },
      {
        name: "Tomas Reyes",
        company: "Northwind Audio",
        last_touch: "2026-04-25",
        status: "active",
      },
      { name: "Aki Sato", company: "Six Lab", last_touch: "2026-04-24", status: "cold" },
      { name: "Priya Nair", company: "Lampshade", last_touch: "2026-04-22", status: "warm" },
      { name: "Jonas Berg", company: "Bauhaus Bikes", last_touch: "2026-04-20", status: "active" },
    ],
  },
  // 20 — READ (date range filter)
  {
    id: "read-orders-over-10",
    category: "read",
    goal: "orders over $10 from last week",
    sql: "SELECT created_at, customer, drink, total\n  FROM orders\n WHERE total > 10\n   AND created_at BETWEEN now() - interval '7 days' AND now()\n ORDER BY total DESC;",
    embed: { lang: "html", template: '<nlq-data goal="{goal}" db="db_coffee"></nlq-data>' },
    rows: [
      { created_at: "2026-04-23", customer: "ben", drink: "drip x4", total: 12.4 },
      { created_at: "2026-04-22", customer: "lin", drink: "latte x3 + scone", total: 18.2 },
      { created_at: "2026-04-21", customer: "rod", drink: "espresso flight", total: 14.0 },
      { created_at: "2026-04-21", customer: "amy", drink: "cold brew growler", total: 22.5 },
    ],
  },
];
