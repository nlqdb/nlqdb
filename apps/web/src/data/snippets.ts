import type { Lang } from "../lib/highlight";

export interface Snippet {
  id: string;
  label: string;
  sub: string;
  lang: Lang;
  source: string;
}

// Three install methods per DESIGN §3.1. Each ≤10 lines, all
// rendering against the same hypothetical "orders tracker" demo DB.
// Edit content here only — the rendering pipeline tokenizes + escapes
// at build time.

export const snippets: readonly Snippet[] = [
  {
    id: "cli",
    label: "CLI",
    sub: "one binary, three verbs",
    lang: "bash",
    source: `# 1. install (curl, brew, npm — pick one)
curl -fsSL https://nlqdb.com/install | sh

# 2. create from a goal — the DB is a side effect
nlq new "an orders tracker for my coffee shop"

# 3. talk to it
nlq "add an order: alice, latte, $5.50, just now"
nlq "how many orders today, by drink"`,
  },
  {
    id: "html",
    label: "HTML",
    sub: "drop a tag, ship the page",
    lang: "html",
    source: `<!-- one CDN script registers the elements -->
<script src="https://elements.nlqdb.com/v1.js" type="module"></script>

<!-- describe what you want; the DB is created on first call -->
<nlq-data
  goal="today's orders, newest first, with customer + total"
  api-key="pk_live_..."
  template="table"
  refresh="5s"
></nlq-data>`,
  },
  {
    id: "sdk",
    label: "SDK",
    sub: "fetch is the SDK",
    lang: "ts",
    source: `import { nlq } from "@nlqdb/sdk";

const client = nlq({ apiKey: process.env.NLQDB_KEY! });

// no schema, no SQL, no ORM. one verb.
const { data, trace } = await client.ask(
  "today's orders, newest first",
);

console.table(data);`,
  },
];
