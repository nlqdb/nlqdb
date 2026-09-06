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
     schema is **never an input to a build**: not read, not compared
     against, not learned from while an iteration is running. See the open
     question below for post-hoc use.
  3. **Success bar.** nlqdb's resulting schema is **as good as or better
     than** the real one. Until an iteration clears that bar the goal is
     not met, whatever else shipped.
  4. **Iteration protocol** — strictly in this order, never overlapping:
     1. Run the iteration.
     2. Write the retrospective to
        [`docs/history/dogfood-iterations/NNN-<slug>.md`](../history/dogfood-iterations/README.md):
        how it went, what went right, what went wrong, **concrete numbers**
        (inserts, unseen-field hits/misses, KPI 1 rate, manual steps taken,
        time), and the next iteration's one change.
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

## Open questions (founder)

- **Post-hoc grading.** Assumption to confirm: once an iteration is frozen
  (retro written, nothing further changed), the real schema may be used
  **only** as a grading reference to judge "as good or even better". Not
  resolved — the agent does not touch the real schema at any point until
  the founder answers.
