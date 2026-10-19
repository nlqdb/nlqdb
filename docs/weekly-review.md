# Weekly review — 2026-10-18

Current-state audit of `/daily` (≤ 4 KB, overwritten weekly). Window
10-11→10-18: runs 240–251 (#1171–#1186), plus the 10-14 steer (#1181).
The focus is the founder's (10-14), kept as is.

## Worst: the canary lost two runs' records, and two MISSes are unread (checks 5 + 3)

Runs 250 and 251 never rewrote `## Last change`, so the scorecard still
says run 249. `dogfood-write.ts` takes the run number from that entry.
The writer saw an "unchanged" run: it never wrote run 250's or 251's run
record, and it filed their row deltas under run 249. The scorecard put
the label down to "a run-number parse to check". The parse is correct;
the input was stale. Run 251's merge
([38998848415](https://github.com/nlqdb/nlqdb/actions/runs/38998848415),
log re-read) wrote 2 `scorecard_deltas` MISSes, both
`commit_error:write_constraint`. No run has read them since, so the
window-2 canary is **1 HIT / 6 MISS**, not 1/4. Fix: `daily.md` now says
to rewrite the entry every run and why. The canary also still writes
through `ask()`, the LLM write path the steer took off writes. Moving it
to `insert()` costs $0, but it is a daily call, so it is not made here.

## Trend (check 1)

- **Engine:** R5 went from no insert path to API + SDK + `nlq insert` +
  MCP `nlqdb_insert` (#1183, #1186). §6.1 is 4/5 green. KPI 1's formal
  sample stays at n = 0 until §5b wires rateme12.
- **Onboarding:** hosted create came back on 10-16 (#1182, #1184), after
  the Neon 500-role cap made it fail from 10-14.
- **UX:** flat.
- **Performance:** dark. p50/p95 have been carried since 07-27.
- No `GLOBAL-025` alert fired, and BIRD/Spider raised no red alarm.

## Monoculture (check 2)

Runs 242–246 all did rateme12 look-and-feel (routes 4 → 13/13). The
10-14 steer then closed §5a. Runs 248–251 followed the step-2 sequence:
role cap, then `insert()`. Each run moved a named number, so this was
the plan running, not a rut.

## Delta integrity: 3 sampled (check 5)

- **#1186, 3/3 surfaces:** `cli/internal/cmd/insert.go` and MCP
  `nlqdb_insert` → `client.insert` both exist, and `go test ./...` passes
  in `cli/`.
- **#1184, smoke green:** CI passed on `3ca4b49` and on `bf06c96`.
- **#1183, 11/11:** not re-runnable. The real-Postgres walk was never
  committed; only the unit tests were (`src/insert`, 31/31 pass). R5's
  open item is the live walk on deploy, and it should land as a
  committed script.

## Dark metrics (check 4)

- **Row #18** is a phantom claim: `docs.nlqdb.com/sdk` still documents
  `runSql({ dryRun })`, which is unbuilt (`SK-SDK-012`). It is carried
  from run 232, about 2 weeks. It costs $0 to fix, but step 2 has no
  slot for it.
- **Row #15** (E2E freshness) reads 0.00. Its last success was 09-08,
  40 days ago.
- **Rows #8/#9** (BIRD/Spider) and the stranger rows (#2, #4, #5) name
  their blockers.
- **Queue:** depth 7. The head is 🔒 PR #1185 (2 d).

## Prompt drift (check 6)

All IDs and paths in `daily.md` and `weekly.md` resolve. The one fix is
above. Outside the prompts, the `AGENTS.md` §5 path map names
`nlqdb_recall`, but the tool is `nlqdb_read` (`packages/mcp/src`).

## Public roadmap (check 7)

The `README.md` "Now" section names Phase A and lists `insert()` on all
three surfaces as ~. That matches what shipped. No marker changed.

## Free-model roster (check 8)

**Plan chain, best first:** groq-qwen `qwen3.8-27b` → gemini
`2.5-flash` → ~~cerebras `gpt-oss-120b`~~ → groq `gpt-oss-120b` →
workers-ai `llama-3.3-70b` → openrouter → mistral.

- **Cerebras** still returns 402 (probed today). This is the 4th week
  it has been a dead leg. Removing it means amending `SK-LLM-023`, so it
  is flagged, not changed.
- **Live listings:** Groq, Gemini and OpenRouter were re-listed live
  today. No stronger free model is on an existing key.
- **Sources:** [Novita](https://blogs.novita.ai/free-llm-api-comparison-2026/)
  and [CostBench](https://www.costbench.com/best/best-llm-api-with-free-tier/).
- **Priority:** low; no write path calls a model now.
- **Blocked-by-human:** no bullet added.
