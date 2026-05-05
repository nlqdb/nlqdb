# Pivot exploration — OTel-native, NL-first observability platform

> **Status:** exploratory. Not a decision. This doc captures an external
> pivot suggestion: *turn nlqdb into a Grafana competitor — cloud-deployed,
> ingest OTel metrics/logs/traces, make the developer experience 10× better
> through natural language.* It surveys competitors (May 2026), maps the
> idea onto the current nlqdb stack, and frames the integrate-vs-spin-off
> question. Per [`CLAUDE.md`](../../CLAUDE.md) `P4 / D1`, vague decisions
> are worse than no decision — nothing here is promoted to a `GLOBAL-NNN`
> or `SK-*` block until the integrate-vs-spin-off question is resolved.
>
> **Cross-refs:**
> - [`docs/architecture.md §0`](../architecture.md) — core values (Free, OSS, Simple, Effortless, Goal-first)
> - [`docs/competitors.md`](../competitors.md) — current competitor scan (DB / NL-to-SQL / agent)
> - [`docs/future/semantic-layer.md`](../future/semantic-layer.md) — same "exploratory, not yet promoted" template
> - [`.claude/skills/observability/SKILL.md`](../../.claude/skills/observability/SKILL.md) — current OTel posture (we *emit* OTel; we don't *ingest* it)
> - [`docs/research/open-questions.md §3`](../research/open-questions.md) — adjacent open question (NL as embeddable lib in users' apps)

---

## 1. The pitch (verbatim, then unpacked)

> *"You can turn the nlqdb project into a Grafana competitor — something
> to deploy on the cloud, collect OTel metrics, and make the DevEx 10×
> better."*

Unpacked, the proposition has four moving parts:

1. **Ingest:** be an OTLP endpoint. Receive metrics, logs, and traces
   from any OTel-instrumented service.
2. **Store:** keep that telemetry cheaply and queryably for some
   retention window.
3. **Query:** let users ask questions in English. *"What's broken?"*,
   *"why did p99 spike at 14:32?"*, *"which deployment regressed
   checkout latency?"* — and answer with a chart, a trace list, and a
   one-sentence narrative.
4. **DevEx 10×:** zero-config dashboards, no PromQL/LogQL/TraceQL to
   memorise, agent-native (MCP), version-controlled artifacts,
   keyboard-first UI. Same effortless-UX bar as the rest of nlqdb
   ([`architecture.md §0`](../architecture.md)).

This is structurally the same product nlqdb already is — *"a database
you talk to"* — applied to time-series + spans instead of OLTP rows.
That symmetry is the reason the suggestion lands; it's also the
reason it's a real pivot question and not an obvious yes.

---

## 2. The 2026 observability landscape

### 2.1 Incumbents

| Vendor | Shape | Why they matter | Where they hurt |
|---|---|---|---|
| **Grafana Labs** (Grafana / Loki / Mimir / Tempo / Pyroscope / Faro) | Composable LGTM stack, open-source dashboards, Grafana Cloud SaaS. | Default open-source ingestion endpoint; massive mindshare; OTel-receiver maturing fast. At GrafanaCON 2026 they shipped **Grafana Assistant** (NL agent), **GCX** (CLI/agent in IDE), Loki Evolution (Kafka-based, 10× faster aggregations, 20× less data scanned), and an `o11y-bench` for evaluating agent observability workflows. | Three query languages (PromQL, LogQL, TraceQL) — engineers must memorise three syntaxes to correlate one incident. Dashboards aren't first-class source-controlled artefacts. Setup is "assemble four projects." |
| **Datadog** | Closed, fully-integrated SaaS APM + infra + logs + RUM + security. | The gold standard for "everything works on day one." Strong APM; rich integrations; broad enterprise footprint. | Pricing is the canonical pain — per-host, per-GB, per-custom-metric, per-user, per-monitor. Cardinality explodes the bill. Lock-in narrative is heavy now that OTel exists. |
| **Dynatrace** | Closed, AI-first ("Davis") full-stack APM. | Strong automatic discovery + RCA. Solid OTel ingest. | Enterprise sales motion; weak self-serve story; pricing opacity. |
| **New Relic** | All-in-one SaaS APM with usage-based pricing. | Closest one-stop SaaS Datadog alternative. | "Many products bolted together" reputation; UI complexity. |
| **Splunk Observability** (Cisco) | Logs-first heritage + APM acquisitions (SignalFx, Plumbr). | Enterprise log scale. | Premium pricing; UI fragmentation between products. |

### 2.2 OTel-native challengers (the cohort we'd actually compete with)

| Vendor | Shape | Notable angle |
|---|---|---|
| **SigNoz** | Open-source, ClickHouse-backed, OTel-native. Cloud at ~$49/mo + ~$0.30/GB. | The leading OSS OTel-first APM. Self-host friendly. Strong traces/logs/metrics unified UI. The most direct architectural neighbour of what an nlqdb pivot would build. |
| **OpenObserve** | Open-source, S3/GCS-backed, claims 140× compression vs Elasticsearch. Cloud is pay-as-you-go ~$0.30/GB. | Optimises specifically for storage cost; SQL queries; recently shipped an AI assistant for NLP→SQL/PromQL/VRL. |
| **Dash0** | Closed-source SaaS but built on open standards. | Marketed as "OpenTelemetry-native from day zero, no retrofit." Aggressive on DevEx polish. |
| **Uptrace** | Open-source, ClickHouse-backed, lighter scope (tracing-first, metrics/logs included). | Pitches "fast contextual debugging" without LGTM operational tax. |
| **Honeycomb** | High-cardinality event store with `BubbleUp` and `Query Assistant` (the original GenAI NLQ in observability — shipped 2023). | Strongest existing NL-query story. Limit: 50 NL queries / 24h, no HIPAA, query language (`Honeycomb querystring`) is bespoke. |
| **Axiom** | OTel-native log/event platform on object storage. | Workers / edge friendly; cheap log retention; light on metrics depth. |
| **ClickStack (ClickHouse)** | ClickHouse's own packaged observability (HyperDX UI + ClickHouse + OTel collector). Managed at <3¢/GB/mo, no per-host fees. | Sets the new floor for storage economics. *Not* a DevEx-led product — it's a data-platform play. |
| **Parseable, groundcover, Middleware, KloudMate, Last9** | Various OTel-native plays at different points (logs-only, eBPF, mid-market APM). | Crowded category; nobody has won DevEx yet. |

### 2.3 The two trends to underline

1. **OTel has neutralised instrumentation lock-in.** Every credible
   vendor now accepts OTLP. Differentiation has moved to *storage
   economics* and *query/UI experience*. This is exactly the seam an
   nlqdb-shaped product targets.
2. **Every incumbent is sprinting on AI.** Honeycomb shipped Query
   Assistant in 2023; Grafana shipped Grafana Assistant + GCX in 2026;
   OpenObserve shipped its AI assistant in March 2026; Datadog has
   Bits AI; New Relic has AI Monitoring; Dynatrace has Davis CoPilot.
   *NL on observability is no longer a moat — it's table stakes by
   end-of-2026.* A pivot has to clear a higher bar than "we add AI
   chat."

---

## 3. Where Grafana's DevEx hurts (the 10× target)

Pulled from public criticism + the cohort's positioning:

1. **Three query languages.** Correlating a metric spike, a log
   anomaly, and a trace tail requires PromQL **and** LogQL **and**
   TraceQL. NL collapses all three into one input.
2. **Dashboards aren't code.** Grafana JSON is exported, not
   authored — code review of a PromQL embedded in a panel is rare.
   *Effortless UX* for nlqdb means the artefact is a goal-first
   prompt, plus a deterministic compiled plan, not a 12 KB JSON blob.
3. **Setup tax.** LGTM = four projects + Alertmanager. *Free* and
   *Simple* (`architecture.md §0`) say one endpoint, one binary, one
   chat box.
4. **Cardinality fear.** Grafana Cloud, Datadog, and New Relic all
   bill on cardinality. Engineers self-censor labels. A storage
   layer that doesn't punish high-cardinality (ClickHouse-class)
   removes the fear.
5. **Alerts as a separate product.** Alertmanager, Grafana OnCall,
   PagerDuty integrations — three planes. *One way to do each
   thing.*
6. **No agent-native surface.** Grafana shipped GCX in 2026, which
   *exposes* Grafana to Claude/Copilot, but the surface is still
   "panel that an agent can read." nlqdb's MCP-first posture
   ([`packages/mcp`](../../packages/mcp)) is the inverse — the
   primitive *is* the agent call.

A real 10× claim has to bundle several of these, not just NL chat.

---

## 4. How (and how badly) it maps onto today's nlqdb

| Existing nlqdb piece | Reusable for o11y? | Notes |
|---|---|---|
| Goal-first NL → typed plan ([`ask-pipeline`](../../.claude/skills/ask-pipeline/SKILL.md)) | **High** — same shape, different DSL target. | Compile to `SQL-on-spans` (ClickHouse / DuckDB) or PromQL/LogQL. Existing `sql-allowlist` becomes a `query-allowlist`. |
| Plan cache keyed by `(schema_hash, query_hash)` ([`plan-cache`](../../.claude/skills/plan-cache/SKILL.md)) | **High** — telemetry schemas widen exactly the same way (`schema-widening` skill applies). | Cache keys extend to `(otel_resource_hash, query_hash)`. |
| LLM router with model presets + BYOK ([`llm-router`](../../.claude/skills/llm-router/SKILL.md), [`premium-tier`](../../.claude/skills/premium-tier/SKILL.md)) | **High** — direct reuse. | Per-incident model spend cap maps cleanly. |
| Auth, rate-limit, idempotency, anonymous-mode ([`auth`](../../.claude/skills/auth/SKILL.md), [`rate-limit`](../../.claude/skills/rate-limit/SKILL.md), [`idempotency`](../../.claude/skills/idempotency/SKILL.md), [`anonymous-mode`](../../.claude/skills/anonymous-mode/SKILL.md)) | **High** — these are surface-agnostic. | "First trace ingested without signup" is the equivalent of anonymous-mode's "first query without signup." |
| `<nlq-data>` web component ([`elements`](../../.claude/skills/elements/SKILL.md)) | **Medium** — `<nlq-chart>` / `<nlq-trace>` is a natural extension. Embedded SLO widgets on a status page is a clean use case. | Net new: streaming chart updates over SSE/WebSocket. |
| MCP server ([`mcp-server`](../../.claude/skills/mcp-server/SKILL.md)) | **High** — the killer surface for "AI SRE" workflows. | An LLM agent doing incident triage via MCP is a unique angle vs Grafana GCX (which still requires a Grafana account + dashboard model). |
| CLI (`nlq`) ([`cli`](../../.claude/skills/cli/SKILL.md)) | **Medium** — rebrand to `nlq tail`, `nlq why`, `nlq slo`. | Compelling demo: `nlq why "checkout p99 spike at 14:32"` returning trace IDs + correlated logs in one command. |
| **Postgres / Neon as primary storage** ([`db-adapter`](../../.claude/skills/db-adapter/SKILL.md)) | **Low.** | OLTP Postgres is the wrong shape for time-series + spans. We'd need a real columnar engine — ClickHouse is the consensus pick across SigNoz/Uptrace/HyperDX. The `multi-engine-adapter` skill (Phase 3) was already the seam for this kind of expansion. |
| **Cloudflare Workers free tier** ([`GLOBAL-013`](../decisions.md)) | **Low for ingest hot path.** | OTLP ingest is sustained-throughput and CPU-bound on protobuf decoding. Workers' 30s CPU and 128 MB memory limits make it the wrong spot for the receiver. The **control plane** (auth, query, dashboards, alerts) still fits. The **data plane** wants a long-lived process — cheapest realistic option is ClickHouse Cloud or self-hosted ClickHouse on a small VPS, with an OTel collector in front. This breaks the "$0 to ship" story for any user with non-trivial volume. |
| Observability skill ([`observability`](../../.claude/skills/observability/SKILL.md)) | **Inverted.** Today we *emit* OTel. The pivot makes us *ingest* it. | The span/metric catalogue at [`docs/performance.md`](../performance.md) becomes a dogfood demo dataset. |

**Summary:** ~70% of the platform code is reusable. The expensive
new build is the **data plane** (ClickHouse-class storage, OTLP
receiver, retention/compaction, alerting) and the **deep o11y UX**
(service maps, RED/USE views, exemplar linking, SLO burn-rate
charts). That is roughly the surface SigNoz / Uptrace built over
3+ years.

---

## 5. Integration vs spin-off — the actual question

Three coherent answers. Each has a clean shape; the wrong choice is
a fuzzy hybrid.

### Option A — *Sub-product inside nlqdb.* "OTel is just another data source."

nlqdb already aspires to many engines (`multi-engine-adapter` —
Phase 3). Add ClickHouse as an engine. Treat OTLP-receive as a
specialised `db.create({ kind: "otel" })` that materialises a
ClickHouse-backed DB. The chat box answers questions over OTel data
the same way it answers over user OLTP data.

- **Pros.** One product, one identity, one billing surface, one
  marketing site. Reuses everything in §4. Slots into the existing
  Phase-3 plan without a strategic reset.
- **Cons.** Dilutes the goal-first message ("Postgres you talk to"
  is a sharper pitch than "everything you talk to"). Storage and
  retention semantics for o11y are *very* different from OLTP —
  hot-cold tiering, sampling, cardinality budgets — and pretending
  they're the same engine produces a leaky abstraction.
- **GTM.** Existing buyer (solo dev / agent builder). Up-sells
  Production-class teams when they want APM without leaving the DB
  product.
- **Risk.** Half-built APM looks worse next to SigNoz than half-
  built NL-DB looks next to Neon. The o11y category punishes
  "almost good enough."

### Option B — *Sister product, shared platform.* "Two products, one engine."

`nlqdb.com` for the DB-you-talk-to; `<new-name>` for the OTel
platform. Both consume the same packages (`packages/llm`,
`packages/auth-internal`, `packages/sdk`, `packages/elements`,
`packages/mcp`). Different brand, different landing page, different
positioning, *same* engineering org and same monorepo.

- **Pros.** Each product gets a focused message. Engineering gets
  the platform leverage. The auth-and-billing rewrite cost is
  near-zero. Either product can win without the other.
- **Cons.** Two marketing surfaces, two on-call rotations, two
  pricing pages. Brand equity splits early.
- **GTM.** New buyer (SRE / platform team) for the o11y product;
  existing buyer for nlqdb. Cross-sell exists but isn't load-
  bearing.
- **Risk.** Classic "two startups in a trenchcoat" failure mode if
  the team isn't disciplined about which product is the priority
  in any given quarter.

### Option C — *Replace the thesis.* "nlqdb pivots; the OLTP work becomes a demo."

Rename. Reposition. Burn the boats. Use the existing OLTP-NL work
as the canonical demo for "we make data legible by chat."

- **Pros.** Maximum focus, biggest market (observability TAM is
  ~$50B; NL-DB TAM is unproven). Clean fundraising story.
- **Cons.** Throws away the part of the product the team has the
  most distinctive insight on (auto-migration, anonymous-mode,
  goal-first DB creation). Walks straight into a category where
  Grafana, Datadog, SigNoz, Honeycomb, and ClickStack are all
  shipping AI features in 2026.
- **GTM.** SRE/platform buyer. Sales motion is heavier than
  developer-led growth — observability buyers want references,
  SOC2, and contracts.
- **Risk.** "Better DevEx" is a feature, not a category. Without a
  structural moat (e.g. proprietary cardinality compression, a
  unique data model, an exclusive ingest path) the pivot is
  competing on UX polish against vendors with 10–100× the
  engineering headcount.

### Recommendation framing (not a decision)

If the goal is *strategic optionality with low regret*, **Option B**
is the most defensible: keep nlqdb's thesis intact, build the o11y
product on the same platform, let the market pick the winner. If
the goal is *single-bet conviction*, **Option C** is the only
honest answer — half-pivots usually fail on both fronts. **Option A**
is attractive on paper but understates how different o11y storage
economics are from OLTP; recommend against unless ClickHouse
adoption is already on the Phase-3 roadmap for independent reasons.

---

## 6. What would make this a 10× DevEx, not a 1.2×

A pivot pitched as "Grafana with chat" is a feature, not a product.
The bar to clear:

1. **One language, ever.** English in, chart-or-table-or-trace-list
   out. PromQL/LogQL/TraceQL exposed only as a *trace* (the
   compiled plan) for power users, never as the authoring surface.
2. **Dashboards as code, by default.** The compiled plan *is* the
   dashboard. Diff-able, code-reviewable, version-controlled.
   `nlq dash export <name> > dash.yml` round-trips losslessly. This
   is the structural Grafana-doesn't-do-this point.
3. **Zero-cardinality-fear pricing.** Storage on ClickHouse-class
   compression, billed on bytes-stored not series-counted. The
   marketing line writes itself: *"label everything. We don't
   charge for cardinality."*
4. **Anonymous-mode for telemetry.** Paste an OTLP endpoint into
   your service config, ship traces in 30 seconds, no signup —
   exactly the [`anonymous-mode`](../../.claude/skills/anonymous-mode/SKILL.md)
   bar applied to o11y. Nobody else does this.
5. **Agent-native incidents.** MCP tools: `incident.why(at: ts)`,
   `incident.diff(deploy_a, deploy_b)`, `slo.burn(service)`.
   Pageable from Claude Desktop, Cursor, or a CI workflow. Grafana
   GCX is the closest analog and it still assumes a Grafana
   account + dashboard.
6. **Single binary, single endpoint.** `otlp.<host>:4318` for
   ingest. `app.<host>/v1/ask` for query. Everything else is a
   convenience.
7. **One destructive-action posture.** Same diff-preview-then-
   confirm UX from `architecture.md §0` applied to retention
   changes, SLO deletions, alert silencing.

If we can't credibly ship at least 4 of those 7 in the first 6
months, this is a 1.2× DevEx improvement — and 1.2× doesn't beat
incumbents shipping AI features on existing distribution.

---

## 7. Risks & open questions

These need answers before any of this gets promoted into a skill or
GLOBAL.

1. **Storage economics on Cloudflare-only infra.** ClickStack sets
   the floor at <3¢/GB/mo. To match it on a Workers-first stack we
   either (a) accept a long-lived ClickHouse process outside
   Workers (breaks the "$0 to ship" story for ourselves) or (b)
   accept worse storage economics than the floor (kills the pricing
   pitch). No third option is currently visible.
2. **Cold-start on the ingest path.** OTLP receivers must accept
   sustained throughput with backpressure. Workers' billing model
   (CPU-time, request count) is *probably* viable up to a few k
   spans/sec per tenant, but past that we're paying retail for
   what dedicated infra does for fixed cost. Modelling required
   before any commitment.
3. **The AI moat is shrinking, not growing.** Honeycomb (2023),
   Grafana (2026), OpenObserve (2026), Datadog (Bits), Dynatrace
   (Davis), New Relic (AI Monitoring) all ship NL features today.
   What is durable about *our* version 18 months out?
4. **Observability buyers are not the nlqdb buyer.** Solo dev / AI
   agent persona ≠ SRE / platform team. The motion, the docs, the
   compliance demands (SOC2, BAA), and the integration breadth
   (Kubernetes, Prometheus exporters, eBPF) are different
   categories of investment.
5. **Ecosystem breadth.** Grafana ships ~100 first-party data
   sources and ~3000 community dashboards. Day-1 we have zero of
   either. How much of that is table stakes for the buyer, vs
   mythological?
6. **Cannibalisation.** If the o11y pivot succeeds, does the
   OLTP-NL product still get the engineering attention it needs to
   reach Phase 1 exit ([`docs/research/phase-1-exit-criteria.md`](../research/phase-1-exit-criteria.md))?

---

## 8. If the answer is "yes, explore further"

Smallest credible next step (4–6 weeks, one engineer):

1. Stand up a single-tenant OTLP/HTTP receiver. ClickHouse on a
   $20/mo Hetzner box. Ingest the existing nlqdb workers' own
   traces (we already emit OTel — the dogfood dataset is free).
2. Wire the existing `ask-pipeline` to compile English →
   ClickHouse SQL over the spans table. Reuse `sql-allowlist`,
   `plan-cache`, `llm-router` unchanged.
3. Demo: *"why was checkout slow at 14:32 yesterday?"* against the
   nlqdb demo workload, end-to-end in <5s.
4. Bench against SigNoz Cloud and Grafana Cloud Free on the same
   ingested workload — query latency, storage cost, and time-to-
   first-answer for a non-trivial incident.
5. Decision gate: do the §6 "10× bar" items 1, 2, 4, 5 actually
   feel achievable on the prototype? If not, abandon. If yes,
   open the integrate-vs-spin-off (Option A/B/C) decision with
   evidence.

Per `D1` of [`CLAUDE.md`](../../CLAUDE.md), this stays an open
exploration — no decision is documented as `SK-*` or `GLOBAL-*`
until §5 and the §7 risks have an owner and an answer.

---

## Sources

Surveys and competitor scans (May 2026):

- [Top 11 Grafana Alternatives — SigNoz](https://signoz.io/blog/grafana-alternatives/)
- [Top 10 Grafana Alternatives — OpenObserve](https://openobserve.ai/blog/top-10-grafana-alternatives/)
- [10 Grafana Alternatives Ranked by DevOps — Middleware](https://middleware.io/blog/grafana-alternatives/)
- [16 Best Grafana Alternatives — Dash0](https://www.dash0.com/comparisons/best-grafana-alternatives-2025)
- [11 Best Observability Tools — Dash0](https://www.dash0.com/comparisons/best-observability-tools)
- [8 Best OpenTelemetry Tools — Dash0](https://www.dash0.com/comparisons/best-opentelemetry-tools)
- [Top 7 AI-Powered Observability Tools — Dash0](https://www.dash0.com/comparisons/ai-powered-observability-tools)
- [Top Observability Platforms — OpenObserve](https://openobserve.ai/blog/top-10-observability-platforms/)
- [Best Datadog Alternatives — OpenObserve](https://openobserve.ai/blog/top-10-datadog-alternative-tools/)
- [Top 10 Observability Tools — Uptrace](https://uptrace.dev/tools/top-observability-tools)

Vendor primary sources:

- [SigNoz pricing](https://signoz.io/pricing/)
- [SigNoz GitHub](https://github.com/SigNoz/signoz)
- [Grafana Labs — AI observability launch (GrafanaCON 2026)](https://grafana.com/press/2026/04/21/grafana-labs-targets-the-ai-blind-spot-with-new-observability-tools-announced-at-grafanacon-2026/)
- [Grafana Labs — 2026 observability trends](https://grafana.com/blog/2026-observability-trends-predictions-from-grafana-labs-unified-intelligent-and-open/)
- [Grafana Assistant product page](https://grafana.com/products/cloud/ai-observability/)
- [SiliconAngle — Grafana closes the AI observability gap (2026-04-21)](https://siliconangle.com/2026/04/21/grafana-trying-close-ai-observability-gap-enterprise-agents-reign-supreme/)
- [Honeycomb — Query Assistant launch](https://www.honeycomb.io/blog/introducing-query-assistant)
- [Honeycomb Query Assistant docs](https://docs.honeycomb.io/investigate/query/build)
- [OpenObserve — March 2026 AI Assistant update](https://openobserve.ai/blog/product-update-march-2026/)
- [ClickHouse — observability cost optimization playbook (2026)](https://clickhouse.com/resources/engineering/observability-cost-optimization-playbook)
- [ClickHouse — Managed ClickStack pricing](https://clickhouse.com/blog/introducing-managed-clickstack-beta)
- [ClickStack landing page](https://clickhouse.com/clickstack)
- [Cloudflare — exporting OpenTelemetry data](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

NL-on-observability research:

- [PromCopilot — text-to-PromQL paper (ACM TOSEM)](https://dl.acm.org/doi/10.1145/3797910)
- [Catalog-driven NL→PromQL framework (arXiv 2604.13048)](https://arxiv.org/html/2604.13048v1)
- [Alibaba Cloud PromQL Copilot](https://www.alibabacloud.com/blog/602420)
- [Gartner — explainable AI driving LLM observability investment to 50% by 2028](https://www.gartner.com/en/newsroom/press-releases/2026-03-30-gartner-predicts-by-2028-explainable-ai-will-drive-llm-observability-investments-to-50-percent-for-secure-genai-deployment)
