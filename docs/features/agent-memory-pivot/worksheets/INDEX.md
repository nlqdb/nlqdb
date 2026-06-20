# Agent-Memory Pivot — worksheet backlog

The pivot ships **slowly**: one small, reversible slice at a time, each sized
to a single `/daily` run. This is the canonical backlog. Governed by
**GLOBAL-036**; the per-surface copy inventory is
[`messaging-surface-map.md`](messaging-surface-map.md).

**Two tracks, interleaved.** This file is the **messaging track** (WS-*).
The **engine track** (E-*) — the actual architectural slices that make the
wedge claims durable — lives at
[`engine/INDEX.md`](engine/INDEX.md). Rule of thumb when picking a
worksheet:

| Worst-number lane today | Pick from |
|---|---|
| Funnel / distribution / waitlist conversion | this file (WS-*) |
| Engine quality / agent on-ramp / "wedge claims true" | [`engine/INDEX.md`](engine/INDEX.md) (E-*) |

Several `WS-*` worksheets sharpen once an `E-*` lands (E-01 unblocks
WS-09's live demo; E-02 sharpens WS-04's MCP copy; E-05 lets WS-03 drop
its honest "no native vector search yet" disclaimer). Cross-links are
called out in each worksheet's `Cross-link` column.

## How a cold daily-loop agent picks up a slice

You are the 6×/day operating agent (`.claude/commands/daily.md`). When the
**worst number** (or the founder-set weekly focus) is in the
**funnel / distribution lane**, this backlog is your lever list:

1. **Pick** the lowest-numbered worksheet below that is `⬜` **and** whose
   `Prereqs` are all `✅`. Skip any marked `FOUNDER-GATED` /
   `infra-gated` unless the founder has cleared it.
2. **Read** the worksheet fully, then the `FEATURE.md`(s) it names (per the
   `AGENTS.md §5` path map). Obey `CLAUDE.md` P1–P5.
3. **Do one slice** — the smallest diff that satisfies one `Done when` box.
   A worksheet may span several runs; tick boxes as you go. **One PR per
   run, small diff.**
4. **Measure** the named scorecard number before/after where the slice can
   move it (most are funnel/conversion or "surface exists" booleans).
5. **Tick** the status here (`⬜ → ✅` with the PR link) in the same PR.
6. **Append one artifact** to `docs/research/distribution-queue.md` (daily
   loop step 3) — the worksheet names the natural one.
7. **PR body** names: the number moved (or the boolean flipped), the
   GLOBAL-025 KPI advanced (**onboarding** or **UX**), and confirms engine /
   performance untouched.

**Hard rules inherited from the loop:** do **not** re-escalate the
GLOBAL-027 gate thresholds; the billing lane stays frozen; the wedge feeds
the **waitlist**, it does not open the product. Every slice is **additive**
until WS-13 — nothing irreversible ships before the founder-gated headline
swap.

## Sequence

| WS | Slice | Risk | Runs | Prereqs | Gate |
|----|-------|------|------|---------|------|
| [01](WS-01-competitors-md-anchor.md) ✅ | Anchor Zep / Letta / LangMem in `docs/competitors.md` | low | 1 | — | — |
| [02](WS-02-memory-vs-pages.md) | Memory-competitor `/vs` pages (Zep, Letta, LangMem — one per run) | low | ~3 | 01 | — |
| [03](WS-03-solve-pages.md) ✅ | Sharpen the agent-memory solve page + add an analytical-queries sibling | low | ~2 | — | — |
| [04](WS-04-mcp-framing.md) ✅ | MCP tool + package + docs framing → "analytical memory" | low | 1 | — | — |
| [05](WS-05-carousel-slides.md) ✅ | Carousel: analytics-over-agent-memory slides | low | 1 | — | — |
| [06](WS-06-capability-matrix.md) ✅ | Mem0 \| Zep \| Letta \| nlqdb capability matrix (new surface) — data ✅ + render ✅ | med | ~2 | 01 | — |
| [07](WS-07-agents-landing.md) | Dedicated `/agents` front door | med | ~3 | 06 | — |
| [08](WS-08-og-images.md) | On-brand OG / social images for the wedge surfaces | low | ~2 | 07 | — |
| [09](WS-09-blog-and-demo.md) | "Database, not a vector store" blog + live in-page demo | med | ~2 | 06 | — |
| [10](WS-10-fsl-selfhost-messaging.md) ✅ | FSL self-host messaging (GLOBAL-019 / arch §0 doc-fix already shipped in the pivot PR) | low | 1 | — | — |
| [11](WS-11-selfhost-container.md) | Pull the self-host container forward (`ghcr.io/nlqdb/api`) | high | multi | 10 | infra-gated |
| [12](WS-12-home-reweight.md) | Home reweight: agent-memory primary + demote P1/P3/P4 to an "also works for…" fold | med | ~2 | 06, 07 | — |
| [13](WS-13-headline-reposition.md) | Headline reposition (wordmark / README / llms.txt / JSON-LD lead) | high | ~2 | 07, 12 | **FOUNDER-GATED** |

**Why this order:** WS-01–05 are additive content on existing machinery
(lowest risk, immediate distribution artifacts). WS-06–09 build the wedge's
centrepiece (matrix → `/agents` → its visuals → the launch post). WS-10–11
make the self-host claim true before anything leads with it. WS-12 changes
the *visible* home hierarchy without touching the wordmark. WS-13 — the only
irreversible brand bet — is last and founder-gated.

## Tracker

Tick on merge. Keep this list as the durable pivot status (the scorecard's
`Pivot:` line is regenerated; this is not).

- [x] WS-01 — competitors.md anchor (2026-06-19, run 19 — branch `claude/sharp-wozniak-y9ee5z`)
- [x] WS-02 — memory `/vs` pages: **Zep ✅** (2026-06-20, run 20 — branch `claude/sharp-wozniak-67k9n4`), **Letta ✅** (2026-06-21, run 21 — branch `claude/sharp-wozniak-sxy0yi`), **LangMem ✅** (2026-06-19, run 22 — branch `claude/vibrant-newton-c3pery`)
- [x] WS-03 — solve pages: **sharpen ✅** (2026-06-19, run 23 — `give-ai-agent-persistent-memory` reframed to the analytical wedge + phantom MCP tools fixed); **analytical sibling ✅** (2026-06-20, run 25 — `analytical-queries-over-agent-memory`, the read-side wedge)
- [x] WS-04 — MCP framing (2026-06-19, run 24 — branch `claude/vibrant-newton-rk77n7`)
- [x] WS-05 — carousel slides (2026-06-20, run 26 — branch `claude/vibrant-newton-8gbdxc`; 2 analytics-over-memory slides: `read-agent-memory-by-category` GROUP BY + `read-agent-memory-top-recalled` top-N)
- [x] WS-06 — capability matrix: **data ✅** (2026-06-20, run 27 — `apps/web/src/data/agentMemoryMatrix.ts` + test, branch `claude/vibrant-newton-s9e2r2`); **render ✅** (2026-06-20, run 28 — `apps/web/src/components/AgentMemoryMatrix.astro`, branch `claude/vibrant-newton-rldywf`)
- [ ] WS-07 — `/agents` landing
- [ ] WS-08 — OG / social images
- [ ] WS-09 — blog + live demo (🟡 1/2 — blog draft ✅ 2026-06-20 run 30, branch `claude/vibrant-newton-wah6ow`; live `/agents` demo pending WS-07)
- [x] WS-10 — FSL self-host messaging (2026-06-20, run 28 — branch `claude/vibrant-newton-fh8mgw`; pricing self-host band + README "Models & plans" self-host line, FSL-accurate, no turnkey-image claim per WS-11 note)
- [ ] WS-11 — self-host container (infra-gated)
- [ ] WS-12 — home reweight + demote personas
- [ ] WS-13 — headline reposition (founder-gated)
