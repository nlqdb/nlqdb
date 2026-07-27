# Founder-actions log — every human operator action, append-only

Why this file: the company is operated by agents; the human does only what
agents cannot (accounts, credentials, console clicks, account-walled
submissions, money). Those actions used to vanish on completion — queue
bullets are deleted once done (`blocked-by-human.md` charter), so the only
record was git archaeology. This log is the durable, chronological record,
kept so that (a) standing up another product with an agent is a **replay**,
not a reconstruction, and (b) it seeds the founder-ops goal pack
([`SK-PIVOT-018`](../features/agent-memory-pivot/decisions/SK-PIVOT-018-goal-packs.md)).

Rules: append-only, newest at the bottom of each era; **metadata only —
never secret values** (credential *names* live in `.env.example`; the
accounts table in [`runbook.md §3`](../runbook.md) stays the canonical
account inventory). One line per action: date · action · surface · what it
unblocked · replay note. Decisions are excluded — they live in decision
records; this file is operator actions only.

## Era 0 — initial infrastructure (repo bootstrap; exact dates in `git log docs/runbook.md`)

One sitting-cluster, reconstructed from [`runbook.md §3`](../runbook.md) +
[`infrastructure-setup.md`](infrastructure-setup.md) (both stay canonical
for the *how*; this is the replay checklist). Dependency order for a
rebuild:

1. **Domains** — buy `nlqdb.com` (+ `nlqdb.ai`); zones onto Cloudflare Free. ~15 min.
2. **Accounts, in dependency order** (17 created, each free-tier; full table runbook §3):
   GitHub org (`nlqdb`) → Cloudflare → Neon → npm (`@nlqdb` scope) →
   Google Cloud project + OAuth consent screen → Resend (+ DKIM/SPF DNS) →
   Stripe (live-mode merchant, CHF) → Grafana Cloud → LogSnag → Tinybird →
   PostHog → Sentry → Fly.io → LLM providers (Google AI Studio, Groq,
   OpenRouter, + later Cerebras/Mistral/SambaNova/NVIDIA/Cohere/HF).
   Docker Hub deliberately skipped (ghcr.io instead). ~2–4 h total.
3. **OAuth apps** — GitHub OAuth apps (prod + dev + canary pairs), Google
   OAuth client; callbacks pinned per runbook §5/§5b. ~30 min.
4. **Tokens/keys minted** — one per service into `.envrc` (~60 vars today;
   names in `.env.example`), then `scripts/mirror-secrets-gha.sh` +
   `mirror-secrets-workers.sh` propagate; `scripts/verify-secrets.sh`
   proves the set. Agent-doable once values exist; the *minting clicks* are
   human. ~1–2 h.
5. **One-time console opt-ins** — Cloudflare R2 "Get Started" click; Neon
   project (us-east-1, PG 17, Neon Auth OFF). Minutes each.

## Era 1 — Phase 0/1 operations (dated where a source records it)

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-05-20 | Bootstrap-publish `@nlqdb/sdk@0.1.0` from maintainer npm session (npm) | changesets/OIDC release lane — OIDC can't create a first version | ~5 min; canonical procedure `.changeset/README.md` |
| (unrecorded) | Bootstrap-publish `@nlqdb/cli@0.1.0` (npm) | `npx @nlqdb/cli` shim | same procedure |
| (unrecorded) | Stripe live-mode sitting: keys, 2 prices, webhook (5 events), Tax, customer portal (Stripe dashboard) | paid-plan readiness (row #20) | ~30 min; `docs/pricing-source-of-truth.md` |
| (unrecorded) | GSC service account + `GSC_SERVICE_ACCOUNT_JSON` (Google console) | `scripts/gsc-pull.ts` — row #7's Google-side instrument | ~10 min |
| 2026-06-12 | Submitted the original Anthropic MCP directory form (clau.de form) | nothing — produced no listing; superseded by the admin-portal path (queue bullet #2) | lesson: verify the live submission path first |

## Era 2 — the 2026-07-26 sitting (seven actions, one hour, queue 9 → 2)

Recorded live during the sitting (PR #834; verification per action in its
body):

| # | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 1 | `npm login` + bootstrap-publish `@nlqdb/mcp@0.1.0` `--no-provenance` (terminal + npm web auth) | the headless install path — first agent-usable route into nlqdb memory | ~5 min; paste was pre-staged in the queue bullet |
| 2 | Configure npm Trusted Publisher for `@nlqdb/mcp` → `release-npm.yml` (npmjs.com) | OIDC publishes with provenance for every later version | ~3 min; fields table `.changeset/README.md`; "allowed actions": publish (+ stage publish, unused) |
| 3 | Smithery: CLI `auth login` (browser OAuth) → `mcp publish` → approve OAuth scan → set listing metadata (smithery.ai) | directory listing, all 5 tools scanned (ledger row #4 in-flight) | ~10 min incl. a local-network false start; homepage/utm field didn't persist — recheck |
| 4 | Flip "Always Use HTTPS", `nlqdb.com` zone (Cloudflare dashboard) | closed GLOBAL-039's plaintext-http residual gap | ~2 min; agent token can't touch zone settings |
| 5 | Submit mcp.so form (GitHub sign-in, mcp.so/submit) | ledger row #7 in-flight (approval queue) | ~5 min; payload was pre-staged |
| 6 | Submit cursor.directory form (sign-in, /plugins/new) | ledger row #8 in-flight (approval queue) | ~5 min; payload was pre-staged |
| 7 | Fork + PR to `punkpeye/awesome-mcp-servers` ([#10984](https://github.com/punkpeye/awesome-mcp-servers/pull/10984), own GitHub account over SSH) | ledger row #10, in-flight on merge | ~10 min; agent sessions are repo-scoped, so cross-repo PRs stay human (or a scope-free session) |

Pattern worth keeping: every action took minutes **because the payload was
pre-staged by agents** — the founder-minute cost of an action is set by how
well the queue bullet was prepared, not by the action itself.
