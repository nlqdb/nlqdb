# Weekly review — 2026-10-11

Current-state audit of `/daily` (≤ 4 KB, overwritten weekly). Window
09-27→10-11 (the 10-04 weekly did not run): runs 225–239 (#1149–#1170),
plus run 240 open as #1171.

## Worst: KPI 1 regressed, 2 HIT / 1 MISS → 2 HIT / 7 MISS (check 1)

The KPI-1 alert (`GLOBAL-025`) says to inspect every dogfood miss the same
run. Instead, six misses landed in two merges. Run 237 had 3 misses, and
run 238 never carried them. Run 239 had 3 more, every one
`preview_error:llm_failed:circuit_open@mistral`
([38061162547](https://github.com/nlqdb/nlqdb/actions/runs/38061162547), log
re-read). Both triples trace to a long `scorecard_deltas` write failing
the whole plan chain in ~76 s, which opened the breakers; in run 239 that
was the 1997-char E1 row, itself the first miss. #1171 fixes the plan
stage. Its claim is 3/7 → 6/7 on the real goals. **Window 1 closed 10-10
at 2 HIT / 7 MISS (22 % HIT), 9/200.** `GLOBAL-041` opens a window at
the first unseen-field insert, so window 2 opens at the next one. No
reset is needed.

## Volume: 9 in-sample writes in 14 days against 200 (checks 2 + 3)

`GLOBAL-041` asks for 200 unseen-field inserts in 14 days. The run-log
workload yields about 0.6 a day, and most writes are `seen_fields`. At
that rate the exit gate cannot be met by construction. The only real
source of more volume is the rateme12 §5b last mile, which is gated
behind §5a step 5. This is flagged against `GLOBAL-041` but not changed:
the rate is still the honest signal, and a synthetic stream is rejected.

The lever mix was healthy, with no monoculture. Runs 225–233 worked on
KPI 1 and §6.1, moving **R2/R3 to green (§6.1 4/4)**. Runs 234–238 built
the clone, moving build steps 0 → 3/10 and routes 0 → 4/13. Run 239 named
each miss's cause.

## Delta integrity: 3 sampled, all genuine (check 5)

- Run 238 claimed 4/13 routes: `ROUTES` in `apps/rateme12/src/worker.ts`
  has 4 entries, 8/8 tests pass, and `/`, `/servers/x` and `/publishers/y`
  return 200 live while `/install` returns 404.
- Run 239 claimed every miss names its cause: the run-239 dogfood log does.
- Run 240's 3/7 → 6/7 comes from a probe; it gets re-read when its merge
  writes.

## Dark metrics (check 4)

- Row #18 (the `dryRun` claim) is a phantom capability on
  `docs.nlqdb.com/sdk`. It has been carried 5 days (runs 232–239) and is
  agent-fixable at $0: drop the claim or build it.
- Row #15 (E2E freshness) is 0.00. sdk/examples/mcp last passed 09-08,
  33 days ago. Re-dispatching them costs $0, so they are not dark; only
  opencheck costs money.
- BIRD/Spider (#8/#9) and the stranger rows (#2/#4/#5) name their blockers.
- The queue has depth 5. Its head is Show HN (120 d), then the
  email-router deploy (23 d).

## Prompt drift: one dead rule fixed (check 6)

`daily.md` still said the CI writer was unbuilt ("until that job exists…
window stays shut"). It also said to record a miss "the same run", which
cannot happen: `dogfood-write.yml` fires on merge, after the run. Step 1
now reads every Dogfood write run since the last scorecard update; that
gap is how run 238 dropped 3 misses. All IDs and paths resolve.

## Public roadmap: one stale marker fixed (check 7)

`kind=extend` said "the formal 200-insert dogfood sample has not opened
yet". It now gives window 1's result. The marker stays ~.

## Free-model roster (check 8)

Plan chain, best first: groq-qwen `qwen3.8-27b` → gemini `2.5-flash` →
~~cerebras~~ → groq `gpt-oss-120b` → workers-ai `llama-3.3-70b` →
openrouter `nemotron-3-ultra:free` → mistral `codestral` (live OK).
Cerebras still returns 402 `payment_required` (probed today). It now
sells expiring credits, not a free tier
([CostBench, 08-06](https://www.costbench.com/best/best-llm-api-with-free-tier/)),
so it stays a dead leg in 4 chains for a 3rd week. Pruning it is an
agent lever. No better free model on an existing key: Groq, Gemini and
OpenRouter `/v1/models` were re-listed live, and `gemini-3.8-flash` was
rejected 09-27 on latency. No key-gated bullet.
