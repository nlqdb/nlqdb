// Seeded prompts per persona — drawn from docs/research/automated-icp-validation-plan.md §1.1.
// Rotating across runs prevents CDN/LLM cache effects from masking regressions.

import type { PersonaId } from "./types.ts";

export const PERSONA_PROMPTS: Record<PersonaId, readonly string[]> = {
  P1: [
    "a meal planner for couples",
    "side project to track my reading",
    "a tiny CRM for my coaching practice",
    "an orders tracker for my Etsy shop",
    "a habit tracker I can share with my partner",
    "leaderboard for my Discord server",
    "save links my friends share with me",
    "a grocery list app for shared households",
    "a workout journal that I own the data for",
    "personal expense tracker with category rollup",
  ],
  P2: [
    "give my Claude agent a place to remember user facts across sessions",
    "vector store for an autonomous research agent",
    "memory layer for my MCP server",
    "let an LLM tool log every action it ran for replay",
    "task queue for a multi-agent pipeline",
    "store evals and outputs my agent generated",
    "session state shared between local agents",
    "keyed key-value memory for a coding agent",
  ],
  P3: [
    "I have a CSV of leads — which are already customers",
    "churn by acquisition channel last 6 months",
    "monthly recurring revenue grouped by plan",
    "top 10 referring domains last week",
  ],
  P6: [
    "p99 latency for checkout last 6h by tier",
    "error rate per service over the last 24 hours",
    "slow queries grouped by endpoint",
  ],
} as const;

// Persona → flow assignment per §1.1. FLOW-001 rotates across all four
// personas; FLOW-002 / FLOW-003 are P3-shaped (analyst search-intent and
// comparison-driven inbound, respectively).
export const FLOW_PERSONA = {
  "flow-001": "P1",
  "flow-002": "P3",
  "flow-003": "P3",
} as const;
