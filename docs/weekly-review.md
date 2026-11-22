# Weekly review — 2026-11-22

Current-state audit of `/daily` (≤ 4 KB, overwritten weekly). Window
11-15 → 11-22: runs 293–304 (#1283–#1292, #1297) plus #1298 and 2 bot
PRs. Focus set: **LogSnag logs this month, 2,023 / 2,500 → pages only.**

## Worst: sign-in went down twice (check 1)

`bun scripts/cf-quota.ts` (re-run today): D1 11-18 **133.5 M = 2,671 %**
(`swiss-prices-comparison`, not nlqdb); KV writes 11-21 **1,236 = 124 %**
(a scanner, one Better Auth KV write per request). Each took signed-in
`app.nlqdb.com` down until 00:00 UTC. #1297 moved per-IP limits to the
edge binding; the D1 hog is mailbox #1 (4 d). rateme12 alone read 2.82 M
(56 %) on 11-20. LogSnag hit 81 % of its cap on 11-21: the focus.

## Monoculture (check 2): the sequence ran dry

2 runs engine (293–294), 4 SEO (295–298), 2 instrument (299–300, one
PR), 4 nulls (301–304). Last focus, KPI B on rateme12's D1, stayed **0**: Tier 1
finds no missing index, and the box is ⛔ on the founder (#2 spike call,
3 d overdue; #3 recruit re-gate). The null rule worked: no busywork.

## Delta integrity (check 5): held

| Claim | Re-run |
|---|---|
| `/solve` literal markdown 0/44 (#1287) | `solve.test.ts` 20/20 pass |
| DBA `/solve` pages 3/3 (#1288) | 3 slugs in `solve.ts`, 44 total |
| rateme12 Tier 1 0 proposals (#1284) | CI 11-21 21:04, job 136984006533: 0; KPI A 317 ms |
| D1 11-18 133.5 M, 11-20 4.39 M (#1289) | same |

Row 14b said KV 11-21 = 1,000 (100 %), read mid-day; the day closed at
1,236. Row 22's served share swings with the window (61.2 → 39.9 %).

## Inert output (check 3)

Rows EA, EB and 16 are still run changelogs (flagged 11-15, unfixed);
14a/14b now list every day. Next run that touches them keeps one value +
range. Four null PRs each re-printed the same paragraph.

## Dark metrics (check 4)

Row 16 (spike pass/fail) is due since 11-19: mailbox #2. Row 15 (E2E
freshness) 0 since 10-22: agent-dispatchable, but its suites call the
free LLMs (`daily.md` rule 3). Rows 2/3/13 measure `/v1/ask`, which the
deletion series removes.

## Prompt drift (check 6)

Every ID, path and script in `daily.md` and `weekly.md` resolves.
`ROADMAP.md` gained §0 fix-first (#1298); `daily.md` step 2 listed only
phases 1a → 3, `weekly.md` output 1 "1 → 2 → 3". This PR adds phase 0 to
both.

## README roadmap (check 7)

Spike line: "kept at 72 h" → held at 228 h, 2.0 ms. rateme12 line: "Tier 1
reads joins next" was done in run 294 and found no missing index;
rewritten.

## Free-model roster (check 8)

Plan chain: groq-qwen `qwen3.8-27b` → gemini `3.8-flash` → cerebras
`gpt-oss-120b` → groq `gpt-oss-120b` → workers-ai `llama-3.3-70b` →
openrouter `nemotron-3-ultra:free` → mistral `codestral`.

- Workers AI's free catalog lists `@cf/qwen/qwen3.8-27b`, `gpt-oss-120b`
  and `glm-5.3` (API list, today); each beats `llama-3.3-70b`
  ([free-llm.com 11-18](https://free-llm.com/guides/free-llm-apis-november-2026-what-changed)).
  Their schema answers in `choices[]`, which `workers-ai.ts` doesn't
  parse.
- `gemini-4-hydrogen` is free from 11-12
  ([pricing](https://aistudio.google.com/docs/pricing),
  [apidog](https://apidog.com/blog/gemini-4-hydrogen-free/)), and our key
  lists it. Its RPD isn't published.
- Not swapped here: both keys exist, but each needs a parser or leg plus
  a live walk (`daily.md` rule 3), on `/v1/ask`, whose deletion scope is
  🔒 (mailbox #7). Check 8 and `GLOBAL-043`'s depth-only rule disagree
  until that lock. No mailbox bullet.
