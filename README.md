# nlqdb — natural-language databases

A database you talk to. Create one, query it in English. The infrastructure is invisible.

Two user actions. That's the whole product:

1. Create a database (one word: a name).
2. Talk to it in natural language.

Engine choice (Postgres / Mongo / Redis / DuckDB / pgvector / …), schema inference, indexing, backups, auto-migration between engines based on your actual workload — background concerns you never have to see.

## Use it

**One CLI command:**

```bash
nlq login                                               # opens browser, one click, done
nlq "an orders tracker — customer, drink, total"        # creates the DB
nlq "today's orders, newest first"
```

**One HTML file:**

```html
<script src="https://elements.nlqdb.com/v1.js" type="module"></script>

<nlq-data
  goal="today's orders, newest first"
  api-key="pk_live_…"
  template="table"
  refresh="5s"
></nlq-data>
```

That's the whole backend. No SQL, no schema, no API, no framework.

→ Full hello-world tutorial: [`./docs/architecture.md` §13](./docs/architecture.md#13-hello-world-e2e-fullstack-tutorial--the-1-pager).

## Examples

[`examples/`](./examples) — minimal scaffolds in plain HTML, Next.js, Nuxt, SvelteKit, Astro, plus a CLI-only walkthrough. Each is the smallest valid integration around one `<nlq-data>` element or one CLI session.

> **Status:** `/v1/ask`, `<nlq-data>`, and the marketing site are live. Examples are spec-only end-to-end until the Phase 1 chat surface ships.

## Progress & roadmap

Pre-alpha. The bar below is the path from "Phase 0 backend exists" to
"high-quality production-grade product".

```
Phase 0  Foundations         ████████████████████  10/10  ✓
Phase 1  On-ramp              ████████░░░░░░░░░░░░   4/11  (sign-in, chat, anon-mode, db.create remaining)
Phase 2  Agent + dev surfaces ████░░░░░░░░░░░░░░░░   1/7   (@nlqdb/sdk shipped)
Phase 3  Multi-engine engine  ░░░░░░░░░░░░░░░░░░░░   0/5
Phase 4  Enterprise polish    ░░░░░░░░░░░░░░░░░░░░   0/6
```

Each step is 2–4 words on purpose — full spec lives in
[`./docs/architecture.md §10`](./docs/architecture.md#10-phased-implementation-plan) and [`./docs/history/infrastructure-setup.md`](./docs/history/infrastructure-setup.md).

### Phase 0 — Foundations ✓

- ✓ Worker skeleton
- ✓ KV + D1 bindings
- ✓ Neon adapter + OTel
- ✓ LLM router (strict-$0)
- ✓ Better Auth (GitHub + Google)
- ✓ `/v1/ask` end-to-end
- ✓ Events queue + drain
- ✓ Stripe webhook + R2
- ✓ CI/CD on merge
- ✓ PR preview environments

### Phase 1 — On-ramp (in progress)

The goal: a stranger lands on `nlqdb.com`, creates a DB in plain English,
embeds it in an HTML file, and sends the link to a friend — in under 60
seconds, no card, no config. The waitlist + carousel on the current site
are a holding pattern; they ship away when all four remaining items land.

- ✓ Marketing site (Astro, Workers Static Assets, live at `nlqdb.com`)
- ✓ `<nlq-data>` v0 (live, public `/v1/demo/ask` endpoint, fixture-backed)
- ✓ Waitlist + capability carousel (holding pattern; removed at Phase 1 close)
- ✓ `apps/web` live at `nlqdb.com` (DNS flip complete, PR #56)
- ◯ Sign-in UI — magic-link + GitHub OAuth (`/api/auth/*` backend ready; requires Resend DKIM/SPF/DMARC)
- ◯ Chat surface — streaming 3-part response, anon-mode (`/v1/chat/messages` backend ready)
- ◯ Anonymous-mode web flow — 72h localStorage token → adopt on sign-in (`/v1/anon/adopt` backend ready)
- ◯ Hosted db.create — typed-plan + provisioner ([`docs/architecture.md §3.6`](./docs/architecture.md)). Unblocks every `<nlq-data>` live claim.
- ◯ API keys page (`pk_live_<dbId>...` per-db, `sk_live_…` account-scoped)
- ◯ `<nlq-action>` writes (signed write-tokens)
- ◯ Hello-world tutorial (canonical entry; satisfied by db.create)

### Phase 2 — Agent + developer surfaces

- ◯ CLI `nlq` (Go binary)
- ◯ MCP server (hosted)
- ◯ Framework wrappers (Next, Nuxt, React, Vue)
- ✓ `@nlqdb/sdk` (typed client; `ask` / `listChat` / `postChat` + `NlqdbApiError`)
- ◯ CSV upload
- ◯ Stripe live + Checkout + Portal
- ◯ Usage metering (Lago)

### Phase 3 — Multi-engine engine (the moat)

- ◯ Workload Analyzer
- ◯ Migration Orchestrator
- ◯ Redis as second engine
- ◯ DuckDB analytics path
- ◯ Dual-read verification

### Phase 4 — Enterprise polish

- ◯ SAML / OIDC SSO
- ◯ Audit log export
- ◯ Per-org quotas + budget caps
- ◯ SOC 2 Type 1
- ◯ EU data residency
- ◯ VPC peering

---

### What's blocking on me (human-only steps)

Things the code can't do for itself. Each block lists the cheapest
trigger to unlock it.

**Right now:** none — PR previews ship via GH Actions (deploy-api,
deploy-web, preview-{api,web,elements}); no manual Cloudflare
dashboard wiring required ([RUNBOOK §6](./docs/runbook.md)). The earlier
"connect Pages git integration for `nlqdb-elements`" item was made
obsolete by the move to GH Actions for every surface.

**Phase 1 — before public soft launch:**

- ◯ Resend domain verification (DKIM/SPF/DMARC for `nlqdb.com`)
- ◯ LogSnag account → drop `LOGSNAG_TOKEN` + `LOGSNAG_PROJECT` in `.envrc`
- ◯ Plausible self-hosted on Fly (web analytics, free)

**Phase 2 — before charging anyone:**

- ◯ Stripe go-live: production keys, Stripe Tax enable
- ◯ Lago on Fly (self-hosted, free) for usage metering
- ◯ Listmonk on Fly (self-hosted, free) for marketing email
- ◯ Apply for Anthropic / OpenAI / Modal / Together startup credits *(non-blocking)*
- ◯ npm publish workflow for `@nlqdb/elements`, `@nlqdb/sdk` *(when v1 is real)*

**Phase 3+ — before enterprise pitches:**

- ◯ Make repo public (currently private through pre-alpha)
- ◯ Submit to Anthropic / Mistral / Bedrock partner programs

---

### Cost ladder — pay only when someone pays you

**Strict rule: $0/month while there are no paying customers.** Then
add only what is strictly forced by traffic or contractual need.

**Today: $0/month** *(+ ~$85/yr unavoidable for the two domain renewals)*

- Cloudflare Free plan — both zones
- Workers / KV / D1 / R2 / Queues / Workers AI — free tier limits
- Neon — 0.5 GB free, scale-to-zero
- Upstash Redis — free tier
- LLM inference — Gemini + Groq + OpenRouter + Workers AI free tiers; Ollama for dev
- Sentry / Grafana Cloud / Resend / LogSnag — free tiers
- GitHub — free private org

**Triggered by the first paying client (transaction-fee only, no monthly):**

- Stripe live mode — only the per-transaction fee on real revenue
- Stripe Tax — 0.5% per live transaction

**Triggered by specific events (only when the event actually happens):**

| Trigger | Upgrade | Monthly cost |
|---|---|---|
| Sustained L7 attack the free WAF can't classify | Cloudflare Pro | $25 |
| Neon DB exceeds 0.5 GB or needs no-pause | Neon Launch | $19 |
| > 3k emails/mo (≈ 100 signups/day) | Resend Pro | $20 |
| > 5k errors/mo | Sentry Team | $26 |
| > 2.5k product events/mo | LogSnag paid | $10 |
| > 100k Worker requests/day | Workers Paid | $5 |
| LLM bills exceed startup credits | Anthropic / OpenAI direct | variable |
| Usage metering needed (Phase 2 paid users) | Lago + Listmonk on 1 Fly Machine | ~$5 |

The point: every line above is gated on a real signal. **Don't
upgrade pre-emptively.** `docs/architecture.md §8` has the full unit-economics model.

---

### Open scaling decisions (block large-company customers)

None of these matter pre-PMF. Each must be decided before its phase
ships, not before. Listed in order of when they bite.

| Decision | Decide by |
|---|---|
| Multi-tenancy at scale: shared Neon cluster vs per-tenant compute | Phase 2 |
| Per-org billing, quotas, budget caps | Phase 2 |
| SAML / OIDC SSO for org accounts | Phase 2 |
| Audit log export format + retention | Phase 2 |
| Pricing model above Pro (custom Enterprise) | Phase 3 |
| EU data residency option | Phase 2 / 3 |
| Compliance posture: SOC 2 Type 1 → ISO 27001 → GDPR DPIA | Phase 3 |
| VPC peering for Enterprise | Phase 3 |
| Custom contracts (annual commit, MSA, DPA) | Phase 3 |
| Cross-region DR + backup RPO/RTO | Phase 3 |
| First sales-engineering / customer-success hire | Phase 3+ |
| Bug-bounty program (paid vs credit-only) | Phase 3+ |

---

### Reference

- [./docs/architecture.md](./docs/architecture.md) — system design (auth, pricing, $0 stack, AI-model selection, hello-world §13, hosted db.create §3.6, phase plan §10).
- [./docs/history/infrastructure-setup.md](./docs/history/infrastructure-setup.md) — Phase 0 infrastructure setup lessons.
- [./docs/performance.md](./docs/performance.md) — SLOs, latency budgets, span/metric catalog.
- [./docs/guidelines.md](./docs/guidelines.md) — four-habit decision rules.
- [./docs/runbook.md](./docs/runbook.md) — what's actually provisioned right now (deploy strategy, preview envs, anonymous-db lifecycle).
- [docs/research-receipts.md](./docs/research-receipts.md) — prior-art and incident research that shaped the design (Replit, Cortex Analyst, Pinterest table-card RAG, Keysight prompt-injection, Neon free-plan capacity math).
- [./docs/research/personas.md](./docs/research/personas.md) — who we're building for.
- [./docs/competitors.md](./docs/competitors.md) — competitive landscape.

## Getting started (dev)

```bash
git clone git@github.com:nlqdb/nlqdb.git && cd nlqdb
scripts/bootstrap-dev.sh   # installs everything, pulls Ollama models, seeds .envrc
scripts/login-cloud.sh     # signs you into cloud providers that have a CLI flow
```

What `bootstrap-dev.sh` stands up in one shot (see [`./docs/history/infrastructure-setup.md §8`](./docs/history/infrastructure-setup.md#8-dev-toolchain)):

- **Runtimes:** Bun (package manager + JS/TS runtime), Node 20+, Go 1.24+, uv (Python).
- **Formatter + linter:** Biome (JS/TS/JSON/CSS), gofumpt + golangci-lint (Go), ruff (Python).
- **Git hooks:** lefthook — `pre-commit` runs Biome/gofumpt/golangci-lint/ruff on staged files; `commit-msg` enforces Conventional Commits; `pre-push` runs whole-repo checks.
- **Cloud CLIs:** wrangler, flyctl, aws, stripe, gh.
- **Local LLM:** Ollama + `llama3.2:3b` and `qwen2.5:7b` for offline dev against the LLM router.
- **Env / secrets:** `.envrc` with self-generated `BETTER_AUTH_SECRET` / `INTERNAL_JWT_SECRET`, loaded by direnv.

Day-to-day:

```bash
bun run fix          # biome format + lint --write (most issues)
bun run check:all    # biome + golangci-lint + ruff (what CI runs)
bun run hooks:run    # run pre-commit hooks against staged files
```

## Surfaces (planned, Phase 1)

- Web chat UI — single page, 60 seconds from landing to first query, no card required.
- HTTP API — two endpoints: create DB, query DB.
- CLI — single static binary: `nlq new`, `nlq login`, `nlq "..."`.
- MCP server — so agents can use it too.
- `<nlq-data>` / `<nlq-action>` HTML elements — the embeddable backend.
- Plus the platform integrations matrix in [`docs/progress.md`](./docs/progress.md) — Nuxt, Next, SvelteKit, Astro, mobile, server middleware, IDE extensions, no-code, iPaaS, analytics tooling, chat platforms.

## Community + legal

- [CONTRIBUTING.md](./CONTRIBUTING.md) — dev setup, branch naming, commits, CLA flow.
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — Contributor Covenant 2.1. Reports to `conduct@nlqdb.com`.
- [SECURITY.md](./SECURITY.md) — vulnerability disclosure (`security@nlqdb.com`, GitHub PVR, Signal). 90-day fix target, credit-only Hall of Fame.
- [SUPPORT.md](./SUPPORT.md) — where to ask questions and what we don't (yet) offer.
- [CLA.md](./CLA.md) — Contributor License Agreement, signed once via the bot on your first PR.
- [TRADEMARKS.md](./TRADEMARKS.md) — what you can and can't do with the nlqdb name and logo.
- [SUBPROCESSORS.md](./SUBPROCESSORS.md) — third-party services that may process personal data on our behalf.
- [IMPRESSUM.md](./IMPRESSUM.md) — Swiss UWG-mandated operator disclosures.
- [LEGAL.md](./LEGAL.md) — running checklist of every legal-housekeeping item, what's done vs pending, free-only path documented.
- Privacy policy and terms of service: [nlqdb.com/privacy](https://nlqdb.com/privacy) · [nlqdb.com/terms](https://nlqdb.com/terms).

## License

[FSL-1.1-ALv2](./LICENSE) — Functional Source License, Apache 2.0 future
license. Source-available for any non-competing use; auto-converts to
Apache 2.0 two years after each release. (Pattern used by Sentry,
Convex, and others.)

`nlqdb`™ is an unregistered trademark of the project's licensor. See [TRADEMARKS.md](./TRADEMARKS.md) for usage guidelines.
