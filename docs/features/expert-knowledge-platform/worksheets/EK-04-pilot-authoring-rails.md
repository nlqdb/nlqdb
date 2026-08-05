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
   archive; this pack's source is an **interview session** (EK-01's
   design). The runner's contract (draft → phases → real counters →
   durable proof → delete) carries over; the adapter feeds it
   answer-derived structured records instead of file-derived ones.
3. **Write path + verification** — rows land on `agent_memory_v1`
   (`SK-PIVOT-007`, no new DDL) through the public MCP/API surface only;
   completion runs the pack's golden queries as the durable proof
   (`SK-PIVOT-021` / P6).

The **question-engine and expert-facing product UX live in `experts`**
(EK-05). The seam between them is an EK-01 design output; whatever shape it
takes, this slice owns everything on the nlqdb side of it.

## Hard edges

- `GLOBAL-037` boundary per the track INDEX: expert answers become cell
  values at write time; the query path stays schema-only.
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
