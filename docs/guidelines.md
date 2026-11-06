# nlqdb — Development Guidelines

This repo's additions to the engineering bar. The bar itself is
`rules://guidelines` (dependencies, DX, logs, comments, testing) and
`rules://general` rule 6 (research before building), served at
https://mcp.hochly.com/mcp — read it first; this file only adds to it.

## 1. Eagle-eye checks

Before opening the editor, re-read:

- The span / metric / label catalog in [`./performance.md §3`](./performance.md#3-span--metric--label-catalog). No one-off names.
- The package's role in [`./architecture.md §2`](./architecture.md#2-system-architecture).
- Whether [`./runbook.md`](./runbook.md) or any package README drifts when this lands; if so, update it in the same PR.

Symptoms of having lost the overview: a label not in `performance.md` §3.3;
a Worker binding named `NLQDB_*` (bare names — single-Worker convention).

## 2. Developer experience — repo additions

- **Types that autocomplete:** template literal types, narrow unions,
  branded IDs — not bare `string`.
- **Setup functions say whether they are idempotent** (cache / safe to call
  twice), e.g. `setupTelemetry({ … })`.
- **Test seams are the smallest functional shape:** `createPostgresAdapter({ query })`
  injects one function instead of mocking the Neon client.
- **Logs:** a hot path (e.g. a successful `/v1/ask`) emits zero log lines;
  user input or upstream bodies are truncated to ~200 chars before logging.
- **A TODO names an owner or an issue link**, or it is not written.

---

## 3. Bullet-proof-by-design checklist

We make bad states unreachable, not caught. Before shipping any user-visible feature, verify each row.

| Edge case | How it's unreachable |
|---|---|
| Schema mismatch | Hosted path only, until the `GLOBAL-043` deletion series: the write itself evolves the schema (unseen field → `ADD COLUMN … NULL` in the insert's transaction); logical changes bump `schema_hash`. |
| Cache invalidation | Plan cache keyed by `(schema_hash, query_hash)`. Old keys LRU. |
| Signup race | Idempotent on email. Second signup = sign-in. |
| Double-charge | `Idempotency-Key` required on mutations; Stripe webhooks deduped. |
| Wrong-tenant leak | Provisioned DBs get per-tenant `tenant_isolation` RLS; the BYO path runs against the user's own single-tenant DB (bounded — no shared surface to cross). |
| SQL injection | No SQL strings; planner emits typed plan, executor binds. |
| Cold-start timeout | Workers cold-start <5ms; Neon resume <1s; 2s first-byte ceiling. |
| LLM column hallucination | Post-plan schema validation; re-prompt with the error. |
| Accidental mass delete | Destructive plans show a diff, require second Enter. |
| Leaked browser API key | `pk_live_` is read-only, origin-pinned, rate-limited. |
| Marketing site outage | Static on Cloudflare CDN. Only fails if CF global is down. |
| Email spam-folder | Resend SPF/DKIM/DMARC; plain templates, transactional only. |
| Surprise trial charge | Never auto-charge. Free rate-limits; never deletes, never upgrades. |

---

## 4. What we reinvent — and what we don't

### Build our own

Seven places where the existing tool isn't good enough:

1. **The query router.** No existing router decides between PG / ClickHouse / Redis / D1 based on a live workload fingerprint. This is the product.
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
