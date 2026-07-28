# SK-GTM-008 — The launch-gate section renders live-from-D1 or static-with-as-of, never an estimate

- **Decision:** `/app/admin` carries a **Launch gate — SK-PIVOT-016**
  section (first section, above the funnel) showing the five dogfood
  criteria plus one pivot-execution row (dogfood track `D-n/7` · gate
  `n/5` · `MEMORY_PRESET`). Every rendered value is exactly one of two
  kinds, and the kind is printed next to it:
  - **live** — computed this request by `computeGtmMetrics`
    (`SK-GTM-001`) from the control-plane D1, or read from the serving
    Worker's own env. The additive `launchGate` block carries
    `memoryPresetEnabled` (the Worker's `MEMORY_PRESET`, which the static
    page cannot see) and the `agent_memory_v1` workload's counters
    (`memoryDbs`, `memoryDbsInternal`, `memoryFirst10Asks/Ok/SuccessRate`,
    `memoryLastQueriedAt`). Memory DBs are identified by the canonical
    id prefix (`isAgentMemoryV1Db`, `SK-HDC-020`), matched with
    `substr(id, 1, length(prefix)) = prefix`.
  - **static** — a constant in `apps/web/src/components/admin/launch-gate.ts`
    (`GATE_STATIC`) carrying its **as-of date and source**, used only
    where no queryable source exists: criterion 3 (proven by the E-03
    invariant suite + eval runs, not a counter), criterion 4 (per-axis
    temporal EX lives in the `quality-eval-memory` CI summary), criterion
    5 (the `/agents` dashboard boolean, D-06), and the `D-n/7` track
    count.
  A criterion with no source states that in words — "not yet measurable,
  workload not started", with the source it *will* read from — and never
  interpolates a number from a neighbouring metric. Criterion 1's live
  number is labeled a **lower bound**, because `first10_asks` saturates
  at 10 per DB. `SK-PIVOT-016` + `worksheets/dogfood/INDEX.md` stay
  canonical for gate state; this section mirrors them and the note on the
  page says so. Founder-only, on the existing `SK-GTM-002` gate — the
  public `/agents` dashboard is D-06's separate decision.
- **Core value:** Honest, Bullet-proof, Simple
- **Why:** The gate's `n/5` lived only in markdown, so the founder read
  progress in a file while `/app/admin` — the surface they already open —
  showed nothing about the weekly focus (founder-directed 2026-07-28).
  The failure mode of putting it on a dashboard is worse than the absence:
  a plausible-looking number with no source becomes the gate's truth and
  the launch turns on an estimate, which `GLOBAL-038` forbids ("yield
  truth is measured, never estimated"). Printing the *kind* beside every
  value makes a stale static constant visible as static instead of
  passing for live, and keeps the honest zero ("no memory DB exists yet")
  a legitimate render.
- **Consequence in code:** New gate facts land as additive `launchGate`
  fields (`SK-GTM-001`) when D1 can answer them, otherwise as a
  `GATE_STATIC` entry **with** an `asOf` — a reviewer rejects a static
  fact without one, and rejects a live-looking number derived from a
  different measurement. When a D-slice moves a criterion, the worksheet
  and `GATE_STATIC` change in the same PR. `memoryPresetEnabled` is the
  only non-D1 input to `computeGtmMetrics`; the cron snapshot leaves its
  default because no snapshot key records it. Nothing here reaches
  SDK/CLI/MCP/elements (`SK-GTM-004`'s web-only gap, unchanged).
- **Alternatives rejected:**
  - **Compute the whole section server-side, static facts included** —
    editing a Worker to correct a doc-derived number, and the as-of dates
    drift from the worksheets that own them.
  - **Show only the live criteria (1–2), hide 3–5** — the founder's
    question is `n/5`; a partial gate reads as a green gate.
  - **Estimate criterion 1 from `first10_asks` as if it were the MCP
    total** — the counter saturates at 10/DB and D1 has no per-ask
    surface attribution; a launch decided on that number is exactly what
    `GLOBAL-038` bans.
  - **A second admin endpoint for the gate** — the existing
    `GET /v1/admin/metrics` already carries every D1 read behind the
    right gate; a sibling route doubles the auth surface for one object.
