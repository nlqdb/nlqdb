# Founder-actions log — every human operator action, append-only

Why this file: the company is operated by agents; the human does only what
agents cannot (accounts, credentials, console clicks, account-walled
submissions, money). Those actions used to vanish on completion — queue
bullets are deleted once done ([`blocked-by-human.md`](../blocked-by-human.md)
charter, which now points here), so the only
record was git archaeology. This log is the durable, chronological record,
kept so that (a) standing up another product with an agent is a **replay**,
not a reconstruction, and (b) it seeds the founder-ops goal pack
([`SK-PIVOT-018`](../features/agent-memory-pivot/decisions/SK-PIVOT-018-goal-packs.md)).

Rules: append-only, newest at the bottom of each era; **metadata only —
never secret values** (credential *names* live in `.env.example`; the
accounts table in [`runbook.md §3`](../runbook.md) stays the canonical
account inventory, and the channel ledger
[`research/acquisition-channels.md`](../research/acquisition-channels.md)
the canonical *status* of anything submitted — this log records the action,
never re-states the outcome). One line per action: date · action · surface ·
what it unblocked · replay note. Decisions are excluded — they live in
decision records; this file is operator actions only.

## Era 0 — initial infrastructure (repo bootstrap; exact dates in `git log docs/runbook.md`)

One sitting-cluster, reconstructed from [`runbook.md §3`](../runbook.md) +
[`infrastructure-setup.md`](infrastructure-setup.md) (both stay canonical
for the *how*; this is the replay checklist). Dependency order for a
rebuild; the times are replay estimates, not measurements:

1. **Domains** — buy `nlqdb.com` (+ `nlqdb.ai`); zones onto Cloudflare Free. ~15 min.
2. **Accounts, in dependency order** (plans + identifiers per service: runbook §3):
   GitHub org (`nlqdb`) → Cloudflare → Neon → npm (`@nlqdb` scope) →
   Google Cloud project + OAuth consent screen → Resend (+ DKIM/SPF DNS) →
   Stripe (live-mode merchant, CHF) → Grafana Cloud → LogSnag → Tinybird →
   PostHog → Sentry → Fly.io → LLM providers (Google AI Studio, Groq,
   OpenRouter, + later Cerebras/Mistral/SambaNova/NVIDIA NIM).
   Docker Hub deliberately skipped (ghcr.io instead). ~2–4 h total.
3. **OAuth apps** — GitHub OAuth apps (prod + dev + canary pairs), Google
   OAuth client; callbacks pinned per runbook §5/§5b. ~30 min.
4. **Tokens/keys minted** — one per service into `.envrc` (canonical names
   in `.env.example`), then `scripts/mirror-secrets-gha.sh` +
   `mirror-secrets-workers.sh` propagate; `scripts/verify-secrets.sh`
   proves the set. Agent-doable once values exist; the *minting clicks* are
   human. ~1–2 h.
5. **One-time console opt-ins** — Neon project (us-east-1, PG 17, Neon Auth
   OFF), minutes. Cloudflare R2 is **not** a free click: it needs a payment
   method on file even inside the always-free allowance, so the R2 line was
   added **2026-04-26 and cancelled the same day** — replay both halves, and
   re-read the "does the bucket keep serving after cancellation?" unknown in
   [`runbook.md §7`](../runbook.md).

## Era 1 — Phase 0/1 operations (dated where a source records it)

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-05-20 | Bootstrap-publish `@nlqdb/sdk@0.1.0` from maintainer npm session (npm) | changesets/OIDC release lane — OIDC can't create a first version | ~5 min; canonical procedure `.changeset/README.md` |
| (unrecorded) | Bootstrap-publish `@nlqdb/cli@0.1.0` (npm) | `npx @nlqdb/cli` shim | same procedure |
| (unrecorded) | Stripe live-mode sitting: keys, 2 prices, webhook (5 events), Tax, customer portal (Stripe dashboard) | paid-plan readiness (scorecard row #20) | ~30 min; `docs/pricing-source-of-truth.md` |
| (unrecorded) | GSC service account + `GSC_SERVICE_ACCOUNT_JSON` (Google console) | `scripts/gsc-pull.ts` — scorecard row #7's Google-side instrument | ~10 min |
| 2026-06-12 | Submitted the original Anthropic MCP directory form (clau.de form) | nothing — produced no listing; superseded by the plan-gated admin-portal path (ledger row #9, still queued) | lesson: verify the live submission path first |

## Era 2 — the 2026-07-26 sitting (seven actions, queue 9 → 2)

Recorded live during the sitting (PR #834; verification per action in its
body). "Ledger row #N" = the channel row in
[`research/acquisition-channels.md`](../research/acquisition-channels.md),
which owns each listing's current status:

| # | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 1 | `npm login` + bootstrap-publish `@nlqdb/mcp@0.1.0` `--no-provenance` (terminal + npm web auth) | the headless install path — first agent-usable route into nlqdb memory | ~5 min; paste was pre-staged in the queue bullet |
| 2 | Configure npm Trusted Publisher for `@nlqdb/mcp` → `release-npm.yml` (npmjs.com) | OIDC publishes with provenance for every later version | ~3 min; fields table `.changeset/README.md`; "allowed actions": publish (+ stage publish, unused) |
| 3 | Smithery: CLI `auth login` (browser OAuth) → `mcp publish` → approve OAuth scan → set listing metadata (smithery.ai) | directory listing, all 5 tools scanned (ledger row #4) | ~10 min incl. a local-network false start; homepage/utm field didn't persist — recheck |
| 4 | Flip "Always Use HTTPS", `nlqdb.com` zone (Cloudflare dashboard) | closed GLOBAL-039's plaintext-http residual gap | ~2 min; agent token can't touch zone settings |
| 5 | Submit mcp.so form (GitHub sign-in, mcp.so/submit) | the mcp.so listing, once approved (ledger row #7) | ~5 min; payload was pre-staged |
| 6 | Submit cursor.directory form (sign-in, /plugins/new) | the cursor.directory listing, once approved (ledger row #8) | ~5 min; payload was pre-staged |
| 7 | Fork + PR to `punkpeye/awesome-mcp-servers` ([#10984](https://github.com/punkpeye/awesome-mcp-servers/pull/10984), own GitHub account over SSH) | the list entry, once maintainers merge (ledger row #10) | ~10 min; agent sessions are repo-scoped, so cross-repo PRs stay human (or a scope-free session) |

Pattern worth keeping: every action took minutes **because the payload was
pre-staged by agents** — the founder-minute cost of an action is set by how
well the queue bullet was prepared, not by the action itself.

## Era 3 — 2026-07-27

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-07-27 | Deleted the orphaned Neon branches `pr-571` and `pr-648` (Neon API) | `ci.yml`'s `test-api-smoke-neon` and every preview needing a branch — the project sat at Free's 10-branch cap, so `POST /branches` answered `422 BRANCHES_LIMIT_EXCEEDED` on innocent PRs | ~2 min; **don't replay** — the same run made it self-healing: all three creation sites now set Neon's `expires_at`, so an orphan reaps itself server-side even when no runner survives to clean up |

## Era 4 — 2026-07-29 (advisor session, in-session decisions)

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-07-29 | **Go** on the `MEMORY_PRESET=1` prod flip — merged #835 (agent session, founder-directed live) | the `agent_memory_v1` preset + `nlqdb_remember` for every signed-in account; SK-PIVOT-016's prod prerequisite → D-04 is agent-drivable | ~1 min; the E-06 gate blocker (E-03, #851) had already shipped, so the decision was a clean go/no-go; rollback stays one var |
| 2026-07-29 | Merged the changesets release PR #826 (agent session, founder-directed live) | `@nlqdb/mcp@0.1.1` (corrected no-key stderr + README) and `@nlqdb/sdk@0.2.2` (import-entrypoint fix) publish via Trusted-Publisher OIDC — no manual `npm login` | ~1 min; a normal release step — merging the changesets PR is the whole action |
| 2026-07-29 | Provided `LOGSNAG_TOKEN` + `LOGSNAG_PROJECT` to the agent session env (CCR environment settings) | the `window.__nlqdb_logsnag` hook — client demand signals (GLOBAL-024) stop being no-ops; verified with one live ingest event (HTTP 200, channel auto-accepted) | ~2 min; both names were already in `.envrc` + `mirror-secrets-gha.sh`, so the GHA secrets side needed nothing new |
| 2026-07-29 | Pasted Dependabot alert #29's body into the session (sharp < 0.35.0 in `apps/docs`, 4 libvips CVEs) | the bump to sharp 0.35.3 (libvips 8.18.3) with a verified docs build — the alert was unreadable from any agent session (no alerts endpoint in the toolset) | ~1 min; replay: pasting the alert text beats waiting on a security-events grant |
| 2026-07-29 | Minted an `sk_mcp_` MCP key at `/app/keys` and set it as `NLQDB_MCP_API_KEY` in the agent-session env | R-04's cold-agent walk — ran green the same session (published `@nlqdb/mcp@0.1.1` + published guide, real prod write + read-back through the confirm flow), deleting the queue's last ~2-min item | ~2 min; the walk passes it to the binary as `NLQDB_API_KEY`; CCR-sandbox replays need `NODE_OPTIONS=--use-env-proxy` (direct egress blocked there) |
