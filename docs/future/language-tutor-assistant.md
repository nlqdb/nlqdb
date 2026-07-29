# Future plan — The language-tutor personal assistant

> **Status:** **vision, unscheduled.** Founder-directed 2026-07-29, with an
> explicit founder constraint: *"make this a vision that will be eventually
> built but make sure it doesn't block the development of the rest of our
> goals."* Nothing in this file is scheduled work — see
> [§ Non-blocking clause](#non-blocking-clause-read-this-before-acting-on-anything-above),
> which is binding on any agent that reads this doc.
>
> **Promotion trigger:** **a founder decision, and nothing else.** Stage 0
> (the goal pack) may be picked up through the normal pack-candidate ranking
> because a pack is content, not product. Stage 1 and Stage 2 do not enter any
> queue until the founder says so; when Stage 2 opens, its stack gets a
> P2-grade research pass *at that time* (`CLAUDE.md §2 / P2`). Per `P4 / D5`,
> **no `SK-*` ID is minted here** — `docs/future/` is pre-decision by
> definition.

**Cross-refs:**
[`SK-PIVOT-018`](../features/agent-memory-pivot/decisions/SK-PIVOT-018-goal-packs.md)
(goal packs: content + a skill prompt, never schema) ·
[`SK-PIVOT-007`](../features/agent-memory-pivot/decisions/SK-PIVOT-007-memory-schema-versioning.md)
(the canonical `agent_memory_v1` shape) ·
[`SK-PIVOT-016`](../features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md)
(the launch gate this vision must not touch) ·
[`dogfood/INDEX.md`](../features/agent-memory-pivot/worksheets/dogfood/INDEX.md)
(where pack candidates are ranked) ·
[`mcp-server/FEATURE.md`](../features/mcp-server/FEATURE.md)
(`SK-MCP-002`'s fixed tool set — how an assistant reaches memory today).

---

## The vision

A genuinely useful **personal assistant** — calendar, email, GitHub, Linear
and more — that is *also* under standing instruction to teach its user one
new language of the user's choosing. Both jobs run in the same conversation:

- **Memory of progress.** Every vocabulary encounter, every mistake, every
  correction lands in the user's nlqdb memory DB, tagged by word, grammar
  rule and severity.
- **Casual correction.** When the user writes a grammar or spelling mistake
  mid-request ("book me a meating tomorow"), the assistant handles the
  request *and* corrects in passing — no quiz mode, no interruption.
- **Dual-purpose replies.** Ordinary assistant answers carry inline
  translations of complex words in the target language, so immersion is a
  side effect of getting work done rather than a separate activity.
- **Voice chat**, for the pronunciation half that text cannot teach.
- **Reachable where the user already is** — Telegram and WhatsApp, not only
  a desktop MCP host.

The founder is user #1.

## The memory thesis — why this is an nlqdb product, not a flashcard app

Language learning is an **analytical** memory workload, not a top-k recall
workload. The questions that make a tutor good are aggregations over
remembered facts:

- *Which grammar rules do I slip on most this month?* — `GROUP BY` rule,
  ordered by count.
- *Which words have I got wrong ≥ 3 times?* — `HAVING count(*) >= 3`.
- *What's due for review today?* — a time-window predicate over
  last-seen timestamps and interval state.
- *Is my error rate falling week over week?* — a trend over time buckets.
- *Which words did I only ever meet in work email, never in conversation?* —
  a `JOIN` across episodes and entities.

A recall-only store (embed the note, fetch the nearest five) cannot answer
any of them: "wrong ≥ 3 times" is a `COUNT`, not a similarity. This is
exactly nlqdb's wedge — remembered facts in a real relational engine, asked
in plain English. The tutor is the most legible demo of that difference we
have found, because a human user can feel the answer being right.

## How it maps to the canonical schema — zero new engine surface

Everything memory-shaped here rides `agent_memory_v1`'s four tables as they
are today (`SK-PIVOT-007`):

| Tutor concept | `agent_memory_v1` |
|---|---|
| A mistake + its correction; a vocabulary encounter; a mastery judgement | `facts` — tagged with the word, the grammar rule, severity |
| A conversation / study session, with its time bounds | `episodes` |
| Words, grammar rules, topics, and the real-world people and projects the assistant already tracks | `entities` |
| "this mistake belongs to this rule and this word" | `entity_facts` |

Stated plainly: **this is a goal pack per `SK-PIVOT-018`** — an extraction
recipe, seed entities and a golden-query set, written through the public
`nlqdb_remember` / `nlqdb_query` surface. **No new table, no new column, no
new endpoint, no new MCP tool.** A pack that needs DDL is not this pack; it
would be an `SK-PIVOT-007` conversation with its own decision record.

## Staged path

Three stages. Each is independently valuable, and stopping after any one of
them leaves nothing half-built.

### Stage 0 — the language-tutor **goal pack**

The pack itself: extraction recipe (what to remember from a conversation and
how to tag it), seed entities (the target language, its rule set, a starter
word list), and ≥ 5 golden queries added to the `SK-QUAL-023` eval family —
the analytical questions above, as pass/fail golds.

Cost: ~2 `/daily` runs. Queue status: a **pack candidate** — a future
goal-pack slice in the dogfood track
([`dogfood/INDEX.md`](../features/agent-memory-pivot/worksheets/dogfood/INDEX.md),
where `D-05` is the existing founder-ops pack). It is pulled only when the
daily loop's lever is pack work, competes under normal founder ranking, and
carries **no priority claim** and no claim on the next run.

Value if we stop here: the analytical-memory claim gains its most
human-legible golden-query set, and any agent can run the tutor by hand.

### Stage 1 — an nlqdb-branded **tutor skill**

A skill in the agent-artifacts family (beside `nlqdb-docs-memory`) that
instructs *any* MCP-connected assistant — Claude Desktop, Cursor, whatever
the user already uses — to run the tutor behavior: remember mistakes and
encounters via `nlqdb_remember`, read progress via `nlqdb_query`, correct
casually, translate complex words inline.

**Boundary, stated once and clearly:** the calendar / email / GitHub / Linear
access comes from **the host's own connectors**, not from nlqdb. nlqdb
supplies memory and the instruction to teach; it does not build, broker or
proxy connectors. Stage 1 therefore adds no infrastructure — it rides hosts
that already exist and the tool set `SK-MCP-002` already ships.

Value if we stop here: the full "assistant that teaches you a language" is
usable today by anyone with an MCP host, and it is a shareable artifact.

### Stage 2 — dedicated reachability (the full vision)

Telegram and WhatsApp bridges plus voice chat, so the assistant lives where
the user already texts and can be spoken to.

Honest about what this implies: a **hosted bot surface** (a long-lived
messaging endpoint, per-channel webhook auth, message-to-agent-identity
mapping), **telephony / STT–TTS choices**, and per-channel rate and cost
control. That is materially more than a pack and a skill — it is the first
nlqdb surface that is a *consumer* endpoint. Per `P2`, the concrete stack
(bridge framework, voice provider, WhatsApp Business access path) gets
researched **when this stage is opened, not now**; guessing it today would
document ambiguity, which `D2` forbids.

## Non-blocking clause (read this before acting on anything above)

This vision **gates nothing**. Specifically, and enforceably:

- It adds **no criterion** to the `SK-PIVOT-016` dogfood launch gate. The
  gate stays at its 5 founder-set criteria. (Only the founder may loosen or
  remove one; nothing here tightens one either.)
- It creates **no `D-*` slice**, and appears in no worksheet sequence.
- It adds **no scorecard row** and makes **no weekly-focus claim**. It is
  never the answer to "what is the worst number this week?".
- It mints **no `SK-*` ID** and supersedes **no** existing decision.
- The **only** queue entry it is allowed to have is Stage 0's pack
  candidate, which competes on the normal pack-candidate ranking like every
  other candidate.
- Promoting Stage 1 or Stage 2 into a feature requires an **explicit founder
  decision** recorded in the relevant `FEATURE.md`. An agent that promotes
  either on its own initiative has violated `P1`.

If you arrived here from a link and are deciding what to work on: **this is
not it.** Read [`docs/scorecard.md`](../scorecard.md) for what is.

## Deliberately open (do not fake-decide these)

Per `D1` / `D2`, these are open on purpose and must stay open until decided
by the founder or by research at the stage that needs them:

- **Which language.** User-chosen by design; the founder's own first target
  is not picked yet. The pack must not hardcode one.
- **The voice stack.** STT/TTS provider, latency budget, whether voice is
  browser-side or telephony-side — Stage 2 research.
- **Bridge technology.** Telegram Bot API is the easy half; WhatsApp's
  Business-API access path, pricing and approval are not, and neither is the
  hosting shape for a long-lived bot beside a Workers-first stack
  (`GLOBAL-013`) — Stage 2 research.
- **Correction aggressiveness.** How often "casual" correction becomes
  annoying is an empirical question the founder answers by using it.

## Why it's strategically real

Two reasons this is more than a nice idea. First, the founder using it daily
produces exactly the traffic class the dogfood gate measures — real memory
reads and writes through the public MCP surface, from a user who will notice
the moment recall is wrong. Second, it is the clearest demo we have of
nlqdb's actual advantage: a tutor that can answer *"which words have I got
wrong three times this month?"* visibly beats one that can only fetch the
five notes most similar to your question, and a human can tell the
difference in one sentence.
