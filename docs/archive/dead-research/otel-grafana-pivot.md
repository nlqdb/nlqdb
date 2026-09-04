# Pivot exploration — OTel-native, NL-first observability platform

> **Status:** exploratory. Not a decision. This doc captures an external
> pivot suggestion: *turn nlqdb into a Grafana competitor — cloud-deployed,
> ingest OTel metrics/logs/traces, make the developer experience 10× better
> through natural language.* It maps the idea onto the current nlqdb stack and
> frames the integrate-vs-spin-off question. Per [`CLAUDE.md`](../../CLAUDE.md)
> `P4 / D1`, vague decisions are worse than no decision — nothing here is
> promoted to a `GLOBAL-NNN` or `SK-*` block until the integrate-vs-spin-off
> question is resolved.
>
> **Cross-refs:**
> - [`docs/competitors.md`](../competitors.md) — canonical scan for the DB / NL-over-DB space (not o11y vendors; this doc owns that landscape).
> - [`docs/architecture.md §0`](../architecture.md) — core values (Free, OSS, Simple, Effortless, Goal-first)
> - [`docs/future/semantic-layer.md`](../future/semantic-layer.md) — same "exploratory, not yet promoted" template
> - [`docs/features/observability/FEATURE.md`](../features/observability/FEATURE.md) — current OTel posture (we *emit* OTel; we don't *ingest* it)
> - [`docs/phase-plan.md §7`](../phase-plan.md) — the NL-as-embeddable-library bet (parked-with-trigger per `GLOBAL-033`)

---

## 1. The pitch

> *"You can turn the nlqdb project into a Grafana competitor — something
> to deploy on the cloud, collect OTel metrics, and make the DevEx 10×
> better."*

Four moving parts: **ingest** (an OTLP endpoint for metrics/logs/traces),
**store** (cheap, queryable, retained), **query** (English in — *"why did p99
spike at 14:32?"* — chart/trace-list/narrative out), **DevEx 10×** (zero-config,
no PromQL/LogQL/TraceQL, agent-native MCP, version-controlled artifacts).
Structurally this is the product nlqdb already is — *"a database you talk to"* —
over time-series + spans instead of OLTP rows. That symmetry is why it lands;
it's also why it's a real pivot question, not an obvious yes.

---

## 2. The 2026 landscape — the two trends that matter

The per-vendor survey was trimmed as non-decision-load-bearing (D5). The two
trends below are what bear on the decision; the OSS cohort and the storage-cost
floor are named inline, the incumbents recur in §5 Option C:

1. **OTel has neutralised instrumentation lock-in.** Every credible vendor now
   accepts OTLP. Differentiation has moved to *storage economics* and *query/UI
   experience* — exactly the seam an nlqdb-shaped product targets.
2. **NL-on-observability is becoming table stakes, not a moat.** Honeycomb
   (Query Assistant, 2023), Grafana (Assistant + GCX, 2026), OpenObserve (Mar
   2026), Datadog (Bits AI), Dynatrace (Davis), and New Relic (AI Monitoring)
   all ship NL features today. A pivot must clear a higher bar than "we add AI
   chat" (see §6).

We'd compete with the OSS, ClickHouse-backed, OTel-native cohort (SigNoz,
Uptrace, OpenObserve, ClickStack); ClickStack sets the storage-cost floor at
**<3¢/GB/mo, no per-host fees**.

---

## 3. Where Grafana's DevEx hurts (the 10× target)

1. **Three query languages.** Correlating a metric spike, a log anomaly, and a
   trace tail needs PromQL **and** LogQL **and** TraceQL. NL collapses all three
   into one input.
2. **Dashboards aren't code.** Grafana JSON is exported, not authored — the
   query inside a panel is rarely code-reviewed. nlqdb's artefact is a goal-first
   prompt + a deterministic compiled plan, not a 12 KB JSON blob.
3. **Setup tax.** LGTM = four projects + Alertmanager. *Free* + *Simple*
   ([`architecture.md §0`](../architecture.md)) say one endpoint, one binary,
   one chat box.
4. **Cardinality fear.** Grafana Cloud / Datadog / New Relic bill on
   cardinality, so engineers self-censor labels. ClickHouse-class storage
   removes the fear.
5. **Alerts as a separate product.** Alertmanager + Grafana OnCall + PagerDuty
   is three planes; *one way to do each thing*.
6. **No agent-native surface.** Grafana's GCX *exposes* Grafana to Claude/Copilot
   but the surface is still "a panel an agent can read." nlqdb's MCP-first
   posture ([`packages/mcp`](../../packages/mcp)) is the inverse — the primitive
   *is* the agent call.

A real 10× claim has to bundle several of these (see §6), not just NL chat.

---

## 4. How (and how badly) it maps onto today's nlqdb

| Existing nlqdb piece | Reusable? | Notes |
|---|---|---|
| Goal-first NL → typed plan ([`ask-pipeline`](../features/ask-pipeline/FEATURE.md)) | **High** | Same shape, different DSL target — compile to SQL-on-spans (ClickHouse/DuckDB) or PromQL/LogQL; `sql-allowlist` → `query-allowlist`. |
| Plan cache `(schema_hash, query_hash)` ([`plan-cache`](../features/plan-cache/FEATURE.md)) | **High** | Telemetry schemas widen the same way (`schema-widening` applies); key extends to `(otel_resource_hash, query_hash)`. |
| LLM router + presets + BYOK ([`llm-router`](../features/llm-router/FEATURE.md), [`premium-tier`](../features/premium-tier/FEATURE.md)) | **High** | Direct reuse; per-incident model spend cap maps cleanly. |
| Auth / rate-limit / idempotency / anonymous-mode | **High** | Surface-agnostic. "First trace ingested without signup" = anonymous-mode's "first query without signup." |
| `<nlq-data>` web component ([`elements`](../features/elements/FEATURE.md)) | **Medium** | `<nlq-chart>` / `<nlq-trace>` is a natural extension; net-new is streaming chart updates over SSE/WS. |
| MCP server ([`mcp-server`](../features/mcp-server/FEATURE.md)) | **High** | The killer surface for "AI SRE" triage — a unique angle vs Grafana GCX (which still needs a Grafana account + dashboard model). |
| CLI (`nlq`) ([`cli`](../features/cli/FEATURE.md)) | **Medium** | Compelling demo: `nlq why "checkout p99 spike at 14:32"` → trace IDs + correlated logs in one command. |
| **Postgres / Neon storage** ([`db-adapter`](../features/db-adapter/FEATURE.md)) | **Low** | OLTP Postgres is wrong for time-series + spans. Need a columnar engine — ClickHouse is the consensus pick. The Phase-3 `multi-engine-adapter` was already the seam for this. |
| **Cloudflare Workers free tier** ([`GLOBAL-013`](../decisions.md)) | **Low for ingest** | OTLP ingest is sustained-throughput, CPU-bound protobuf decode; Workers' 30 s CPU / 128 MB limits make it the wrong receiver. The **control plane** still fits; the **data plane** wants a long-lived process (§9). |
| Observability feature ([`observability`](../features/observability/FEATURE.md)) | **Inverted** | Today we *emit* OTel; the pivot makes us *ingest* it. Our own span catalogue ([`performance.md`](../performance.md)) becomes the dogfood dataset. |

**Summary:** ~70% of the platform code is reusable. The expensive new build is
the **data plane** (ClickHouse-class storage, OTLP receiver,
retention/compaction, alerting) and the **deep o11y UX** (service maps, RED/USE
views, exemplar linking, SLO burn-rate charts) — roughly what SigNoz / Uptrace
built over 3+ years.

---

## 5. Integration vs spin-off — the actual question

Three coherent answers. The wrong choice is a fuzzy hybrid.

### Option A — *Sub-product inside nlqdb.* "OTel is just another data source."

Add ClickHouse as an engine (`multi-engine-adapter`, Phase 3); treat
OTLP-receive as a specialised `db.create({ kind: "otel" })`. The chat box
answers over OTel data the same way it answers over OLTP.

- **Pros.** One product/identity/billing/site. Reuses everything in §4. Slots
  into the existing Phase-3 plan without a strategic reset.
- **Cons.** Dilutes the goal-first message ("Postgres you talk to" is sharper
  than "everything you talk to"). O11y storage/retention semantics (hot-cold
  tiering, sampling, cardinality budgets) differ enough from OLTP that one
  engine becomes a leaky abstraction.
- **Risk.** Half-built APM looks worse next to SigNoz than half-built NL-DB
  looks next to Neon — o11y punishes "almost good enough."

### Option B — *Sister product, shared platform.* "Two products, one engine."

`nlqdb.com` for the DB-you-talk-to; `<new-name>` for the OTel platform. Both
consume the same packages (`llm`, `auth-internal`, `sdk`, `elements`, `mcp`).
Different brand/landing/positioning, *same* org and monorepo.

- **Pros.** Each product gets a focused message; engineering keeps the platform
  leverage; auth/billing rewrite cost is near-zero; either product can win
  alone.
- **Cons / risk.** Two marketing surfaces, two on-call rotations, two pricing
  pages; brand equity splits early. Classic "two startups in a trenchcoat"
  failure if the team isn't disciplined about the quarter's priority.

### Option C — *Replace the thesis.* "nlqdb pivots; OLTP becomes a demo."

Rename, reposition, burn the boats; the OLTP-NL work becomes the canonical demo.

- **Pros.** Maximum focus, biggest market (o11y TAM ~$50B vs unproven NL-DB
  TAM), clean fundraising story.
- **Cons.** Throws away the team's most distinctive insight (auto-migration,
  anonymous-mode, goal-first DB creation) and walks into a category where
  Grafana/Datadog/SigNoz/Honeycomb/ClickStack are all shipping AI in 2026.
- **Risk.** "Better DevEx" is a feature, not a category. Without a structural
  moat (proprietary compression, a unique data model, an exclusive ingest path)
  it's UX polish against vendors with 10–100× the headcount.

### Recommendation framing (not a decision)

For *strategic optionality with low regret*, **Option B** is the most
defensible — keep the thesis, build o11y on the same platform, let the market
pick. For *single-bet conviction*, **Option C** is the only honest answer;
half-pivots fail on both fronts. **Option A** understates how different o11y
storage economics are from OLTP — recommend against unless ClickHouse adoption
is already on the Phase-3 roadmap for independent reasons.

---

## 6. What makes this a 10× DevEx, not a 1.2×

Ship at least 4 of these 7 in the first 6 months or it's a 1.2× improvement —
and 1.2× doesn't beat incumbents shipping AI features on existing distribution:

1. **One language, ever.** English in; chart/table/trace-list out.
   PromQL/LogQL/TraceQL exposed only as a *trace* (the compiled plan), never as
   the authoring surface.
2. **Dashboards as code, by default.** The compiled plan *is* the dashboard —
   diff-able, code-reviewable, `nlq dash export <name> > dash.yml` round-trips
   losslessly. The structural Grafana-doesn't-do-this point.
3. **Zero-cardinality-fear pricing.** ClickHouse-class compression, billed on
   bytes-stored not series-counted: *"label everything. We don't charge for
   cardinality."*
4. **Anonymous-mode for telemetry.** Paste an OTLP endpoint, ship traces in 30 s,
   no signup — the [`anonymous-mode`](../features/anonymous-mode/FEATURE.md) bar
   applied to o11y. Nobody else does this.
5. **Agent-native incidents.** MCP tools: `incident.why(at: ts)`,
   `incident.diff(deploy_a, deploy_b)`, `slo.burn(service)` — pageable from
   Claude Desktop, Cursor, or CI. GCX is the closest analog and still assumes a
   Grafana account + dashboard.
6. **Single binary, single endpoint.** `otlp.<host>:4318` ingest;
   `app.<host>/v1/ask` query. Everything else is convenience.
7. **One destructive-action posture.** The same diff-preview-then-confirm UX
   from `architecture.md §0`, applied to retention changes, SLO deletions, and
   alert silencing.

---

## 7. Risks & open questions

Answer these before any of this is promoted to a feature or GLOBAL:

1. **Storage economics on free infra.** ClickStack's <3¢/GB/mo floor is hard to
   match on a Workers-first stack: either a long-lived ClickHouse process
   outside Workers (breaks our own "$0 to ship") or worse-than-floor economics
   (kills the pricing pitch). §9 surveys a possible third path.
2. **Cold-start on the ingest path.** OTLP receivers need sustained throughput
   with backpressure; Workers' CPU-time/request billing is *probably* viable to
   a few k spans/sec/tenant, retail-priced past that. Model before committing.
3. **The AI moat is shrinking, not growing.** Everyone ships NL features today
   (§2). What's durable about *our* version 18 months out?
4. **Observability buyers ≠ the nlqdb buyer.** Solo dev / agent persona vs
   SRE / platform team: different motion, docs, compliance (SOC2, BAA), and
   integration breadth (Kubernetes, Prometheus exporters, eBPF).
5. **Ecosystem breadth.** Grafana ships ~100 first-party data sources + ~3000
   community dashboards; day-1 we have zero. How much is table stakes vs myth?
6. **Cannibalisation.** If the pivot succeeds, does the OLTP-NL product still get
   the attention to reach Phase 1 exit
   ([`phase-1-exit-criteria.md`](./phase-1-exit-criteria.md))?

---

## 8. If the answer is "yes, explore further"

Smallest credible next step (4–6 weeks, one engineer), aligned with the §9
free-stack finding:

1. **Ingest:** a Cloud Run service running the upstream `otelcol` binary
   (OTLP/HTTP receiver, ClickHouse exporter) on its always-free quota.
2. **Storage:** Tinybird Free Forever, schema mapped from `otelcol`'s ClickHouse
   exporter to a Tinybird Data Source.
3. **Query:** existing `ask-pipeline` compiles English → ClickHouse SQL →
   Tinybird Pipe, reusing `sql-allowlist` / `plan-cache` / `llm-router`
   unchanged. Seed with nlqdb's own emitted traces — the dogfood dataset is free.
4. **Demo:** *"why was checkout slow at 14:32 yesterday?"* end-to-end in <5 s.
5. **Bench** vs SigNoz Cloud + Grafana Cloud Free on the same workload — query
   latency, storage cost, time-to-first-answer for a non-trivial incident.
6. **Decision gate:** do the §6 items 1, 2, 4, 5 feel achievable on the
   prototype? If not, abandon. If yes, open the Option A/B/C decision with
   evidence. **Cost to validate the thesis end-to-end: $0.**

Per `D1` of [`CLAUDE.md`](../../CLAUDE.md), this stays an open exploration — no
`SK-*` / `GLOBAL-*` until §5 and the §7 risks have an owner and an answer.

---

## 9. Free-forever stack — May 2026 research

`GLOBAL-013` ("free tier, no credit card") forces both decisions. This surveys
what's *actually* free-forever (not "free trial," not "$X credit," not "12
months on AWS") per layer, to preserve the strict-$0 sign-up promise.

### 9.1 ClickHouse-class storage

| Vendor | Free-forever quota | Verdict |
|---|---|---|
| **Tinybird** | 10 GB · 1k read queries/day · unlimited writes · no card | **Best fit.** Only managed-ClickHouse with a true free-forever, no-card plan; writes don't count → matches the OTLP write shape. The 1k-reads/day cap is the ceiling, but NL-first UX only fires queries on user intent (vs a polling Grafana dashboard). |
| **Self-host on Oracle Always Free** | 4 ARM OCPU · 24 GB RAM · 200 GB · 10 TB egress/mo · forever | **Backstop.** "Operator the user never sees" — one shared cluster for the free cohort. Caveats: hard provisioning (anti-fraud), Ampere often out-of-stock, idle reclaim. Not per-tenant infra. |
| **Axiom** | 500 GB ingest/mo · 30-day retention · OTLP-compatible | **Plausible** if the primitive is "ask English over events" — generous, o11y-shaped, but cedes control of the storage layer. |
| MotherDuck · ClickHouse Cloud · OpenObserve Cloud · Aiven · Altinity · DoubleCloud | trial / credit / eliminated / shut down | **Out** (ClickHouse Cloud sets the <3¢/GB/mo benchmark but has no permanent free tier). |

**Provisional conclusion.** **Tinybird for the user-facing write+query plane**
(no card, never expires) **+ optionally self-hosted ClickHouse on Oracle
Always-Free** as the cost-floor backstop past Tinybird's 10 GB / 1k-reads
ceiling. Neither forces a card at sign-up — the seam `GLOBAL-013` requires.

### 9.2 OTLP ingest hot-path — Workers alternatives that stay free forever

Constraints: *(a) free forever, no card; (b) accepts sustained protobuf POSTs
from an OTel collector; (c) cheap at 1k–10k spans/sec/tenant.*

| Runtime | Free-forever quota | Trade-off vs Workers |
|---|---|---|
| **Cloudflare Workers** (status quo) | 100k req/day · 10 ms CPU/req · global edge | Fits if stateless + writes offloaded (Queues + R2 + drainer). Hard 128 MB / 10 ms (30 s extended) ceilings — fine for ingest, painful for fan-in. |
| **Google Cloud Run** | 2M req/mo · 360k vCPU-sec · 180k GiB-sec | **Best quota; runs a real `otelcol` binary.** Container, scale-to-zero; cold-start ~1–3 s (mitigated with a warm pool). |
| **Deno Deploy** | 100k req/day · 15 h CPU/mo · 6 regions | Same V8-isolate shape as Workers, no per-request CPU wall — wins on heavy protobuf batches; loses on region count. |
| **AWS Lambda** | 1M req/mo · 400k GB-sec | 10× Workers' request quota; cold-start 200–500 ms is fine if collectors batch ≥250 ms; ties cleanly to Kinesis/Firehose. |
| **Koyeb / Northflank** | 1–2 always-free services, commercial use, no card | Long-lived process — natural `otelcol` home; single-pool ceiling fits a *shared* receiver, not tenant-isolated ones. |
| **Oracle Always Free** | 4 ARM OCPU · 24 GB · forever | "Run our own otelcol" path; pairs with the §9.1 self-hosted ClickHouse on the same allocation. |
| Vercel Hobby · Render · Fly.io · Railway | personal-only / sleeps / trial-only | **Out** for a production ingest hot path. |

**Provisional conclusion** — three viable architectures, ranked:

1. **Cloud Run ingest + Tinybird storage.** Cleanest match; both no-card,
   never-expires. Spillover: route a tenant past Tinybird's ceiling to the shared
   Oracle Always-Free ClickHouse as a warm archive.
2. **Workers + Deno Deploy hybrid.** Keep Workers as the routing edge, dispatch
   heavy decode to Deno Deploy (no CPU wall). Adds a second runtime to operate.
3. **All-Oracle.** `otelcol` + ClickHouse on one Always-Free VM — lowest cost,
   but stakes the free tier on Oracle's capacity (a fragile SPOF).

The "Workers everywhere" plan ([`architecture.md §2`](../architecture.md)) does
**not** break, but for o11y it's no longer the cheapest path: we'd *add* one of
Cloud Run / Deno Deploy / Oracle, not replace Workers — same shape as the
existing `multi-engine-adapter` Phase-3 plan, for compute runtimes.

---

## Sources (May 2026)

Primary sources for the trimmed (D5) o11y survey — competitors.md covers
DB / NL-over-DB, not o11y:

- **Landscape:** [Grafana Alternatives — SigNoz](https://signoz.io/blog/grafana-alternatives/) · [SigNoz pricing](https://signoz.io/pricing/) · [Grafana AI launch, GrafanaCON 2026](https://grafana.com/press/2026/04/21/grafana-labs-targets-the-ai-blind-spot-with-new-observability-tools-announced-at-grafanacon-2026/) · [Grafana Assistant](https://grafana.com/products/cloud/ai-observability/) · [Honeycomb Query Assistant](https://www.honeycomb.io/blog/introducing-query-assistant) · [OpenObserve AI Assistant (Mar 2026)](https://openobserve.ai/blog/product-update-march-2026/)
- **Cost floor:** [ClickHouse observability cost playbook (2026)](https://clickhouse.com/resources/engineering/observability-cost-optimization-playbook) · [Managed ClickStack pricing](https://clickhouse.com/blog/introducing-managed-clickstack-beta) · [Cloudflare: exporting OTel](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- **NL-on-o11y:** [PromCopilot — text-to-PromQL (ACM TOSEM)](https://dl.acm.org/doi/10.1145/3797910) · [Catalog-driven NL→PromQL (arXiv 2604.13048)](https://arxiv.org/html/2604.13048v1) · [Gartner: explainable-AI → 50% LLM-observability by 2028](https://www.gartner.com/en/newsroom/press-releases/2026-03-30-gartner-predicts-by-2028-explainable-ai-will-drive-llm-observability-investments-to-50-percent-for-secure-genai-deployment)
- **Free-forever stack (§9):** [Tinybird pricing](https://www.tinybird.co/pricing) + [shared-infra limits](https://www.tinybird.co/docs/forward/pricing/shared-infrastructure) · [Oracle Always Free — Ampere A1](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) · [Axiom pricing](https://axiom.co/pricing) · [Deno Deploy](https://deno.com/deploy/pricing) · [AWS Lambda](https://aws.amazon.com/lambda/pricing/) · [Google Cloud Run](https://cloud.google.com/run/pricing) · [Koyeb](https://www.koyeb.com/pricing) · [Northflank](https://northflank.com/pricing) · [Render free tier](https://render.com/docs/free)
