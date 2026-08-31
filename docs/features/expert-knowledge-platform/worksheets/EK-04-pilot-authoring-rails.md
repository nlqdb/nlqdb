# EK-04 — Pilot authoring rails: the language-tutor expert pack (public half)

**Status:** in-flight · **Repo:** nlqdb · **Risk:** high · **Runs:** multi ·
**Prereqs:** EK-01 design record (met) · the D-08 shared runner (**met
2026-08-11** — the pack-runner core landed as #973). ·
**Box 1 shipped 2026-08-08:** the language-tutor pack's golden-query set +
seed corpus landed in the `SK-QUAL-023` memory-quality eval family
(`tools/eval/src/datasets/memory-quality.ts`, `language_tutor_memory_v1` — 12
golds, 4 temporal, all five axes; hand-checked semantics guarded in
`tools/eval/test/datasets/memory-quality.test.ts`). Mirrors D-03's repo-ops set.
**Interview-source adapter landed 2026-08-11** (box 4): the language-tutor
`PackAdapter` (instance #2) is `apps/api/src/pack-runner/packs/language-tutor.ts`
— pure `parseSource`/`classify`/`extract` mapping an interview transcript
(`SK-EKP-007` seam) to `agent_memory_v1` rows with `source_episode`
provenance, registered with **one `PACKS` entry and zero runner edits** (the
N+1 proof). **`INV-EKP-037` egress guard landed 2026-08-12 (box 5):**
`packs/language-tutor.egress.test.ts` wires the pack's real authored cell
values to the exact planner egress a buyer's `/v1/ask` plan hop emits
(`buildPlanSystem` + `buildPlanUser`, now exported from `@nlqdb/llm`) over the
real `agent_memory_v1` DDL, and asserts zero expert row values transit — the
schema-only floor under `SK-EKP-001`. **Box 3 shipped 2026-08-31:**
`packs/language-tutor.integration.test.ts` drives the whole runner journey
(createDraft → advance → verify) over a fixture transcript against a **live
Neon `agent_memory_v1` branch**, writing every row through
`buildRememberInsert` (the deterministic `nlqdb_remember` builder —
allow-listed identifiers, bound params) under the same tenant + `app.agent_id`
scope and non-owner role production runs, then reconciles planned-vs-written
from a real read-back and asserts the golden-query vocabulary + `source_episode`
provenance land and stay agent-isolated — proving the write side is real on the
engine, not just faithful in a mock (gated on `NEON_TEST_BRANCH_URL`, skips
without it). Remaining: `acquire`'s live transcript endpoint is wired only via
injected `fetch` until the `experts` interview service ships (box 2, gates on
EK-05), which is what the live-import box (2) needs.

## Goal

Build the **public-rail half** of the pilot authoring experience
(`SK-EKP-004`: language tutor): an expert pack as the shared runner's
instance #2, proving D-08's N+1 claim — a new pack supplies
source/configuration, extraction categories, and result queries **without
rebuilding auth, resumability, progress, verification, or cleanup**.

Public-rail scope (everything here is `SK-PIVOT-018`-shaped content +
generic plumbing, no marketplace code):

1. **Pack recipe** — the language-tutor expert pack: extraction categories
   (error taxonomies, student-profile facts, lesson episodes, pricing
   heuristics), seed entities, and ≥10 golden queries (≥3 temporal) in the
   `SK-QUAL-023` eval family — mirroring what D-03 did for repo-ops.
2. **Interview-source adapter for the runner** — D-08's source is a repo
   archive; this pack's source is an **interview session** whose design is
   fixed by [`SK-EKP-007`](../decisions/SK-EKP-007-interview-extraction-design.md)
   (EK-01's record — the seam EK-04 and EK-05 both build to). The runner's
   contract (draft → phases → real counters → durable proof → delete)
   carries over unchanged (D-08 N+1); the adapter feeds it, per exchange, an
   **episode row plus the extracted entity/fact/edge rows carrying
   `source_episode` provenance** (the Graphiti pattern on `agent_memory_v1`),
   produced by the ACTA / min-2-probe interview — not file-derived records.
   Verification renders row cards with **edit/rank/forced-choice** affordances;
   a yes/no "correct?" read-back is prohibited (`SK-EKP-007` stake 3).
3. **Write path + verification** — rows land on `agent_memory_v1`
   (`SK-PIVOT-007`, no new DDL) through the public MCP/API surface only;
   completion runs the pack's golden queries as the durable proof
   (`SK-PIVOT-021` / P6).

The **question-engine and expert-facing product UX live in `experts`**
(EK-05). The seam between them is an EK-01 design output; whatever shape it
takes, this slice owns everything on the nlqdb side of it.

## Hard edges

- `GLOBAL-037` boundary per the track INDEX, stated as the testable
  `INV-EKP-037` invariant in `SK-EKP-007`: expert answers become cell values
  at write time (the interview path is the only path they reach an LLM); the
  knowledge-DB query path stays schema-only, reusing the unmodified
  `GLOBAL-037` egress builder.
- Founder (a real language tutor's use case, user #1) manually walks the
  journey before any alpha label is discussed — same discipline as D-08's
  acceptance journey.
- No regulated-profession content sneaks into the pilot pack's examples.

## Done when

- [x] Pack recipe + golden queries merged; eval family runs them.
      (2026-08-08 — `language_tutor_memory_v1` in the `SK-QUAL-023`
      memory-quality dataset: extraction categories as seed corpus + 12 golden
      queries, 4 temporal, all five axes; runs via `--dataset memory-quality`.)
- [ ] Runner executes an interview-sourced import end-to-end (draft →
      progress counters → verify → proof → delete) with zero
      runner-code forks.
- [x] Rows verifiably on `agent_memory_v1` via public surfaces only.
      (2026-08-31 — `packs/language-tutor.integration.test.ts`: the pilot pack's
      interview import lands on a live Neon `agent_memory_v1` branch through
      `buildRememberInsert` — the `nlqdb_remember` write builder, allow-listed
      identifiers + bound params, run under the production tenant/`app.agent_id`
      scope + non-owner role — and reads back under scope with the exact
      golden-query vocabulary (episodes `lesson`; facts `mistake` /
      `pricing_heuristic` / `student_profile` each carrying `source_episode`
      provenance; entities `grammar_rule` / `student`); `verifying` reconciles
      planned-vs-written from the real read-back, and a second agent scope in the
      same DB reads none of it. Gated on `NEON_TEST_BRANCH_URL`.)
- [x] The N+1 claim holds: diff shows pack content + adapter, no rebuilt
      journey machinery. (2026-08-11 — `packs/language-tutor.ts` + one `PACKS`
      entry in `deps.ts`; zero edits to `runner.ts`/`types.ts`/the journey. The
      runner's own N+1 fake-pack test already proves the runner drives a
      non-repo pack end-to-end.)
- [x] `INV-EKP-037` asserted in the adapter test suite (`SK-EKP-007`, as
      hardened 2026-08-07): the knowledge-DB query/ask path sends schema
      tokens only — zero expert row values — to the model. (2026-08-12 —
      `packs/language-tutor.egress.test.ts`: the pack's authored rows never
      appear in the real plan egress `buildPlanSystem`+`buildPlanUser` builds
      over the `agent_memory_v1` DDL; the summarize hop is skipped for these
      DBs — `orchestrate.ts` `skipSummary` — so the plan hop is the only LLM
      egress, and it is schema-only. The former "sole code path" companion
      clause is a reviewable invariant, not a test: an LLM call carrying
      expert cell values outside the interview/extraction module is rejected
      in review.)
