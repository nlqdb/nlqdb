# Phase plan

Canonical phase plan and exit gates. Extracted from `architecture.md` §10
to keep that doc under the D4 20 KB shard cap; cross-refs there now link
here.

**Navigation:** [architecture.md](./architecture.md) (system design) ·
[decisions.md](./decisions.md) (cross-cutting `GLOBAL-NNN`) ·
[features/](./features/) (per-feature `FEATURE.md` with status) ·
[performance.md](./performance.md) (SLOs and budgets).

**The roadmap is [`GLOBAL-043`](./decisions/GLOBAL-043-attach-first-autonomous-dba.md)'s
three items** (`/daily` step 2): 1a the attach product built on synthetic
databases, 1b the Postgres spike + the D1 attach on rateme12, 2 the deletion PR series, 3 the playbook's proposal kinds. **Exit
gate:** the spike's measured delta (`GLOBAL-043` item 10) — pass starts item
2, fail deletes nothing. Onboarding / UX / performance floors:
[`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md); LLM strategy:
[`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).
§1–§5 are the retired hosted wedge's shipped history, kept so their section
numbers resolve; §0 and §6–§8 still bind.

---

## 0. Operative rules

Apply to every phase:

- Ship the on-ramp first. A user must reach first value before any new
  surface ships.
- Vertical slices, not horizontal layers. Each slice ships end-to-end.
- Every shipped feature must measurably advance at least one
  north-star ([`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md))
  — engine quality, onboarding, UX, or performance — AND must
  not degrade any of the others.
- Every phase has a measurable exit gate. No gate, no phase rollover.
- **Strict-$0 forever for the free tier** ([`GLOBAL-013`](./decisions/GLOBAL-013-free-tier-bundle-budget.md)
  + [`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)).
  Free LLM chain is permanent; hosted premium routes only on paid
  plans; BYOLLM is available on every tier.
- Dogfood from Phase 0. Every surface used by the team before it ships
  to a stranger.
- New monetization or scaling work is **gated on demand-signal**, not
  on phase number — see §6 below.

---

## 1. Phase 0 — Foundations (shipped)

Workers + KV + D1 + R2, the strict-$0 LLM chain, the KV plan cache, Better
Auth, the Neon adapter, and `POST /v1/ask` end-to-end.

## 2. Phase 1 — On-ramp (shipped)

`nlqdb.com` + `/app` chat, anonymous mode, hosted `db.create`, `<nlq-data>`,
API keys, Resend / Sentry / Web Analytics / LogSnag.

## 3. Phase 1.5 — Trust + Telemetry (shipped)

Trust UX ([`GLOBAL-023`](./decisions/GLOBAL-023-trust-ux-baseline.md),
[`GLOBAL-040`](./decisions/GLOBAL-040-guided-turn-not-dead-end.md)),
demand-signal events
([`GLOBAL-024`](./decisions/GLOBAL-024-demand-signal-telemetry.md)) and the
`nlqdb.surface` label.

## 4. Phase 2 — Distribution (shipped)

MCP server, CLI `nlq` (incl. `nlq run`), SDK `runSql()`, `<nlq-action>`,
framework wrappers + Swift package, docs site, the BIRD/Spider regression
alarm, BYOLLM. Per-surface status: [`progress.md §0`](./progress.md#0-surface-status-matrix--single-source-of-truth).

## 5. Phase 3 — Retired

Its `GLOBAL-041` Phase B/C plan is superseded by the `GLOBAL-043` roadmap
above.

---

## 6. Monetization + scaling trigger

**Building** is never gated — implement it before the signal. What a
demand-signal gates is **the cost-incurring layers**: Listmonk
marketing email and cost-incurring scaling (Cloudflare Pro, Neon
Launch). The hosted-premium meter is no longer a separate
service — it rides Stripe Billing Meters directly
([`SK-PREMIUM-017`](./features/premium-tier/decisions/SK-PREMIUM-017-stripe-billing-meters.md)).
None turn on by phase number; they turn on when one signal trips —
whichever first:

| Signal | Threshold | What it unlocks |
|---|---|---|
| Unsolicited inbound asking how to pay | ≥ 1 across GH / Discord / email (tripped 2026-08) | Revealed preference. Founder-led pricing conversation (a $1 founding-supporter tier is a cheap hard-signal layer). |
| Checkout completion rate | ≥ 30% over 50 sessions | Strong enough to commit to Stripe Billing Meters + the cost-incurring scaling layers. |

Thresholds are starting heuristics, not measured truths — adjust on
first contact with traffic. The [cost ladder](./cost-ladder.md) is the
same rule: free to build, no spend until it trips.

**What is *not* §6-gated.** Per
[`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md),
**BYOLLM ships in Phase 2** for every tier (no payment infra needed) and the
**hosted-premium lane is now wired end-to-end** (router, meter, and allowance
seeds in `apps/api/src/billing/premium/**`). §6 gated only the *meter firing*
(`PREMIUM_METER_LIVE`) — the operator flipped it live 2026-08-14.

**Scaling triggers (infra, not billing; `GLOBAL-033`):** shard / migrate the
single D1 at **70% of its daily-read quota (rolling 7-day) or 10k DAU**,
whichever first; stay single-region us-east through Phase 2 and add an EU Neon
read-replica when the **first EU paying customer** signs (latency-, not
capacity-driven).

---

## 7. Phase 4+ — Beyond v1

- **BYO Postgres + BYO ClickHouse** (`POST /v1/db/connect`) — **promoted out
  of Phase 4+ to active dev** per [`SK-DB-011`](./features/db-adapter/decisions/SK-DB-011-byo-postgres-promoted.md)
  / [`SK-MULTIENG-005`](./features/multi-engine-adapter/decisions/SK-MULTIENG-005-byo-clickhouse-promoted.md);
  shared `registerByoDb` path, shape in [`architecture.md §3.6.7`](./architecture.md#367-byo-postgres-phase-4-decided-shape).
  Engine-specifics + the retired signal-gate live in those SKs.
- **Embeddable NL library** ("Stripe of NL-Q" — their app, their end-users) and
  **notebook-style multi-query docs** — both **parked** as speculative scope
  (`GLOBAL-033`): revisit only when a paying / design-partner customer asks. A
  notebook is a BI tool (`architecture.md §8` not-building).
- Enterprise (SSO, audit log, on-prem).
- More engines (TimescaleDB, Typesense, pgvector at scale).
- `<nlq-stream>` real-time element.

---

## 8. Always-on (cross-phase)

- Build-in-public cadence, blog drip and channel work: **paused**
  (`GLOBAL-043`); existing pages stay live. The exceptions — the founder's
  ~10 hand-recruited builders and Show HN on the love gate — are
  `GLOBAL-043`'s. Recruitment +
  interview cadence in [`docs/founder-playbook.md`](./founder-playbook.md).
- Security hygiene: Trivy + CodeQL on every PR; secret rotation
  quarterly; Renovate (`renovate.json5`) for dependency updates.
- Inference cost monitoring: weekly Grafana; if any free provider hits
  70% of daily quota for 3 days → light up paid tier.
- Free-tier abuse: per-IP + per-account rate limits day 1; PoW on
  signup if needed.
- Quarterly forced LLM failover in production for 1h.
- Weekly automated backup-restore drill.
