# Lessons Learnt — Initial Infrastructure Setup

One-time steps taken to stand up the nlqdb stack from scratch. Preserved here so future maintainers understand *why* things are configured the way they are, and so onboarding a new environment (staging, disaster-recovery clone) is reproducible.

---

## 1. Domains

### 1.1 Cloudflare plan per zone: Free ($0/mo/zone)

Both `nlqdb.com` and `nlqdb.ai` run on Cloudflare's Free tier through Phase 2. What the Free plan provides:

| Capability                              | Free tier                           |
| :-------------------------------------- | :---------------------------------- |
| DNS                                     | Fast, unlimited queries             |
| Global CDN                              | Unlimited bandwidth, full coverage  |
| Universal SSL                           | Edge + origin (ECC)                 |
| Application-layer DDoS                  | Unmetered                           |
| Rate limiting                           | IP-based only                       |
| WAF                                     | High-severity / widespread vulns    |
| Bot management                          | Common bots only                    |
| Page / transform / origin rules         | 70 total                            |
| Custom Cloudflare Rules                 | 5                                   |
| Custom WAF Rules                        | 5                                   |
| Support                                 | Community + docs                    |

**Why Free suffices through Phase 2:**
- No SLA or managed-WAF rules needed pre-PMF.
- 5 custom rules are enough for the two gates we care about: block POSTs outside `/v1/*` at the edge, and cache all `GET /v1/ask` by `(schema_hash, query_hash)`.
- Workers / KV / D1 / R2 / Queues / Workers AI / Durable Objects are priced per-request, not per-zone — Free plan doesn't cap them.
- Custom embed domains (Phase 2) use **Cloudflare for SaaS**, whose first 100 zones are free independent of the plan on `nlqdb.com`.

**Upgrade triggers:**
- Sustained L7 attack that the free WAF doesn't classify → Pro ($25/mo).
- Needing more than 5 custom Cloudflare Rules or 5 custom WAF Rules.
- Needing Argo Smart Routing or Load Balancing (unlikely pre-Phase 3).
- Requiring business-hour support SLA — Enterprise only; revisit at Phase 4.

### 1.2 DNS migration from GoDaddy

`nlqdb.com` and `nlqdb.ai` were registered at GoDaddy. Cloudflare's *Add a site* wizard scans the registrar and imports existing records. **Delete every imported record** before hitting *Continue*:

| Record (as imported) | Action | Why |
| :------------------- | :----- | :-- |
| `A @ → 13.248.243.5` / `76.223.105.230` | delete | GoDaddy parking-page IPs; Phase 0 points apex at a Cloudflare Worker (`nlqdb-web`). |
| `CNAME _domainconnect → …gd.domaincontrol.com` | delete | GoDaddy Domain Connect; useless off GoDaddy DNS. |
| `CNAME www → nlqdb.com`                  | delete | Re-add cleanly when the Worker custom-domain is wired. |
| `TXT _dmarc → rua=…onsecureserver.net`   | delete | GoDaddy's DMARC aggregator; we set a real SPF/DKIM/DMARC when Resend lands in Phase 1. |

At GoDaddy (once, per zone): `dcc.godaddy.com` → *My Products* → `<zone>` → *DNS* → *Nameservers* → *Change* → *"I'll use my own nameservers"* → paste the two Cloudflare-assigned NS → Save. The parked-page shows until NS propagation completes (5–30 min typical).

**Assigned nameservers** (Cloudflare picks 2 at zone creation; these are permanent for the life of the zone, not rotated):

| Zone         | NS 1                       | NS 2                     |
| :----------- | :------------------------- | :----------------------- |
| `nlqdb.com`  | `jeremy.ns.cloudflare.com` | `kiki.ns.cloudflare.com` |
| `nlqdb.ai`   | _(assigned on add-a-site)_ | _(assigned on add-a-site)_ |

### 1.3 DNSSEC kill-switch (CRITICAL)

If DNSSEC is enabled on the domain at GoDaddy, switching NS without disabling it first **breaks the domain** (resolvers return SERVFAIL because the DS records no longer match). Ordered steps:

1. GoDaddy → the domain → *DNSSEC* → **Disable / Off**. Wait 1–2 min for GoDaddy's DS records to clear from `.com` TLD.
2. GoDaddy → *Nameservers* → *Change* → paste Cloudflare NS → Save.
3. Optionally, after the zone is active on Cloudflare, re-enable DNSSEC from the Cloudflare dashboard (*DNS* → *Settings* → *DNSSEC*), then copy the DS record Cloudflare gives you back to GoDaddy's *DNSSEC* page.

### 1.4 Inbound email — Cloudflare Email Routing (free)

Both zones use **Cloudflare Email Routing** (Free plan feature; included with the zone, no extra SKU) for `hello@`, `security@`, `contact@`, `abuse@`, etc. Forwards inbound to the founder's existing inbox; up to 200 addresses per zone, unlimited volume, no card.

| Capability              | Email Routing                         |
| :---------------------- | :------------------------------------ |
| Inbound forwarding      | ✅ Yes, unlimited volume              |
| Outbound ("send as")    | ❌ No — use Resend                    |
| Mailbox hosting         | ❌ No — forwards only                 |
| Custom addresses        | Up to 200 rules per zone              |
| Catch-all               | ✅ Yes                                |
| MX / SPF auto-setup     | ✅ Cloudflare auto-writes the records |

**DKIM / DMARC:** Resend's DKIM is set up when outbound email lands in Phase 1. DMARC is set after both inbound (Email Routing) and outbound (Resend) are aligned — premature DMARC breaks mail flow.

**Setup sequence (per zone, once NS are flipped):**
1. Dashboard → the zone → *Email* → *Email Routing* → *Get started*.
2. Cloudflare writes MX + SPF records automatically.
3. Add the destination email (founder's real inbox); Cloudflare sends a one-time verification link — click it.
4. Create forwarding rules: `hello@` → `$FOUNDER_EMAIL`, catch-all `*@` → `$FOUNDER_EMAIL`.

---

## 2. Identity / source / distribution

- **GitHub org `nlqdb`** — branch protection, required reviews, secret scanning, Dependabot.
- **npm org `nlqdb`** (reserves `@nlqdb/*`).
- **`nlqdb/homebrew-tap`** (GitHub repo).
- ~~Docker Hub org `nlqdb`~~ → **skipped**. Docker removed the free-org tier (Team plan now starts at $15/seat/mo), which conflicts with the strict-$0 budget. Images (if/when we ship them in Phase 3+) publish to **GitHub Container Registry** under `ghcr.io/nlqdb/<image>` — free for public images, no extra account.

---

## 3. Hosting / runtime

| Service | Account note |
| :------ | :----------- |
| **Cloudflare** — Pages, Workers, KV, D1, R2, Queues, Workers AI, Durable Objects | Capture `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (scoped), `CF_AI_TOKEN`. |
| **Neon** — Postgres 17 GA | `NEON_API_KEY`. Every Neon project uses Postgres 17. **Neon Auth is OFF** on every project — auth lives in Cloudflare Workers via Better Auth; Neon Auth tables would pollute tenant schemas. |
| **Upstash** — Redis | `UPSTASH_REDIS_REST_TOKEN`. |
| **Fly.io** — Listmonk / Plausible / Lago | `FLY_API_TOKEN`. |

---

## 4. LLM inference (all no-card)

| Provider | Key | Free limit |
| :------- | :-- | :--------- |
| Google AI Studio | `GEMINI_API_KEY` | 500 RPD Flash / 100 RPD Pro |
| Groq Cloud | `GROQ_API_KEY` | 14,400 RPD 8B / 1,000 RPD 70B |
| OpenRouter | `OPENROUTER_API_KEY` | fallback only |
| Cloudflare Workers AI | covered by `CF_AI_TOKEN` | 10k Neurons/day |
| Ollama on dev laptops | — | local; Llama 3.2 3B, Qwen 2.5 7B |

Optional (apply Day 1, don't block): Anthropic / OpenAI / Google Cloud for Startups / Modal startup credits.

---

## 5. Auth / email / payments

| Key | Notes |
| :-- | :---- |
| `BETTER_AUTH_SECRET` | Self-generated. |
| `INTERNAL_JWT_SECRET` | Workers-only; signs 30s internal JWTs. |
| **GitHub OAuth app — `nlqdb-web` (prod)** → `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` | Single callback URL: `https://app.nlqdb.com/api/auth/callback/github`. The `OAUTH_*` prefix avoids GitHub Actions' reserved `GITHUB_*` namespace. Device-code flow enabled for CLI. |
| **GitHub OAuth app — `nlqdb-web-dev`** → `OAUTH_GITHUB_CLIENT_ID_DEV`, `OAUTH_GITHUB_CLIENT_SECRET_DEV` | Callback: `http://localhost:8787/api/auth/callback/github`. Required because GitHub OAuth Apps support exactly one callback URL each. |
| **Google OAuth client** → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | GCP project: `nlqdb`. OAuth consent screen in **Testing** mode; publishing deferred until Phase 1 public launch. Scopes: `openid`, `/auth/userinfo.email`, `/auth/userinfo.profile` — all non-sensitive. |
| **Resend** → `RESEND_API_KEY` | Free tier, 3k emails/mo. Domain verification for `nlqdb.com` (SPF/DKIM/DMARC) deferred to Phase 1 — no outbound mail until magic-link sign-in lands. |
| **Stripe (test mode)** → `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | Merchant: Switzerland / CHF; statement descriptor `NLQDB.COM`. Stripe Tax to enable when going live in Phase 2. |
| `STRIPE_WEBHOOK_SECRET` | Phase 0 — needs `apps/api` to host the webhook endpoint before the signing secret can be minted. |

**AWS SES dropped.** AWS account creation requires a credit card — violates strict-$0. Resend free tier is overkill for pre-PMF traffic; when we hit the ceiling prefer Postmark / MailerSend / Loops over AWS SES.

---

## 6. Observability

| Service | Key | Notes |
| :------ | :-- | :---- |
| **Sentry** | `SENTRY_DSN` | 5k errors/mo free. |
| **Plausible** | self-hosted on Fly | No SaaS key. Phase 1. |
| **Grafana Cloud OTLP** | `GRAFANA_CLOUD_API_KEY`, `GRAFANA_CLOUD_INSTANCE_ID`, `GRAFANA_OTLP_ENDPOINT` | Stack `nlqdb` on `us-east-2`, instance `1609127`, access policy `nlqdb-phase0-telemetry` with `metrics:write` + `logs:write` + `traces:write`. Live-verified via empty OTLP envelope POST. |
| **LogSnag** | `LOGSNAG_TOKEN`, `LOGSNAG_PROJECT` | Sole product-event sink for now. Free tier 2,500 events/mo. Sign-ins deliberately **not** emitted — they would dominate the quota. If `LOGSNAG_TOKEN` is absent on the consumer Worker, the sink ack-and-drops (unit-tested) so dev + CI never need real credentials. |
| **PostHog Cloud** | `POSTHOG_API_KEY`, `POSTHOG_HOST` | **Phase 2, optional** — only if a cohort / funnel / retention question lands that SQL on D1/Neon can't answer. Wires into `packages/events` as a second sink; call sites stay unchanged. |

---

## 7. Secret management

Three concentric scopes:

1. **Local dev** — `.envrc` (gitignored), loaded by `direnv`. Encrypted backup at `~/Library/Mobile Documents/.../nlqdb-backups/.envrc.age` (out of repo, see `docs/runbook.md §8`).
2. **CI (GitHub Actions)** — mirrored from `.envrc` via `scripts/mirror-secrets-gha.sh` (idempotent; values read via `--body -` so they never reach argv / ps / shell history). Names are 1:1 with `.env.example` minus `BETTER_AUTH_SECRET` + `INTERNAL_JWT_SECRET` (CI generates ephemeral values per run). Re-run the script whenever a credential rotates.
3. **Runtime (Cloudflare Workers)** — mirror from `.envrc` via `wrangler secret put` once `apps/api` exists.

`.env.example` is the canonical name list — adding a secret requires updating `.env.example` AND the `SECRETS=` array in `scripts/mirror-secrets-gha.sh` simultaneously.

---

## 8. Dev toolchain

A single script `scripts/bootstrap-dev.sh` stands up every local tool, pulls Ollama models, seeds `.envrc` from `.env.example`, installs workspace deps, and wires git hooks. A dev with a clean machine runs it once.

| Purpose                        | Tool                              |
| :----------------------------- | :-------------------------------- |
| JS/TS runtime + package mgr    | **Bun** (`bun@1.3+`)              |
| Python envs + tools            | **uv**                            |
| Go CLI                         | Go 1.24+                          |
| JS/TS/JSON/CSS format + lint   | **Biome**                         |
| Go format                      | **gofumpt**                       |
| Go lint                        | **golangci-lint**                 |
| Python format + lint           | **ruff**                          |
| Git hooks (pre-commit/push)    | **lefthook**                      |
| Cloud CLIs                     | wrangler (via Bun), flyctl, aws, stripe, gh |
| Local LLM                      | Ollama (`llama3.2:3b`, `qwen2.5:7b`) |
| Env / secrets loader           | direnv                            |

**Rationale:** one binary per job, all Rust- or Go-compiled, sub-second runtime budget on a monorepo we expect to reach 200k+ LOC. Prettier + ESLint + husky are explicitly out — they are slow enough that devs disable them, and Biome + lefthook cover the same surface in a single install with ~10× the throughput.

Commit-message policy: **Conventional Commits** (enforced by lefthook `commit-msg` hook).

**Total Day-1 spend: $0.** Recurring: ~$7/mo amortized domains.
