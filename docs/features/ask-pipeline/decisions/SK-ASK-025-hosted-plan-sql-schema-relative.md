# SK-ASK-025 — Hosted plan SQL is schema-relative (the plan cache stores no physical schema name)

- **Decision:** For hosted Postgres DBs, `/v1/ask` normalises plan SQL to
  **schema-relative** form before it is validated, executed, and cached:
  the DB's own physical schema qualifier (`"<schema>".` / `<schema>.`,
  where `<schema>` = `dbId` minus the `db_` prefix) is stripped, and the
  exec-time `search_path` (already set to that schema by
  `buildHostedExecSteps`) resolves the bare name. Two helpers in
  `apps/api/src/ask/plan-normalize.ts`: `schemaRelativeSql` (deterministic
  string strip on the exact, unique schema token — no SQL rewrite) and
  `referencesQualifiedTable` (read-only AST check). BYO / ClickHouse rows
  (a `connectionBlob`) are exempt — they run the plan verbatim.
- **Core value:** Bullet-proof, Free, Fast
- **Why:** The plan cache key is `(schema_hash, query_hash)` and **only**
  that ([GLOBAL-006](../../../decisions/GLOBAL-006-plan-cache-content-addressing.md)
  / SK-PLAN-002), whose load-bearing premise is *"identical schema + query
  ⇒ identical SQL regardless of tenant."* But `schema_hash` fingerprints
  the **logical** `SchemaPlan`, while the physical schema name is minted
  per-DB from the `dbId` at provision time and baked into the DDL that
  seeds the planner prompt — so the LLM emits `FROM "<schema>"."users"`,
  and two structurally-identical DBs (e.g. every DB from one preset — the
  e2e `users` fixture, real duplicate-schema signups) **collide on the
  cache key while the cached SQL names a foreign schema**. The second DB
  gets a `42P01` ("relation `other_schema.users` does not exist") because
  its least-privilege role has USAGE only on its own schema — the exact
  cross-schema read `SET LOCAL ROLE` is designed to fail closed
  (`build-deps.ts`). Root-caused from a durable `diag:schema_mismatch` KV
  row (SK-ASK-023): `pgCode 42P01`, `dbId db_users_11d170`, plan
  `users_d31c65.users`, `cacheHit true`. Stripping the physical name
  **restores** the SK-PLAN-002 invariant — plans become genuinely portable
  — and aligns plan SQL with the search_path-relative isolation model.
- **Consequence in code:** `orchestrate.ts` derives `hostedSchema` once,
  applies `schemaRelativeSql` on both the cache-hit `planSql` and the
  freshly-planned SQL (before `validateSql`, so what is validated is what
  runs and what is cached). A cache **hit** whose SQL still names a schema
  after own-stripping was baked by a *different* DB (a pre-normalisation
  poisoned entry): it is dropped (`cached = null`) and re-planned, and the
  gated cache-write (SK-ASK-015) overwrites it schema-relative. This is an
  automatic, in-band correctness re-plan for an entry proven inapplicable —
  **not** a cache-version bump or manual flush (SK-PLAN-003 stands): no
  key-prefix change, no TTL lever, no flush API. Poisoned entries self-heal
  on first touch; no operational KV surgery.
- **Alternatives rejected:**
  - **Add `dbId` / physical-schema to the cache key** — directly
    contradicts SK-PLAN-002 / GLOBAL-006 and kills the cross-DB hit rate
    the cache exists for.
  - **Bump the `plan:` key prefix to evict poisoned entries** — the exact
    move SK-PLAN-003 and SK-PLAN-009 reject; the self-heal-on-read makes it
    unnecessary.
  - **Strip the schema by feeding the planner unqualified DDL only** — a
    real improvement to the prompt, but leaves the correctness property at
    the mercy of the LLM re-qualifying, and does not neutralise entries
    already in KV; the deterministic strip + self-heal is bullet-proof.
  - **Generic AST rewrite (`sqlify`) of every plan** — `sqlify` is not used
    anywhere on the exec path today; reformatting correctness-critical SQL
    on every request is higher risk than a targeted strip of a known token.
