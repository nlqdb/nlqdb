# D-02 — One-way re-sync hook: CI on merge when `docs/**` changed

**Status:** 🟢 code-complete — **D-02a shipped** (the runnable extractor); **D-02b shipped** (read-verb decided + convergent write path + the workflow). The workflow is committed-but-dark: it skips green until the `NLQDB_API_KEY` secret (set 2026-08-04, `founder-actions-log.md` Era 5) and the `NLQDB_MEMORY_DB` var (D-04) exist — a flag flip, not a refactor.
**Sequence:** Dogfood 2 of 7 · **Risk:** low → **D-02b is med** (see finding) · **Runs:** 2 · **Prereqs:** D-01 · **Gate:** the live convergent sync fires once `NLQDB_API_KEY` (see *Credential*) + `NLQDB_MEMORY_DB` are set

## Finding (2026-08-02) — the slice splits in two

D-01 shipped the producer as a **skill** (`agent-artifacts/nlqdb-docs-memory/SKILL.md`) —
instructions for a coding *agent*. There is no runnable extractor, and CI can't run an
agent for free (the `$0` ladder, rule 4). So "run D-01's extraction" needed a producer to
exist as code first, and a second, subtler blocker surfaced: **`facts` rows are append-only**
(`remember.ts` has no fact-update verb), so an idempotent re-sync must **read-before-write**
per `source.key` — and the deterministic read verb is unresolved (`ask()` is LLM-backed ⇒
costs money + non-deterministic; `/v1/run` may be outside the `sk_mcp_` key scope). That
read-path decision, not the workflow, is the real work. The slice therefore splits:

- **D-02a ✅ (this run):** the deterministic, `$0`, no-LLM extractor —
  `tools/docs-memory/` (`extract.ts` pure core + `sync.ts --dry-run` + tests). It parses the
  same structure SK-PIVOT-017 defines (v1: open questions per feature + the blocked-queue),
  emits `nlqdb_remember`-shaped entities/facts with `source.{key,digest}` for convergence,
  and reports the yield offline. Measured over the live `docs/` corpus: **9 open-question +
  6 blocked facts, 14 entities** — the 9 cross-checks scorecard row #17's independent count.
- **D-02b ⬜ (next):** the authenticated convergent write + the `memory-sync.yml` workflow,
  once the read-path question below is decided and the `NLQDB_API_KEY` secret is set.

## Goal

The memory corpus stays true to `docs/` without anyone remembering to re-run
anything. On every merge to `main` that touched `docs/**`, CI re-runs D-01's
extraction against the changed corpus. Convergent, one-way, idempotent — a
re-run after a docs change updates the index; nlqdb never writes markdown back.

## SK-PIVOT-016 criterion / number it moves

**Criterion 1** (≥ 100 real `/v1/ask` calls from the ops workload) — this is
what makes the workload *sustained* rather than a single seeding run. Also
protects criterion 3: a stale index that answers confidently from deleted docs
is exactly a "wrong-answer-accepted" incident.

## Read first

- [`SK-PIVOT-017`](../../decisions/SK-PIVOT-017-docs-to-memory-skill.md) — "keep
  it fresh with a one-way re-sync hook (CI on merge and/or session start)"
- [`D-01`](D-01-docs-memory-skill.md) — the skill this hook invokes, and its
  idempotency guarantee (this hook is only correct because of it)
- `.github/workflows/quality-eval-memory.yml` — the closest existing shape: a
  workflow that talks to the live API with a secret, free-tier only
- `docs/features/ci-permissions/FEATURE.md` — **mandatory** per `AGENTS.md` §5
  for anything under `.github/workflows/**`
- `apps/api/src/memory/remember.ts` — the endpoint the run writes through

## Mechanism — the "and/or" resolved

SK-PIVOT-017 leaves the trigger as "CI on merge **and/or** session start".
Resolved to **CI on merge only** (a value-decidable call per `GLOBAL-033`):

- `/daily` fires ~6×/day and `/reach` 4×/day. A session-start sync would re-run
  the same extraction ~10×/day against a corpus that changed at most once —
  work with no delta, and every run pays the latency.
- Merge is the exact event that changes the corpus, so on-merge is
  once-per-change by construction.
- Daily-agent containers are egress-gated in places (the row-#15 opencheck and
  row-#21 walker constraints); CI is not.

Session-start is therefore **out of scope**, not deferred — re-opening it needs
a reason this reasoning doesn't already cover.

**Path filter** is the whole point of the trigger: `paths: ['docs/**']` on
`push: branches: [main]`. A merge that touches no docs must be a no-op with no
API call, or criterion 1's call count stops meaning "real work".

## Credential

The workflow needs `NLQDB_API_KEY` (a self-minted `sk_mcp_*` MCP key — least
privilege for a headless CI runner, `SK-APIKEYS-015`) as a **repo
secret** — an operator action an agent cannot perform. **Already queued:**
bullet **#2** in [`blocked-by-human.md`](../../../../blocked-by-human.md)
(added 2026-08-01) asks the founder to mint the key and set the secret. Until
the secret exists the workflow is committed but skips with a printed reason,
never fails red.

## The open design question (D-02b, `GLOBAL-033` — value-decidable) — RESOLVED 2026-08-03

**Which deterministic read backs the read-before-write convergence?** **Decided: (a) `/v1/run`
with a keyed `SELECT` over `facts`** — no new endpoint (P5, `GLOBAL-015`). The subtlety the
finding flagged (does the `sk_mcp_` scope even *see* the facts?) resolves in favour of (a): both
sides default to the **same** scope. `nlqdb_remember` server-defaults `agentId` to the tenant
principal, and `buildHostedExecSteps` (`apps/api/src/ask/build-deps.ts`) defaults
`scope = { agentId: tenantId }` for a plain `/v1/run`. So the `SK-PIVOT-009` RESTRICTIVE RLS on
`facts` lets a default-scope `/v1/run` SELECT read exactly the rows a default-scope `remember`
wrote — the read and the write agree by construction. `sk_mcp_` reaches `/v1/run` (it is not in
the pk_live/anon read-only-forced set), and a SELECT is a read either way. Option (b) — a new
keyed `facts`-read verb — is **rejected**: it adds an endpoint for a read `/v1/run` already
serves. The convergence read is `converge.ts`'s `FACTS_READ_SQL`; the pure diff (`planWrites`) is
what makes idempotency a measured unit test rather than an assertion.

## Steps

1. **D-02a ✅ (done, this run).** `tools/docs-memory/`: `extract.ts` (pure, tested),
   `sync.ts --dry-run` (offline yield report), `package.json`/`tsconfig.json`. `$0`, no
   secret, covered by `bun run test`/`typecheck`/`lint`.
2. **D-02b ✅ (done, 2026-08-03).** Read verb decided (above). Added
   `.github/workflows/memory-sync.yml`: `push` → `branches: [main]`, `paths: ['docs/**']`,
   plus `workflow_dispatch`; least-privilege `permissions: contents: read` per the
   `ci-permissions` feature; concurrency-guarded (`group: memory-sync`, no cancel). It runs
   the D-02a extractor, then `bun src/sync.ts --apply`: reads current facts via
   `FACTS_READ_SQL` (`/v1/run`), diffs by `source.key → source.digest` (`planWrites`), writes
   only what differs via `/v1/memory/remember`, and prints existing / entities / facts-written
   / facts-unchanged / call counts. Skips with a printed reason (green) when
   `NLQDB_API_KEY` or `NLQDB_MEMORY_DB` is absent.

## Done when

- [x] The runnable extractor exists as tested code (`tools/docs-memory/`), verified offline
      over the live `docs/` corpus (D-02a).
- [x] The convergence read-verb question is decided (`GLOBAL-033`) — (a) `/v1/run` keyed SELECT,
      see the resolved design section above (D-02b).
- [x] `.github/workflows/memory-sync.yml` exists: `push` on `main` filtered to `docs/**`,
      plus `workflow_dispatch`; least-privilege `permissions: contents: read`; concurrency-guarded (D-02b).
- [x] Missing-secret path skips with a printed reason (green, not red); the repo secret
      was set 2026-08-04 (`founder-actions-log.md` Era 5) (D-02b) — verified locally: `bun src/sync.ts --apply`
      with no env prints the reason and exits 0.
- [x] Second consecutive run over an unchanged corpus writes **0 new rows** — measured offline in
      `converge.test.ts` (`planWrites` over an index reflecting run 1 → `factsToWrite` empty). The
      **live** re-measurement over the ops DB awaits the secret + `NLQDB_MEMORY_DB` (D-04).
- [x] INDEX tracker + status ticked. **Deferred to a later run:** the `INDEX.md` D-02 tracker line
      is left to open PR #885 (which edits `INDEX.md`) — this run avoids that file per the `/daily`
      step-0 no-overlap rule; the status here is the durable D-02 record until #885 merges.

## Artifact

None owed — a workflow is not a stranger-searchable lesson. Skip step 3.2.

## Rollback

D-02a: delete `tools/docs-memory/` — a pure offline tool with no runtime, no state, no
consumer yet. D-02b: delete the workflow file; the corpus freezes at its last sync, D-04's
memories are untouched. No migration, no state either way.
