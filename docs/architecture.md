# nlqdb — Architecture

> A database you talk to. You write HTML; each component asks for what it wants in plain English. nlqdb answers.

**Navigation:** [decisions.md](./decisions.md) (index of GLOBAL-NNN; bodies under [decisions/](./decisions/)) · [features/](./features/) for per-feature `FEATURE.md` decisions · [runbook.md](./runbook.md) for operations · [progress.md](./progress.md) for integration tiers

If a sentence here disagrees with a feature, **the feature wins**. This document owns: core values, system architecture, surface overviews, phase plan, tech-stack rationale, risks, and what we are explicitly not building.

---

## 0. Core values (non-negotiable)

Acceptance criteria for every PR. Violations don't ship.

- **Free.** Sign up, build, ship to production without a credit card. Forever.
- **Open source.** Core engine, CLI, MCP, SDKs — Apache-2.0. Cloud is a convenience, not a moat.
- **Simple.** One way to do each thing. Two endpoints, two CLI verbs, one chat box. No config in the first 60 seconds. Every error is one sentence with the next action. If a feature needs a tutorial, it failed.
- **Effortless UX.** Zero modals. Zero "are you sure" except for destructive actions. Keyboard-first. The chat is the product; everything else is a disclosure.
- **Seamless auth — one identity, four surfaces, zero friction.**
  - No login wall before first value. Anonymous-mode is the default (§4).
  - One Better Auth identity across web, CLI, and every MCP host.
  - Tokens refresh silently — users never see a 401.
  - `nlq mcp install` auto-detects installed hosts, signs in if needed, provisions a host-scoped key per host.
  - Credentials live in the OS keychain — never plaintext files.
  - Revocation is instant: every token listed with last-used, one click to revoke.
- **Fast.** p50 query < 400ms (cache hit), p95 < 1.5s (cache miss), cold start < 800ms. CLI binary < 8MB, starts < 30ms.
- **Goal-first, not DB-first.** No persona woke up wanting to "create a database." The DB is plumbing. See §0.1.
- **Bullet-proof by design, not by handling.** Make bad states unreachable:
  - Schemas only widen — no "schema mismatch" branch.
  - Every mutating call takes an `Idempotency-Key` — retries safe by construction.
  - Plans content-addressed by `(schema_hash, query_hash)` — no cache invalidation.
  - Destructive ops require diff preview + second confirm.

---

## 0.1 On-ramp inversion

No persona's goal is "create a database." The DB is a side effect of what they're trying to build. Every surface is reframed so the user's first action is stating a goal; the DB materializes as a consequence.

| Surface | Old (DB-first) | New (goal-first) |
|---|---|---|
| Marketing hero | "Name your database" | "What are you building?" |
| Platform first run | "Create database" button | Single chat input, DB created silently |
| CLI first command | `nlq db create orders` | `nlq new "an orders tracker"` |
| MCP first call | `nlqdb_create_database("memory")` | `nlqdb_query("memory", "remember…")` (DB auto-created) |
| `<nlq-data>` | `db="orders"` required | `goal="…"` leads; `db` inferred |
| HTTP API | multiple setup steps | `POST /v1/ask { "goal": "…" }` returns session + DB |

**Mechanism:** every entry point accepts a goal. The first call materializes a DB (slug + short hash), persists it under the caller's identity (or anonymous token), and returns a session containing the DB handle. The DB is always one flag away for power users — goal-first is the default, not the only way.

---

## 1. Vision

A developer writes plain HTML. They drop in a `<nlq-data>` element with a one-line English prompt: *"the 5 most-loved coffee shops in Berlin, with photos."* The element hits the nlqdb API, which (a) figures out which DB to query, (b) plans the query, (c) executes it, (d) returns rows + a rendered HTML fragment + a typed JSON payload. The developer wrote zero backend code. There is no schema, no ORM, no migrations, no SQL, no `DATABASE_URL`. nlqdb is **both the database and the backend**, addressed in natural language.

The four surfaces (Web, API, CLI, MCP) are four projections of the same engine. The marketing site is the fifth surface — built the same way users will build their own apps.

---

## 2. System architecture

```
                                    ┌──────────────────────────────────────┐
                                    │          nlqdb Core Engine           │
                                    │                                      │
   ┌──────────────┐    HTTPS        │   ┌────────────────────────────┐    │
   │ Marketing    │ ─────────────►  │   │  Edge Router (Cloudflare    │    │
   │ Site         │                 │   │  Workers, < 50ms global)    │    │
   │ (Astro)      │                 │   └──────────────┬─────────────┘    │
   └──────────────┘                 │                  │                  │
                                    │                  ▼                  │
   ┌──────────────┐                 │   ┌────────────────────────────┐    │
   │ Platform     │ ───── HTTPS ──► │   │  Auth & Quota (Better Auth │    │
   │ Web App      │                 │   │  + Workers KV)              │    │
   │ (Astro +     │                 │   └──────────────┬─────────────┘    │
   │  React       │                 │                  │                  │
   │  islands)    │                 │                  ▼                  │
   └──────────────┘                 │   ┌────────────────────────────┐    │
                                    │   │  Plan Cache (KV, content-  │    │
   ┌──────────────┐                 │   │  addressed by schema_hash) │    │
   │ CLI (`nlq`)  │ ─── HTTPS ───►  │   └──────┬──────────────┬──────┘    │
   │ Go binary    │                 │          │ HIT          │ MISS      │
   └──────────────┘                 │          ▼              ▼           │
                                    │   ┌──────────┐   ┌──────────────┐  │
   ┌──────────────┐                 │   │ Executor │   │ NL→Plan      │  │
   │ MCP Server   │ ─── HTTPS ───►  │   │ (Engine  │   │ Compiler     │  │
   │ (TypeScript) │                 │   │ adapter) │◄──┤ (LLM router) │  │
   └──────────────┘                 │   └────┬─────┘   └──────────────┘  │
                                    │        │                           │
   ┌──────────────┐                 │        ▼                           │
   │ <nlq-data>   │ ─── HTTPS ───►  │   ┌────────────────────────────┐  │
   │ HTML element │                 │   │ Engines: Postgres, ClickHouse│ │
   │ (any site)   │                 │   │ (Tinybird), Redis, ...      │  │
   └──────────────┘                 │   └────────────────────────────┘  │
                                    └──────────────────────────────────────┘
```

Five surfaces, one edge router, one core engine. No parallel implementations.

### 2.1 Domains

Canonical: **`nlqdb.com`** (`.ai` is held defensively and 301s to `.com`).

| Hostname | Purpose |
|---|---|
| `nlqdb.com` | Marketing site (§3.1). Primary entry + SEO. |
| `nlqdb.com/app` | Platform web app (§3.2). |
| `app.nlqdb.com` | HTTP API + auth. Versioned `/v1/…`. |
| `elements.nlqdb.com` | `<nlq-data>` JS CDN (§3.5). R2 + Cloudflare. |
| `docs.nlqdb.com` | Documentation. |

`.com` is canonical. `.ai` held to block squatters. `@nlqdb` secured on GitHub, npm, X, LinkedIn, Discord, Bluesky. Total fixed cost: ~$85/yr (the only unavoidable recurring cost).

---

## 3. Surfaces

> Decisions for each surface live in the corresponding `docs/features/<feature>/FEATURE.md`. What follows is a product spec (the *what*), not a decision record.

### 3.1 Marketing site — `nlqdb.com`

Canonical feature: `web-app/FEATURE.md` (`SK-WEB-001..007`). Hosted on Cloudflare Pages, Lighthouse 100/100/100/100.

Above the fold (top-to-bottom): goal-first input ("What are you building?"), tabbed code-example panel (HTML · React · Vue · Agent · curl, all rendering against the same demo DB), "what this replaces" scroll-driven strip, live anonymized query ticker.

**Creative direction:** neo-brutalist + terminal — thick borders, hard shadows, JetBrains Mono headlines, Acid Lime `#C6F432` on near-black `#0B0F0A`. No stock photos, no cookie banner (Plausible self-hosted).

Surfaces promised on the home page (full integration matrix in [`progress.md §10`](./progress.md)):

| Surface | Package | Status |
|---|---|---|
| HTML / web component | `@nlqdb/elements` | Phase 1 |
| JS/TS SDK | `@nlqdb/sdk` | Phase 1 |
| React / Next | `@nlqdb/next` | Phase 2 |
| Vue / Nuxt | `@nlqdb/nuxt` | Phase 2 |
| Agent (MCP) | `@nlqdb/mcp` | Phase 2 |
| HTTP / curl | `POST /v1/ask` | Phase 0 |

### 3.2 Platform web app — `nlqdb.com/app`

Canonical feature: `web-app/FEATURE.md`. Served at `nlqdb.com/app` (the API Worker owns `app.nlqdb.com`). Session cookie `__Secure-session` (HttpOnly, `Domain=.nlqdb.com`) read server-side via Astro frontmatter or a client-side `/api/auth/get-session` call.

Pages: **Chat** (answer/data/trace, Cmd+K palette, Cmd+/ trace toggle), **DB list** (left rail), **Settings** (API keys, billing, live $-counter), **Embed snippets** (copy `<nlq-data>` HTML with `pk_live_` pre-inlined).

### 3.3 CLI — `nlq`

Canonical feature: `cli/FEATURE.md` (`SK-CLI-001..015`). Static Go binary.

```
nlq                          # interactive REPL, creates DB silently
nlq new "an orders tracker"  # creates DB from goal, opens chat
nlq "how many signups today" # bare query against current DB
nlq login                    # device-code flow (browser)
nlq mcp install              # auto-detects MCP hosts and sets them up
```

Power-user: `nlq db create|list`, `nlq query <db> "…"`, `nlq use <db>`, `nlq connection <db>` (raw Postgres URL).

### 3.4 MCP server — `@nlqdb/mcp`

Canonical feature: `mcp-server/FEATURE.md` (`SK-MCP-001..007`). Two transports: **hosted** (`mcp.nlqdb.com`, paste-URL into host config, OAuth) and **local stdio** (`@nlqdb/mcp` via `nlq mcp install`). Three tools: `nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe` — no `nlqdb_create_database` (DB materializes on first `nlqdb_query` per §0.1).

### 3.5 `<nlq-data>` element

Canonical feature: `elements/FEATURE.md` (`SK-ELEM-001..008`). ESM bundle ≤6 KB.

```html
<script src="https://elements.nlqdb.com/v1.js" type="module"></script>

<!-- Goal-first (default): DB auto-created on first call -->
<nlq-data goal="5 most-loved coffee shops in Berlin" api-key="pk_live_..." template="card-grid"></nlq-data>

<!-- Power-user: explicit DB -->
<nlq-data db="coffee-shops" query="5 most-loved…" api-key="pk_live_..."></nlq-data>
```

### 3.6 Hosted db.create — typed-plan, validator, provisioner

The mechanism behind every "DB created silently" arrow in §0.1 and §3. The *why* behind each choice is in [`docs/research-receipts.md`](./research-receipts.md). Canonical feature: `hosted-db-create/FEATURE.md`.

#### 3.6.1 Endpoint shape

`/v1/ask` is the single create-or-query endpoint. No separate `/v1/db/new`.

```
POST /v1/ask
  Authorization: Bearer <pk_live_… | sk_live_…>     (or none → anon)
  Body: { "goal": "an orders tracker for my coffee shop",
          "db"?: "db_orders_tracker_a4f3b2",          // optional
          "name"?: "my coffee shop" }
```

A cheap classifier-tier LLM call decides `kind ∈ {create | query | write}`. `create` routes to the typed-plan pipeline; `query`/`write` route to the read/write orchestrator.

#### 3.6.2 Typed-plan pipeline (the create path)

```
goal → classifier (cheap tier)
         │ kind = "create"
         ▼
       schema-inference (planner tier, structured output)
         │ → SchemaPlan { tables[], columns[], foreign_keys[],
         │                metrics[], dimensions[], sample_rows[] }
         ▼
       Zod validator (identifier collisions, reserved words,
                      cross-tenant FKs, per-tenant table caps)
         ▼
       deterministic compiler (our code, not the LLM)
         │ emits CREATE TABLE / CREATE INDEX / FK constraints
         ▼
       libpg_query parse-validate (defense in depth)
         ▼
       provisioner: BEGIN
         CREATE SCHEMA, GRANT, DDL, sample_rows, D1 row, pgvector table-cards
       COMMIT (or ROLLBACK on any structural failure)
         ▼
       response: { db, pk_live, rows: [...sample],
                   plan: { metrics, dimensions, joins } }
```

**The LLM never emits raw DDL.** It emits a typed JSON plan; our deterministic compiler emits SQL. Collapses the prompt-injection surface to "what shape can the LLM force into the plan" — much smaller than "what SQL string can the LLM compose." See [`research-receipts.md §2`](./research-receipts.md).

#### 3.6.3 Semantic-layer moat

`SchemaPlan` carries `metrics` (named aggregations) and `dimensions` (named filterable attributes). Because we own the schema-creation moment, we auto-generate the semantic layer — the runtime benefits from the dbt/Cube/Cortex pattern even though the user never wrote one. No other shipped NL-Q product does this. See [`research-receipts.md §8`](./research-receipts.md). Phase 2 makes this baseline editable, OSI-compatible, and source-controlled — full plan in [`docs/future/semantic-layer.md`](./future/semantic-layer.md).

#### 3.6.4 Per-surface dbId resolution

`dbId` is fully optional in `/v1/ask`. Resolution is per-surface; on REST and the chat surface a cheap-tier LLM picks among 2+ candidates with a confidence floor (`SK-ASK-003` / `SK-HDC-005`). CLI / MCP stay deterministic.

| Surface | If `dbId` absent | Auth shape |
|---|---|---|
| HTML (`<nlq-data>`) | Resolved from `pk_live_<dbId>` key; keyless + goal → CREATE on first call | `pk_live_<dbId>` (per-db, read-only, origin-pinned) |
| REST + chat | 0 dbs → CREATE; 1 db → auto-target; 2+ → `llm.disambiguate` cheap-tier pick (≥ 0.7 confidence → auto-target with `selected_db` echo on response); else `409` with `candidate_dbs` ranked by LLM score | `Bearer sk_live_…` (REST) / session cookie (chat) |
| CLI | MRU + interactive `select`; `nlq new "<goal>"` always creates | `sk_live_…` from keychain |
| MCP | 0 dbs → CREATE; 1 db → auto-target; 2+ → MCP elicitation | `sk_mcp_<host>_<device>_…` |

The "silent wrong-tenant" failure mode the original deterministic-only rule guarded against (`docs/research-receipts.md §7`) is contained by three properties of the LLM path: a confidence floor (`≥ 0.7`), a visible `selected_db` echo on every response (chosen slug + reason — a wrong pick is immediately visible to the user, not silent), and one-click recovery via the rail. Destructive verbs still pass the SK-ASK-004 / SK-HDC-006 validator split + the SK-ONBOARD-004 confirm-diff gate; a wrong-tenant *destructive* call requires both a wrong LLM pick AND the user approving a diff that names the wrong table.

#### 3.6.5 Validator architecture — read/write vs DDL paths

| Path | Allowed verbs | Why this scope |
|---|---|---|
| **Read/write** (every query/write via `/v1/ask`) | `SELECT / INSERT / UPDATE / DELETE / WITH / EXPLAIN / SHOW` only. `CREATE / ALTER / DROP / TRUNCATE / GRANT / REVOKE / VACUUM` rejected. `EXPLAIN ANALYZE` rejected (executes). Multi-statement rejected. | LLM never has DDL rights through this path. |
| **DDL** (only from §3.6.2 typed-plan compiler) | Compiled `CREATE TABLE / CREATE INDEX / FK` only. `DROP / TRUNCATE / GRANT / REVOKE / pg_catalog / information_schema` rejected via AST. | Defense-in-depth: even our compiler's output is re-parsed with the Postgres parser before execution. |

Both paths follow the **layered guardrails** principle from [`research-receipts.md §1`](./research-receipts.md): AST reject-list, role isolation, RLS, statement timeout, transactional wrapper.

#### 3.6.6 Tenancy and storage

- **Phase 1:** every DB is a Postgres schema on one shared Neon branch. Isolation via `SET LOCAL search_path` + per-tenant role + RLS.
- **Phase 2b:** tier-based tenancy — Free/Hobby on shared, Pro+ on dedicated Neon branches. Same `connection_secret_ref` model; only the provisioner gets a branch-create path.
- **Phase 4:** BYO Postgres (§3.6.7). The modular split done now means BYO is a provisioner swap, not a rewrite.

#### 3.6.7 BYO Postgres (Phase 4, decided shape)

Not in Phase 1. Shape locked now to avoid painting into a corner:

- **Endpoint:** `POST /v1/db/connect { connection_url, name? }` — separate from `/v1/ask`.
- **Introspection:** `pg_catalog` query at connect time; generate one table-card per existing table. No `pg_dump`.
- **Secret-at-rest:** per-db AES-GCM blob in D1 with a Workers-held KEK (Workers Secret count is capped; per-user secrets don't scale; the blob model does).
- **Validator:** the read/write validator from §3.6.5 applies unchanged.
- **Provisioner split done now:** `provisionDb(plan)` vs `registerByoDb(connection_url, plan)`. Phase 4 work is replacing one function call, not rebuilding the pipeline.

**BYO contract.** nlqdb operates with the role's privileges; the validator (§3.6.5) fires on every nlqdb-mediated path including `/v1/run`. Out-of-band psql is the user's surface.

**Role model.** Each `dbId` stores up to three URLs: `read`, `write`, `admin`. `/v1/db/connect` accepts one admin URL and mints `nlqdb_read` / `nlqdb_write` via `CREATE ROLE` + `GRANT`; if `CREATE ROLE` is denied, falls back to a copy-paste SQL snippet for the missing URLs. `nlq role read|write|admin` flips the active role per `dbId`; default is `read`. `<nlq-data>` is hard-pinned to `read`. CLI prompt + chat pill + SDK response envelope echo the active role.

**Cancel on write.** Write and DDL queries run inside `BEGIN; … COMMIT;` with a live `executing for Xs [Cancel]` label. Cancel → `ROLLBACK` + `pg_cancel_backend(pid)`. Layered under `SK-TRUST-001` diff-confirm (pre-exec gate); this is the during-exec gate.

**Function reject-list.** Filesystem/network builtins (`pg_read_file`, `pg_ls_dir`, `lo_import`, `dblink*`, `COPY ... FROM PROGRAM`, `pg_sleep`) rejected by the validator (`SK-SQLAL-008`, sql-allowlist feature). User-defined functions opaque — user owns their DB.

Sibling concern for BYO ClickHouse: `readonly = 1` does *not* block DDL — see `docs/research/personas.md` P6 open questions.

#### 3.6.8 Rate limits on create

Free-tier abuse rules extend to db.create: per-IP 5 creates/hour, per-account 20 creates/day. PoW on signup if a wave of anonymous creates hits the bucket.

---

## 4. Auth & identity

Canonical features: `auth/FEATURE.md` (`SK-AUTH-001..012`), `api-keys/FEATURE.md` (`SK-APIKEYS-001..007`), `anonymous-mode/FEATURE.md` (`SK-ANON-001..006`).

**Library:** Better Auth (MIT, TypeScript) on Cloudflare Workers + D1. **Methods:** magic link (primary), passkey (promoted on second visit), GitHub OAuth, Google OAuth. No passwords ever.

**Anonymous mode:** opaque `localStorage` token (web) / OS-keychain token (CLI). DB lives 72h tied to the token; on sign-in, adoption is a one-row update with no conditional code paths.

**API key types:**

| Type | Scope | Used by |
|---|---|---|
| `pk_live_…` | Publishable, read-only, per-DB, origin-pinned | `<nlq-data>` |
| `sk_live_…` | Secret, server-only, full scope | Backend / HTTP API |
| `sk_mcp_<host>_<device>_…` | `sk_live_` + `(mcp_host, device_id)` claims | MCP server |

Hashed with Argon2id; last 4 chars cleartext for display. No plaintext retrieval — lost means rotate.

**Session lifecycle:**

| Surface | Auth | TTL | Refresh |
|---|---|---|---|
| Web | Magic link / passkey / OAuth | 1h access | 30d sliding in KV |
| CLI | Device-code (`nlq login`) | 1h access | 90d, rotated on use |
| MCP | `nlq mcp install` | n/a (key only) | Key rotation |
| Embed | `pk_live_` | n/a | Key rotation |

**Service-to-service:** the edge is the only component that sees external credentials; it signs a 30s internal JWT for all downstream calls. `@nlqdb/mcp` has zero DB-driver deps in its lockfile (CI-enforced).

**Revocation:** instant (≤2s), visible. Every credential listed with last-used; one-click revoke; affected surface re-prompts seamlessly. `GLOBAL-018` is the canonical revocation contract.

---

## 5. Pricing

Canonical: `GLOBAL-013` (strict-$0 free tier). Stripe ingest and subscription state decisions in `stripe-billing/FEATURE.md`. Premium-model routing in `premium-tier/FEATURE.md`.

**Constraint:** a real user must be able to ship a real product without paying us.

| Tier | Price | Limits | Card |
|---|---|---|---|
| **Free** | $0 forever | 1k queries/mo, 500MB/DB, pause after 7d idle (resume <2s), 7-day backups | No |
| **Hobby** | $10/mo | 50k queries/mo, 5GB/DB, no pausing, 30-day backups, email support | Yes |
| **Pro** | $25/mo min + usage | $0.0005/query over 50k, $0.10/GB-mo over 5GB; hard cap opt-in. LLM tokens **not** metered — Pro uses the strict-$0 chain same as Free | Yes |
| **Premium models** (add-on, Hobby+) | Pay-per-token | Frontier routing (Claude Sonnet 4.6 / GPT-5) for hard-plan queries. Provider list + 0% markup. The **only** thing that produces an LLM-tokens invoice line | Yes |
| **Enterprise** | Custom | VPC peering, SAML SSO, audit-log export, on-prem | Annual |

**Honest billing rules:** no card for free tier, ever. Hitting a limit rate-limits — never silently upgrades. Soft cap email at 80%; hard cap default at 100%. Export always free. Cancellation is one click, no call, no exit survey.

**Unit economics:** free user at 100 queries/mo costs ~$0.15–$0.40. Hobby margin target: 60–80% at target plan-cache hit rate. Pro margin target: 75%+ once self-hosted classifier is online.

---

## 6. $0/month launch stack

| Concern | Tool | Free tier |
|---|---|---|
| DNS / CDN / SSL / DDoS / WAF | Cloudflare Free plan | Unmetered CDN+DDoS; 5 custom rules, 5 WAF rules |
| Marketing site | Cloudflare Pages | Unlimited requests, 500 builds/mo |
| Edge compute | Cloudflare Workers | 100k req/day, 10ms CPU/req |
| Session / plan cache | Cloudflare KV | 100k reads/day, 1k writes/day |
| Control plane DB | Cloudflare D1 | 5M reads/day, 100k writes/day, 5GB |
| User DBs (Postgres) | Neon | 0.5GB, scale-to-zero |
| User DBs (Redis) | Upstash | 10k cmds/day, 256MB |
| Object storage / backups | Cloudflare R2 | 10GB, 1M Class A ops/mo, **zero egress** |
| Transactional email | Resend | 3k/mo, 100/day |
| Auth | Better Auth (OSS) | Free, no MAU fees |
| Payments | Stripe | 0% until first charge |
| Usage metering | Lago (self-hosted) | OSS, free |
| App errors | Sentry | 5k errors/mo |
| Web analytics | Plausible (self-hosted) | OSS, GDPR-exempt |
| Product events | LogSnag | 2,500 events/mo, 3 seats |
| Backend traces | Grafana Cloud | 10k metrics, 50GB logs |
| Long-running compute | Fly.io | 3 small machines, 3GB volumes |
| Domains | `nlqdb.com` + `nlqdb.ai` | **~$85/yr — only fixed cost** |
| LLM inference | See §7 strict-$0 path | $0 at launch scale |
| Code + CI | GitHub | Free for OSS, 2k Action min |

**Total at zero users:** ~$7/mo (domains amortized). At ~1k users / ~10k queries/day: still ~$0 with plan-cache; ~$30–60/mo otherwise (mostly LLM tokens).

**Single-vendor note:** Cloudflare concentration buys zero egress and the most generous free tier. We mitigate with a per-service adapter layer — if we need to leave, it's a week of work.

---

## 7. AI model selection

Canonical: `llm-router/FEATURE.md` (`SK-LLM-001..011`). Tables below are at-a-glance views; pricing is approximate as of April 2026.

| Job | Tier | Model |
|---|---|---|
| Hot-path classification (read/write/create triage) | 1 | GPT-5.4 Nano / Gemini 3.1 Flash-Lite |
| Schema embedding | 1 | Gemini 3.1 Embeddings / bge-m3 self-host |
| NL → query plan (~80% of LLM cost) | 2 | Claude Sonnet 4.6 |
| Hard plans / multi-engine reasoning (≤5%) | 3 | Claude Opus 4.7 |
| Result summarization | 1 | GPT-5.4 Nano / DeepSeek V3.2 |
| Workload analyzer (batch) | 3 | Opus 4.7 / Gemini 3.1 Pro |

### 7.1 Strict-$0 inference path (Day 1, no credits, no card)

| Job | Provider | Free limit | Card |
|---|---|---|---|
| Classification | Groq — Llama 3.1 8B Instant | 14,400 RPD / 500k TPD | No |
| NL → query plan | Google AI Studio — Gemini 2.5 Flash | 500 RPD / 250k TPM | No |
| Hard-plan fallback | Google AI Studio — Gemini 2.5 Pro | 100 RPD | No |
| Summarization | Groq — Llama 3.3 70B / Qwen3 32B | 1,000 RPD | No |
| Embeddings | Cloudflare Workers AI — bge-base-en-v1.5 | 10,000 Neurons/day | No |
| Universal fallback | OpenRouter — `qwen/qwen3-coder:free` (plan / schema_infer); Llama 3.x `:free` (route / summarize) | 50 RPD anon / 1,000 RPD after a one-time $10 deposit | No (deposit unlocks the 1k tier and is kept even if balance falls to $0) |

**Capacity:** ~500 plan generations/day + ~14,400 classifications/day → ~2–4k user queries/day after the plan cache. Covers Phase 1 with headroom.

**Total cost to add intelligence Day 1: $0.**

Env vars: `GEMINI_API_KEY`, `GROQ_API_KEY`, `CF_AI_TOKEN`, `OPENROUTER_API_KEY`.

### 7.2 Cost-control mitigations, in priority order

Features reference these by number (e.g. "cost-control rule 3"). Canonical detail in `llm-router/FEATURE.md`.

1. **Plan cache by fingerprint — 60–80% hit rate, bypasses LLM entirely.** Every `/v1/ask` request hits the plan cache before any LLM call. Cache key = `(schema_hash, query_fingerprint)`. Expected steady-state hit rate 60–80%; covers the majority of production traffic with no model cost. (`SK-LLM-010`, `GLOBAL-006`)
2. **Small-model first, big-model on fallback.** Hot-path classification and summarization run on the cheapest tier (Tier 1). The plan tier (Tier 2, Claude Sonnet 4.6) fires only on cache miss. Hard-plan reasoning (Tier 3, Opus 4.7) handles ≤5% of queries. (`SK-LLM-001`)
3. **Prompt caching on every provider that supports it — ~80% input-token reduction.** System prompts and few-shot examples are pinned and sent with provider prompt-caching headers (Anthropic `cache_control`, OpenAI cached tokens, AI Gateway response cache). Repeated schema-context tokens cost near-zero after the first call. (`SK-LLM-009`)
4. **No summarization for structured-output (API) callers.** When the caller sets `Accept: application/json`, the summarize step is skipped entirely. Summarization is a UX feature for chat surfaces, not a correctness requirement. (`SK-ASK-005`)
5. **Self-host the classifier at ~50 k queries/day.** Once classify-tier hosted cost crosses the flat-Modal threshold (~50 k/day), a quantized 8B Llama on a single A10G (~$200/mo) replaces the per-call Groq cost. Plan and hard tiers stay on hosted providers indefinitely. (`SK-LLM-011`)

---

## 8. What we are NOT building

To avoid scope creep — these are deliberate decisions, not oversights. Re-evaluate after Phase 3 exit gate, not before.

- A visual schema editor (the schema is invisible)
- A query builder (you type English)
- A migrations tool (schemas only widen; `nlq new` makes a fresh DB for schema breaks)
- A mobile app (web app is responsive; that's enough)
- A "low-code" workflow builder (`<nlq-data>` is the workflow builder)
- A dashboard / BI product (showcase examples exist; the platform is not a BI tool)
- On-prem before Phase 4
- Real-time subscriptions / changefeeds (Phase 2 as `<nlq-stream>`)
- A GraphQL API (REST + embed + MCP are enough)
- A "Sign in with nlqdb" identity provider

**What we deliberately reinvent** (the rest is boring-tool choices):
1. **The query router** — no existing router picks between PG / ClickHouse / Redis / D1 based on a live workload fingerprint.
2. **The NL → plan compiler** — existing text-to-SQL libraries are demos; they don't handle schema drift, don't stream, don't do multi-engine, don't expose trace.
3. **The migration orchestrator with dual-read verification** — no off-the-shelf tool does cross-engine migration safely.

**What we do NOT reinvent:** auth (Better Auth), payments (Stripe + Lago), transport (MCP TypeScript SDK), SQL parsers (`pg_query`, `sqlparser-rs`).

---

## 9. CI/CD

A dedicated `nlqdb/actions` repo owns one reusable workflow (`.github/workflows/ci.yml@v1`) and composite actions (`setup`, `llm-changelog`, `deploy-cloudflare`). Every consumer repo has a 4-line `ci.yml`:

```yaml
jobs:
  ci:
    uses: nlqdb/actions/.github/workflows/ci.yml@v1
    with:  { run-release: true }
    secrets: inherit
```

**Properties:** auto-detects language from `package.json` / `go.mod` / `pyproject.toml`. Cancels in-flight runs on same ref. Cached aggressively (Bun install, Go build, uv). Fast-fail order: lint → typecheck → test → build → scan → release.

**Lint/format stack:** Biome for JS/TS/JSON/CSS; gofumpt + golangci-lint for Go; ruff for Python. Devs run the same commands locally via lefthook pre-commit hooks.

**Conventions:** Conventional Commits (commit-lint in `lint:`); LLM-generated `CHANGELOG.md` via `llm-changelog` (Sonnet 4.6); `changesets` for npm, tag-driven for Go. Every PR gets a sticky comment with build-size / coverage / p95-bench deltas + preview-deploy link.

---

## 10. Phase plan

Moved to its own file to keep this doc under the 20 KB D4 shard cap.
The phase plan is the canonical roadmap: items per phase, exit gates,
the §6 monetization trigger that supersedes the old "Stripe in Phase 2".

→ [**`./phase-plan.md`**](./phase-plan.md)

---

## 11. Alternative technologies (evaluated, not just listed)

We lean toward tools with real APIs, generous free tiers, and no mandatory UI step. UI-first vendors are disqualified — we cannot automate them.

### Data engines

| Candidate | Verdict | Notes |
|---|---|---|
| **Postgres (Neon)** | ✅ primary | Branching, serverless, generous free tier, HTTP API. |
| **Postgres (Supabase)** | ⚠️ backup | Great DX but opinionated (auth, storage bundled). |
| **Postgres (RDS/Aurora)** | ❌ Phase 2+ at scale | Slow to provision, expensive idle. |
| **Postgres (self-hosted on Fly)** | ✅ considered | Full control, API-provisionable. Heavier operationally. |
| **SQLite (Turso / libSQL)** | ✅ edge + small DBs | Replicated, HTTP API, very cheap. |
| **ClickHouse (Tinybird)** | ✅ second engine | Free 10 GB / 1 k reads/day; Pipes = daily-reshape. |
| **Redis (Upstash)** | ✅ deferred | HTTP; counters/leaderboards. |
| **pgvector** | ✅ default vector | Stays in PG. |
| **TimescaleDB** | ✅ time-series default | PG extension — no new engine. |
| **MongoDB Atlas** | ⚠️ | Good API, tiny free tier. Prefer JSONB on PG unless must. |
| **FaunaDB** | ❌ | Vendor lock + pricing opacity. |
| **PlanetScale** | ❌ post-Vitess changes | Re-evaluate later. |

### Hosting / compute

| Candidate | Verdict | Notes |
|---|---|---|
| **Cloudflare Workers + R2 + D1** | ✅ edge + cheap egress | R2 zero egress is huge for us. |
| **Fly.io Machines** | ✅ primary long-running compute | API-first, per-second billing. |
| **Vercel** | ✅ frontend only | Not for stateful workloads. |
| **AWS** | ❌ Phase 1 | Too heavy, too slow to iterate. Revisit Phase 3 for enterprise. |
| **Modal** | ✅ LLM workers | Great Python API, scales to zero. |

### Auth

| Candidate | Verdict |
|---|---|
| **Better Auth** (TS, OSS, MIT) | ✅ chosen — see `auth/FEATURE.md` |
| **Clerk** | ❌ per-MAU pricing cliff, user-shape lock-in |
| **WorkOS AuthKit** | ⚠️ keep for enterprise SSO later |
| **Supabase Auth** | ❌ pulls in whole Supabase |

### Payments

| Candidate | Verdict |
|---|---|
| **Stripe** | ✅ default |
| **Lago** (self-hosted) | ✅ usage metering layer in front of Stripe |
| **Paddle** | ⚠️ MoR model nice for int'l; more restrictive |

### LLM providers

| Candidate | Verdict |
|---|---|
| **Anthropic (Claude)** | ✅ primary — reasoning + tool-use quality |
| **OpenAI** | ✅ fallback + cheap-small-model tier |
| **Groq / Fireworks / Together** | ✅ cheap classifier models (latency wins) |
| **Local (Llama via vLLM)** | ✅ schema-embedding + hot-path classifier once traffic justifies |

---

## 12. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| LLM costs kill margins | High | Plan cache (60–80% hit rate); small-model-first chain; local classifier once traffic justifies. |
| Cross-engine migration corrupts data | Medium | Dual-read verification, staged rollout, chaos tests, reversible cutover. |
| "Simple" is too simple for serious workloads | Medium | Always-available escape hatches: raw connection string, raw SQL, raw Mongo. |
| LLM hallucinates column names → confident wrong answers | High | Static schema validation after plan gen; confidence gate; structured output. |
| Free-tier abuse | Medium | Per-IP + per-account rate limits day 1; PoW on signup if needed; anomaly detection Phase 2. |
| Vendor lock (Neon, Anthropic) | Medium | Adapter layer for each; quarterly "can we swap this in a week" drill. |
| Someone ships a better text-to-SQL inside Postgres in 18 months | Real | Our moat is multi-engine auto-migration, not NL→SQL. Stay focused on Phase 3. |
| Competitors with deeper pockets (Supabase, Vercel, MongoDB) | High | We out-focus them. They sell platforms; we sell one experience. |

---

## 13. Hello-world e2e fullstack tutorial — the 1-pager

Published copy lives at `nlqdb.com/hello-world` (the canonical surface readers actually hit). Source for that page is in the `apps/web` repo; this doc no longer mirrors it.
