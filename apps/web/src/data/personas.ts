// Canonical persona set for both AEO surfaces — `/solve` groups its index
// by persona, `/vs` tags each comparison with the audience. Same four
// buyers, so the labels live here rather than once per feature.
//
// The `P1..P4` keys mirror docs/research/personas.md and exist for
// grouping, ordering, and telemetry only: they are internal terminology
// and must never reach rendered copy, because "P3 analyst" reads as a leak
// to a stranger arriving from "supabase alternative". Every surface showing
// the audience renders `PERSONAS[persona].label` (and `description` where
// there's room for a sentence). Declaration order is the render order.

export const PERSONAS = {
  "P1 solo builder": {
    label: "Solo builders",
    description:
      "Founders and single engineers shipping side-projects on weekends. Spend day one of every project wiring up Postgres, ORMs, and migrations before the app does anything useful — they'd rather skip that step and ship.",
  },
  "P2 agent builder": {
    label: "Agent builders",
    description:
      "Engineers building LLM-powered agents that need to remember things across sessions. Structured memory has had no opinionated primitive — most teams stitch together a connection string, an ORM, and a hand-rolled migration loop before the agent's first tool call.",
  },
  "P3 analyst": {
    label: "Analysts and PMs",
    description:
      "PMs, ops, and customer-success leads who can write SQL but resent it. Live in Metabase, Retool, and Excel — want one-off questions answered without filing a data ticket, and want internal dashboards that don't charge per viewer.",
  },
  "P4 backend engineer": {
    label: "Backend engineers",
    description:
      "Engineers at small startups running their own Postgres. Want a natural-language admin layer over the database they already own — not a replacement for the data store underneath.",
  },
} satisfies Record<string, { label: string; description: string }>;

export type Persona = keyof typeof PERSONAS;
