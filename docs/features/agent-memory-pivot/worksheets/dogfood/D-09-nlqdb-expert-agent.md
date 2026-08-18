# D-09 — The nlqdb expert agent: our research corpus as a 1-click memory DB our chat consults over MCP

**Status:** ⬜ not started — **founder-directed 2026-08-17** (in-session):
"as quickly as possible we can create an agent with all our research data
from the repo, and our chat should have access to that agent as an MCP —
our chat should represent nlqdb, knowledgeable in anything to do with
memories, querying and RAG."
**Sequence:** follow-on to D-08 · **Risk:** med · **Runs:** multi ·
**Prereqs:** D-02a (extractors), D-04 (prod memory rails proven), D-08
(one-click journey — runner core ✅, `/agents` UI pending) · **Gate:** none —
must never delay D-04–D-07 or the SK-PIVOT-016 gate.

## Goal

nlqdb becomes its own first expert agent. Three parts, in dependency order:

1. **Create the expert agent through the 1-click maker.** Run the
   [`D-08`](D-08-repo-ops-one-click-import.md) journey on the nlqdb repo
   itself, with extraction widened from today's two categories
   (open questions + blocked queue, D-02a) to the **full research corpus**:
   `docs/research/**`, `docs/decisions/**`, `docs/features/**/FEATURE.md` +
   decision shards, `docs/history/**`, `docs/competitors.md`. The result is a
   fresh, isolated `agent_memory_v1` DB that holds what nlqdb knows about
   agent memory, NL querying and RAG — the founder walking this import is
   also acceptance evidence for D-08.
2. **Expose it over MCP.** Nothing to build: any memory DB is already
   reachable via `npx -y @nlqdb/mcp` + a per-host `sk_mcp_*` key
   (`SK-MCP-004`) with `nlqdb_query`/`nlqdb_recall`. The deliverable is the
   minted key + a paste-able host config, not a new tool
   (`SK-PIVOT-018`: no new schema, endpoint or tool).
3. **Ground our chat in it.** The chat consults the expert agent as an MCP
   client before answering, so nlqdb's own chat represents nlqdb — able to
   answer memory/querying/RAG questions from our recorded research rather
   than from a bare LLM. This is the only net-new capability: no chat→MCP
   client path exists anywhere in the product today.

## What exists already (why this is a slice, not a project)

- D-08 runner core (`apps/api/src/pack-runner/**`, `/v1/packs/imports*`) —
  the one-click maker, shipped 2026-08-10; `/agents` UI still open.
- `tools/docs-memory/` extractors (D-01/D-02a) — extend, don't rebuild.
- Prod DB `db_agent_memory_v1_3a8a72` (D-04) — proves the rails, but holds
  13 facts from two categories; it is **not** "all our research data".
- Hosted MCP (`apps/mcp`) + `@nlqdb/mcp` — the access surface, unchanged.

## Decisions this slice must mint before chat code (design run)

Per `P3`/`D1`, part 3 needs one feature-local decision (next free
`SK-PIVOT-0NN`) locking, from pre-drafted options:

- **Which chat surface first.** Conservative default (`GLOBAL-033`): the
  `/agents` chat, where the memory audience already lands — not the per-DB
  product chat, which answers over a *user's* data and must not silently
  mix in nlqdb's corpus.
- **How chat reaches the DB.** Default: through the public MCP surface with
  its own `sk_mcp_*` key, exactly as the founder framed it — matching the
  dogfood public-surfaces spirit (the ops-agents rule doesn't bind product
  code, founder ruling 2026-08-10, but the public path measures what a
  stranger's agent would experience).
- **Answer honesty.** Grounded answers cite the recalled fact rows visibly
  (three-part reply per `SK-WEB-005`); no invented provenance.

**GLOBAL-037 check (P1) — within lanes, no widening.** Recall rows sent to
the answering LLM are nlqdb's **own** public markdown on nlqdb's **own**
tenant — lane 2 (narration of returned rows, ≤50, disclosed). Grounding
chat on a *customer's* knowledge DB would be a lane widening and is out of
scope here (founder + GLOBAL amendment required; see EK-09's narration-skip
direction for granted paths).

## Relationship to the expert-knowledge marketplace

This DB is the shape of a free first-party listing (`SK-EKP-006`) — nlqdb
as expert #0, the dogfood proof behind the "become AI" pitch. The tracks
stay uncoupled per `SK-EKP-005`: nothing here blocks or is blocked by EK-*.

## Steps

1. **Run 1 — corpus.** Widen `tools/docs-memory` with the research-corpus
   extraction categories (decisions, research findings + receipts,
   competitor rows, history lessons); import through the D-08 journey into
   a fresh prod DB; reconcile counts. Mint the MCP key + host config.
2. **Run 2 — golden queries.** ≥ 5 golden queries over the widened corpus
   in the `SK-QUAL-023` family (D-03 frozen-snapshot discipline), e.g.
   "which memory strategies did our research reject, and why-tagged how?".
3. **Run 3 — design.** Mint the chat-grounding `SK-PIVOT-0NN` above.
4. **Run 4 — chat.** Chat recalls from the expert DB via MCP before
   answering; grounded answers show their source facts; P2 persona E2E for
   ask → recall → grounded answer → sources visible.

## Done when

- [ ] The full research corpus (globs above) is imported through the
      one-click journey into a fresh prod memory DB; counts reconcile.
- [ ] The DB answers over the public MCP surface with a fresh `sk_mcp_*`
      key; host config recorded (metadata only, never the key value).
- [ ] ≥ 5 golden queries added and measured; EX + run link recorded.
- [ ] The chat-grounding decision is minted **before** any chat code lands.
- [ ] The chat answers a memory/querying/RAG question grounded in
      expert-DB rows, sources visible, on the decided surface.
- [ ] Zero new schema, preset version, endpoint or MCP tool
      (`SK-PIVOT-007`/`SK-PIVOT-018`) — the expert agent is content + the
      shared runner.
- [ ] INDEX tracker + status ticked.

## Rollback

Delete the expert DB (`SK-HDC-016`) and revoke its key; chat grounding
ships behind a flag and turns off without residue. The corpus is derived —
markdown stays canonical (`SK-PIVOT-017`), so rollback loses nothing.
