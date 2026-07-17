# SK-PIVOT-011 — The TTL sweep is a server-built constant `DELETE`, `facts`-only, with per-DB failure isolation

- **Decision:** E-04's expiry sweep is a deterministic, server-built
  `DELETE FROM facts WHERE expires_at IS NOT NULL AND expires_at < $1` (cutoff
  bound, never LLM-composed), run **per memory-preset DB with one DB's failure
  isolated** so the rest still sweep. It targets `facts` only — `episodes` and
  `entities` have no `expires_at` (append-only / long-lived by E-01 DDL). The pure core
  (`apps/api/src/memory/expire.ts`: `buildExpirySweep` + `orchestrateSweep`)
  ships ahead of the cron Worker (infra) and the read-side TTL-invisibility
  clause on E-03's `facts` RLS `USING` policy (E-03-gated).
- **Core value:** Bullet-proof, Honest, Simple
- **Why:** Same trust boundary as the write verb (SK-PIVOT-008) — the only
  thing consulted is `facts.expires_at` and the cutoff is a bound param, so the
  LLM never composes the SQL. Per-DB isolation keeps one unreachable tenant DB
  from aborting the whole nightly sweep. Proving the primitive offline (the
  E-02 pattern) lets the EX-irrelevant infra (a Neon-reachable scheduled
  Worker) land separately without blocking the testable spine.
- **Consequence in code:** `expire.ts` is import-free of any prod path this run
  (no route, no schedule), so engine/chain/scorer/BIRD+Spider baselines are
  untouched; the cron Worker will call `orchestrateSweep` and emit
  `nlqdb.memory.expire` + `nlqdb.memory.expired_rows_total` from
  `SweepSummary.expiredRows`. The read-side invisibility is **not** a
  compile-layer predicate (the read path is free-form LLM SQL — nothing to
  inject into); it extends E-03's RLS `USING` clause.
- **Alternatives rejected:** **One global `DELETE` across all memory DBs** —
  cross-tenant SQL, breaks per-DB isolation and the tenant search_path model. ·
  **A view / compile-layer TTL filter for read invisibility** — the read path
  executes the raw LLM SQL string via `neonSql.query(sql, [])`; there is no
  AST step to inject a predicate into (the SK-PIVOT-009 finding). · **Sweep `episodes`/`entities` too** —
  they have no `expires_at` and are append-only / long-lived by design (a
  wrongly-set `ttlSeconds` on them is rejected write-side with a one-sentence
  error, GLOBAL-012).
