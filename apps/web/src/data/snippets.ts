import type { Lang } from "../lib/highlight";

export interface Snippet {
  id: string;
  label: string;
  sub: string;
  lang: Lang;
  source: string;
}

// Three install methods per docs/architecture.md §3.1. Each ≤10 lines, all
// rendering against the same hypothetical "orders tracker" demo DB.
// Edit content here only — the rendering pipeline tokenizes + escapes
// at build time.

export const snippets: readonly Snippet[] = [
  {
    id: "react",
    label: "React",
    sub: "one component, SSR-safe",
    lang: "ts",
    source: `import { NlqData } from "@nlqdb/react";

export default function Orders() {
  return (
    <NlqData
      goal="today's orders, newest first, with customer + total"
      apiKey={process.env.NEXT_PUBLIC_NLQDB_KEY!}
      template="table"
      refresh="5s"
    />
  );
}`,
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
