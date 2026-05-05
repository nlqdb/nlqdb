# nlqdb Runbook

Living state-of-the-world doc. Ground truth for *what's provisioned*,
*where it lives*, and *how to get back in*. Edit this whenever
infrastructure changes — if it goes stale, the rest of the repo gets
harder to operate.

- [./architecture.md](./architecture.md) — architectural narrative, phase plan, tech-stack rationale.
- [./performance.md](./performance.md) — SLOs, latency budgets, span/metric catalog.
- [docs/features/](../docs/features/) — canonical per-feature decisions.
- [./decisions.md](./decisions.md) + [./decisions/](./decisions/) — canonical cross-cutting `GLOBAL-NNN` (index + one shard per decision).
- **this file** — what's actually set up right now (operational state,
  not decisions; if a sentence here disagrees with a skill, the skill wins).

**Last verified: 2026-04-28.** Running `./scripts/verify-secrets.sh`
should return 21/21 green (or more, as provisioning expands).

---

## 1. What is live

| Surface                     | URL                                 | State                          |
| :-------------------------- | :---------------------------------- | :----------------------------- |
| `nlqdb.com` / `www`         | https://nlqdb.com                   | 200 — `nlqdb-web` Worker (Workers Static Assets) |
| Privacy policy              | https://nlqdb.com/privacy           | 200 |
| Terms of service            | https://nlqdb.com/terms             | 200 |
| Alt apex                    | https://nlqdb.ai                    | 301 → `https://nlqdb.com/`     |
| Alt www                     | https://www.nlqdb.ai                | 301 → `https://nlqdb.com/…`    |
| `nlqdb-api` health          | https://app.nlqdb.com/v1/health     | 200; bindings `kv` + `db` green |
| `nlqdb-api` auth            | https://app.nlqdb.com/api/auth/*    | Better Auth — GitHub + Google + magic-link APIs ready; web UI is Phase 1 remaining |

---

## 2. Domains

Both zones are on Cloudflare's **Free plan**, nameservers
`jeremy.ns.cloudflare.com` + `kiki.ns.cloudflare.com`, registered at
GoDaddy. DNSSEC is off at both ends (safe for now; optional to
re-enable via Cloudflare later).

### `nlqdb.com`

- DNS managed by Cloudflare.
- **Custom-domain routing** — `nlqdb.com` and `www.nlqdb.com` are
  served by the `nlqdb-web` Worker (Workers Static Assets). The legacy
  `nlqdb-web` Pages project and `nlqdb-coming-soon` Pages project both
  have 0 custom domains and can be deleted from the Cloudflare dashboard.
- `www` follows the same routing as the apex.
- **Cloudflare Email Routing ON:**
  - `hello@nlqdb.com` → founder's personal inbox (verified).
  - Catch-all: check current state at
    https://dash.cloudflare.com → zone → Email.

### `nlqdb.ai`

- DNS managed by Cloudflare.
- `AAAA @ → 100::` proxied (dummy target; Cloudflare Single Redirect
  rule intercepts before the target matters).
- `CNAME www → nlqdb.ai` proxied.
- **Single Redirect rule:** `All incoming requests` → dynamic
  expression `concat("https://nlqdb.com", http.request.uri)`, status
  301. Preserves path + query string.
- Email Routing: **not yet enabled.** When enabled, forward to the
  same destination as `nlqdb.com`.

---

## 3. Accounts

| Service          | Account                   | Plan                              | Non-secret identifier                              |
| :--------------- | :------------------------ | :-------------------------------- | :------------------------------------------------- |
| GitHub           | `omerhochman` (personal)  | Org `nlqdb` (free)                | Repo: `nlqdb/nlqdb`; tap: `nlqdb/homebrew-tap`     |
| npm              | `omerhochman`             | Free (unlimited public packages)  | Scope `@nlqdb`                                     |
| Cloudflare       | `omer.hochman@gmail.com`  | Free per zone                     | Token name: `nlqdb-phase0-dev`                     |
| Neon             | `omer.hochman@gmail.com`  | Free                              | Project in `us-east-1`, PG 17, **Neon Auth OFF**   |
| Upstash          | `omer.hochman@gmail.com`  | Free                              | Redis DB provisioned                               |
| Fly.io           | `omer.hochman@gmail.com`  | 7-day trial → PAYG (no card yet)  | Org `personal`, **no apps**, token scope: `org`    |
| Sentry           | `omer.hochman@gmail.com`  | 14-day Business trial → Developer | Project: `nlqdb-api` (Cloudflare Workers platform) |
| Google AI Studio | Existing                  | Free                              | Gemini API key                                     |
| Groq             | Existing                  | Free                              | —                                                  |
| OpenRouter       | Existing                  | Free (fallback)                   | —                                                  |
| Google Cloud     | `omer.hochman@gmail.com`  | Free                              | Project `nlqdb`, OAuth consent screen **In production** |
| Resend           | `omer.hochman@gmail.com`  | Free (3k emails/mo)               | API key `nlqdb-phase0`; domain verification ⏳ Phase 1 |
| Stripe           | `omer.hochman@gmail.com`  | Test mode (no card)               | Merchant: Switzerland / CHF; descriptor `NLQDB.COM`; webhook secret ⏳ Phase 0 §3 |
| Grafana Cloud    | `omer.hochman@gmail.com`  | Free                              | Stack `nlqdb` on `us-east-2`, instance `1609127`, access policy `nlqdb-phase0-telemetry` |
| Docker Hub       | **SKIPPED**               | —                                 | Using `ghcr.io/nlqdb` instead (paid-only org tier) |

**Not yet provisioned**:

- Stripe webhook secret — needs `apps/api` (Phase 0 §3) to host the endpoint.
- LogSnag (`LOGSNAG_TOKEN` + `LOGSNAG_PROJECT`) — Phase 1. Free tier
  (2,500 events/mo, 3 seats). Sole sink for `packages/events`; LogSnag
  fans events out to Slack / Discord / email itself.

**Explicitly deferred** (re-evaluate if a real cohort question lands):

- PostHog Cloud (`POSTHOG_API_KEY`, `POSTHOG_HOST`) — optional Phase 2
  second sink for funnels / retention. Pre-PMF, SQL on D1/Neon
  answers every analytics question we actually have. Designed to
  plug into `packages/events` with zero call-site changes when
  needed.

**Explicitly skipped** (re-evaluate post-PMF):

- AWS SES — card-required; Resend free tier (3k/mo) is enough pre-PMF.
  When/if a fallback is needed, prefer Postmark / MailerSend / Loops.

---

## 4. Secrets

Every credential's canonical name lives in
[`.env.example`](../.env.example). Never commit real values.

- **Local dev:** `.envrc` (gitignored), loaded automatically by
  direnv. Regenerate self-signed secrets by running
  `scripts/bootstrap-dev.sh` after deleting `.envrc`.
- **CI (GitHub Actions):** mirrored from `.envrc` via
  `scripts/mirror-secrets-gha.sh` (idempotent; never logs values).
  Skips `BETTER_AUTH_SECRET` + `INTERNAL_JWT_SECRET` — local-dev only;
  CI workflows generate ephemeral test values per run.
- **Runtime (Cloudflare Workers):** not yet mirrored — Phase 0 §3
  pending (needs `apps/api` to exist).

**Live verification:** `./scripts/verify-secrets.sh`. Current baseline
is 21 ✅ across self-generated, Cloudflare ×3, Neon ×2, Fly, Upstash,
LLM ×3, OAuth ×4 (Google ×2 + GitHub prod pair + GitHub dev pair),
Resend, Stripe ×2 (sk + pk), Grafana, Sentry. Stripe webhook secret
skips cleanly until `apps/api` exists (Phase 0 §3).

**Values never echoed** — all checks are length/HTTP-status based.

---

## 5. Google OAuth — what's configured

Currently **In production** — anyone with a Google account can sign in.
Verification only needed if we add sensitive/restricted scopes; the
`openid` + `userinfo.{email,profile}` set we use is non-sensitive, so
the consent screen ships unverified-but-public (Google shows an
"unverified app" warning the first time but allows the flow).

- **GCP project:** `nlqdb`
- **OAuth consent screen** (Branding tab):
  - App name: `nlqdb`
  - User support email: `contact@nlqdb.com` (needs Email Routing rule
    — currently only `hello@` is forwarded; add `contact@` or flip
    catch-all on if Google's verification emails get lost)
  - Privacy policy: https://nlqdb.com/privacy
  - Terms of service: https://nlqdb.com/terms
  - Authorized domain: `nlqdb.com`
- **Audience:** External, Production status.
- **Data access (scopes):** `openid`, `/auth/userinfo.email`,
  `/auth/userinfo.profile` — all non-sensitive, so the app stays
  unverified-but-public; verification submission only needed if we
  later request sensitive scopes (Drive / Gmail / Calendar / etc.).
- **OAuth 2.0 Client** — Web application named `nlqdb-web`:
  - Authorized JavaScript origins:
    - `https://app.nlqdb.com`
    - `https://nlqdb.com`
    - `http://localhost:8787` (Wrangler dev — Better Auth lives in
      Workers, see §5b)
  - Authorized redirect URIs:
    - `https://app.nlqdb.com/api/auth/callback/google` (prod)
    - `http://localhost:8787/api/auth/callback/google` (Wrangler dev)
  - Credentials in `.envrc` as `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.

  **Path scheme:** `/api/auth/*` is Better Auth's default basePath; we
  keep it. Custom device-flow endpoints land at `/v1/auth/{device,
  device/token, refresh, logout}` in a later slice (different paths,
  different ownership) — Google's redirect URI list above is OAuth-only.

**Re-verification trigger.** Stay in production with the current
non-sensitive scope set indefinitely. The moment we add a sensitive
or restricted scope (Drive / Gmail / Calendar / fitness / health), we
need to submit for verification — Google reviews can take weeks for
sensitive scopes, longer for restricted. Do not roll a sensitive
scope into production without budgeting that timeline.

---

## 5b. GitHub OAuth — what's configured

Classic **OAuth App** under the `nlqdb` GitHub org (not a GitHub App —
we need sign-in only, no installation/permission semantics). nlqdb is
**engine-agnostic** — describe its sign-in to the user as "Sign in to
nlqdb." rather than naming a specific backend.

- **Org settings page:** `https://github.com/organizations/nlqdb/settings/applications`
- **App name:** `nlqdb-web` (production sign-in).
- **Homepage URL:** `https://nlqdb.com`
- **Authorization callback URL** — exactly **one** URL per OAuth App.
  GitHub OAuth Apps **do not support** multiple callback URLs (that
  capability is for GitHub Apps, a different product). Multi-env
  strategy:
  - **`nlqdb-web` (prod):** homepage `https://nlqdb.com`, callback
    `https://app.nlqdb.com/api/auth/callback/github`. Credentials in
    `.envrc` as `OAUTH_GITHUB_CLIENT_ID` + `_SECRET`.
  - **`nlqdb-web-dev`:** homepage `http://localhost:8787` (Wrangler
    dev — Better Auth lives in Workers per DESIGN §4), callback
    `http://localhost:8787/api/auth/callback/github`. Credentials in
    `.envrc` as `OAUTH_GITHUB_CLIENT_ID_DEV` + `_SECRET_DEV`. Better
    Auth picks based on `NODE_ENV` (set via `wrangler.toml [vars]`).
  - `/api/auth/*` is Better Auth's default basePath; we keep it.
    `/v1/auth/{device, device/token, refresh, logout}` are different
    custom endpoints landing in a later slice — they don't use this
    callback URL.
  - `https://nlqdb.com/device/approve` is the **device-flow user-prompt
    page**, not an OAuth redirect — device flow polls and never invokes
    the callback URL, so it doesn't need to be registered.
- **Enable Device Flow:** ✅ — CLI uses device-code flow (`nlq login`)
  per [./architecture.md §3.3](./architecture.md#33-cli--nlq).
- **Webhook URL:** _none_ — auth-only, no webhook.
- **Credentials in `.envrc`** as `OAUTH_GITHUB_CLIENT_ID` +
  `OAUTH_GITHUB_CLIENT_SECRET` (the `OAUTH_*` prefix avoids GHA's
  reserved `GITHUB_*` namespace; same names used in CI / Workers
  secrets so mirroring is 1:1). Refresh `.envrc.age` via
  `scripts/backup-envrc.sh` after pasting.

**Verification:** `./scripts/verify-secrets.sh` does a live probe of
`POST /applications/{client_id}/token` with the secret pair as Basic
auth and a deliberately-bogus token in the body. Expected HTTP **404**
= Basic auth accepted, the bogus token correctly not-found. **401** is
the failure path (Basic auth rejected = wrong id or secret).

---

## 6. Deployments

**Strategy** (per surface):

| Surface              | Hosting             | Production deploy                                          | PR preview                                                    |
| :------------------- | :------------------ | :--------------------------------------------------------- | :------------------------------------------------------------ |
| `apps/api`           | Cloudflare Workers  | GH Actions — `.github/workflows/deploy-api.yml`            | GH Actions — `.github/workflows/preview-api.yml` (Workers Versions on `nlqdb-api`; per-PR URL) |
| `apps/events-worker` | Cloudflare Workers  | GH Actions — `.github/workflows/deploy-events-worker.yml`  | n/a (queue-only; nothing visible to preview)                  |
| `apps/coming-soon`   | Cloudflare Pages    | retired — `nlqdb.com` now served by `apps/web`              | n/a |
| `apps/web`           | Workers Static Assets | GH Actions — `.github/workflows/deploy-web.yml`          | GH Actions — `.github/workflows/preview-web.yml` (Workers Versions on `nlqdb-web`; per-PR URL) |
| `packages/elements`  | Cloudflare Pages    | GH Actions — `.github/workflows/deploy-elements.yml`       | GH Actions — `.github/workflows/preview-elements.yml` (sticky `pr-<N>.nlqdb-elements.pages.dev/v1.js`) |

Every surface deploys via GH Actions. Reasons we don't use
Cloudflare Pages git integration for the static surfaces:

- **Uniformity** — one mechanism, one set of logs, one place to
  look when a deploy breaks.
- **Pre-deploy gating** — biome / typecheck / tests in `ci.yml`
  run on the same PR before the deploy workflow fires. Pages git
  integration doesn't gate on the rest of the repo's CI.
- **Code-driven config** — the 2026-04-27 secret-mirror incident
  showed that anything dashboard-driven on CF risks invisible
  state divergence. Workflows checked into git are auditable.

Per-branch preview URLs: Pages surfaces use `wrangler pages deploy
--branch=pr-<N>` (CF stable alias `pr-<N>.<project>.pages.dev`);
Worker surfaces (apps/api, apps/web) use `wrangler versions upload`
(per-version preview URL on the Worker subdomain).

### Coming-soon page

Retired — `nlqdb.com` is now served by `apps/web`. The
`nlqdb-coming-soon` Cloudflare Pages project has 0 custom domains and
can be deleted from the dashboard.

### `apps/api` (Phase 0 §3 — in progress)

Cloudflare Worker `nlqdb-api` at **`app.nlqdb.com`** (custom domain
managed by `[[routes]] custom_domain = true` in `wrangler.toml` —
wrangler creates the proxied DNS record + Universal SSL cert on first
deploy, idempotent thereafter). Slice 1 shipped `/v1/health`; Slice 2
added KV + D1 bindings (R2 deferred); Slice 3 added the Neon adapter
(`packages/db`), the OTel SDK + OTLP exporters (`packages/otel`), and
the first D1 migration; Slice 4 landed the strict-$0 LLM router
(`packages/llm`) — Groq + Gemini + Workers AI + OpenRouter behind a
cost-ordered failover chain; Slice 5 wires Better Auth at
`/api/auth/*` with GitHub + Google social providers, backed by D1
(four tables in `migrations/0002_better_auth.sql`). Resource IDs are
committed in `apps/api/wrangler.toml` (account-scoped, not secret).

**Auto-deploy on merge to `main`**: `.github/workflows/deploy-api.yml`
runs `migrate:remote` + `wrangler deploy` whenever `apps/api/**` or
its workspace dependencies change. `secrets:remote` is not in CI
(the script reads from `.envrc`, which only exists on dev boxes).
Mirror secrets manually whenever one rotates:

```bash
bun run --cwd apps/api secrets:remote
```

**First deploy from a clean Cloudflare account** (or after a secret
rotation that the Worker needs at runtime) — three steps in order:

```bash
bun run --cwd apps/api secrets:remote   # mirror .envrc → Worker secrets
bun run --cwd apps/api migrate:remote   # apply migrations/* to remote D1
bun run --cwd apps/api deploy           # wrangler deploy
```

All three are idempotent — safe to re-run. The `app.nlqdb.com`
custom-domain attach happens once on first `deploy` and is a no-op
thereafter. After this initial deploy, CI takes over for code +
schema changes; only re-run `secrets:remote` on rotation.

**Cloudflare resources** (provisioned by
`scripts/provision-cf-resources.sh`, idempotent):

| Resource | Name             | Binding         | ID/Reference                                                    |
| :------- | :--------------- | :-------------- | :-------------------------------------------------------------- |
| KV       | `nlqdb-cache`    | `KV`            | `5b086b03ead54f508271f31fc421bbaa`                              |
| D1       | `nlqdb-app`      | `DB`            | `98767eb0-65df-4787-87bf-c3952d851b29`                          |
| Queue    | `nlqdb-events`   | `EVENTS_QUEUE`  | name-bound (no separate ID); producer = `apps/api`, consumer = `apps/events-worker` |
| R2       | _deferred_       | `ASSETS`        | needs one-time dashboard opt-in; not on `/v1/ask` critical path |

Re-running the provision script is safe — existing resources are
detected by name and skipped.

**D1 migrations** live in `apps/api/migrations/` and are tracked by
wrangler in the `d1_migrations` table inside the D1 DB itself.
Idempotent wrappers:

```bash
scripts/migrate-d1.sh local    # ~/.wrangler local SQLite (no auth)
scripts/migrate-d1.sh remote   # production D1 (needs CLOUDFLARE_*)
```

The first migration (`0001_init.sql`) creates the `databases` table —
the tenant → Neon connection registry `/v1/ask` reads to pick a
backend per request.

**Telemetry**: `apps/api`'s Worker installs the OTel SDK on every
request (idempotent) when `GRAFANA_OTLP_ENDPOINT` and
`GRAFANA_OTLP_AUTHORIZATION` are set as Worker secrets, and flushes
spans + metrics via `ctx.waitUntil(forceFlush())`. Without those
secrets the Worker is a no-op telemetry-wise — fine for local dev.

**LLM provider chain**: `packages/llm` reads four secrets at
request time — `GROQ_API_KEY`, `GEMINI_API_KEY`, `CF_AI_TOKEN`
(+ `CLOUDFLARE_ACCOUNT_ID`), `OPENROUTER_API_KEY`. Per-operation
chains are baked in as defaults (DESIGN §8.1); env overrides are
deferred until a real reason to override appears. A provider listed
in a chain but missing its key is simply skipped and increments
`nlqdb.llm.failover.total{reason="not_configured"}` — the next
provider in the chain handles the call.

**Better Auth** (`apps/api/src/auth.ts`): top-level singleton, wired
via `import { env } from "cloudflare:workers"`. Reads
`BETTER_AUTH_SECRET`, `OAUTH_GITHUB_CLIENT_{ID,SECRET}` (or `_DEV`
when `NODE_ENV !== "production"`), `GOOGLE_CLIENT_{ID,SECRET}` at
module load. Persists to D1 via `kysely-d1`. `basePath: "/api/auth"`
(Better Auth's default; matches the OAuth Apps registered in §5b
and the Google client redirect URIs in §5).

Secrets mirror — single source of truth is `.envrc`:

```bash
bun run --cwd apps/api secrets:local    # writes apps/api/.dev.vars (wrangler dev)
bun run --cwd apps/api secrets:remote   # wrangler secret bulk → deployed Worker
```

Both modes filter to the Worker-runtime subset (BETTER_AUTH_SECRET,
OAUTH_GITHUB_*, GOOGLE_CLIENT_*, LLM keys, DATABASE_URL, GRAFANA_*).
`GRAFANA_OTLP_AUTHORIZATION` is computed from the
`GRAFANA_CLOUD_INSTANCE_ID:GRAFANA_CLOUD_API_KEY` pair so rotation
stays on the pair (IMPLEMENTATION §2.6). Re-run after any `.envrc`
rotation; idempotent.

### `apps/events-worker` (queue-only consumer)

A separate Worker `nlqdb-events-worker` that drains the `nlqdb-events`
Cloudflare Queue and dispatches each event to its sink(s). Phase 0 has
one sink: **LogSnag**. The producer side is `@nlqdb/events`, called
from `apps/api`'s orchestrator; this Worker is the only thing that
talks to external sinks. See [`apps/events-worker/README.md`](../apps/events-worker/README.md)
for the architecture and "adding a new event/sink" recipe.

No HTTP route, no public URL (`workers_dev = false` /
`preview_urls = false`). No D1 of its own, so the deploy is a
single `wrangler deploy`.

**Auto-deploy on merge to `main`**: `.github/workflows/deploy-events-worker.yml`
runs `wrangler deploy` whenever `apps/events-worker/**` or its
workspace deps change. Same `secrets:remote`-stays-manual rule as
`apps/api`.

```bash
bun run --cwd apps/events-worker secrets:remote   # mirror LogSnag + GRAFANA_*
bun run --cwd apps/events-worker deploy           # wrangler deploy
```

Secrets pushed: `LOGSNAG_TOKEN`, `LOGSNAG_PROJECT`,
`GRAFANA_OTLP_ENDPOINT`, computed `GRAFANA_OTLP_AUTHORIZATION`. If
both LogSnag secrets are absent the consumer ack-and-drops every
message — useful for `wrangler dev` without real credentials.

Verify the wire end-to-end:

```bash
wrangler queues info nlqdb-events
# Expect: 1 producer (worker:nlqdb-api), 1 consumer (worker:nlqdb-events-worker)
```

The `nlqdb-events` queue is created/updated by
`scripts/provision-cf-resources.sh` (idempotent).

### `apps/web` (Phase 1 marketing site)

Astro static site that builds to `apps/web/dist/`. Served by the
Cloudflare Worker (`nlqdb-web`) via Workers Static Assets at `nlqdb.com`.
Currently serves a waitlist + capability carousel; sign-in UI and chat
surface are the remaining Phase 1 work (backend at `app.nlqdb.com` is
ready).

Deploys via `.github/workflows/deploy-web.yml` on merge to main when
`apps/web/**` or `packages/elements/**` changes. SLSA L3 build
provenance is attested via `actions/attest-build-provenance@v2`,
with `continue-on-error: true` until the repo flips public or
moves to a paid GitHub plan (the attestation API is gated on
either; PR #56 made the step non-blocking).

Manual re-deploy: workflow_dispatch on the Actions tab, or
`bun run --cwd apps/web deploy` from a dev machine.

### `packages/elements` (CDN bundle)

The `<nlq-data>` runtime built to a single ESM at
`packages/elements/dist/v1.js`. Hosted on Cloudflare Pages project
`nlqdb-elements`, reachable at `nlqdb-elements.pages.dev/v1.js`
(eventual DNS: `elements.nlqdb.com/v1.js`).

Deploys via `.github/workflows/deploy-elements.yml` on merge to main
when `packages/elements/**` changes. Bundle-size budget (< 6 KB
gzipped, DESIGN §3.5) is enforced upstream by
`.github/workflows/ci.yml` job `packages/elements (esbuild + bundle-size)`.

Manual re-deploy: workflow_dispatch on the Actions tab.

### Preview environments

What you see in a PR before merging, by surface:

#### Web preview — `apps/web` (Workers Versions), `packages/elements` (Pages)

`.github/workflows/preview-web.yml` runs `wrangler versions upload`
on the `nlqdb-web` Worker per PR — same pattern as the API.
`preview-elements.yml` deploys to the elements Pages project with
`--branch=pr-<N>`, giving a sticky `pr-<N>.nlqdb-elements.pages.dev/v1.js`.
Both surfaces sticky-comment the URL on the PR; production stays untouched.

Why GH Actions and not Pages git integration: see the strategy
table earlier in this section.

#### Workers — `apps/api`

`.github/workflows/preview-api.yml` triggers on every PR push and
runs `wrangler versions upload` against the `nlqdb-api` Worker
(Workers Versions feature). Each push produces a *non-production*
version of the prod Worker with a unique URL of the form
`<id>-nlqdb-api.omer-hochman.workers.dev`. The promoted production
version (and `app.nlqdb.com`) stay untouched until merge runs
`wrangler deploy` via `deploy-api.yml`. Sticky PR comment carries
the per-version URL.

**One-time dashboard setup (already done):** Workers & Pages →
`nlqdb-api` → Settings → Domains & Routes → enable both
`workers.dev` and `Preview URLs`. Without Preview URLs enabled,
the per-version URLs aren't publicly reachable.

Versions inherit prod bindings (KV / D1 / Queue / R2). The workflow
deliberately skips `migrate:remote` — schema-changing PRs need
local testing with `migrate:local` + `wrangler dev`, the preview
will 5xx schema-dependent routes until the PR merges and
`deploy-api.yml` applies migrations.

Why versions-upload over `--env preview` and what the per-version
URL contract is: see the header comment in
`.github/workflows/preview-api.yml`. Don't restate it here.

#### Workers — `apps/events-worker`

Queue-only consumer with no public URL. Preview adds little
visible value — defer until there's a clear reason to test
unmerged consumer code against the preview queue.

---

## 7. Prerequisites checklist (see `docs/architecture.md §10` Phase 0)

| §    | Item                               | Status       |
| :--- | :--------------------------------- | :----------- |
| 2.1  | `nlqdb.com` zone + Pages + SSL     | ✅            |
| 2.1  | `nlqdb.com` Email Routing          | ✅            |
| 2.1  | `nlqdb.ai` zone + 301 redirect     | ✅            |
| 2.1  | `nlqdb.ai` Email Routing           | ✅            |
| 2.2  | GitHub org `nlqdb`                 | ✅            |
| 2.2  | Repo transfer to `nlqdb/nlqdb`     | ✅            |
| 2.2  | Secret scanning + Dependabot       | ✅            |
| 2.2  | `nlqdb/homebrew-tap` repo          | ✅ (empty)    |
| 2.2  | npm org `@nlqdb`                   | ✅            |
| 2.2  | Docker Hub org                     | ⏭ skipped → `ghcr.io/nlqdb` |
| 2.3  | `CLOUDFLARE_API_TOKEN` + account ID | ✅            |
| 2.3  | Neon DB + `DATABASE_URL`           | ✅            |
| 2.3  | `NEON_API_KEY` (control plane)     | ✅            |
| 2.3  | Upstash Redis + token              | ✅            |
| 2.3  | `FLY_API_TOKEN` (org scope)        | ✅            |
| 2.4  | Gemini / Groq / OpenRouter keys    | ✅            |
| 2.5  | `BETTER_AUTH_SECRET` (self-gen)    | ✅            |
| 2.5  | `INTERNAL_JWT_SECRET` (self-gen)   | ✅            |
| 2.5  | GitHub OAuth app — `nlqdb-web` (prod)  | ✅            |
| 2.5  | GitHub OAuth app — `nlqdb-web-dev`     | ✅            |
| 2.5  | Google OAuth client                | ✅ (In production) |
| 2.5  | Resend API key                     | ✅ (domain verification ⏳ Phase 1) |
| 2.5  | ~~AWS SES fallback~~               | ⏭ dropped — card-required; Resend free tier suffices pre-PMF |
| 2.5  | Stripe (test mode) — sk + pk       | ✅            |
| 2.5  | Stripe webhook secret              | ✅ (Slice 7 — PR #33) |
| 2.6  | Sentry DSN                         | ✅            |
| 2.6  | Grafana Cloud OTLP                 | ✅            |
| 2.6  | LogSnag (`LOGSNAG_TOKEN` + `LOGSNAG_PROJECT`) | ⏳ (Phase 1 — single product-event sink) |
| 2.6  | PostHog Cloud (`POSTHOG_API_KEY`, `POSTHOG_HOST`) | ⏭ optional Phase 2 (only if SQL on D1/Neon stops being enough) |
| 2.7  | Mirror `.envrc` → GHA secrets      | ✅ via `scripts/mirror-secrets-gha.sh` |
| 2.7  | Mirror `.envrc` → Workers secrets  | ✅ via `scripts/mirror-secrets-workers.sh local`/`remote` |
| 3    | `apps/api` Worker skeleton + `/v1/health` | ✅ (Slice 1 — PR #21) |
| 3    | KV namespace `nlqdb-cache` (binding `KV`) | ✅ (Slice 2) |
| 3    | D1 database `nlqdb-app` (binding `DB`)    | ✅ (Slice 2) |
| 3    | Neon adapter + OTel SDK + first D1 migration | ✅ (Slice 3 — PR #24) |
| 3    | LLM router with strict-$0 provider chain  | ✅ (Slice 4 — PR #25) |
| 3    | Better Auth at `/api/auth/*` + D1 0002    | ✅ (Slice 5 — PR #27) |
| 3    | `POST /v1/ask` end-to-end                 | ✅ (Slice 6 — PR #31) |
| 3    | Events queue + `apps/events-worker`       | ✅ (PR #32)           |
| 3    | Stripe webhook + `customers` + R2 archive | ✅ (Slice 7 — PR #33) |
| 3    | R2 bucket `nlqdb-assets` (binding `ASSETS`) | ✅ enabled — billing footnote below |

**R2 billing footnote.** Cloudflare requires a payment method on file
to enable R2 even if usage stays inside the always-free monthly
allowance (10 GB storage, 1 M Class A ops, 10 M Class B ops, free
egress). The R2 line item on the account was added 2026-04-26 to
unblock provisioning, then cancelled the same day — the cancellation
takes effect at the end of the billing period.

What we don't yet know with confidence: whether the bucket keeps
serving under the free tier after the R2 subscription line ends, or
whether the cancellation revokes API access account-wide. Cloudflare's
public docs don't give a definitive answer for this exact path
(enable + cancel without ever exceeding free tier), and community
threads suggest suspended subscriptions block bucket access. So the
cancellation date is a known unknown — calendar a check ~28 days out
and decide then between (a) re-subscribing, (b) draining R2 onto a
different store. Slice 7's only R2 use is fire-and-forget archival
of Stripe webhook payloads (Stripe Dashboard "Resend webhook" is the
canonical replay path; R2 is belt-and-braces), so an R2 outage is not
data-loss for `customers` or `stripe_events` — only the raw payload
audit trail.

---

## 8. Recovery playbook

### Returning after time away

```bash
git pull                        # pick up any merged PRs
direnv allow .                  # re-source .envrc if needed
./scripts/verify-secrets.sh     # should be all-green
gh pr list                      # what's open
```

### New machine (or recovering from lost `.envrc`)

```bash
git clone git@github.com:nlqdb/nlqdb.git && cd nlqdb
scripts/bootstrap-dev.sh        # tools + stub .envrc from .env.example
scripts/restore-envrc.sh        # decrypts iCloud backup over the stub
./scripts/verify-secrets.sh     # should be all-green
```

**Encrypted `.envrc` backup lives outside the repo.** `.envrc.age` is
gitignored — the repo history was rewritten on 2026-04-25 to remove a
previously-committed copy; do not re-introduce one. Default location:
`~/Library/Mobile Documents/com~apple~CloudDocs/nlqdb-backups/.envrc.age`
(iCloud Drive). Produced by `scripts/backup-envrc.sh` using age
passphrase mode (scrypt KDF, cost 2^18). Refresh after any `.envrc`
change:

```bash
scripts/backup-envrc.sh         # encrypts .envrc → $NLQDB_BACKUP_DIR/.envrc.age
```

Override the sync location:

```bash
NLQDB_BACKUP_DIR=/path/to/private/folder scripts/backup-envrc.sh
```

### When a credential fails verify, OR a new secret joins the stack

> **Two destinations, two scripts. Both must be run on EVERY
> rotation AND on EVERY first-time addition of a new secret.**
>
> ```bash
> ./scripts/mirror-secrets-gha.sh          # CI (used in workflows)
> ./scripts/mirror-secrets-workers.sh remote api  # Worker runtime (used by deployed code)
> ```
>
> Then verify the secret you just touched is actually present on
> each destination it needs to be on:
>
> ```bash
> gh secret list -R nlqdb/nlqdb | grep <SECRET_NAME>             # CI
> (cd apps/api && wrangler secret list) | grep <SECRET_NAME>     # Worker runtime
> ```
>
> **Never paste secret values into the GH Actions UI or
> Cloudflare Worker secrets UI directly.** Two incidents have
> made this rule load-bearing:
>
> - **2026-04-27 — UI-pasted CF token drift.** Pasting in the GH UI
>   silently corrupted the value (likely whitespace on copy);
>   `code: 6111 Invalid Authorization header` on D1, `code: 7003
>   Could not route` on Workers Versions. Mirror script writes via
>   `gh secret set` reading stdin so the byte-exact `.envrc` value
>   is what gets stored.
> - **2026-04-27 — `RESEND_API_KEY` only mirrored to GH, not to
>   Worker.** GH Actions had it (CI workflows happy) but the
>   deployed Worker didn't, so `email.ts` fell through to the dev
>   stub that just `console.log`s and returns. Magic-link sends
>   reported HTTP 200 but no email ever reached Resend. Diagnosed
>   via `wrangler secret list | grep RESEND_API_KEY` — empty.
> - **2026-04-27 — `gh secret set --body -` wrote literal `"-"`.**
>   `gh` v2.x interprets `--body -` as `--body` with value `"-"`,
>   not "read stdin". Mirror script ran, reported "29 secrets
>   mirrored ✓ each with their length", but every secret it touched
>   was actually set to a single dash character. CI failed with
>   `code: 6111` and `code: 7003` on every Pages and Workers call
>   that needed `CLOUDFLARE_API_TOKEN`. Fixed in
>   `mirror-secrets-gha.sh` by omitting the `--body` flag entirely
>   (per the CLI doc: "reads from standard input if not specified").
>   Both mirror scripts now also refuse to push values shorter than
>   4 chars and the GHA script self-verifies CF token after pushing.
>
> Checklist for every PR that adds a new secret name:
>
> 1. Add the variable to `.env.example` (canonical name list).
> 2. Add the variable to `.envrc` on your machine.
> 3. Add it to `scripts/mirror-secrets-gha.sh` `SECRETS=` array IF
>    a CI workflow needs it (most don't — only Cloudflare /
>    deployment ones do).
> 4. Add it to `scripts/mirror-secrets-workers.sh` IF the Worker
>    reads it at runtime (most NEW ones do — anything in
>    `apps/api/src/**` reading `c.env.X`).
> 5. Run BOTH mirror scripts.
> 6. Verify with both `grep` commands above.
> 7. Wire it into `apps/api/wrangler.toml` `[vars]` block ONLY if
>    it's non-secret; otherwise leave it out (Worker secret
>    surfaces it on `c.env` directly).

| Credential             | Rotation path                                                              |
| :--------------------- | :------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | https://dash.cloudflare.com/profile/api-tokens → use template **Edit Cloudflare Workers** (covers Workers Scripts/Builds/KV/R2/Tail edit + Account Settings/User Details read + Workers Routes edit). Add `D1: Edit` + `Queues: Edit` for our stack. |
| `CLOUDFLARE_ACCOUNT_ID`| `wrangler whoami` — never rotates                                          |
| `NEON_API_KEY`         | Neon → Account settings → API keys → create new                            |
| `DATABASE_URL`         | Neon → Branches → main → Roles → `neondb_owner` → Reset password           |
| `FLY_API_TOKEN`        | `fly tokens create org --name nlqdb-phase0-<purpose>`                      |
| `UPSTASH_REDIS_REST_*` | console.upstash.com → DB → REST API section                                |
| `GEMINI_API_KEY`       | https://aistudio.google.com/apikey                                         |
| `GROQ_API_KEY`         | https://console.groq.com/keys                                              |
| `OPENROUTER_API_KEY`   | https://openrouter.ai/settings/keys                                        |
| `SENTRY_DSN`           | Sentry → project settings → Client Keys (DSN). Project-scoped, safe-ish to re-share. |
| `LOGSNAG_TOKEN`        | app.logsnag.com → Settings → API Tokens → revoke + create. 32-char hex. `LOGSNAG_PROJECT` is a slug, doesn't rotate. |
| `POSTHOG_API_KEY`      | app.posthog.com → Project settings → Project API Key. Public-ish (used client-side too); rotate via "Reset" in the same panel. |
| `GOOGLE_CLIENT_*`      | GCP → APIs & Services → Credentials → reset secret (client ID stays)       |
| `BETTER_AUTH_SECRET`   | `bun -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))'` — rotating this invalidates every active session. |
| `INTERNAL_JWT_SECRET`  | Same generator as above. Workers-only; rotating is safe any time (30 s TTL). |

### When a domain goes wrong

1. Check NS: `dig +short NS nlqdb.com @1.1.1.1` — must return `jeremy.ns.cloudflare.com` + `kiki.ns.cloudflare.com`. If different, GoDaddy reverted — log in → Nameservers → re-apply.
2. Check zone status: dash.cloudflare.com → the zone → Overview → should be Active.
3. Check custom-domain attachment: dash.cloudflare.com → Workers & Pages → Workers → `nlqdb-web` → Settings → Domains & Routes — should show `nlqdb.com` with a green "Active" pill. If missing, re-attach via Settings → Domains & Routes.
4. If `nlqdb.com` returns "This domain is not configured": the custom-domain attachment got removed — re-attach to the `nlqdb-web` Worker via Settings → Domains & Routes.

---

## 9. Anonymous-db lifecycle (Phase 1+)

Lands with the hosted db.create slice ([`./architecture.md §10`](./architecture.md) Phase 1,
[`./architecture.md §3.6`](./architecture.md)). Capacity reasoning and source
citations: [`docs/research-receipts.md §9`](./research-receipts.md).

### 9.1 Capacity math

Neon Free is **0.5 GB total per project**, scale-to-zero. Phase 1
puts every db on a single shared Neon branch as a Postgres schema.
A typical anonymous schema with a few tables and modest data sits
in the **100-500 KB range**. That gives a ceiling of roughly
**1,000-5,000 anonymous dbs before pressure** — not negligible at
any meaningful traction. The cost ladder in [`README.md`](../README.md)
gates the next upgrade ($19/mo Neon Launch) on "Neon DB exceeds
0.5 GB or needs no-pause"; the policy below is designed to use
that gate, not blow through it.

### 9.2 Policy

| Class | Retention | Per-db size cap | Notes |
|---|---|---|---|
| **Adopted** (signed-in user) | Forever | None on Free; tier raises it on Hobby+ | Adoption = explicit user intent → keep |
| **Anonymous** (no sign-in) | 90 days from most-recent query | **10 MB hard cap** — writes that would exceed return `db_full` | TTL counts from last query, not creation, so an active anonymous user keeps their db |

### 9.3 Daily sweep job

Runs as a Cloudflare Workers Cron Trigger
(`apps/api/wrangler.toml [triggers] crons = ["0 4 * * *"]` — 04:00
UTC daily, off-peak). Source: `apps/api/src/db-sweep/sweep.ts`
(lands with the db.create slice).

```
1. SELECT all anonymous dbs (D1: WHERE adopted_at IS NULL).
2. Drop any anonymous db where last_queried_at < now() - 90 days,
   regardless of size. Order: oldest first; per-iteration COMMIT.
3. After step 2, sum bytes across remaining anonymous dbs.
   If SUM > 300 MB → drop the OLDEST anonymous db; repeat until
   total ≤ 300 MB.
4. Emit one event per drop: `db.swept` with reason ∈
   { "ttl_expired", "pressure_sweep" } (LogSnag + OTel span).
```

The 300 MB pressure threshold leaves **200 MB headroom** on the
500 MB Neon Free cap for adopted dbs and Postgres system tables.

### 9.4 Alert thresholds

| Total anonymous-db bytes | Action |
|---|---|
| < 200 MB | green; daily sweep does its job |
| ≥ 200 MB | **warn** — Slack post `#nlqdb-ops`, no automatic action |
| ≥ 280 MB | **urgent** — pager ping + dashboard banner; pressure-sweep is imminent |
| ≥ 300 MB | sweep runs automatically; emits `db.pressure_sweep_started` |
| ≥ 450 MB total project (anonymous + adopted) | escalate to Neon Launch ($19/mo); follow [`README.md` cost ladder](../README.md) |

### 9.5 Manual sweep (for ops, not automation)

```bash
# Dry-run: list what would be swept, drop nothing.
wrangler tail nlqdb-api --search "db_sweep"
curl -X POST "$API/v1/admin/db-sweep" -H "$INTERNAL_AUTH" -d '{"dry_run":true}'

# Force a sweep outside the 04:00 window.
curl -X POST "$API/v1/admin/db-sweep" -H "$INTERNAL_AUTH" -d '{}'
```

Admin endpoint requires `INTERNAL_JWT_SECRET`-signed bearer; not
exposed publicly. CLI `nlq admin db-sweep --dry-run` lands in
Phase 2 with the rest of the admin surface.

### 9.6 What sweeps NEVER touch

- Adopted dbs (signed-in). The sweep query explicitly filters
  `WHERE adopted_at IS NULL`. Any future migration that touches
  this column must update the sweep query in lockstep; covered by
  unit test `sweep-skips-adopted.test.ts`.
- Anonymous dbs whose last query was within the last 90 days, even
  if total pressure is high — the pressure-sweep step drops only
  the *oldest* dbs first.
- The `databases` D1 row for a swept db. We mark `swept_at` on the
  row but keep it for ~30 days for forensic queries (then a separate
  monthly cleanup drops the D1 row + its KV plan-cache entries).

---

## 10. Personas — design-partner reference

Operational reference for design-partner recruitment, activation-funnel
decisions, and product judgement calls. Drafted pre-launch from public
Discord, GitHub issue, and Reddit research; treat as starting hypotheses
to be validated with real users in Phase 1.

### 10.1 Priority table

Ranked by how much of Phase 1 capacity they deserve.

| Use case | Persona | Priority | Notes |
|---|---|---|---|
| Solo dev prototyping a new app's DB | P1 | **P0** | The flagship journey. Optimize onboarding for this. |
| Agent giving itself memory via MCP | P2 | **P0** | MCP server must ship in Phase 1, not Phase 2. |
| Non-engineer answering a one-off question from a CSV | P3 | **P1** | Requires CSV upload. Ship it. |
| Solo dev using chat as an admin UI over their own nlqdb | P1 | **P1** | Falls out of P0 naturally. |
| Startup team using chat as admin UI over *their own* PG | P4 | **Phase 2** | Needs BYO-connection. Park. |
| Scheduled/recurring queries ("email me this weekly") | P3 | **Phase 2** | Useful but not foundational. |
| Destructive ops with NL-diff preview | P1, P4 | **P0** | Trust-building. Ship in Phase 1. |
| Sharing a query result by link | P3, P1 | **P1** | Cheap to build, high word-of-mouth. |
| Team workspaces with roles | P4 | **Phase 2** | Solo product first. |
| Embedded NL-query widget in user's own app | — | **Phase 3** | Tempting but dilutes the message. |

**P0 = must ship in Phase 1. P1 = ship in Phase 1 if capacity allows. Phase 2+ = explicitly deferred.**

### 10.2 Persona vignettes

#### 10.2.1 P1 — Maya (Solo Builder)

Maya is building a meal-planning side project on a Friday night. She runs `nlq db create mealplan`, drops the connection string into her Next.js app, and by Sunday has real users signing up. Monday morning she types `"how many signups this weekend, grouped by referrer"` into the chat instead of opening psql. Two weeks in she needs a `trial_ends_at` column — says so in chat, reviews the diff, approves. She never writes a migration file, never runs `pg_dump`, never logs into a cloud console.

#### 10.2.2 P2 — Jordan (Agent Builder)

Jordan is building a personal research agent that browses the web and drafts memos. Before nlqdb the agent dumped facts into a messy `notes.json` and forgot things between sessions. Now at session start the agent calls `nlqdb_create_database("session_<id>")` and stores claims, sources, and user corrections as structured rows it designs itself. At session end the agent either persists the DB (if the user liked the output) or drops it. Jordan's entire memory layer is ~40 lines of glue code instead of a bespoke vector store + metadata service.

#### 10.2.3 P3 — Priya (Data-Curious Analyst / PM / Ops)

Priya is a growth PM at a 30-person SaaS. Thursday afternoon a conference vendor emails a 12k-row CSV of leads. She drops it in the chat: `"load this as conference_leads_q2"`. Then: `"how many of these are already in our users table, and which plan are they on"` — the chat joins her upload with a read-only mirror of prod. She has the numbers for her 4pm exec sync without opening a data-request ticket, and shares a result link in Slack.

#### 10.2.4 P4 — Dmitri (Backend Engineer at a Small Startup)

Dmitri is on-call at a 20-person startup. Support escalates: a pricing bug double-charged ~180 customers between 11pm and midnight. Instead of writing a one-off refund script, he opens the team workspace pointed at their existing Postgres, types the refund in plain English, and reviews the generated diff (183 rows, $2,104 total) before approving. The audit log captures who ran it, and the Retool page he would've had to build doesn't need to exist. *(Requires Phase 2 "bring your own Postgres" mode — aspirational for this persona in Phase 1.)*

Representative query example: `"migrate users from plan 'starter' to 'basic'"` (with diff preview, per [`docs/features/onboarding/FEATURE.md` SK-ONBOARD-004](../docs/features/onboarding/FEATURE.md)).

#### 10.2.5 P5 — Aarav (Student / First-Timer)

Aarav is doing the CS50 web track. Instead of spending day one fighting `brew install postgresql` and password errors, he runs `nlq db create cs50_final` and types `"i need a table for blog posts with title, body, and author"`. The chat creates it and shows him the SQL it ran, which he pastes into his notes for the write-up. He ships the assignment by Wednesday and actually understands what a foreign key is by the end of it.

### 10.3 Anti-personas

Being clear about this prevents scope creep and bad-fit support tickets.

#### A1 — The Regulated Enterprise

Finance, healthcare, anyone with HIPAA/SOC2/GDPR-DPA requirements today. We are not compliant yet, our LLM providers make data-handling a hard conversation, and "an LLM might look at my PII" is a non-starter. Point them at a roadmap page; revisit in Phase 3.

#### A2 — High-Volume OLTP at Scale

Payment processors, ad-tech, real-time bidding, anyone doing >10k writes/sec. Our abstraction tax (p99 latency within 1.3× of hand-written queries, per [`docs/features/multi-engine-adapter/FEATURE.md` Phase 2 exit criteria](../docs/features/multi-engine-adapter/FEATURE.md)) means we're not for the top of that curve yet. They should run Postgres / CockroachDB / Scylla directly.

#### A3 — Strict-Schema Shops Built Around dbt / Great Expectations / Flyway

Their whole workflow is about pinning schema. Our whole workflow is about inferring it. Fundamental mismatch. We will never convince them and shouldn't try.

#### A4 — Users Who Want a BI Tool

If someone wants dashboards, charts, scheduled reports, embedded analytics — that is Metabase / Hex / Mode / Superset. We can be the *data* layer underneath one of those eventually, but we are not building the visualization product.

#### A5 — Users Who Want an ORM

Prisma / Drizzle / SQLAlchemy are not what we are. If they want codegen from a schema they control, we're the wrong tool.

### 10.4 Validation plan

For each P0 persona, before we declare Phase 1 done:

- **P1 Solo Builder:** 5 design partners each ship a real project using nlqdb as the primary DB. At least 2 convert to paid Hobby.
- **P2 Agent Builder:** MCP server installed in 3 distinct agent frameworks in the wild. At least 1 agent product publicly integrates nlqdb as its memory layer.
- **P3 Analyst:** 3 non-engineers complete a real analysis end-to-end in under 10 minutes, unassisted, in user tests.

If any of these don't hit, we don't ship Phase 2 — we iterate.
