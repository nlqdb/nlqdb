# GLOBAL-043 — Attach-first: the autonomous DBA acts on the database a team already has

**Status:** active · **Set by the founder:** 2026-10-22 · **Supersedes:**
[`GLOBAL-041`](./GLOBAL-041-autonomous-dba.md) items 1–2 (host the DB, infer
the schema from inserts), its Phase A/B/C plan and KPIs 1–2;
[`GLOBAL-004`](./GLOBAL-004-logical-schema-evolves.md) in part (inference
from inserts); the migrate-onto-nlqdb goal of
[`GLOBAL-042`](./GLOBAL-042-dogfood-iteration-loop.md) and its iteration 001.
The mission ([`END_GOAL.md`](../END_GOAL.md#mission)) and GLOBAL-042's
iterate → retro → cleanup loop stand.

- **Decision:** nlqdb is the autonomous DBA that **attaches** to the
  database a team already has and acts on it safely through one
  deterministic loop: **observe → propose → apply → verify → revert**.
  1. **Attach, don't host.** nlqdb is never on the app's request path. The
     hosted-DB / infer-from-inserts path is retired from the product.
  2. **Engines.** Postgres (Supabase, Neon, RDS, any) is the primary,
     market engine. Cloudflare D1 is engine #2 and the live
     dogfood: the real rateme12 runs on D1. One loop, per-engine observers
     behind the `packages/db` adapter seam — no per-engine branch.
  3. **No LLM in any hot path.** The LLM runs only async — explaining a
     proposal, naming an enum, suggesting a retype, writing migration text.
  4. **A proposal is one object, recorded in the ledger** with its diff,
     inverse, before/after measurement, cost, and **who decided** — a human
     user, an agent principal (API key or MCP session) or an auto-apply
     policy. Auto-apply is **off by default**: a proposal waits for one
     click; per-category auto-apply is opt-in later. **Auto-revert on
     regression is always on and identical for every principal** — an
     agent's bad apply reverts exactly like a human's.
  5. **Two verbs, every door:** `apply` and `reject` — web click; CLI
     `nlqdb apply <id>` / `nlqdb reject <id>`; API
     `POST /v1/proposals/:id/apply|reject` via `@nlqdb/sdk`; MCP
     `nlqdb_list_proposals`, `nlqdb_apply_proposal`,
     `nlqdb_reject_proposal` ([`GLOBAL-003`](./GLOBAL-003-all-surfaces-one-pr.md)).
     An agent may approve any proposal the owner could apply with one
     click — the human's ceiling, never above; the owner can restrict
     agent approvals per category in `/app/dba`. A reject records
     the reason given, for the playbook to learn from async.
  6. **Four onboarding doors, one first proposal within minutes:** (a) paste
     a connection string at nlqdb.com; (b) `npx nlqdb attach <connection-string>`;
     (c) `POST /v1/attach` via `@nlqdb/sdk`; (d) MCP — the coding agent
     (Claude Code, Cursor) attaches the DB it just created. D1 attaches with
     a Cloudflare API token + account id + database id instead of a string —
     same doors, same proposal object. Agent-native onboarding is the
     distribution bet.
  7. **Data tiers (Postgres).** Tier 0 catalog — schema, constraints, FKs
     without indexes, `pg_stats` selectivity, sizes, `pg_settings`. Tier 1
     workload — `pg_stat_statements` fingerprints (calls, mean/total/stddev
     time, rows, cache hits), `pg_stat_user_tables`/`_indexes` (seq vs idx scans,
     dead tuples, unused indexes); cumulative, so snapshot-and-diff over
     days. Tier 2 what-if — `EXPLAIN` + HypoPG where the host has it
     (Supabase, Neon; not RDS), else `pg_stats` heuristics and the verify
     window judges. Tier 3 truth — re-read Tier 1 for the same fingerprints
     after apply → p95 delta → keep, or revert if it is > 10 % worse
     (`GLOBAL-041` KPI 3's regression bound). `pg_stat_statements` keeps
     no percentiles, so the Postgres p95 is estimated per window as
     mean + 1.65 σ from the diffed counters and labelled an estimate
     ([pgMustard](https://www.pgmustard.com/blog/approximate-the-p99-of-a-query-with-pgstatstatements)). The verify window is 72 h on
     both engines until the spike measures when each engine's counters
     settle (Azure: 30 min–72 h). Roles: observe = `pg_read_all_stats` +
     `SELECT` on the app's tables (`pg_stats` and `EXPLAIN` cover only
     readable tables); apply = membership in the role that owns the tables
     (Postgres lets only a table's owner create or drop its indexes),
     `CREATE INDEX CONCURRENTLY`. That membership could also `ALTER`,
     `TRUNCATE` or `DROP`; nlqdb runs under it only a proposal's DDL or its
     stored inverse, each passing the kept `libpg_query` validator against
     that proposal kind's verb set (index kinds: `CREATE`/`DROP INDEX`).
     **D1:** Tier 1 = the sampled
     `d1QueriesAdaptiveGroups` analytics (query, rows read/written, time,
     [docs](https://developers.cloudflare.com/d1/observability/metrics-analytics/));
     Tiers 0/2 = `PRAGMA index_list`/`table_info` + `EXPLAIN QUERY PLAN`, no
     hypothetical index; apply = `CREATE INDEX` over the REST API within
     D1's 30 s cap; KPI B also counts rows-read cost. Details:
     [`002`](../history/dogfood-iterations/002-rateme12-attach.md).
  8. **The playbook grows on the same loop**, in order: unindexed FKs,
     missing / slow-fingerprint indexes, unused-index drops,
     bloat/autovacuum, retype/enum proposals, partitioning at size
     thresholds, retention crons, then sharding / engine placement. Each is
     a proposal kind; none is a special case.
  9. **Engine KPIs** (the engine pillar of
     [`GLOBAL-025`](./GLOBAL-025-north-star.md)):
     **KPI A** time-to-first-proposal after attach, target < 5 min.
     **KPI B** proposals applied with a measured p95 improvement, per
     attached DB per 30 d (the former KPI 3), target > 0 on every attached
     DB with a workload. **KPI C** regressions
     auto-reverted / regressions applied, target 100 % with 0 user action.
     KPIs 1–2 (first-insert inference, evolution) are retired. **Love
     gate:** ≥ 3 of the first ~10 founder-recruited builders return
     unprompted in their second week; Show HN waits on it.
  10. **The decisive test is a 2-week spike** on a real-traffic Postgres the
      founder picks: proposals from Tiers 0–2, ONE index applied, before/after
      p95 on its hot fingerprint, recorded with its inverse. **Pass** = a
      measured delta the founder would pay for ⇒ the deletion PR series
      starts. **Fail** = evidence, nothing deleted. The D1 dogfood runs
      in parallel ([`002-rateme12-attach.md`](../history/dogfood-iterations/002-rateme12-attach.md)).

- **Core value:** Simple, Bullet-proof, Effortless UX, Honest latency

- **Why:** The write path is already deterministic —
  `apps/api/src/insert/orchestrate.ts` makes 0 LLM calls — yet after
  ~10 weeks the KPI-1 formal sample is **n = 0**: all DBA value was gated on
  migrating a database onto nlqdb, and not even rateme12 got there. The
  optimizer on `main` is a stub: no `pg_stat_*`, `EXPLAIN` or HypoPG code;
  `dispatchPgAdvisory` (`apps/api/src/workload-analyser/cron.ts`) writes only
  an audit row and its ClickHouse Pipe is `PLACEHOLDER_PIPE_SQL`; its fingerprint is a SHA-256 of the NL goal
  text (`apps/api/src/ask/plan-cache.ts`) timed with LLM latency included;
  `/v1/insert` and `/v1/run` emit no query event (`apps/api/src/index.ts`);
  ledger inverses are never run (`apps/web/src/components/dba/DbaPanel.tsx`).
  The databases that need a DBA already exist elsewhere: Databricks
  bought Neon (~$1 B) saying > 80 % of its databases were agent-provisioned
  ([TechRepublic](https://www.techrepublic.com/article/news-databricks-neon-acquisition/));
  Supabase (raised $150 M, Oct 2026) says ~70 % of new databases are
  agent-created ([Pulse 2.0](https://pulse2.com/supabase-raises-150-million-and-acquires-turso/)).
  Those apps ship with PKs/FKs but no secondary indexes
  ([witscode](https://witscode.com/blogs/supabase-indexing),
  [dev.to](https://dev.to/jakub_inithouse/5-supabase-mistakes-we-catch-in-every-vibecoded-app-audit-at-inithouse-4bj8))
  and often open RLS (57 % of reachable Supabase apps allowed
  unauthenticated reads in one Aug 2026 scan,
  [vibe-eval](https://vibe-eval.com/updates/vibe-coding-security-monthly-aug-2026/)).
  Supabase's `index_advisor` is single-column B-tree and report-only
  ([dbi-services](https://www.dbi-services.com/blog/enhancing-postgresql-performance-with-index-advisor-and-hypopg/)).
  The one proven auto-apply loop, Azure SQL automatic tuning, ships index
  create/drop **off** by default, applies in low-load windows, verifies for
  30 min–72 h and reverts on regression
  ([Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-sql/database/automatic-tuning-overview))
  — the model adopted here. OtterTune's tuning worked, yet it shut
  down in 2024 on onboarding and stickiness
  ([Pavlo](https://x.com/andy_pavlo/status/1801687420330770841),
  [HN](https://news.ycombinator.com/item?id=40682165)): onboarding here is
  one paste or one tool call, stickiness a measured delta in the ledger.
  Attach tools price low — pganalyze $149–399/mo
  ([pricing](https://pganalyze.com/pricing)), Postgres.ai from $62
  ([pricing](https://postgres.ai/pricing)) — so the spike
  must prove a delta someone pays for before anything is deleted. No-schema
  precedents converged on explicit schema: Xata moved to vanilla Postgres
  ([Xata](https://xata.io/blog/open-source-postgres-branching-copy-on-write)),
  MongoDB added validation in 3.6
  ([MongoDB](https://mongodb.com/blog/post/busting-top-myths-about-mongodb-vs-relational-databases)),
  Convex validates once a schema exists
  ([Convex](https://docs.convex.dev/api/interfaces/server.DefineSchemaOptions)).
  The real rateme12 runs on D1 and is starting to scale: a dogfood with real
  traffic, which the clone never had. D1 is the dogfood engine, Postgres the
  market; Cloudflare may ship its own recommender
  ([docs PR](https://github.com/cloudflare/cloudflare-docs/pull/32323)).

- **Consequence in code & docs:**
  - **Roadmap — the `/daily` step-2 sequence**, each item with its number:
    1. **Postgres spike** (market proof; `SPIKE_PG_URL`) **and D1 attach on
       the real rateme12** (dogfood; `RATEME12_D1_TOKEN`) — runs may
       alternate; each ends with a measured delta. Numbers: KPI A on attach;
       KPI B = 1 applied index with its before/after p95.
    2. **Deletion PR series** — one subsystem per PR, deletion-only, CI
       green. Number: LOC removed, KPIs A–C unchanged.
    3. **Playbook proposal kinds** in item 8's order, Postgres and D1 each.
       Number: KPI B per kind, KPI C held at 100 %.
  - **KPIs A–C and the love gate live only here**; `GLOBAL-025`'s engine
    row routes here.
  - **Deletion list (after a pass):** the hosted/infer path (`insert()` +
    widen: `apps/api/src/insert/**`, `db-create/**` provisioning and
    compile-write-ddl, tenant roles), the NL-specific `/v1/ask` machinery,
    `tools/eval` (BIRD/Spider), anonymous mode, agent-memory and
    expert-knowledge rails, ICP-mining / GTM / PMF, marketing content pages,
    other-language SDKs and framework wrappers, the rateme12 clone
    (`apps/rateme12`) — one per PR. The dogfood canary stays a regression
    check until `insert()` goes.
  - **Kept and reused:** the `dba_changes` ledger (migration `0038`), the
    `libpg_query` DDL validator, the BYO egress guard + sealed secrets
    (`GLOBAL-031`, `GLOBAL-035`), `packages/db` adapters, OTel, the job
    table, API keys.
  - Every apply / reject / revert carries `Idempotency-Key`
    ([`GLOBAL-005`](./GLOBAL-005-idempotency-key.md)) and an OTel span
    ([`GLOBAL-014`](./GLOBAL-014-otel-on-external-calls.md)); Postgres
    indexes build `CONCURRENTLY` in a low-load window. A role that cannot
    apply gets each proposal as a copy-paste migration — never a silent skip.
  - **Carried from `GLOBAL-041`, unchanged:** acquisition paused and depth
    only; the ~10 builders are recruited once rateme12's attach shows
    KPI B > 0; the shipped premium tier stays; BIRD/Spider is a regression
    alarm until deleted.

- **Alternatives rejected:**
  - **Keep hosting + inference (`GLOBAL-041`)** — value gated on a
    migration nobody made; n = 0 after ~10 weeks.
  - **Migrate rateme12 onto nlqdb (iteration 001)** — the same gate; the
    clone never had real traffic.
  - **Recommend-only advisor** — Dexter, `index_advisor`, pganalyze exist;
    the value is apply + verify + revert.
  - **Auto-apply on by default** — Azure ships it off; trust is earned per
    category.
  - **An LLM in the hot path** — nondeterministic, quota-bound.
  - **Build a better host** — Supabase and Neon own capital and
    distribution; attaching rides it.
  - **Human-only approvals** — most new DBs are agent-created; one ceiling
    and one revert guard for every principal.
  - **A loop per engine** — D1 differs only in observer and apply call.
