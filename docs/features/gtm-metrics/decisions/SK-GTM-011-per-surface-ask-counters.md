# SK-GTM-011 — Non-saturating per-DB ask counters split by surface (the SK-PIVOT-016 criterion-1 instrument)

- **Decision:** Every `databases` row carries two new counters
  (migration `0034`): `asks_total` — every routed `/v1/ask` completion
  (ok or error) for the DB — and `asks_mcp` — the subset whose principal
  was a **public-MCP** key (`surfaceFromPrincipal === "mcp"`, i.e.
  `sk_mcp_`). Both are bumped **fire-and-forget in the same UPDATE** as the
  `SK-ONBOARD-006` first-10 counters, in the `/v1/ask` handler
  (`bumpAskCounters`), off the response path and excluded for nlqdb's own
  stranger-test walker ([`SK-ONBOARD-007`](../../onboarding/FEATURE.md)).
  Unlike `first10_asks` they **do not saturate** — the first-10 cap moves
  from the old `WHERE first10_asks < 10` guard into a `CASE` so one write
  keeps first-10 capped *and* the totals counting. The launch gate
  (`SK-GTM-008`) reads `SUM(asks_mcp)` over the `agent_memory_v1` DBs and
  renders [`SK-PIVOT-016`](../../agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md)
  criterion 1 ("≥ 100 real asks through the public MCP surface") as a real
  live count that can go green — `memoryAsksMcp` on `GtmMetrics.launchGate`.
- **Core value:** Free, Simple, Effortless UX
- **Why:** Criterion 1 was **unmeasurable**, not merely unmet. `first10_asks`
  stops at 10 by design and carries no per-ask surface, and
  [`SK-GTM-010`](SK-GTM-010-creating-surface-on-db-row.md)'s `source_surface`
  is a *create-time* stamp — so the dashboard could only ever render a
  saturated lower bound, never the number the gate is defined over. A gate
  criterion the instrument cannot count can never flip; closing that
  measurement gap is prerequisite to the whole dogfood-gate weekly focus.
  The principal's surface is already resolved on every authenticated request
  (`surfaceFromPrincipal`), so splitting the counter by it is the smallest
  honest shape — no new client contract, nothing to spoof (the surface is
  derived from the credential, not sent in the body).
- **Consequence in code:** The counters are **telemetry, never
  load-bearing** — the same drop-on-failure discipline as `first10_*`: a
  failed bump only logs (`ask_counters_bump_failed`), never blocks a
  response. The single UPDATE preserves the first-10 saturation exactly
  (`CASE WHEN first10_asks < 10`), so `SK-ONBOARD-006`'s KPI read is
  unchanged. `asks_mcp` counts every MCP ask, not just the first 10, so it
  is the total the criterion needs — but it is a **count of asks, not of
  distinct correct answers**: criterion 3 (silent-wrong-answer) stays a
  separate judgement, and criterion 1 going green is a volume gate only.
- **Alternatives rejected:**
  - Extend `first10_asks` past 10 — breaks the `SK-ONBOARD-006` KPI, whose
    denominator is defined over exactly the first 10 asks; the ordinal cap
    is the point of that counter, not an accident.
  - Derive the MCP subset from `source_surface` — that is the *creating*
    surface (one stamp per DB), not the *per-ask* surface; a DB created via
    the web and then driven by an MCP host would be miscounted.
  - An `asks` events table or an OTel-metric rollup keyed by DB — a second
    store + a read path for a value 1:1 with the row already updated on
    every ask; two integer columns are strictly smaller (the same reasoning
    `SK-GTM-007`/`SK-GTM-010` used to reject side tables).
