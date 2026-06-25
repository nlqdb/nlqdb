import type { Lang } from "../lib/highlight";

export interface Snippet {
  id: string;
  label: string;
  sub: string;
  lang: Lang;
  source: string;
}

// Each tab is one entire integration — same backend, picked by surface preference.
// Edit content here only; the rendering pipeline tokenizes + escapes at build time.

export const snippets: readonly Snippet[] = [
  {
    id: "cli",
    label: "CLI",
    sub: "one binary, two verbs",
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
  db="orders"
  api-key="pk_live_..."
  template="table"
  refresh="5s"
></nlq-data>`,
  },
  {
    id: "react",
    label: "React",
    sub: "typed JSX, SSR-safe",
    lang: "ts",
    source: `import { NlqData } from "@nlqdb/react";

export function Orders() {
  return (
    <NlqData
      goal="today's orders, newest first"
      db="orders"
      apiKey={process.env.NEXT_PUBLIC_NLQDB_KEY}
      template="table"
      refresh="5s"
    />
  );
}`,
  },
  {
    id: "vue",
    label: "Vue",
    sub: "single-file component",
    lang: "html",
    source: `<script setup lang="ts">
import { NlqData } from "@nlqdb/vue";
</script>

<template>
  <NlqData
    goal="today's orders, newest first"
    db="orders"
    api-key="pk_live_..."
    template="table"
    refresh="5s"
  />
</template>`,
  },
  {
    id: "sdk",
    label: "SDK",
    sub: "fetch is the SDK",
    lang: "ts",
    source: `import { createClient } from "@nlqdb/sdk";

const client = createClient({ apiKey: process.env.NLQDB_KEY! });

// no schema, no SQL, no ORM. one verb.
const res = await client.ask({
  goal: "today's orders, newest first",
  dbId: "orders",
});

if (res.status === "ok") console.table(res.rows);`,
  },
  {
    id: "curl",
    label: "curl",
    sub: "raw HTTP, zero deps",
    lang: "bash",
    source: `# same /v1/ask the SDK and the element call — no SDK required
curl -X POST https://app.nlqdb.com/v1/ask \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"goal":"today orders, newest first","dbId":"orders"}'`,
  },
  {
    id: "mcp",
    label: "MCP",
    sub: "talk to your data from Claude",
    lang: "ts",
    source: `// ~/Library/Application Support/Claude/claude_desktop_config.json
// (or ~/.cursor/mcp.json — same shape works in every MCP host)
{
  "mcpServers": {
    "nlqdb": {
      "url": "https://mcp.nlqdb.com/mcp",
      "headers": {
        "Authorization": "Bearer sk_mcp_..."
      }
    }
  }
}`,
  },
  {
    id: "swift",
    label: "Swift",
    sub: "SwiftUI in three lines",
    lang: "ts",
    source: `import SwiftUI
import Nlqdb

NlqDataView(
  goal: "today's orders, newest first",
  dbId: "orders",
  apiKey: "pk_live_..."
) { result in
  Text("\\(result.rowCount) rows")
}`,
  },
];
