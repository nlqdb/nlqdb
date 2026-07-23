# Infisical as source of truth for operator secrets — feasibility + migration plan

Status: research complete — every mechanism verified (2026-07-17); migration
not yet executed. Decision to adopt supersedes the "`.envrc` is the single
source of truth" stance in runbook §4 and the `mirror-secrets-gha.sh` header;
the migration PR updates both and adds the GLOBAL recording the switch.

Candidate selection (why Infisical over Doppler / Bitwarden SM / SOPS+age /
1Password) was settled in the first pass of this research: Infisical is the
only $0 option with native push-syncs to both GitHub Actions and Cloudflare
Workers, an open-source (MIT) core as exit hatch, and a direnv-compatible
CLI. 1Password has no free tier and its
[open-source program](https://github.com/1Password/for-open-source) excludes
commercial projects; [Doppler](https://www.doppler.com/pricing)'s free plan
caps at exactly the 5 syncs we need and is closed-source;
[Bitwarden SM](https://bitwarden.com/products/secrets-manager/) has no
Workers sync; Vault/Vaultwarden need an always-on server we don't run.

## 1. Feasibility — every load-bearing mechanism, verified

| # | Mechanism | Verified fact | How verified |
|---|---|---|---|
| F1 | Free-tier fit | 5 identities, 3 projects, 3 environments, 10 integrations; CLI/API/SDKs, all integrations, secret referencing, webhooks, 2FA included; no secrets-count cap listed | [pricing](https://infisical.com/pricing) |
| F2 | We need | 1 project, 2 environments (`prod`, `canary`), 2 app connections + 5 syncs ≤ 10, 1 human identity, 0 machine identities in v1 (CI keeps reading GHA secrets) | §2 design |
| F3 | Cloudflare Workers sync | Per-script push sync; auto-sync on change; "overwrite destination" or deletion-protection modes; key-schema templating | [docs](https://infisical.com/docs/integrations/secret-syncs/cloudflare-workers) |
| F4 | CF connection scope | API token needs only `Workers Scripts: Edit` + `Account Settings: Read`; token rotation is manual | [docs](https://infisical.com/docs/integrations/app-connections/cloudflare) |
| F5 | GitHub sync | Repo-scope Actions-secrets push (write-only — GitHub never exposes values back); GitHub App auth with `Secrets: R/W` + `Actions: Read`, installable on selected repos only | [sync docs](https://infisical.com/docs/integrations/secret-syncs/github) · [connection docs](https://infisical.com/docs/integrations/app-connections/github) |
| F6 | References expand in syncs | The sync queue expands `${...}` references server-side so destinations receive resolved values; caveat: references break if the referenced secret has a *personal override* ([#2812](https://github.com/Infisical/infisical/issues/2812)) — rule: never create personal overrides | [source walk-through](https://deepwiki.com/Infisical/infisical/4.3-secret-references-and-interpolation) |
| F7 | CLI | v0.43.109 hands-on (`npm i @infisical/cli`): `export` supports `--env --path --format dotenv-export --template`, `--expand` (default on) resolves references client-side; `secrets set --file` bulk-imports a `.env` file per folder; `run` supports `--recursive --watch`; `vault` stores the login token in the OS keyring (GLOBAL-010-consistent) | ran `--help` on this machine |
| F8 | direnv pattern | `.envrc` = `eval "$(infisical export ...)"` loops; documented community pattern | [discussion #2222](https://github.com/Infisical/infisical/discussions/2222) |
| F9 | Rate limits (free) | 200 reads / 90 writes / 120 secret-ops **per minute** — orders of magnitude above our usage (a few exports/day + syncs on change) | [API reference](https://infisical.com/docs/api-reference/overview/introduction) |
| F10 | Runtime independence | Workers/GHA read their *own* materialized secret stores; Infisical is only in the write path. An Infisical outage can never break prod or CI runs — only delay secret *changes* | architecture of §2 |

## 2. Target design (all names assigned — nothing left to decide)

Project `nlqdb`; environments `prod` + `canary` (rename default `staging` →
`canary`; `dev` left unused). Folders under `prod`; shared values live once
in `/shared`, consumer folders hold references (`${prod.shared.NAME}`),
which expand on sync/export (F6/F7). This preserves today's deliberately
minimal per-Worker sets exactly (the mcp Worker keeps its 2+1 secrets).

**Connections (2):** GitHub App scoped to `nlqdb/nlqdb` only; Cloudflare API
token per F4 (new token, created for this).

**Syncs (5)** — auto-sync on; deletion-protection ON until Gate C:

| Sync | Source | Destination |
|---|---|---|
| gha | `prod:/gha` | GitHub Actions repo secrets, `nlqdb/nlqdb` |
| cf-api | `prod:/api` | Worker `nlqdb-api` |
| cf-events | `prod:/events-worker` | Worker `nlqdb-events-worker` |
| cf-mcp | `prod:/mcp` | Worker `nlqdb-mcp-server` |
| cf-canary | `canary:/` | Worker `nlqdb-api-canary` |

### Name → folder assignment (complete)

`prod:/shared` — canonical values, referenced by the folders that need them:
`BETTER_AUTH_SECRET` (api, mcp, gha), `CEREBRAS_API_KEY`, `CF_AI_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `EVAL_INGEST_TOKEN`, `GEMINI_API_KEY`,
`GROQ_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY` (each api + gha),
`LOGSNAG_TOKEN`, `LOGSNAG_PROJECT`, `RESEND_API_KEY` (api + events + gha),
`POSTHOG_API_KEY`, `POSTHOG_HOST` (events + gha/deploy-web),
`GRAFANA_OTLP_ENDPOINT`, `GRAFANA_OTLP_AUTHORIZATION` (api + events + mcp).
`GRAFANA_OTLP_AUTHORIZATION` is stored as a literal (today it's computed in
`mirror-secrets-workers.sh:163`); the §4 rotation recipe recomputes it.

`prod:/api` — own values: `API_KEY_SECRET`, `BYO_SECRET_KEK`,
`DATABASE_URL`, `GH_TOKEN`, `OAUTH_GITHUB_CLIENT_ID{,_DEV}`,
`OAUTH_GITHUB_CLIENT_SECRET{,_DEV}`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_HOBBY`, `STRIPE_PRICE_PRO`, **`TURNSTILE_SECRET`** (today
hand-set on the Worker, outside `.envrc` — must enter the vault *before*
the first cf-api sync or an overwrite-mode sync would drop it); plus
references for the rest of the runtime set in
`mirror-secrets-workers.sh:92-128`. `GH_TOKEN` lives *only* here — it must
never reach GHA secrets (`gh` auto-consumes the env var;
`mirror-secrets-gha.sh` documents the exclusion) and with folder-scoped
syncs it structurally can't.

`prod:/events-worker` — own: `TINYBIRD_TOKEN`, `TINYBIRD_API_BASE`; refs:
LogSnag pair, PostHog pair, Grafana endpoint+auth, `RESEND_API_KEY`.

`prod:/mcp` — refs only: `BETTER_AUTH_SECRET`, `GRAFANA_OTLP_ENDPOINT`,
`GRAFANA_OTLP_AUTHORIZATION`.

`prod:/gha` — own values: `CLOUDFLARE_API_TOKEN`,
`CF_TURNSTILE_EDIT_API_TOKEN`, `NEON_API_KEY`, `NEON_PROJECT_ID`,
`FLY_API_TOKEN`, `OPENROUTER_FRONTIER_API_KEY`, `COHERE_TRIAL_API_KEY`,
`HF_ACCESS_TOKEN`, `NVIDIA_API_KEY`, `FALLBACK2_LLM_API_KEY`, `SENTRY_DSN`,
`STRIPE_PUBLISHABLE_KEY`, `GRAFANA_CLOUD_INSTANCE_ID`,
`GRAFANA_CLOUD_API_KEY`, `PREVIEW_BETTER_AUTH_SECRET`, `NPM_TOKEN`, plus
the six GHA-only stragglers that exist in GitHub but **not** in `.envrc`
(found by diffing `gh secret list` targets vs the mirror list): `CLA_PAT`,
`FALLBACK_LLM_API_KEY`, `LLM_API_KEY`, `SEMGREP_APP_TOKEN`,
`STAGING_NLQDB_API_KEY`, `HOMEBREW_TAP_GITHUB_TOKEN`. Refs: the nine
shared LLM/CF/eval names + LogSnag pair + `RESEND_API_KEY` + PostHog pair +
`GRAFANA_OTLP_ENDPOINT` + `BETTER_AUTH_SECRET`.
*Deliberate shrink*: names GHA holds today only because the deploy
workflows re-mirror them to Workers (`DATABASE_URL`, `BYO_SECRET_KEK`,
OAuth pairs, `STRIPE_SECRET_KEY`, …) are dropped — verified against
`grep -rhoE 'secrets\.[A-Z0-9_]+' .github/workflows/`: every name a
workflow actually reads is covered above.

`prod:/local` — `INTERNAL_JWT_SECRET` (scaffolded, no runtime consumer;
runbook already excludes it from mirrors).

`canary:/` — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` under prod-slot
names, values from today's `CANARY_*` (replaces the rename map in
`mirror-secrets-canary.sh:64-75`).

### Local dev (direnv stays)

`.envrc` becomes (cache fallback ⇒ an Infisical outage can't break local dev):

```sh
# direnv → Infisical (project nlqdb, env prod). Falls back to last good
# export if Infisical is unreachable.
cache="$HOME/.cache/nlqdb/env.sh"; mkdir -p "${cache%/*}"
tmp="$(mktemp)" && ok=1
for p in shared api events-worker mcp gha local; do
  infisical export --projectId <PROJECT_ID> --env prod --path "/$p" \
    --format dotenv-export --silent >> "$tmp" || { ok=0; break; }
done
[ "$ok" = 1 ] && { mv "$tmp" "$cache"; chmod 600 "$cache"; } || rm -f "$tmp"
source "$cache"
```

`mirror-secrets-workers.sh local <app>` (`.dev.vars` writer) needs **no
change**: it `source`s `.envrc`, which now evals the export. CI keeps
reading GHA secrets — no workflow gains an Infisical dependency.

## 3. Migration runbook (gated; revert is one command at every gate)

**Step 0 — accounts & connections.** Create Infisical Cloud account
(founder email, 2FA on), org, project `nlqdb`; rename `staging`→`canary`.
Create the scoped CF API token (F4). Install the Infisical GitHub App on
`nlqdb/nlqdb` only (F5). Install CLI (`brew install infisical/get-cli/infisical`),
`infisical login`.

**Step 1 — import.** One-off local script converts `.envrc` into per-folder
`.env` files per the §2 table (references written literally as
`NAME=${prod.shared.NAME}`), then `infisical secrets set --file <f> --env
prod --path /<folder>` per folder; canary values into `canary:/`. Set
`GRAFANA_OTLP_AUTHORIZATION` from the §4 recipe. Add `TURNSTILE_SECRET`
(from founder records; if lost, regenerate in the Turnstile dashboard —
sitekey stays, `docs/blocked-by-human.md` note closes). For each of the six
GHA stragglers: value on record → set it; no record → rotate at the
provider and set the new value.

**Gate A (read parity).** Script compares sha256 of every old `.envrc`
value vs `infisical export` output (names echoed, never values). 100 %
match required. *Revert: delete the Infisical project. Nothing else changed.*

**Step 2 — syncs.** Create the 5 syncs (§2), deletion-protection ON,
auto-sync ON; trigger each once.

**Gate B (write parity + live drill).** (a) `gh secret list` ⊇ /gha∪refs;
(b) `wrangler secret list` per Worker = exactly today's set (+`TURNSTILE_SECRET`
managed); (c) `scripts/verify-secrets.sh` all green; (d) drill: rotate
`EVAL_INGEST_TOKEN` in Infisical → confirm it lands in GHA + the api Worker
via auto-sync and eval ingest still 200s. *Revert: delete syncs, re-run
`mirror-secrets-all.sh` from the untouched `.envrc`.*

**Step 3 — switch local.** Back up old `.envrc` (`backup-envrc.sh` one last
time), replace with the §2 eval block, `direnv allow`, regenerate
`.dev.vars` per app, run `verify-secrets.sh`.

**Step 4 — CI cleanup.** Remove the reconstruct-`.envrc`-and-mirror steps
from `deploy-api.yml:147-161`, `deploy-events-worker.yml:74-82`,
`deploy-mcp.yml:56-64` (single-writer rule: only Infisical writes Worker
secrets now). Update the `ci.yml:193-210` ICP-wiring guard to point at
`verify-secrets.sh` only.

**Parity week.** Daily `verify-secrets.sh`; any drift fails the gate.
*Revert unchanged: restore `.envrc` from `.envrc.age`, delete syncs,
re-run mirror scripts (still in-tree).*

**Gate C (day 7) — commit.** Flip syncs to full management (deletion on);
delete the now-unmanaged stale GHA names (the §2 "deliberate shrink" list).
Retire `mirror-secrets-gha.sh`, `mirror-secrets-canary.sh`, and the
`remote` mode of `mirror-secrets-workers.sh` (local mode stays); repoint
`backup-envrc.sh` at `infisical export` output (age encryption + iCloud
target unchanged — mandatory, F1: no version history on free). Update
runbook §4 + §8 rotation table, `.env.example` header, script headers; add
the new GLOBAL (vault-as-source-of-truth) + index row; PR names the
GLOBAL-025 onboarding KPI (contributor setup = `bootstrap-dev.sh` +
`infisical login`, no secret hand-off), degrades none; GLOBAL-013 intact ($0).

## 4. Rotation flow (after Gate C)

Edit the value in Infisical (UI or `infisical secrets set … --path /shared`)
→ auto-sync fans out → `verify-secrets.sh`. Grafana pair: rotate
`GRAFANA_CLOUD_*` in `/gha`, then
`printf '%s:%s' "$ID" "$KEY" | base64 | tr -d '\n'` →
`GRAFANA_OTLP_AUTHORIZATION` in `/shared`. Canary OAuth: edit in `canary:/`.
UI-paste into GitHub/Cloudflare remains forbidden (runbook §8 incidents) —
the vault is the only write path.

## 5. Residual risks — none forces a revert

| Risk | Why it can't force a revert |
|---|---|
| Infisical Cloud outage | Runtime/CI never read Infisical (F10); local dev uses the cache fallback; only secret *changes* wait |
| Free-tier shrink / vendor change | Self-host (MIT) or export-and-return-to-scripts; scripts live in git history, `.envrc.age` backup regenerated on every rotation |
| Vault account compromise | 2FA; strictly-scoped CF token + repo-scoped GitHub App bound the blast radius below today's `.envrc` (which holds an account-wide CF token) |
| CF 10214 (preview version ahead) | Same failure exists today; sync shows failed status with one-click retry after deploy — remedy documented in runbook §8 |
| Reference not expanding (#2812) | Only triggers via personal overrides — we create none (single human user) |
| CF connection token expiry | Manual rotation caveat (F4); quarterly reminder + failed-sync status makes it visible |
| Import mistakes | Gate A hash-parity catches value errors before anything syncs; Gates B/C catch delivery errors while the old path still works |
