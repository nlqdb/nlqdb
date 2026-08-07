# EK-04 — Pilot authoring rails: the language-tutor expert pack (public half)

**Status:** planned · **Repo:** nlqdb · **Risk:** high · **Runs:** multi ·
**Prereqs:** EK-01 design record · the D-08 shared runner exists

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

- [ ] Pack recipe + golden queries merged; eval family runs them.
- [ ] Runner executes an interview-sourced import end-to-end (draft →
      progress counters → verify → proof → delete) with zero
      runner-code forks.
- [ ] Rows verifiably on `agent_memory_v1` via public surfaces only.
- [ ] The N+1 claim holds: diff shows pack content + adapter, no rebuilt
      journey machinery.
- [ ] `INV-EKP-037` asserted in the adapter test suite (`SK-EKP-007`): the
      knowledge-DB query/ask path sends schema tokens only — zero expert row
      values — to the model, and the interview path is the sole code path
      reading expert cell values into an LLM request.
