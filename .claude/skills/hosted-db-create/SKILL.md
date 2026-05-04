---
name: hosted-db-create
description: Hosted db.create — typed-plan SchemaPlan, deterministic DDL compiler, Zod + libpg_query validation, provisioner, semantic layer at create-time.
when-to-load:
  globs:
    - apps/api/src/db-create/**
    - apps/api/src/ask/classifier.ts
    - apps/api/src/ask/sql-validate-ddl.ts
    - packages/llm/src/prompts/schema-inference.ts
  topics: [db.create, typed-plan, schema-inference, schema-plan, provisioner, semantic-layer, ddl, classifier, dbid-resolution]
---

# Feature: Hosted db.create

**One-liner:** Goal-string in, working multi-table Postgres database out — typed-plan pipeline, deterministic DDL compiler, semantic layer auto-generated at create-time.
**Status:** planned (Phase 1 — design locked in [`docs/architecture.md` §3.6](../../docs/architecture.md), implementation pending)
**Owners (code):**
- `apps/api/src/db-create/**` (orchestrator, infer-schema, compile-ddl, neon-provision)
- `apps/api/src/ask/classifier.ts` (kind classifier on the `/v1/ask` entry)
- `apps/api/src/ask/sql-validate-ddl.ts` (DDL-path validator, separate from the read/write allowlist)
- `packages/llm/src/prompts/schema-inference.ts` (typed-plan prompt)

**Cross-refs:** docs/architecture.md §3.6.1–§3.6.8 (canonical) · docs/architecture.md §10 §4 (Phase 1 slice — sub-modules, anonymous-db lifecycle, exit gate) · docs/research-receipts.md §1 (Replit incident → layered guardrails), §2 (Cortex Analyst + SchemaAgent → typed plans), §7 (deterministic dbId fallbacks > LLM disambiguation), §8 (semantic-layer-at-create moat) · GLOBAL-005, GLOBAL-014, GLOBAL-017, GLOBAL-020 (see governing-GLOBALs section below)

**Sibling skills to read alongside:**
- `.claude/skills/ask-pipeline/SKILL.md` — the classifier branches off the existing `/v1/ask` orchestrator; this skill owns the `kind=create` arm
- `.claude/skills/db-adapter/SKILL.md` — the provisioner uses the adapter; SK-DB-007 (schema-per-DB tenancy) and SK-DB-008 (ALTER TABLE ADD COLUMN NULL) constrain what we emit
- `.claude/skills/llm-router/SKILL.md` — the classifier and schema-inference are LLM calls; provider routing + cost accounting belongs there
- `.claude/skills/sql-allowlist/SKILL.md` — owns the read/write validator; SK-HDC-006 here owns the DDL-path validator that sits next to it

## Touchpoints — read this skill before editing

- `apps/api/src/db-create/**` (canonical implementation: orchestrator + sub-modules)
- `apps/api/src/ask/classifier.ts` (cheap-tier kind classifier; routes `kind=create` here)
- `apps/api/src/ask/sql-validate-ddl.ts` (DDL validator path; split from read/write allowlist)
- `apps/api/src/ask/orchestrate.ts` (the consumer that delegates `kind=create` to this skill)
- `packages/llm/src/prompts/schema-inference.ts` (the typed-plan prompt)
- `packages/db/src/types.ts` (`SchemaPlan` lives near the adapter types)

## Decisions

### SK-HDC-001 — One classifier-routed endpoint: `/v1/ask` does create, query, and write

- **Decision:** There is no `/v1/db/new`. `POST /v1/ask` accepts a `goal`, a cheap classifier-tier LLM call decides `kind ∈ {"create" | "query" | "write"}`, and `kind=create` routes to the typed-plan pipeline owned by this skill. `kind=query` and `kind=write` continue to use the existing read/write orchestrator.
- **Core value:** Simple, Goal-first
- **Why:** `GLOBAL-017` says one way to do each thing. No persona ever woke up wanting to "create a database" (`docs/runbook.md §10`); they want a meal-planner, an agent that remembers, a number for the 4pm sync. A separate "create" endpoint forces every surface to add a "are you starting fresh?" branch — exactly the DB-first framing `docs/architecture.md §0.1` rejects. Folding create into `/v1/ask` lets `<nlq-data>` work with no `db=` attribute, lets MCP work with no setup tool, and keeps the SDK / CLI / MCP surface symmetric.
- **Consequence in code:** The `/v1/ask` handler runs the classifier first; `kind=create` calls `db-create/orchestrate.ts`, `kind=query`/`kind=write` call the existing `ask/orchestrate.ts`. New endpoints for create are rejected at review. Surfaces (`<nlq-data>`, CLI, MCP, SDK) never branch on "create vs query" — they pass the goal and the API decides.
- **Alternatives rejected:**
  - `/v1/db/new` separate endpoint — forces every surface to add a "is this a new db?" branch; contradicts `GLOBAL-017` and the goal-first framing in `docs/architecture.md §0.1`.
  - Heuristic in the surface ("if no `db=`, call create") — pushes routing logic to N surfaces; drifts; the LLM classifier stays in one place.

### SK-HDC-002 — LLM emits a typed `SchemaPlan`; our deterministic compiler emits SQL

- **Decision:** The schema-inference LLM call returns a typed JSON object (`SchemaPlan { tables[], columns[], foreign_keys[], metrics[], dimensions[], sample_rows[] }`) with structured-output enforced. The LLM **never emits raw DDL**. A deterministic compiler (our code, not the LLM) emits `CREATE TABLE` / `CREATE INDEX` / FK constraint statements from the validated plan.
- **Core value:** Bullet-proof, Simple
- **Why:** This collapses the prompt-injection surface from "what SQL string can the LLM compose" to "what shape can the LLM force into a plan" — much smaller, much easier to enumerate. It matches the [Cortex Analyst](https://www.snowflake.com/en/engineering-blog/cortex-analyst-text-to-sql-accuracy-bi/) and [SchemaAgent](https://arxiv.org/html/2503.23886) lessons in `docs/research-receipts.md §2`. It is also a hard precondition for the layered-guardrails posture (`docs/research-receipts.md §1`, the Replit-incident lesson): no LLM-authored DDL ever reaches the executor.
- **Consequence in code:** `apps/api/src/db-create/infer-schema.ts` returns a `SchemaPlan` validated by Zod (`packages/db/src/types.ts`). `apps/api/src/db-create/compile-ddl.ts` is the only file that emits DDL strings; PRs that add LLM-authored SQL anywhere on the create path fail review. New `SchemaPlan` fields require a Zod schema update first — the compiler refuses to consume fields the validator doesn't know about.
- **Alternatives rejected:**
  - LLM emits SQL directly — every prompt-injection vector becomes "compose SQL." Replit's incident is the named example; we don't replicate it.
  - LLM emits an intermediate SQL-like DSL — same surface area as SQL, just less testable. Typed JSON has a finite, validated grammar.

### SK-HDC-003 — Defense in depth: Zod over the plan + libpg_query parse over the compiled DDL

- **Decision:** Every create runs **two** validators in series: (1) Zod over the `SchemaPlan` rejects identifier collisions, reserved-word use, cross-tenant FK refs, and per-tenant table-count caps; (2) libpg_query parses the compiler's output and rejects anything containing `DROP / TRUNCATE / GRANT / REVOKE / pg_catalog / information_schema` — even though our compiler authored the SQL.
- **Core value:** Bullet-proof
- **Why:** Layered guardrails is the explicit lesson from `docs/research-receipts.md §1` (the Replit incident): AST-level reject-list, role isolation, RLS, statement timeout, transactional wrapper. None of these alone suffices. The Zod layer catches plan-shape errors (LLM hallucination); libpg_query catches compiler regressions (our bugs). Skipping either gives us one bug away from a bad statement reaching the executor.
- **Consequence in code:** `apps/api/src/db-create/orchestrate.ts` calls Zod-validate before compile, and libpg_query parse-validate after compile, before the provisioner sees the SQL. Both layers are exhaustively tested. PRs that bypass either layer fail review. The libpg_query parse catches `EXPLAIN ANALYZE` (executes), multi-statement strings, and DDL-verb leaks the same way the read/write allowlist does (`SK-SQLAL-*`) — same primitives, separate validator instance because the allowed-verb set is different (`SK-HDC-006`).
- **Alternatives rejected:**
  - Trust the typed plan — works until the compiler regresses; the parse layer is cheap (libpg_query is fast).
  - Trust the parser only — Zod catches plan-shape problems libpg_query can't (cross-tenant FK refs, reserved words) because they parse fine but are semantically wrong.

### SK-HDC-004 — Semantic layer (`metrics` + `dimensions`) is generated at create-time, in the same plan

- **Decision:** The `SchemaPlan` carries `metrics` (named aggregations: `monthly_revenue := SUM(amount) WHERE status='paid' GROUP BY month`) and `dimensions` (named filterable attributes: `customer_segment := CASE WHEN ltv > 5000 THEN 'enterprise' ELSE 'smb' END`). The schema-inference call generates them in the same pass that designs the tables, and the provisioner persists them alongside the schema. They are not optional and not deferred to a later "semantic config" step.
- **Core value:** Creative, Goal-first
- **Why:** No other shipped NL-Q product auto-creates the database — but every shipped enterprise NL-Q product (Cortex Semantic View, Power BI Q&A model, ThoughtSpot Worksheet, Tableau Pulse Metrics, dbt MetricFlow, Cube) depends on a curated semantic layer to give accurate answers. Because we own the schema-creation moment, we generate the semantic layer for free — the runtime gets the dbt/Cube/Cortex pattern without the user ever writing one. This is the unique position; deferring semantic-layer generation means competing with the same teams on the same ground (`docs/research-receipts.md §8`).
- **Consequence in code:** The `SchemaPlan` Zod schema includes `metrics` and `dimensions` as required arrays (empty allowed; absent rejected). Phase 2's user-editable `semantic.yml` (see [§ Semantic layer — Phase 2 design](#semantic-layer--phase-2-design) below) reads from this baseline — the auto-generated version is the seed, not a placeholder. The `/v1/ask` planner consumes `metrics`/`dimensions` for query routing; PRs that ignore them fail review.
- **Alternatives rejected:**
  - Generate schema first, semantic layer later — splits the moment we have the goal in hand; second LLM call costs more and may disagree with the first.
  - Skip semantic generation, rely on the planner to infer at query time — every query repeats the same inference; latency and cost both go up; accuracy is worse without the named-metric grounding.

### SK-HDC-005 — Per-surface `dbId` resolution is deterministic; we never LLM-guess "which db did you mean"

- **Decision:** When `dbId` is absent on `/v1/ask`, resolution is fully deterministic per surface: HTML uses the `pk_live_<dbId>` per-db key (CREATE on first call if no key); REST returns `409 Conflict` with `{ candidate_dbs: [...] }` when the account has 2+ dbs; CLI prompts interactively (MRU + select); MCP elicits a clarifying-question response. We do **not** run an LLM-based "which db is this goal about" heuristic in Phase 1.
- **Core value:** Bullet-proof, Honest latency
- **Why:** The failure mode of guessing wrong silently is worse than asking. A wrong-db query against a multi-tenant account exposes the wrong rows or fails confusingly; MCP agents can act on incorrect data. The prior art that pushed this decision is in `docs/research-receipts.md §7`. Asking back has zero friction on agent surfaces (MCP elicitation is the protocol's intended path); it has tolerable friction on REST (the `409` includes `candidate_dbs` so the client picks). HTML resolves deterministically via the per-db key, so the embed case has no UX cost.
- **Consequence in code:** No code path in `/v1/ask` calls the LLM to disambiguate `dbId`. Each surface implements its own deterministic fallback (table in `docs/architecture.md §3.6.4`). MCP servers return an elicitation payload; CLI prints a numbered list; REST returns `409 candidate_dbs`. Schema-match scoring (LLM-driven heuristic disambiguation) is **deferred to Phase 2+**.
- **Alternatives rejected:**
  - LLM picks the most-similar-looking db — silent wrong-tenant data exposure when the LLM is wrong; unrecoverable from the user's POV.
  - Always require `dbId` — kills the goal-first framing on HTML and breaks the "drop a tag, get a working db" promise (`docs/architecture.md §0.1`).

### SK-HDC-006 — Two validator paths: read/write (allowlist) vs DDL (allowlist + libpg_query parse)

- **Decision:** Two distinct SQL validators, exhaustively tested, with non-overlapping responsibilities. The **read/write** path (`apps/api/src/ask/sql-validate.ts`, owned by `sql-allowlist` skill) allows `SELECT / INSERT / UPDATE / DELETE / WITH / EXPLAIN / SHOW` and rejects `CREATE / ALTER / DROP / TRUNCATE / GRANT / REVOKE / VACUUM` and `EXPLAIN ANALYZE`. The **DDL** path (`apps/api/src/ask/sql-validate-ddl.ts`, owned by this skill) allows the compiler's `CREATE TABLE / CREATE INDEX / FK constraints` and rejects the same destructive verbs (`DROP / TRUNCATE / GRANT / REVOKE / pg_catalog / information_schema`).
- **Core value:** Bullet-proof, Simple
- **Why:** The LLM never has DDL rights through `/v1/ask`'s read/write path. The only legitimate `CREATE` comes from this skill's typed-plan compiler — which is our code, not the LLM. Two validators (instead of one with conditional verb sets) make each one trivially auditable: every line of the read/write validator says "no DDL"; every line of the DDL validator says "compiler-shaped DDL only." A reviewer asking "could the LLM ever execute `DROP`?" reads one short file and is done.
- **Consequence in code:** The two validator files share the libpg_query primitives but ship as separate exports. PRs that try to "merge them for DRY" are rejected — duplication is the point. Both validators are called from the orchestrators (read/write from `ask/orchestrate.ts`, DDL from `db-create/orchestrate.ts`); neither orchestrator ever calls the other's validator. Cross-link enforced in `sql-allowlist/SKILL.md` SK-SQLAL-*.
- **Alternatives rejected:**
  - One validator with verb-set parameter — the conditional becomes the audit risk; "trust me, in DDL mode it allows CREATE" is exactly the kind of branch we're trying to remove.
  - Drop the DDL validator (compiler is trusted) — defeats `SK-HDC-003`'s defense-in-depth lesson. Compiler bugs happen.

### SK-HDC-007 — Provisioner abstraction split now: `provisionDb(plan)` vs `registerByoDb(connection_url, plan)`

- **Decision:** The Phase 1 provisioner is split into two functions from day one: `provisionDb(plan)` creates a Postgres schema on the shared Neon branch (Phase 1 default per `SK-DB-007`); `registerByoDb(connection_url, plan)` is a stub that throws `NotImplementedError` until Phase 4. Both share the same executor + validator path. The split lives in code from the first commit even though only `provisionDb` is wired.
- **Core value:** Simple, Bullet-proof
- **Why:** Phase 4's BYO Postgres (`docs/architecture.md §3.6.7`) is decided shape — separate endpoint, introspect via `pg_catalog`, secret-at-rest as encrypted blob, validator inheritance. If we don't split now, the Phase 4 work becomes "rebuild the pipeline." Splitting day one means Phase 4 is a single function-body fill-in. The cost today is two function names and an unused export; the saving in Phase 4 is the difference between a refactor PR and a feature PR.
- **Consequence in code:** `apps/api/src/db-create/orchestrate.ts` accepts an injected `provision: ProvisionFn` parameter. Phase 1 wires `provisionDb`; Phase 4 wires `registerByoDb` for the BYO `POST /v1/db/connect` endpoint. Tests use the seam to inject fakes (mirrors `SK-DB-006`'s `query` injection pattern). PRs that fold the two functions back into one are rejected with a pointer to this decision.
- **Alternatives rejected:**
  - Single `provision(plan, opts)` with `byo: true` flag — same conditional-as-audit-risk problem as SK-HDC-006; the BYO path needs a different role grant model and a different secret-handling path that don't belong behind a flag.
  - Defer the split until Phase 4 — proven pattern: the deferred split never gets done before the Phase-4 PR turns into a rewrite.

### SK-HDC-008 — Per-IP and per-account rate caps on create; PoW on signup if abused

- **Decision:** Hosted db.create is rate-limited at two layers: **per-IP** at 5 creates/hour for anonymous/un-authed callers; **per-account** at 20 creates/day for authed callers. If a wave of anonymous creates hits the per-IP bucket, signup adds a [hashcash-style](https://en.wikipedia.org/wiki/Hashcash) Proof-of-Work challenge before the create proceeds. These caps live in the rate-limit middleware (`SK-RL-*` ownership) but are surfaced here because their values are tuned to the create cost (Neon DDL + LLM call ≈ 800ms + $0.0005 to us at the classifier tier).
- **Core value:** Bullet-proof, Free
- **Why:** Without caps, a single botnet can exhaust our Neon DDL budget and our classifier-tier credits in minutes. The numbers come from `docs/architecture.md §10 §8`'s free-tier abuse rules, which budget 200 launch-day signups against the DDL execution rate. PoW on signup is the [Hashcash](https://en.wikipedia.org/wiki/Hashcash) tradition: it costs an attacker N×CPU per request while costing legitimate users 200ms. Card-on-file would be cheaper to enforce but contradicts `GLOBAL-013` (free tier, no card).
- **Consequence in code:** `apps/api/src/ask/classifier.ts` checks `kind=create` against the per-IP/per-account limiter before calling `db-create/orchestrate.ts`. Limit values are configured in `apps/api/wrangler.toml` (so they can be tuned without code change). On 429, the response includes the standard `X-RateLimit-*` headers (`SK-RL-*`). PoW is wired only when the per-IP bucket trips system-wide for >5min — not on every signup.
- **Alternatives rejected:**
  - Card-on-file gate before create — kills `GLOBAL-013` ("$0/month for the free tier"); kills the `<nlq-data>` anonymous flow.
  - Single global rate limit — mis-incentivises one abuser to cap everyone; per-IP isolation is the standard pattern.
  - Captcha — bad UX (anonymous embed flow has no place to put it); PoW is invisible to the user when off, transparent when on.

### SK-HDC-009 — SQL injection: identifiers asserted, literals escaped, values parameterised

- **Decision:** The provisioner is the last-mile defense against SQL injection in the create path, even though the LLM-emitted plan is Zod-validated upstream (SK-HDC-002) and the compiled DDL is libpg_query-parsed (SK-HDC-003). Three rules at the executor level:
  1. **Identifiers** (schema, table, column, role names) MUST pass an `assertSafeIdentifier` regex check (`^[a-zA-Z_][a-zA-Z0-9_]*$`, length ≤ 63) before being interpolated into a double-quoted form. A rejected identifier throws — no fallback "sanitize and continue" path exists.
  2. **Values** (sample-row column values) MUST be passed as parameters (`$1, $2, …`) — never string-interpolated. Sample-row INSERTs use the parameterised form unconditionally.
  3. **Literals** (the tenant_id embedded in `CREATE POLICY USING (... = '<tenant_id>')`, where Postgres DDL accepts no parameters) MUST be passed through `escapeSqlLiteral` (single-quote doubling, the canonical Postgres escape) before interpolation. The surrounding `'…'` quotes plus the doubled internal `''` together prevent literal-breakout.
- **Core value:** Bullet-proof
- **Why:** The Zod and libpg_query layers are upstream guards — they catch *plan-shape* and *parser-level* problems but don't address the executor's own string-handling. A compiler regression that emits an unquoted identifier, or an upstream validator that misses an exotic Unicode quote variant, would slip through both upper layers; the executor's own checks catch them. The identifier whitelist is intentionally narrower than Postgres allows (no quoted identifiers with embedded characters, no Unicode names) so the regex is auditable in one line. This mirrors the layered-guardrails posture from `docs/research-receipts.md §1` (the Replit incident lesson) — none of the layers alone suffices, and the executor's check is the one the user's data physically traverses.
- **Consequence in code:** `apps/api/src/db-create/neon-provision.ts` exports nothing that bypasses these checks: `assertSafeIdentifier` and `escapeSqlLiteral` are local helpers, called on every interpolation site. Tests under `provisionDb — input validation (SK-HDC-009)` cover the malicious-identifier paths (quote-injection in `dbId`, table name, column name, plus the 63-char limit). PRs that add a new interpolation site without going through the helpers fail review. Where Postgres parameters work (`$1` placeholders), they MUST be used; the only literal-interpolation site is the `CREATE POLICY USING` clause, because Postgres DDL accepts no parameters there.
- **Alternatives rejected:**
  - Trust the upstream Zod + libpg_query layers — defeats the layered-guardrails posture; one upstream regression and the executor sends bad SQL to Neon.
  - Use Postgres's `quote_ident()` / `format()` server-side — requires shipping the raw identifier to the server, which is exactly the surface we're trying to remove. The check belongs at the boundary, not after the wire crossing.
  - Allow quoted identifiers with embedded characters (the full Postgres identifier grammar) — auditability cost outweighs the (zero) benefit; we control the upstream compiler and never need exotic identifier shapes.

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
  - *In this skill:* db.create is a mutation. The `(user_id, key)` store dedupes the entire pipeline — classifier + LLM call + DDL + provision — so a retried create returns the same `{ db, pk_live, rows, plan }` byte-for-byte and never double-allocates a Postgres schema. Anonymous-mode callers (no `user_id`) dedupe by `(anon_device_id, key)` from the 72h `localStorage` token (`SK-AUTH-*`).
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
  - *In this skill:* the create path emits four spans per call: `llm.classify` (cheap-tier `kind` decision), `llm.schema_infer` (planner-tier SchemaPlan generation), `db.query` (per-statement; provisioner emits one per `CREATE TABLE` / `CREATE INDEX` / sample-row insert), `db.transaction` (the BEGIN…COMMIT wrapping the DDL batch). All match `docs/performance.md` §3 names; new spans land in the catalog before they land in code.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
  - *In this skill:* SK-HDC-001 is the direct application of this GLOBAL on the create surface — `/v1/ask` does create, query, and write; there is no `/v1/db/new`. Phase 4's BYO connect *is* a separate endpoint (`POST /v1/db/connect` per `docs/architecture.md §3.6.7`) because it's an authoring action with different auth shape, not a data operation; SK-HDC-001 explicitly carves that exception.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.
  - *In this skill:* the create path is the load-bearing implementation of this GLOBAL. `<nlq-data goal="…">` with no `db=` and no key triggers anonymous create on first hit, returns rows, and stashes a 72h `localStorage` token — zero config, zero file, zero region picker. Anonymous-db lifecycle is owned by the `anonymous-mode` skill (90-day TTL, 10 MB per-db cap, pressure-sweep at 300 MB total per `docs/runbook.md`).

## Open questions / known unknowns

- **Classifier accuracy on ambiguous goals** — "show me last week's signups for my coffee shop" could be `kind=create` (no db yet) or `kind=query` (db exists). Resolution is per-surface (SK-HDC-005), but the classifier's confidence threshold for routing to create vs prompting for clarification isn't yet tuned. Open: do we pick a single threshold, or tier it per-surface?
- **`SchemaPlan` type-system breadth** — Phase 1 ships `text / int / numeric / timestamptz / uuid / boolean / jsonb`. Open: when does `enum` (Postgres native) land — Phase 1 or Phase 2? `enum` interacts with `SK-DB-008` (schemas only widen) because adding an enum value is `ALTER TYPE`, not `ADD COLUMN`.
- **Sample-row generation** — the typed-plan includes `sample_rows[]` so the user sees data on first hit. Open: are samples LLM-generated (creative but possibly wrong) or template-generated (boring but always plausible)? `docs/research-receipts.md` doesn't decide this.
- **Multi-statement transactional boundary** — `BEGIN; CREATE SCHEMA; CREATE TABLEs; INSERT samples; INSERT INTO databases; pgvector cards; COMMIT;` is the happy path. Open: if pgvector embedding fails (Workers AI rate limit) after the schema is created, do we ROLLBACK the whole thing or COMMIT and queue the embed? The latter leaks an un-embedded db; the former wastes a successful schema create. Cross-link to `events-pipeline` for the queue option.
- **Per-tenant table-count cap** — Zod rejects plans with too many tables, but the cap value (10? 25? 50?) isn't yet decided. Free-tier abuse rules in `docs/architecture.md §10 §8` need to inform this.
- **Phase 4 BYO connect introspection cost** — `pg_catalog` reads + LLM-written table-card descriptions on first connect. Open: do we charge for the connect-time embedding work against the user's free-tier credits, or absorb it as onboarding cost? Cross-link to `llm-router` SK-LLM-* (credit accounting).

## Semantic layer — Phase 2 design

**Why:** the 2025–2026 NL-to-SQL frontier diverged hard from raw-schema introspection. dbt's 2026 benchmark reports up to **3× accuracy** when the LLM queries through a curated semantic model rather than raw `information_schema` columns; Snowflake Cortex Analyst, Databricks Genie, Wren AI, and the Open Semantic Interchange (OSI) standard all converge on semantic-first NL2SQL. Full receipts in `docs/research-receipts.md §8`.

**Relationship to `db.create`.** The typed-plan output of `db.create` already carries `metrics` and `dimensions`. Phase 1 emits an auto-generated baseline at create time; Phase 2 makes it editable, OSI-compatible, and source-controlled. The auto-baseline is the seed, not a parallel system.

**Shape of the Phase 2 ship:**

1. **OSI-compatible YAML** at `~/.nlqdb/semantic.yml` (or per-DB in the registry). Compatible subset of MetricFlow + OSI shape — `entities`, `dimensions`, `metrics`, `joins`. The user's existing dbt MetricFlow / Cube / LookML dump becomes the source of truth.
2. **Optional, not required.** Without `semantic.yml` the planner still works against raw schema. With it, the LLM's `plan` prompt receives the curated dimensions/metrics list instead of (or in addition to) the raw schema dump.
3. **`nlq semantic init`** — bootstraps a starter `semantic.yml` from the live schema by inferring entities and 5–10 obvious metrics. User edits, commits to repo. (Alternative path: export the `db.create` auto-baseline directly — no inference needed.)
4. **Semantic-aware allow-list.** `apps/api/src/ask/sql-validate.ts` gains an optional pass that verifies referenced columns belong to dimensions/metrics declared in `semantic.yml`. Mis-references fail with `semantic_violation` instead of leaking schema.
5. **Cache key** includes the `semantic.yml` fingerprint so the cached schema hash invalidates when a metric is renamed.

**Out of scope for Phase 2:** authoring UI, multi-engine semantic projection (BigQuery/Snowflake-specific dialects via sqlglot transpile), semantic-layer marketplace.

**Deferred decisions:**

- Whether to ingest dbt MetricFlow `*.yml` directly (would force a Python sidecar via `metricflow-semantics`) or only the OSI-standardized subset. Lean OSI to keep the Worker bundle clean; revisit if a customer asks for native MetricFlow.
- Caching strategy for embeddings of dimension descriptions (pgvector on Neon vs Cloudflare Vectorize). Vectorize wins on operational simplicity; benchmark before committing.
