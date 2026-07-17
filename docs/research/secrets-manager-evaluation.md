# Secrets-manager evaluation — replacing `.envrc` as source of truth

Status: research / proposal — no decision taken yet (see open questions).
Date: 2026-07-17. Free-tier limits below are as of this date; re-verify
before adopting.

## 1. Why

Today the founder's local `.envrc` is the single source of truth for
~45 operator secrets (runbook §4). It fans out via
`scripts/mirror-secrets-*.sh` to four targets: GitHub Actions secrets,
three Cloudflare Workers (`api`, `events-worker`, `mcp`), the canary
Worker, and local `.dev.vars`. The model works but has structural
weaknesses the 2026-04-27 incidents exposed (CF-token drift,
`RESEND_API_KEY` mirror gap, 29 secrets wiped to `-`): a laptop file as
source of truth, drift between targets detected only by
`verify-secrets.sh`, disaster recovery via a manual `age` backup to
iCloud, and no history/audit of changes.

Goal: a hosted vault as source of truth (a "1Password for API keys"),
at **$0/mo** (GLOBAL-013 spirit), that pushes to the existing four
targets and keeps the direnv workflow.

## 2. Requirements (derived from the current pipeline)

1. $0/mo, no card on file.
2. Push-sync to **GitHub Actions repo secrets** and **Cloudflare
   Workers secrets** (per-app subsets — 28 names to `nlqdb-api`, a
   smaller set to `events-worker`, 2 to `mcp-server`, `CANARY_*`
   renames to the canary Worker).
3. CLI that works in `.envrc` (direnv stays) and can generate
   `.dev.vars`.
4. Machine identity for CI (ideally OIDC — no long-lived token stored
   in the thing the vault is supposed to replace).
5. Support ≥ 3 logical environments (dev / prod / canary) in 1 project.
6. Exit hatch — open source / self-hostable preferred, so the free
   tier isn't a trap.

## 3. Candidates

| | [Infisical](https://infisical.com/pricing) | [Doppler](https://www.doppler.com/pricing) | [Bitwarden Secrets Manager](https://bitwarden.com/products/secrets-manager/) | SOPS + age (git-native) | 1Password |
|---|---|---|---|---|---|
| Cost | $0 (free cloud tier) | $0 (≤ 3 users) | $0 (2 users) | $0 | ❌ no free tier; [OSS program](https://github.com/1Password/for-open-source) excludes commercial projects — nlqdb ineligible |
| Free-tier limits | 5 identities, 3 projects, **3 environments, 10 integrations** | 25 users listed / free ≤ 3, 10 projects, 4 environments, **5 config syncs** | 2 users, **3 machine accounts**, 3 projects | n/a | n/a |
| CF Workers push-sync | ✅ [native](https://infisical.com/docs/integrations/secret-syncs/cloudflare-workers), auto-sync on change | ✅ [native](https://docs.doppler.com/docs/cloudflare-workers) | ❌ (CLI/SDK only) | ❌ (keep mirror scripts) | via `op` CLI only |
| GitHub secrets push-sync | ✅ [native](https://infisical.com/docs/integrations/secret-syncs/github) (org/repo/environment scope) | ✅ native | ❌ (inject-only [GHA action](https://bitwarden.com/products/secrets-manager/)) | ❌ | via CLI |
| CI auth | machine identity, [OIDC](https://github.com/Infisical/secrets-action) | service token (static) | access token (static) | age key in GHA secret | service account (paid) |
| direnv fit | `eval $(infisical export --format=dotenv-export --silent)` ([pattern](https://github.com/Infisical/infisical/discussions/2222)) | `doppler secrets download --format env` | `bws` CLI, manual templating | `sops exec-env` | `op inject` |
| Open source / self-host | ✅ MIT core | ❌ closed SaaS | ✅ (self-host is Enterprise-only for SM) | ✅ fully local | ❌ |
| Versioning / recovery on free | ❌ paid (Pro) — keep an encrypted export backup | 3-day activity log | ❌ | ✅ full git history | ✅ |

HashiCorp Vault / Vaultwarden self-hosted were ruled out without a
row: both need an always-on server nlqdb doesn't run anywhere free,
and the ops burden contradicts P5 for a one-person team.

## 4. Recommendation: Infisical Cloud (free tier)

It is the only candidate that meets every requirement:

- **$0 and open source (MIT)** — free tier includes CLI, API, all
  integrations, webhooks, 2FA; self-hosting is the exit hatch if the
  free tier ever shrinks.
- **Native syncs replace the mirror scripts** — one GitHub repo-secrets
  sync + four Cloudflare Workers syncs (api, events-worker, mcp,
  canary) = 5 of the 10 free integrations. Auto-sync on change kills
  the drift class of incidents structurally instead of detecting it
  after the fact. (Doppler's free cap is exactly 5 syncs — zero
  headroom; Infisical leaves 5.)
- **Fits the free limits**: 1 project; dev / prod / canary = exactly
  3 environments; 1 human + 1–2 machine identities ≤ 5. Per-app Worker
  subsets map to folders (`/api`, `/events-worker`, `/mcp`, `/shared`
  via secret referencing), each sync pointing at one folder.
- **direnv survives**: `.envrc` shrinks to one line —
  `eval "$(infisical export --format=dotenv-export --silent)"` — so
  `bootstrap-dev.sh` and every `source .envrc` consumer keep working.
  `mirror-secrets-workers.sh local <app>` (`.dev.vars` generation) can
  keep its shape, reading from `infisical export` instead of `.envrc`.
- **CI via OIDC machine identity** (`Infisical/secrets-action`) — the
  deploy workflows' "reconstruct `.envrc` from `toJSON(secrets)`"
  dance becomes unnecessary once Workers secrets are synced directly.

### What would change

| Piece | Today | After |
|---|---|---|
| Source of truth | laptop `.envrc` | Infisical project (web UI + CLI) |
| `mirror-secrets-gha.sh` | `gh secret set` loop | retired → GitHub sync |
| `mirror-secrets-workers.sh remote` | `wrangler secret bulk` | retired → CF Workers syncs |
| `mirror-secrets-canary.sh` | `CANARY_*` rename push | canary environment + its own sync |
| `mirror-secrets-workers.sh local` | reads `.envrc` | reads `infisical export` |
| `backup-envrc.sh` | `.envrc` → `.envrc.age` in iCloud | `infisical export` → same `age` file (still wanted: free tier has no point-in-time recovery) |
| Rotation flow (runbook §8) | edit `.envrc` → run 3 scripts → deploy | edit in Infisical → auto-sync → deploy |
| `verify-secrets.sh` | unchanged — still the live-probe backstop | unchanged |

Unaffected decisions: GLOBAL-031 (user BYO secrets stay in the D1
envelope — this is operator secrets only), GLOBAL-010 (CLI end-user
credentials stay in the OS keychain).

### Caveats

- **Trust concentration**: Infisical Cloud holds every operator key.
  Mitigations: 2FA on the account, the encrypted `age` export backup,
  self-host exit. Net risk is comparable to today's iCloud `.envrc.age`.
- **No version history on free** — the backup script stays mandatory.
- Derived value `GRAFANA_OTLP_AUTHORIZATION` (computed in
  `mirror-secrets-workers.sh:163`) must be stored as its own secret or
  kept as the one remaining script transform.
- Deliberate asymmetries must survive the migration: `GH_TOKEN` never
  goes to GHA; `INTERNAL_JWT_SECRET` skipped; `TURNSTILE_SECRET` and
  `HOMEBREW_TAP_GITHUB_TOKEN` need to enter the vault (they're
  currently hand-set stragglers).
- CF error 10214 (bulk put vs newer deployed version) may still bite
  auto-sync exactly as it bites `secret bulk` today; behaviour to test
  in the pilot.

## 5. Open questions (decide before any code change)

1. Adopt Infisical, or stay on `.envrc` + scripts? Superseding
   "`.envrc` stays the single source of truth"
   (runbook §4, `mirror-secrets-gha.sh` header) needs an explicit
   decision — likely a new GLOBAL.
2. Pilot scope: suggest migrating **one** target first (GHA sync),
   keeping mirror scripts as fallback until `verify-secrets.sh` shows
   parity for a week.
3. Cloud vs self-host later — cloud now; revisit only if free limits
   shrink.

## Sources

- [Infisical pricing](https://infisical.com/pricing) · [Cloudflare Workers sync](https://infisical.com/docs/integrations/secret-syncs/cloudflare-workers) · [GitHub sync](https://infisical.com/docs/integrations/secret-syncs/github) · [secrets-action (OIDC)](https://github.com/Infisical/secrets-action) · [direnv pattern](https://github.com/Infisical/infisical/discussions/2222)
- [Doppler pricing](https://www.doppler.com/pricing) · [Doppler ↔ Cloudflare Workers](https://docs.doppler.com/docs/cloudflare-workers)
- [Bitwarden Secrets Manager](https://bitwarden.com/products/secrets-manager/)
- [1Password for Open Source — eligibility](https://github.com/1Password/for-open-source)
- Landscape: [GitGuardian top secrets-management tools](https://blog.gitguardian.com/top-secrets-management-tools/) · [dev.to 2026 comparison](https://dev.to/thedailyagent/top-6-secrets-management-tools-for-devs-in-2026-4ahe)
