// Manifesto content (docs/architecture.md §0). Single source of truth for the
// long-form `/manifesto` page and the home-page excerpt.

export interface Tenet {
  n: string; // "01", "02", …
  title: string;
  body: readonly string[]; // paragraphs
}

export const tenets: readonly Tenet[] = [
  {
    n: "01",
    title: "Free. Forever.",
    body: [
      "You can sign up, build a thing, and ship it to production without a credit card. That isn't a trial. That's the product.",
      "Every cost upgrade is gated on a real signal — usually that someone is paying us for the thing they shipped. Until then the bill is zero, the limits are honest, and the free tier is the same engine paying customers run on.",
    ],
  },
  {
    n: "02",
    title: "Open source. By default.",
    body: [
      "The engine, the CLI, the MCP server, the SDK — all under FSL-1.1-ALv2. Source-available now, Apache 2.0 in two years. The cloud is a convenience, not a moat. If we ever try to wall something off, you can fork the engine and run it yourself.",
    ],
  },
  {
    n: "03",
    title: "Simple. One way to do each thing.",
    body: [
      "Two endpoints. Two CLI verbs. One chat box. No config files in the first 60 seconds. No “pick a region.” No schema. fetch is the SDK.",
      "Every error is one sentence with the next action. If a feature needs a tutorial to use, it failed. If two engineers disagree on a design, we ship the simpler one.",
    ],
  },
  {
    n: "04",
    title: "Effortless UX.",
    body: [
      "Zero modals. Zero “are you sure?” except for destructive actions. Keyboard-first. The chat is the product; everything else is a disclosure that you opt into when you actually need it.",
    ],
  },
  {
    n: "05",
    title: "Seamless auth — one identity, four surfaces, zero friction.",
    body: [
      "No login wall before first value. Every surface produces a working answer before asking who you are. The DB you create before signing in adopts to your account when you do.",
      "One sign-in covers everything. Web, CLI, every MCP host — same identity. Tokens refresh silently. You will never see a 401.",
      "Credentials live in the OS keychain. Revocation is instant and visible. Every token on every device, listed with last-used; one click revokes it.",
    ],
  },
  {
    n: "06",
    title: "Goal-first, not DB-first.",
    body: [
      "Nobody woke up wanting to create a database. They woke up wanting a meal-planner, an agent that remembers them, the number for the 4pm sync. The database is plumbing.",
      "Every surface starts with a goal. The DB materialises as a side effect, named after the thing you described, ready to query. You can always reach the raw Postgres URL — it’s one click away — but you almost never need to.",
    ],
  },
  {
    n: "07",
    title: "Bullet-proof by design — not by handling.",
    body: [
      "We make bad states unreachable, not branched on. Schemas only widen, so there is no “schema mismatch” code path. Every mutating call carries an idempotency key, so retries are safe by construction. Plans are content-addressed, so cache invalidation has nothing to invalidate.",
      "Destructive operations require a diff preview and a second confirm. Numeric inputs are bounded, so there is no NaN, no overflow. Secrets are scoped per-DB, so there is no “wrong tenant” branch to write a test for.",
    ],
  },
  {
    n: "08",
    title: "Creative. By policy.",
    body: [
      "The product looks and feels nothing like a Tailwind template. Personality is required. Acid lime on near-black, JetBrains Mono headlines, hard shadows, kinetic typography on the words that matter. Stock photos are forbidden. Logo grids are forbidden. “Trusted by” is forbidden.",
    ],
  },
  {
    n: "09",
    title: "Fast. Measured.",
    body: [
      "p50 query under 400ms on cache hit. p95 under 1.5s on cache miss. Cold start under 800ms. CLI binary under 8MB, starts in under 30ms.",
      "Marketing site: Lighthouse 100 on every metric. First paint under 600ms on 4G. Numbers exist so we can fail them in CI, not so we can quote them in a deck.",
    ],
  },
];

// Inversion table (docs/architecture.md §0.1). Tabular data — rendered as a real
// <table> by the manifesto page.
export interface InversionRow {
  surface: string;
  oldHtml: string;
  newHtml: string;
}

export const inversion: readonly InversionRow[] = [
  {
    surface: "Marketing hero",
    oldHtml: "&ldquo;Name your database&rdquo;",
    newHtml: "&ldquo;What are you building?&rdquo;",
  },
  {
    surface: "Platform first run",
    oldHtml: "&ldquo;Create database&rdquo; button",
    newHtml: "One chat input; DB created silently",
  },
  {
    surface: "CLI first command",
    oldHtml: "<code>nlq db create orders</code>",
    newHtml: '<code>nlq new "an orders tracker"</code>',
  },
  {
    surface: "MCP first call",
    oldHtml: '<code>nlqdb_create_database("memory")</code>',
    newHtml: '<code>nlqdb_query("memory", "remember&hellip;")</code>',
  },
  {
    surface: "HTML element",
    oldHtml: '<code>db="orders"</code> required',
    newHtml: '<code>goal="&hellip;"</code> leads; <code>db</code> inferred',
  },
];

// Home-page excerpt — three loudest tenets, with shorter copy. Lives
// here so the home page and the long-form page never drift apart by
// accident; the *content* is allowed to differ deliberately because
// the excerpt is a teaser, not a verbatim quote.
export interface ExcerptItem {
  title: string;
  body: string;
}

export const excerpt: readonly ExcerptItem[] = [
  {
    title: "Free, forever",
    body: "Sign up, build, ship to production without a credit card. The free tier isn't a trial — it's the product. Every cost upgrade is gated on a real signal: paying customers, not theoretical scale.",
  },
  {
    title: "Fast. Measured.",
    body: "p50 query under 400ms on cache hit. p95 under 1.5s on cache miss. Cold start under 800ms. Numbers exist so we can fail them in CI, not so we can quote them in a deck.",
  },
  {
    title: "Goal-first, not DB-first",
    body: "Nobody woke up wanting to create a database. They want a meal-planner, an agent that remembers, the number for the 4pm sync. The DB materialises as a side effect of the goal.",
  },
];
