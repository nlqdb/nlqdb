# GLOBAL-042 — The agent builds a real product on nlqdb, in cleaned-up iterations

**Status:** active · **Set by the founder:** 2026-09-06

- **Decision:** The agent's daily work is optimized toward one goal: **the
  agent itself uses nlqdb to build a real product**, iteration after
  iteration, until nlqdb designs and optimizes the schema from scratch **as
  well as or better than** the project's real, hand-made schema. This is a
  measured product goal, not a roadmap tick.

## Founder's words (verbatim, 2026-09-06)

> i would like to optimize the daily work of the agent to get to a point where the agent itself can actually use nlqdb to build a real product and then iterate on actually building some project like rateme12 (i willl also provide access to that repo when its time) allowing nlqdb to optimize and create the schema itself from scratch without comparing or learning from the real schema structure. it should be as good or even better. i think it will take us some iterations to get there, but thats a real goal - not just ticks in a roadmap. we should cleanup every iteration after documenting how it went and what went right and what went wrong. and also between iterations there might be idea to change or rethink real design decisions which is ok.

- **Core value:** Goal-first, Effortless UX, Bullet-proof, Simple

- **Why:** Phase A of [`GLOBAL-041`](./GLOBAL-041-autonomous-dba.md) sat at
  0 of 9 build steps with KPI 1 unmeasured while daily runs kept shipping —
  a focus problem, not a pace problem. Ticking roadmap items proves nothing
  about whether a developer can build an app on nlqdb without modeling data.
  Building a real product with it, as a real user would, is the only test
  that cannot be gamed; a hand-made schema for the same product is the only
  honest bar.

- **Consequence in code & docs — the rules every agent follows:**
  1. **The goal.** The agent builds a real product on nlqdb **through the
     public surfaces only** — `@nlqdb/sdk`, `nlq` CLI, MCP — no internal
     shortcuts (no direct Neon/D1 access, no hand-written DDL, no
     pre-modeled fields). First target project: **rateme12**; the founder
     grants repo access when it is time. Until then, every daily run
     optimizes the loop toward that build (Phase A items, the dogfood
     workload, the retro/cleanup tooling below).
  2. **nlqdb owns the schema.** The schema is created and evolved by nlqdb
     from the product's inserts and reads, from scratch. The real project's
     schema is **never an input during a build**: not read, not compared
     against, not learned from while an iteration is running. It may be
     read, compared against and learned from **only post-hoc** — after the
     product built in that iteration is working and its retro is written.
     Founder, 2026-09-06: *"yes it can be learned post-hoc after the
     product is working."*
  3. **Success bar.** nlqdb's resulting schema is **as good as or better
     than** the real one. Until an iteration clears that bar the goal is
     not met, whatever else shipped.
  4. **Iteration protocol** — strictly in this order, never overlapping:
     1. Run the iteration.
     2. Write the retrospective to
        [`docs/history/dogfood-iterations/NNN-<slug>.md`](../history/dogfood-iterations/README.md),
        opened from [`TEMPLATE.md`](../history/dogfood-iterations/TEMPLATE.md):
        how it went, what went right, what went wrong, **concrete numbers**
        (inserts, unseen-field hits/misses, KPI 1 rate, manual steps taken,
        time), the next iteration's one change, and the three-line leverage
        verdict (§Leverage below).
     3. **Clean up everything the iteration created** — hosted DBs, API
        keys, branches, scratch code, test tenants. The repo and the
        platform look as if the iteration never ran, except for the retro.
     4. Only then start the next iteration.
  5. **Rethinking decisions is expected.** Between iterations, a retro may
     change or replace existing GLOBALs / SK-IDs. Do it per `P1`/`P3`:
     edit the canonical file, write the new stance clean, never rationalise
     around the old one — and never mid-iteration.
  6. **Relationship to `GLOBAL-041`.** This loop is how Phase A is driven
     and measured; KPI 1 (first-insert inference ≥ 95 %) and the phase
     gates stay as defined there.

- **Alternatives rejected:**
  - **Keep ticking the Phase A build order** — steps can all be green while
    a real developer still has to model data; the tick is not the goal.
  - **Synthetic benchmark workloads** — prove the extend path, not that a
    real app gets a schema a DBA would sign off on (`GLOBAL-041` already
    rejected this for Phase A).
  - **Let the agent peek at the real schema to converge faster** — the
    result would measure copying, not inference; the founder excluded it
    explicitly.
  - **Carry state between iterations** — leftover DBs, keys and branches
    hide what the next iteration actually needed from a clean start.

## Leverage

Design-for-leverage verdict for this loop, recorded 2026-09-06 after the
discovery gate below; every iteration's retro re-states it for its own diff.

```
Leverage: spend-with-seams
N+1: iteration 002 copies docs/history/dogfood-iterations/TEMPLATE.md and writes only its §1 goal, §4 inventory, §5 specifics and the §6.1 "Today" column; the seam is TEMPLATE.md (extraction trigger for anything more: a cleanup or retro step re-done by hand in two consecutive retros)
Category: "a real app built on nlqdb through the public surfaces only, measured, then cleaned up" — 0 prior instances; one level up, "a workload that exercises nlqdb end to end and measures it" — 7 instances
```

Discovery (re-runnable): `ls examples/ tools/ tests/ scripts/`;
`find examples tests packages -path '*e2e*'`; `grep -rli dogfood` over
`*.md|*.ts|*.sh`; `grep -rlIi 'demo app|sample app|reference app|built on nlqdb'`.
Nearest near-misses, none an app with journeys: `examples/*` (11 one-file
`<nlq-data>` read embeds), `tools/stranger-test/fixtures/agent-app/` (scratch
fixture a cold agent edits, never deployed), the `/daily` dogfood workload
(`.claude/commands/daily.md`, SDK writes of run logs — the KPI 1 instrument,
not a product), `tests/opencheck/tests-{a,b,c}.yaml` (create → write → cleanup
lifecycle on the web surface). The one-level-up instances —
`tools/stranger-test` FLOW-001/002/003, `scripts/flow-005-walk.sh`,
`scripts/flow-005-stdio-walk.sh`, `scripts/verify-flows.sh`,
`scripts/reach-agent-walk.sh`, `tools/eval` (BIRD/Spider), opencheck — all
emit a JSON outcome per run; a retro is prose with numbers, so none is
extendable into the iteration brief. Of the 001 brief, ~55 % was mechanics
(quarantine, token handling, code-location rules, retro fields, cleanup) —
that fraction is `TEMPLATE.md`. No iteration script: nearest is
`scripts/stranger-test.sh`; a `new`/`retro`/`cleanup` entry at one iteration
would be `cp` plus steps the SDK/CLI should own (`nlq db delete` is missing —
a `GLOBAL-003` gap, logged by the iteration, not scripted around).
