# nlqdb — Development Guidelines

Four habits that keep Phase 0 lean. Apply before writing non-trivial
code; refer back during review.

---

## 1. Reach for a small mature package before building

If the work is minimal logic, or well-trodden ground (routing, JWT
signing, retry/backoff, OTel transport, CSV parsing), first look for
a small, widely-used, actively-maintained package. Only DIY if
nothing fits — or if every candidate brings in too much.

**Lean is non-negotiable.** We'd rather write 30 lines than add a
200 KB framework for one helper. The Workers Free-tier bundle
ceiling is real (3 MiB compressed); the cognitive ceiling on
"transitive deps a future maintainer must understand" is tighter.

Hard-pass criteria:

- RC / pre-1.0 on the critical path (we declined `@microlabs/otel-cf-workers@1.0.0-rc.x`).
- Last release > 12 months ago, or open-PR backlog deeper than the
  release cadence.
- Pulls a heavy peer-dep tree we didn't already have.

Examples that landed this way:

- ✅ [Hono](https://hono.dev) for Workers routing — small, ubiquitous, type-safe.
- ✅ `@neondatabase/serverless` for the Postgres HTTP driver.
- ✅ `@opentelemetry/*` (stable releases, composed behind a thin in-house wrapper) instead of an RC Workers helper.

## 2. Research before DIY

If you decide to build it yourself, spend 10 minutes finding how the
canonical implementations do it *before* writing any code. The
answer is almost always free online.

Sources, in order:

1. The official spec (OTel Semantic Conventions, IETF RFCs, the
   product's own protocol docs).
2. The reference implementation in a popular library
   (e.g. `@opentelemetry/instrumentation-pg` for SQL operation
   extraction).
3. The most-starred TypeScript / Workers / Bun example matching the
   shape of the problem.

A 10-minute Google search is cheaper than shipping a subtly wrong
implementation and catching it in production.

Concrete example in this repo: `detectOperation` in `@nlqdb/db`
mirrors `@opentelemetry/instrumentation-pg`'s first-keyword
extraction. Copying their proven pattern saved us from missing CTE
/ DDL / TCL cases that the original CRUD allowlist silently bucketed
to `OTHER`.

## 3. Eagle-eye overview at all times

Every change must fit the broader system. Before opening the editor,
mentally re-read:

- The current slice's scope in [`apps/api/README.md`](../apps/api/README.md). Don't pre-empt future slices.
- The span / metric / label catalog in [`./performance.md §3`](./performance.md#3-span--metric--label-catalog). No one-off names.
- The package's role in [`./architecture.md §2`](./architecture.md#2-system-architecture). A change that's locally clean but breaks the system shape is worse than the bug it was fixing.
- Whether [`./runbook.md`](./runbook.md) or any package README drifts when this lands. If yes, update both in the same PR.

Symptoms of having lost the overview:

- Adding a label not in PERFORMANCE §3.3.
- Naming a Worker binding `NLQDB_*` (we use bare names — single-Worker convention).
- Implementing tenant-aware caching when the current slice has no tenants yet.
- Adding a route directly in `apps/api/src/index.ts` without a corresponding entry in the slice plan.

## 4. Developer experience is part of the spec

Every exported function, hook, and config struct ships with DX as an
explicit goal:

- **Minimal required params.** Optional with sensible defaults. If
  the caller passes five options to call you, your internals leaked.
- **One way to do the common thing.** Multiple call shapes for one
  concept is a footgun.
- **Types that autocomplete.** Template literal types, narrow unions,
  branded IDs — not bare `string`.
- **Errors that say what to do next.** `"NEON_API_KEY not set —
  run scripts/bootstrap-dev.sh"` beats `"Error: missing"`.
- **Idempotency + lifecycle clarity.** Setup functions document
  whether they cache / can be called twice safely.
- **Test seams that don't leak production internals.** A test
  override should be the smallest functional shape, not the whole
  underlying client. (See `createPostgresAdapter({ query })` — tests
  inject one function instead of mocking a Neon driver.)

A function whose JSDoc explains *how to call it* has already failed
DX. Make the call site obvious enough that no doc is needed.

Examples that pass:

- `setupTelemetry({ … })` — single call, idempotent, opt-in via env;
  works in tests by default (no-op when `GRAFANA_*` are unset).
- `createPostgresAdapter({ query })` — `query` injection point for
  tests, no need to fake the Neon client.
- `scripts/migrate-d1.sh local|remote` — one positional arg, no
  flags to memorise.

## 5. Logs tell a story, not the novel

An operator opening logs cold should be able to read down the
timeline and answer: **what was attempted, where did we land, what
failed and why**. Nothing more.

The non-negotiables:

- **One useful line per decision point.** Not per iteration, not per
  function entry. A failover happened? One line. A provider's API
  key wasn't configured at boot? One line. The chain is exhausted?
  One line with the per-attempt summary.
- **Errors get structured context.** Not `Error: failed`. Include
  the *what* (operation, provider, URL), the *why* (status code,
  upstream message, truncated body), and any actionable next step.
  `POST https://api.groq.com/v1/chat/completions → 429: rate limit
  exceeded, retry in 60s` beats `http error`.
- **Successes don't need logs.** Spans + metrics already tell that
  story. If you're tempted to log "got response", it's because you
  don't trust the trace — fix the trace.
- **Hot paths log at most once per request, and only on failure.**
  A `/v1/ask` that succeeds emits zero application logs. Spans cover
  the timeline; metrics cover the rates.
- **Never log secrets, full prompts, full result rows, or PII.**
  Tenant IDs and request IDs only. Truncate any user input or
  upstream body to ~200 chars before it lands in a log line — if
  the truncation hides the issue, raise the cap deliberately, don't
  log unbounded.
- **Use levels honestly.** `info` = something an operator should
  notice but not act on. `warn` = something they should look at this
  week. `error` = something they should look at now. `debug` = off
  in production, used during local development only.

Symptoms of getting this wrong:

- Two log lines for one event ("trying X" + "X failed"). Collapse
  into one — the trace shows the attempt; the log records the
  outcome.
- Logs that recapitulate metric labels (`{provider: groq, op: plan,
  status: ok}` lines on every successful call). The metric *is* the
  data; the log is for what the metric can't carry.
- Per-token / per-row logging. If you're loop-logging, you're
  building a metric badly — emit a counter, not log lines.
- "Just-in-case" debug noise left at `info` after a fix landed.

A good rule of thumb: when you read your own logs after a quiet
hour, you should see **exactly one entry per significant unexpected
event** — and that entry should tell you what happened. If the logs
during a quiet hour are empty, the system is healthy and the trace
viewer is where you go for detail. If they're full of routine
chatter, the chatter is hiding the actual signal next time something
breaks.

---

## 6. Bullet-proof-by-design checklist

We make bad states unreachable, not caught. Before shipping any user-visible feature, verify each row.

| Edge case | How it's unreachable |
|---|---|
| Schema mismatch | Schemas only widen. `ALTER TABLE ADD COLUMN … NULL`. |
| Cache invalidation | Plan cache keyed by `(schema_hash, query_hash)`. Old keys LRU. |
| Signup race | Idempotent on email. Second signup = sign-in. |
| Double-charge | `Idempotency-Key` required on mutations; Stripe webhooks deduped. |
| Wrong-tenant leak | Enforced at the connection pool, not app code. No branch to take. |
| SQL injection | No SQL strings; planner emits typed plan, executor binds. |
| Cold-start timeout | Workers cold-start <5ms; Neon resume <1s; 2s first-byte ceiling. |
| LLM column hallucination | Post-plan schema validation; re-prompt with the error. |
| Accidental mass delete | Destructive plans show a diff, require second Enter. |
| Leaked browser API key | `pk_live_` is read-only, origin-pinned, rate-limited. |
| Marketing site outage | Static on Cloudflare CDN. Only fails if CF global is down. |
| Email spam-folder | Resend SPF/DKIM/DMARC; plain templates, transactional only. |
| Surprise trial charge | Never auto-charge. Free rate-limits; never deletes, never upgrades. |

---

This file pairs with [`CONTRIBUTING.md`](../CONTRIBUTING.md) (mechanics:
hooks, branches, commit format) and [`./architecture.md`](./architecture.md)
(architecture). Those are the *what*; this is the *how-we-decide*.

## 7. What we reinvent — and what we don't

### Build our own

Seven places where the existing tool isn't good enough:

1. **The query router.** No existing router decides between PG / Mongo / Redis / DuckDB based on a live workload fingerprint. This is the product.
2. **The NL → plan compiler.** Existing text-to-SQL libraries (LangChain SQL agent, Vanna, etc.) are demos. They don't handle schema drift, don't stream, don't do multi-engine, don't expose trace. We build our own, tested against a held-out benchmark we curate.
3. **The migration orchestrator with dual-read verification.** Shadow + compare + cutover, per engine pair. No off-the-shelf tool does cross-engine migration safely.
4. **Connection proxy with per-DB quotas.** PgBouncer is the right shape but we need per-user-DB isolation, per-query budget, NL-query cancellation, and live trace surfacing. Write our own thin one in Go.
5. **The NL diff/undo layer.** Before destructive ops, show the diff in plain English + data preview. This library does not exist.
6. **Usage metering ingest path.** Lago handles invoicing, but the *ingest* of every query's token+latency stamp must be sub-ms overhead on the hot path. Async path, batched into Lago.
7. **The onboarding itself.** It is literally the entire product for the first 60 seconds. Hand-craft it; don't reach for a SaaS onboarding framework.

### Don't reinvent

- Postgres.
- Auth (Better Auth).
- Payment processor (Stripe).
- OTel.
- The MCP protocol (implement the spec, don't fork it).
- SQL parsers (use `pg_query`, `sqlparser-rs`).
