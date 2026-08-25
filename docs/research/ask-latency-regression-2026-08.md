# `/v1/ask` latency regression — August 2026 investigation

**Status:** open investigation. Signal is real and reproducible in PostHog;
the cause is **not yet isolated** because the telemetry needed to isolate it
does not exist yet (§4). This doc records the evidence, the ranked
hypotheses, and the instrumentation that would settle it.

**Compiled:** 2026-08-25, from PostHog EU (`ask.completed`) + repo history.
Cross-refs: [`performance.md`](../performance.md) (SLOs, §1; stage budgets,
§2) · [`features/events-pipeline/FEATURE.md`](../features/events-pipeline/FEATURE.md)
(`ask.completed` payload).

---

## 1. The signal

`ask.completed.orchestratorMs`, grouped by ISO week (Mon-start). Source:
PostHog HogQL over `events`, pulled 2026-08-25.

| Week (Mon) | asks | avg ms | p50 ms | p90 ms | max ms |
|---|---:|---:|---:|---:|---:|
| 2026-07-13 | 3 | 1 651 | 1 676 | 1 811 | 1 845 |
| 2026-07-20 | 1 | 943 | 943 | 943 | 943 |
| 2026-07-27 | 2 | 1 952 | 1 952 | 2 245 | 2 318 |
| 2026-08-03 | 5 | 2 190 | 2 020 | 3 059 | 3 060 |
| 2026-08-10 | 24 | 1 855 | 1 406 | 4 070 | 6 854 |
| 2026-08-17 | 18 | 4 701 | 3 740 | 8 924 | 19 664 |
| 2026-08-24 (partial) | 5 | 10 824 | 10 186 | 17 955 | 20 693 |

**Read:** the **median** ask went from ~1.4 s (week of 08-10) to ~3.7 s
(08-17) to ~10.2 s (partial 08-24) — a 5–10× move in two weeks, and it is a
shift of the whole distribution, not a tail artefact: by 08-24 the *fastest*
half of asks is slower than the previous month's worst case.

**Caveats, stated up front.** (a) Weekly n is 1–24; no percentage claims are
made on these denominators, and p90 on n=5 is effectively a max. (b)
`orchestratorMs` is captured in `apps/api/src/ask/orchestrate.ts` **before**
response serialise/egress, so it is orchestrator-internal and is *not* the
`/v1/ask` wall-clock the [§1 SLO](../performance.md) governs — the
user-visible number is this plus egress, i.e. the SLO breach is at least
this bad. (c) Small-n weeks can be dominated by one slow db or one user's
session; §4's `dbId` split is what would rule that out.

Against the [§1 SLO](../performance.md) (cache-miss p50 < 1.5 s, p99 < 3.5 s):
the last two weeks are out of budget on the **median**, which by that
document's own rule is release-blocking.

## 2. What the data can already say

- **Not an engine mix change.** `engine` is `postgres` on 100% of asks
  across the whole window; no BYO/ClickHouse path is involved.
- **Not one pathological query shape.** Over the last 30 days the slowest
  `planShape` buckets are singletons (19 664 ms, 9 713 ms, 6 427 ms avg on
  n=1–2) while repeat shapes stay fast (837 ms on n=4, 853 ms on n=2). The
  pattern is consistent with **cold/first-time plans being slow** and cached
  ones staying fast — i.e. an LLM-hop cost, not a SQL-execution cost.
- **Not obviously load.** Volume *fell* from 24 asks (08-10) to 18 (08-17)
  while latency tripled.

## 3. Ranked hypotheses

Ordered by how well each explains a step change in the week of **2026-08-17**.

1. **Planner-head churn on the strict-$0 lane.** `SK-LLM-048` added GLM-4.7
   as the strict-$0 planner head on 2026-08-16 (#997) — one day before the
   step change — and it was re-headed on 2026-08-24 to Qwen3.6-27B on Groq
   after GLM-4.7 started 404-ing on Cerebras (#1041). A head that 404s or
   times out before the fallback chain fires costs a full retry round-trip
   on every plan, which is exactly a several-second, distribution-wide
   penalty. *Strongest candidate; also predicts the further jump in the
   08-24 week, when the head was failing before being replaced.*
2. **More LLM hops per ask.** Between 08-17 and 08-22, ask gained a
   schema-metadata planner directive (#1002, longer prompt → more input
   tokens), guided clarify turns for low confidence (`GLOBAL-040`, #1036)
   and unanswerable write references (`SK-ASK-031`, #1029), plus create/query
   classification fixes (#1037). Each adds prompt size or an extra model
   call on some fraction of asks.
3. **Plan-cache hit-rate collapse.** A schema or prompt change that shifts
   `schemaHash`/`queryHash` invalidates cached plans, pushing asks onto the
   cache-miss path. Consistent with §2's cold-shape observation — and
   currently **unfalsifiable from telemetry**, see §4.
4. **Upstream provider slowness** on the free lane (no code change needed).
   Cheapest to rule out, but only once per-stage timing exists.

Deliberately *not* on the list: SQL execution against user Postgres, and
Workers cold starts — neither explains a median move of this size on an
unchanged engine mix, though both become checkable with §4.

## 4. Why this can't be closed today — the instrumentation gap

`ask.completed` carries exactly nine properties: `dbId`, `schemaHash`,
`queryHash`, `planShape`, `engine`, `orchestratorMs`, `rowsReturned`, `ts`,
`nlqdb_event`. It carries **one undifferentiated duration and no
cache-hit flag**, even though `cacheHit` is a live local in
`orchestrate.ts` and the cache-hit vs cache-miss split is the difference
between two different SLOs (200 ms vs 1.5 s p50). So the top three
hypotheses are indistinguishable in analytics today.

Minimum additions to make the next regression self-diagnosing — additive
fields only, per the events-pipeline schema-evolution rule:

- `cacheHit: boolean` — separates the two SLOs and directly tests H3.
- `planMs` / `execMs` (and `summarizeMs` when the summarize hop runs) —
  splits "the model was slow" from "the database was slow"; tests H1/H2/H4
  in one query.
- `plannerModel` / `plannerAttempts` (or a fallback-depth counter) — makes a
  404-ing head or a retried chain visible as a number instead of an
  inference from git history.

OTel spans already exist per stage ([`performance.md` §3–4](../performance.md)),
but the Grafana free-tier sampling makes them a poor fit for reconstructing a
14-event week; the event stream is the durable record at this volume.

## 5. Next steps

1. Land the `ask.completed` additions in §4 (small, additive, no new sink).
2. Re-pull this table one full week after the 2026-08-24 planner re-head
   (#1041): if the median returns to the ~1.5 s range, H1 is confirmed and
   the remaining work is a **guard**, not a fix.
3. Add a latency guard so this is caught by the system rather than by a
   monthly manual pull — the §1 SLO is already the stated threshold.
4. If the median does *not* recover, the `planMs`/`execMs` split from step 1
   discriminates H2 from H3/H4 on the next ~20 asks.

**Open question:** the SLO in `performance.md` §1 is written against
`/v1/ask` wall-clock, but the only durable measurement is the
orchestrator-internal `orchestratorMs`. Either the analyser publishes the
wall-clock number at this volume, or §1 gains an explicit
orchestrator-internal sub-budget so the two are comparable without a
footnote.
