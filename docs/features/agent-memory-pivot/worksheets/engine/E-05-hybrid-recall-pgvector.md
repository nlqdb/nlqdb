# E-05 — Hybrid recall: pgvector + `nlqdb_recall`

**Status:** ⬜ not started
**Sequence:** Engine 5 of 7 · **Risk:** **high** · **Runs:** multi · **Prereqs:** E-01 ✅ · **Gate:** infra-gated (Neon pgvector enablement; embeddings provider in the free chain)

## Goal

Close the gap the agent-memory solve page admits today: *"No native vector
search yet — for unstructured fact recall over chat-text strings, Mem0 or
pgvector are the right shape."* The wedge is "memory + analytics" — but if
analytics is the *only* thing we cover, the wedge is half a product. E-05
makes nlqdb the **complete** memory primitive: similarity recall over fuzzy
content **and** analytical SQL over structured fields, fused.

## Why this is gated, not a normal slice

- Needs **pgvector enabled on Neon** for the project (a Neon project
  setting; founder-clickable, not agent-runnable). Capture in
  `docs/blocked-by-human.md` per `.claude/commands/daily.md` rule 4.
- Needs an **embedding provider in the free chain** (LLM-router work).
  Today the `db-create` `embedTableCards` slice is stubbed pending pgvector
  (per README L134-135). E-05 is the slice that un-stubs it.
- Likely **multi-run** (provider wiring, index choice, eval ablation).
- Hard-disagree with the framing doc on one thing: **vector search is part
  of memory, not the competitor's lane.** Cite this delta explicitly in
  GLOBAL-036's commentary once shipped.

## Scorecard number it moves

`Pivot:` boolean "hybrid recall live." Flips the WS-06 matrix' vector-search
cell honestly. Sharpens the WS-03 solve page (the `whatItDoesnt` "no native
vector search yet" disclaimer goes away).

## Read first

- `docs/future/semantic-layer.md` — the closest prior thinking on
  embedding-driven retrieval
- `apps/api/src/db-create/embedTableCards` (the stubbed slice from
  hosted-db-create — un-stub at the right join)
- `packages/llm/AGENTS.md` + LLM-router feature — adding an embedding
  provider to the free chain
- `docs/competitors.md §4` — Pinecone/Weaviate/Chroma framing
  (pgvector-in-Postgres is the consensus 2026 shape)

## Mechanism

- Add `embedding VECTOR(N)` index on `facts.content` (HNSW or IVFFLAT;
  measure both). `N` chosen from the embedding provider's dimension.
- `nlqdb_remember` (E-02) optionally embeds on write (model is one of the
  free-chain embedding providers; falls back to no-embed under failure —
  GLOBAL-022).
- New MCP tool **`nlqdb_recall`** (additive, alongside `nlqdb_query`) —
  takes an NL query and returns a hybrid result: top-K by cosine similarity
  + an analytical WHERE filter from the structured fields (`tags`,
  `created_at`, `end_user_id`, etc.). The fusion is owned by the
  compile-layer, not the LLM (typed-plan still applies).
- `nlqdb_query` keeps doing pure analytical SQL (no change).

## Steps

1. **Founder/infra (blocked-by-human entry).** Enable pgvector on the Neon
   project; pick an embedding provider for the free chain (and the BYOLLM
   path).
2. **Run 1 — embedding write path.** `nlqdb_remember` embeds on write,
   GLOBAL-022 retry semantics; write completes even if embedding fails (row
   has NULL embedding; recall falls back to text-tsvector or skips
   similarity). Add an OTel span `nlqdb.memory.embed`.
3. **Run 2 — `nlqdb_recall` + fusion.** New MCP tool + SDK parity. Compile
   layer fuses: vector similarity top-K, then structured WHERE (agent
   scope enforced by the E-03 `agent_isolation` RLS policy + `app.agent_id`
   GUC, TTL filter from E-04, plus the agent's analytical filters). Diff
   preview unchanged.
4. **Run 3 — eval ablation.** `tools/eval/` gets a memory-recall ablation
   on a fixture `agent_memory` fixture set; numbers feed the WS-09 blog.
5. **Backfill** existing memory rows on demand (background job).

## Done when

- [ ] pgvector enabled on Neon; embedding provider wired into the free chain.
- [ ] `facts.embedding` populated on new writes; backfill job for existing rows.
- [ ] `nlqdb_recall` (additive) returns hybrid results; compile-layer owns the fusion.
- [ ] WS-06 matrix' vector-search cell flips to ✓ honestly; WS-03 solve page disclaimer removed.
- [ ] Eval ablation reported in `tools/eval/`; engine INDEX tracker + status ticked.

## Artifact

The headline blog claim: "the only agent-memory layer where recall AND
analytics live in the same query" → updates WS-09 draft.

## Rollback

`nlqdb_recall` is additive; remove the tool + the embedding-on-write path.
Memory DBs with embeddings keep them (no schema downgrade); recall falls
back to analytical-only.
