// /architecture — single source of truth for the 3D map AND the
// server-rendered prose below it (SK-WEB-021). Content mirrors
// docs/architecture.md §2 (system architecture); if the two disagree,
// architecture.md wins — fix this file.

export type ArchGroupId = "ask" | "engine" | "data";

export interface ArchGroup {
  id: ArchGroupId;
  /** Big label on the overview card. */
  label: string;
  /** One quiet sub-line under the overview label. */
  sub: string;
  /** Prose paragraph for the section below the map. */
  blurb: string;
  /** World-space center of the cluster. */
  center: [number, number, number];
  /** Overview card size (w, h). */
  size: [number, number];
}

export interface ArchNode {
  id: string;
  group: ArchGroupId;
  label: string;
  blurb: string;
  pos: [number, number, number];
  /** Honest-claims flag (SK-WEB-003): not shipped yet. */
  roadmap?: boolean;
}

export interface ArchEdge {
  from: string;
  to: string;
  /** Short mono label rendered at the edge midpoint (detail view). */
  label?: string;
}

/** Aggregate overview edges between group cards. */
export interface ArchGroupEdge {
  from: ArchGroupId;
  to: ArchGroupId;
  label: string;
}

export const ARCH_GROUPS: ArchGroup[] = [
  {
    id: "ask",
    label: "You ask",
    sub: "five surfaces, one call",
    blurb:
      "Every surface is a projection of the same engine — the web chat, the <nlq-data> element, the CLI, the MCP server, and the SDK all end up making the same POST /v1/ask call with a goal in plain English.",
    center: [-13, 0, 0],
    size: [7.5, 12.6],
  },
  {
    id: "engine",
    label: "The engine",
    sub: "one request path, no backend to write",
    blurb:
      "One edge-routed request path: authenticate, check the plan cache, and only on a miss ask the LLM for a typed plan — which is validated before anything touches your data. The LLM never emits raw SQL.",
    center: [0, 0, 0],
    size: [15.5, 8],
  },
  {
    id: "data",
    label: "Your data",
    sub: "the right engine per workload",
    blurb:
      "Storage is a routing decision, not your problem. Postgres is the default home; ClickHouse serves analytics-shaped workloads; the adapter layer is engine-agnostic so more engines slot in behind the same executor.",
    center: [12, 0, 0],
    size: [7, 8.5],
  },
];

export const ARCH_NODES: ArchNode[] = [
  // ---- You ask ----
  {
    id: "web",
    group: "ask",
    label: "Chat web app",
    blurb:
      "nlqdb.com/app — every reply comes back as a one-sentence answer, the raw data, and a trace you can open.",
    pos: [-13, 4.4, 0],
  },
  {
    id: "element",
    group: "ask",
    label: "<nlq-data> element",
    blurb:
      "One HTML tag on any site: a goal in plain English in, rendered data out. The whole client is ≤ 6 KB.",
    pos: [-13, 2.2, 0],
  },
  {
    id: "cli",
    group: "ask",
    label: "nlq CLI",
    blurb:
      'A single static Go binary. `nlq "how many signups today"` — goal-first, starts in milliseconds.',
    pos: [-13, 0, 0],
  },
  {
    id: "mcp",
    group: "ask",
    label: "MCP server",
    blurb:
      "Claude, Cursor, Windsurf, and Zed talk to nlqdb as agent memory over MCP — typed rows the agent writes as it learns.",
    pos: [-13, -2.2, 0],
  },
  {
    id: "sdk",
    group: "ask",
    label: "SDK / HTTP API",
    blurb:
      "POST /v1/ask { goal } — the one endpoint every SDK wraps, from TypeScript to Swift, Ruby, and Rust.",
    pos: [-13, -4.4, 0],
  },

  // ---- The engine ----
  {
    id: "router",
    group: "engine",
    label: "Edge router",
    blurb:
      "Cloudflare Workers at the edge — under 50 ms from anywhere. Every surface lands here first.",
    pos: [-5.6, 1.4, 0],
  },
  {
    id: "auth",
    group: "engine",
    label: "Auth & quota",
    blurb:
      "Better Auth + Workers KV. Anonymous works out of the box; rate limits fire before any model spends a token.",
    pos: [-1.9, 1.4, 0],
  },
  {
    id: "cache",
    group: "engine",
    label: "Plan cache",
    blurb:
      "Plans are content-addressed by (schema_hash, query_hash) — no invalidation, ever. 60–80% of queries skip the LLM entirely.",
    pos: [1.8, 1.4, 0],
  },
  {
    id: "compiler",
    group: "engine",
    label: "NL→plan compiler",
    blurb:
      "On a cache miss, the LLM router turns English into a typed query plan — never a raw SQL string.",
    pos: [0.2, -1.8, 0],
  },
  {
    id: "validator",
    group: "engine",
    label: "Validator",
    blurb:
      "An AST allowlist between the model and your data: reads stay reads, writes are previewed, and DDL only ever comes from our deterministic compiler.",
    pos: [3.9, -1.8, 0],
  },
  {
    id: "executor",
    group: "engine",
    label: "Executor",
    blurb:
      "Runs the validated plan on the right engine and streams rows back — with the trace that shows every step and its timing.",
    pos: [5.6, 1.4, 0],
  },

  // ---- Your data ----
  {
    id: "postgres",
    group: "data",
    label: "Postgres",
    blurb:
      "The default home for your data — Neon under the hood, one schema per tenant, row-level security on.",
    pos: [12, 2.2, 0],
  },
  {
    id: "clickhouse",
    group: "data",
    label: "ClickHouse",
    blurb:
      "Bring the warehouse you already run — ClickHouse or Tinybird — and question it in English.",
    pos: [12, 0, 0],
  },
  {
    id: "more",
    group: "data",
    label: "More engines",
    blurb:
      "The adapter is engine-agnostic: a workload analyser watches your query shapes and proposes the engine that fits (Redis, D1, …).",
    pos: [12, -2.2, 0],
    roadmap: true,
  },
];

export const ARCH_EDGES: ArchEdge[] = [
  { from: "web", to: "router" },
  { from: "element", to: "router" },
  { from: "cli", to: "router" },
  { from: "mcp", to: "router" },
  { from: "sdk", to: "router" },
  { from: "router", to: "auth" },
  { from: "auth", to: "cache" },
  { from: "cache", to: "executor", label: "hit" },
  { from: "cache", to: "compiler", label: "miss" },
  { from: "compiler", to: "validator", label: "typed plan" },
  { from: "validator", to: "executor", label: "safe SQL" },
  { from: "executor", to: "postgres" },
  { from: "executor", to: "clickhouse" },
  { from: "executor", to: "more" },
];

export const ARCH_GROUP_EDGES: ArchGroupEdge[] = [
  { from: "ask", to: "engine", label: "a goal, in English" },
  { from: "engine", to: "data", label: "validated queries" },
];

/** How a question travels — the ordered story the prose section tells. */
export const ARCH_FLOW_STEPS: string[] = [
  "You ask in plain English — from the chat, an HTML element, the CLI, an agent over MCP, or the SDK. Same endpoint either way.",
  "The edge router picks up the request at the nearest Cloudflare location, and auth & quota decide who you are (anonymous is fine) and what you may spend.",
  "The plan cache looks up the question by (schema_hash, query_hash). On a hit — the majority of traffic — the LLM is never involved.",
  "On a miss, the NL→plan compiler asks the LLM for a typed plan, and the validator checks it against an allowlist before it can run. The model never writes raw SQL.",
  "The executor runs the plan on the engine your data lives in and streams back the answer, the rows, and a trace with per-step timings.",
];

export function archNodeById(id: string): ArchNode | undefined {
  return ARCH_NODES.find((n) => n.id === id);
}

/** Labels of the nodes a given node connects to (either direction). */
export function archNeighborLabels(id: string): string[] {
  const out: string[] = [];
  for (const e of ARCH_EDGES) {
    if (e.from === id) {
      const n = archNodeById(e.to);
      if (n) out.push(n.label);
    } else if (e.to === id) {
      const n = archNodeById(e.from);
      if (n) out.push(n.label);
    }
  }
  return out;
}
