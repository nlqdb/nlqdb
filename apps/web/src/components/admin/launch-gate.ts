// SK-GTM-008 — the `/app/admin` launch-gate section's composition
// logic: the five `SK-PIVOT-016` dogfood criteria, each rendered either
// from a live D1 read (`metrics.launchGate`) or from a static constant
// carrying its own as-of date and source. No criterion is estimated
// (GLOBAL-038: yield truth is measured, never estimated), and none is
// interpolated from a neighbouring number.
//
// Canonical gate state stays in
// `docs/features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md`
// and the track index `.../worksheets/dogfood/INDEX.md` — this module
// mirrors them for the founder's own dashboard. When a D-slice moves a
// criterion, update the worksheet AND the static block below.

import type { GtmMetrics } from "../../lib/admin";
import { fmtPct } from "./format";

/** How a criterion's rendered value was obtained. */
export type GateMeasurement = "live" | "static";

export type GateState = "green" | "in-progress" | "not-started";

export type GateCriterion = {
  n: number;
  label: string;
  state: GateState;
  measurement: GateMeasurement;
  /** The rendered state — a number only where a real one exists. */
  value: string;
  /** Where the value comes from, and what it is not. */
  detail: string;
};

/**
 * The gate facts with no D1 source. Each carries its as-of date because
 * a stale static number that looks live is the failure mode this
 * section exists to avoid.
 */
export const GATE_STATIC = {
  /** Criterion 3's actual evidence: tests + eval runs, not a counter. */
  invariants: { asOf: "2026-07-28", suite: "E-03 scoping invariant suite (unit + Neon-gated)" },
  /** Criterion 4 — per-axis EX lives in the CI run summary, never in D1.
   * Now combined synthetic + ops (D-03 measured the repo-ops corpus).
   * Re-measured on the post-hint head (the SK-QUAL-023 schema-structure
   * hints, /daily runs 186–187, landed in the production preset run 191):
   * synthetic 2/3 + ops 3/4 = 5/7 (up from the pre-hint 2/7). */
  temporal: { pass: 5, total: 7, asOf: "2026-08-28", run: "GHA run 33132370698" },
  /** Criterion 5 — D-06 ships the public dashboard; this view is not it. */
  agentsDashboard: { shipped: false, slice: "D-06" },
  /** Dogfood track tracker (`worksheets/dogfood/INDEX.md`). */
  track: { done: 1, total: 7, asOf: "2026-07-29" },
} as const;

const TARGET_MCP_ASKS = 100;
const TARGET_FIRST10 = 0.95;

/** The five SK-PIVOT-016 criteria, in the order the decision lists them. */
export function launchGateCriteria(m: GtmMetrics): GateCriterion[] {
  const g = m.launchGate;
  const presetNote = g.memoryPresetEnabled
    ? "`MEMORY_PRESET` is on"
    : "`MEMORY_PRESET` is off in prod, so a preset create returns `preset_disabled`";

  return [
    {
      n: 1,
      label: `≥ ${TARGET_MCP_ASKS} real public-MCP asks from the ops workload`,
      state:
        g.memoryDbs === 0
          ? "not-started"
          : g.memoryAsksMcp >= TARGET_MCP_ASKS
            ? "green"
            : "in-progress",
      measurement: "live",
      value: `${g.memoryAsksMcp} / ${TARGET_MCP_ASKS}`,
      detail:
        g.memoryDbs === 0
          ? `No \`agent_memory_v1\` DB exists yet — the workload has not started (${presetNote}). Live count of memory DBs in the control plane; D-04 starts the corpus sync.`
          : `${g.memoryDbs} memory DB(s), ${g.memoryDbsInternal} on internal accounts. Live, non-saturating count of asks whose principal was a public-MCP (\`sk_mcp_\`) key, summed over the memory DBs (\`databases.asks_mcp\`, SK-GTM-011) — the real number the gate is defined over, no longer a first-10 lower bound. ${g.memoryAsksTotal} asks across all surfaces.`,
    },
    first10Criterion(g),
    {
      n: 3,
      label: "Zero silent data loss / wrong-answer-accepted incidents",
      state: "not-started",
      measurement: "static",
      value: `no workload yet · invariants green as of ${GATE_STATIC.invariants.asOf}`,
      detail: `Proven by tests and review, never by a counter — no incident metric exists. Evidence today: the ${GATE_STATIC.invariants.suite} was green when E-03 shipped ${GATE_STATIC.invariants.asOf}. The criterion is a judgement over the workload's real runs, so it cannot go green before criterion 1 does (D-04).`,
    },
    {
      n: 4,
      label: "Temporal golden queries pass",
      state: "in-progress",
      measurement: "static",
      value: `${GATE_STATIC.temporal.pass} / ${GATE_STATIC.temporal.total} (synthetic + ops corpus)`,
      detail: `Latest known value, as of ${GATE_STATIC.temporal.asOf} (${GATE_STATIC.temporal.run}, SK-QUAL-023) — per-axis EX lives in the CI run summary, not in D1, so this is static, not a live read. Re-measured on the post-hint head (the schema-structure hints from /daily runs 186–187, landed in the production preset run 191): overall temporal 5/7 — synthetic 2/3, ops 3/4, up from the pre-hint 2/7 (synthetic 2/3, ops 0/4). Three of the four ops temporal queries now pass; the two remaining misses (synthetic q4 range-scan, ops q19 over-joins episodes for a self-contained \`blocked\` fact's own \`created_at\`) are query-shape, not the categorical-vocabulary root cause the hints closed. Both temporal halves must be fully green for this criterion, so it stays in-progress; the offline eval is noise-dominated at ±5 pp, so the last two are a query-shape/pack-recipe lever, not more hint grinding.`,
    },
    {
      n: 5,
      label: "Live memory dashboard public on `/agents`",
      state: GATE_STATIC.agentsDashboard.shipped ? "green" : "not-started",
      measurement: "static",
      value: GATE_STATIC.agentsDashboard.shipped ? "shipped" : "unshipped",
      detail: `Boolean, owned by slice ${GATE_STATIC.agentsDashboard.slice} (\`worksheets/dogfood/D-06-agents-memory-dashboard.md\`). This founder-only section is NOT that dashboard — D-06 decides separately which aggregates go public.`,
    },
  ];
}

/** Criterion 2 — the only criterion whose own number D1 can already serve. */
function first10Criterion(g: GtmMetrics["launchGate"]): GateCriterion {
  if (g.memoryFirst10Asks === 0) {
    return {
      n: 2,
      label: `First-10 success ≥ ${fmtPct(TARGET_FIRST10)} on that workload`,
      state: "not-started",
      measurement: "live",
      value: "N = 0 — workload not started",
      detail:
        "Not yet measurable. Reads `SUM(first10_ok)/SUM(first10_asks)` over `agent_memory_v1` DBs (the SK-ONBOARD-006 counters) — the same instrument as the all-DBs rate above, filtered to the workload. It goes live with the first ask D-04 sends.",
    };
  }
  const rate = g.memoryFirst10SuccessRate;
  return {
    n: 2,
    label: `First-10 success ≥ ${fmtPct(TARGET_FIRST10)} on that workload`,
    state: rate !== null && rate >= TARGET_FIRST10 ? "green" : "in-progress",
    measurement: "live",
    value: fmtPct(rate),
    detail: `${g.memoryFirst10Ok}/${g.memoryFirst10Asks} first-10 asks OK across ${g.memoryDbs} memory DB(s); newest activity ${g.memoryLastQueriedAt ?? "—"}. Live from the SK-ONBOARD-006 counters.`,
  };
}

/** How many of the five are green — the `n/5` the /daily loop restates. */
export function gateGreenCount(criteria: GateCriterion[]): number {
  return criteria.filter((c) => c.state === "green").length;
}

/** Marker glyph mirroring the worksheet index's own idiom. */
export function gateStateGlyph(state: GateState): string {
  return state === "green" ? "✅" : "⬜";
}
