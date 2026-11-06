# Roadmap

The task queue for `GLOBAL-043`
([attach-first](decisions/GLOBAL-043-attach-first-autonomous-dba.md)). Order is
priority; one box is one merged PR; a done box is deleted (git holds it). The
scheduled run takes the first open, unblocked, unclaimed box
([`/daily`](../.claude/commands/daily.md) step 2). Each box moves a step of
[`END_GOAL.md`](END_GOAL.md) and names its number: KPIs A–C and the love gate
are defined in `GLOBAL-043` item 9.

## 1a — Build the attach product on synthetic databases

No founder secret. Each box is tested in CI against a seeded Postgres with
`pg_stat_statements` (HypoPG where installable) or a throwaway D1 in nlqdb's
own Cloudflare account. Number: KPI A, B or C on the synthetic DB, labelled
synthetic.

- [ ] D1 verify: the `dba_verify` job re-reads Tier 1 on an applied D1 index and auto-reverts a regression — KPI C on a synthetic D1
- [ ] D1 through the CLI, MCP and web doors (`nlq attach`, `nlqdb_connect_database`, `/app/connect`) with token + account id + database id — doors reaching the D1 loop

## 1b — Real-traffic proof

Postgres spike (market proof, `SPIKE_PG_URL`, `GLOBAL-043` item 10) and the
D1 attach on the real rateme12 (dogfood, `RATEME12_D1_TOKEN`,
[`002`](history/dogfood-iterations/002-rateme12-attach.md)). Number: KPI A on
attach; KPI B = one applied index with its before/after p95 (D1: and rows
read).

- [ ] Spike: Tier 1 proposes a `create_index` from the spike's app fingerprints (today 28/32 planned, 0 proposed)
- [ ] Spike: apply ONE index (`CONCURRENTLY`, low-load window), record its hot fingerprint's before/after p95 with the inverse — the founder calls pass/fail
- [ ] rateme12: attach its live D1 read-only through the API door — KPI A on a real D1
- [ ] rateme12: apply one D1 proposal, record p95 and rows read before/after — KPI B on a real D1

## 2 — Deletion PR series

Only after the spike passes. One subsystem per PR, deletion-only, CI green.
Number: LOC removed, KPIs A–C unchanged.

- [ ] The hosted / infer path: `insert()` + widen (`apps/api/src/insert/**`), `db-create/**` provisioning and compile-write-ddl, tenant roles
- [ ] The NL-specific `/v1/ask` machinery ⛔ see blocked-by-human.md (which pieces)
- [ ] `tools/eval` (BIRD / Spider)
- [ ] Anonymous mode
- [ ] Agent-memory and expert-knowledge rails
- [ ] ICP-mining, GTM metrics, PMF survey
- [ ] Marketing content pages
- [ ] Other-language SDKs and framework wrappers

## 3 — Playbook proposal kinds

Postgres and D1 each. Number: KPI B per kind, KPI C held at 100 %.

- [ ] Unused-index drops
- [ ] Bloat / autovacuum
- [ ] Retype / enum proposals
- [ ] Partitioning at size thresholds
- [ ] Retention crons
- [ ] Sharding / engine placement

## Sequencing rationale

1a needs no secret, so it runs first and builds every instrument 1b
measures with. A 1b track starts once its secret is set and 1a's boxes for
its engine are merged, then outranks 1a; the two 1b tracks may alternate. The
spike is the market proof: its pass is the only thing that unlocks deletion,
because deleting before a measured delta would discard the fallback with no
evidence the bet works. Deletion goes in `GLOBAL-043`'s list order (largest
surface first), and the playbook follows `GLOBAL-043` item 8's order, so each
kind reuses the loop the previous one proved.
