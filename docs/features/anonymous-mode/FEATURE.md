---
name: anonymous-mode
description: No-login first-value path across web / CLI / MCP; later attached to a Better Auth identity.
when-to-load:
  globs:
    - apps/web/**
    - cli/**
    - apps/api/src/anon-adopt.ts
  topics: [anonymous, first-value, no-login, device]
---

# Feature: Anonymous Mode

**One-liner:** No-login first-value path across web / CLI / MCP; later attached to a Better Auth identity.
**Status:** partial — anon `/v1/ask` create flow (`apps/api/src/principal.ts` + `apps/api/src/anon-rate-limit.ts` + `apps/web/src/pages/app/new.astro`) shipped; `/v1/anon/adopt` row-update + RLS-policy rewrite on sign-in remains the Phase 1 exit gate
**Owners (code):** `apps/web/**`, `cli/**`, `apps/api/src/anon-adopt.ts`
**Cross-refs:** docs/decisions.md#GLOBAL-007 · docs/architecture.md §0.1, §3.3, §3.6.4, §4.1, §14.3, §14.6 · docs/runbook.md §10 (P1, P5 first-touch) · docs/architecture.md §10 §4 (partial status) · docs/runbook.md §9 (anonymous-db lifecycle)

## Touchpoints — read this skill before editing

- `apps/web/**`
- `cli/**`
- `apps/api/src/anon-adopt.ts`

## Decisions

### SK-ANON-001 — `localStorage` token on web; OS-keychain anonymous token on CLI

- **Decision:** Anonymous identity is an opaque token. On the web it lives in `localStorage` (visible to the page; no server cookie required for first value). On the CLI, the anonymous token is minted by `nlq` and written to the OS keychain (`zalando/go-keyring`) with the same fallback behavior as a real session token. The MCP server inherits identity from the host's installed key, so MCP has no separate anonymous token.
- **Core value:** Free, Effortless UX, Goal-first
- **Why:** Per-surface storage matches each surface's idioms — `localStorage` is what every web app uses, the keychain is what every CLI uses. Reusing `GLOBAL-010`'s storage primitive on the CLI means anonymous tokens benefit from the same encryption-at-rest and same shell-history-leak protection as a real session. A single shared anonymous-token format would have forced the web to use cookies (heavier) or the CLI to use a config file (rejected by `GLOBAL-010`).
- **Consequence in code:** Web reads/writes `localStorage["nlqdb_anon"]` for the bearer token. Per `SK-ANON-011`, three additional localStorage slots — `nlqdb_draft`, `nlqdb_pending`, `nlqdb_history` — carry the prompt-persistence guarantee under the same storage primitive. CLI uses the keychain abstraction with key `nlqdb-anon-<machine_id>`. The API treats both bearer values as `Authorization: Bearer anon_…`. No surface invents a third storage path.
- **Alternatives rejected:**
  - Cookie-based anonymous identity on the web — adds a server round-trip before the chat materializes; the cookie can't be set until the response.
  - Plaintext config file on the CLI — banned by `GLOBAL-010`.

### SK-ANON-002 — 72h adoption window from the user's perspective; 90-day server retention

- **Decision:** The user-facing message is "anonymous DBs live for 72h — sign in to keep them." The server-side retention policy in `docs/runbook.md §9` is more generous (90 days from last query, with a 10 MB per-DB hard cap and pressure-sweep at 300 MB total). The 72h number is a *promise*, not a *limit*.
- **Core value:** Honest latency, Bullet-proof, Goal-first
- **Why:** Promising 72h and keeping the data 90 days means the user is never surprised by data loss. The server policy is sized to actual capacity (`docs/runbook.md §9.1` does the math against the 0.5 GB Neon Free cap); the user-facing copy is a worst-case promise that's also short enough to feel urgent (drives adoption) but not so short it strands legitimate weekend-only users. Honesty about latency / availability cuts both ways: under-promise, over-deliver, never the reverse.
- **Consequence in code:** All user-facing copy says "72h". The sweep job at `apps/api/src/db-sweep/sweep.ts` runs daily, drops anonymous DBs whose `last_queried_at < now() - 90 days`, and pressure-sweeps the oldest if total bytes exceed 300 MB. CLI's first-run banner: *"Saved as anonymous. Run `nlq login` within 72h to keep it."* (`docs/features/cli/FEATURE.md`). Tests on `sweep-skips-adopted.test.ts` guarantee adopted DBs are never touched.
- **Alternatives rejected:**
  - Promise 90 days and limit at 90 days — gives no urgency to sign in; activation funnel suffers.
  - Promise 24h and limit at 24h — strands weekend-only users (Maya in `docs/runbook.md §10` starts on a Friday night and signs in Monday).

### SK-ANON-003 — Adoption is a one-row update, never a data move

- **Decision:** Sign-in adopts an anonymous DB by updating `databases.adopted_at` and `databases.user_id` in the D1 row. The Postgres schema, the data, the `pk_live_` keys, and the plan cache are unchanged. The endpoint is `POST /v1/anon/adopt`.
- **Core value:** Bullet-proof, Effortless UX, Seamless auth
- **Why:** A "data move" path is a migration path — every migration is a chance to lose data. By keeping adoption to one row update, we collapse the failure surface to "the row update either succeeded or did not"; either state is recoverable. It also means adoption is sub-second regardless of DB size, which keeps the seamless-auth promise (`GLOBAL-008`) honest at sign-in.
- **Consequence in code:** `apps/api/src/routes/anon/adopt.ts` is a small handler that authenticates the new session, validates the bearer-anon token, and runs `UPDATE databases SET adopted_at = now(), user_id = ? WHERE anon_token_hash = ? AND adopted_at IS NULL`. The temporary `pk_live_` minted for the anonymous device is rotated to a permanent one in the same transaction (per `SK-WEB-007`). No row-level data migration; no pgvector re-embedding.
- **Alternatives rejected:**
  - Copy data into a "real" schema on adoption — slow, fragile, double-storage during the window.
  - Defer adoption until the user explicitly clicks "keep this" — adds a step to the seamless arc; activation suffers.

### SK-ANON-004 — Anonymous tier has its own rate-limit bucket distinct from authenticated

- **Decision:** The API has an explicit anonymous-mode rate-limit tier — a per-IP bucket, separate from per-(user_id, key) buckets used for authenticated calls. Limits are tighter than free-tier authenticated limits. Anonymous creates also have separate per-IP and per-account create-rate caps (5/hour per IP, 20/day per account) per `docs/architecture.md §3.6.8`. Layered above this per-IP bucket is the **global anon cap** (`SK-ANON-010`, 100/hr / 1000/day / 10k/month summed across all anon traffic) — when global trips, the user is soft-promoted to auth via 401 + sign-in URL rather than 429'd.
- **Core value:** Free, Bullet-proof
- **Why:** Anonymous traffic has no accountable identity behind it — abuse defenses can only key off IP. Sharing the authenticated bucket means one abuser exhausts the per-DB budget for legitimate users. A separate, tighter anonymous tier limits blast radius without inconveniencing real users (who graduate to the authenticated tier on sign-in). Without this tier the free promise collapses under any meaningful abuse.
- **Consequence in code:** `apps/api/src/middleware/rate-limit.ts` selects bucket by auth shape: anonymous → IP bucket (smaller window, lower cap); authenticated → user/key bucket. The anonymous-create caps live alongside the rate-limit middleware. PoW on signup is the escape valve if a coordinated wave hits the IP bucket.
- **Alternatives rejected:**
  - One shared bucket with anonymous and authenticated traffic — abuse wins.
  - No anonymous rate limit, rely on PoW everywhere — PoW is friction; reserve it for active-abuse states.

### SK-ANON-005 — `nlq login` adopts every anonymous DB on the device in one action

- **Decision:** The CLI's `nlq login` device-code flow, on success, automatically adopts every anonymous DB associated with the device's anonymous token — not one at a time, not "ask the user which to keep." The session message names the count: *"Signed in as maya@example.com. Adopted 1 anonymous DB: orders-tracker-a4f."*
- **Core value:** Seamless auth, Effortless UX, Goal-first
- **Why:** Asking the user "which of these 3 anonymous DBs do you want to keep?" turns sign-in into a chore. The user's intent in running `nlq login` is "keep my work" — adopting all of it is the right default. If they want to drop one later, the dashboard supports that. The message naming the count gives them confidence that adoption happened.
- **Consequence in code:** Device-code token endpoint, on a successful exchange, reads the device's anonymous-token hash and runs the adopt update for every matching `databases` row. CLI prints the count + slugs. Web mirror: post-OAuth callback runs the same adopt path against the browser's `localStorage` token.
- **Alternatives rejected:**
  - Per-DB confirmation prompt — slow and out-of-character for a CLI sign-in.
  - Adopt nothing by default; require explicit `nlq adopt <db>` — silently drops user work after 90 days; surprises follow.

### SK-ANON-006 — Anonymous flow has zero conditional branches in the orchestrator

- **Decision:** `/v1/ask`'s orchestrator does not branch on `is_anonymous`. Anonymous identity is just one shape of `Authorization` header (`Bearer anon_…`); the orchestrator resolves a `user_id` (or anonymous-device id) up front and the rest of the pipeline treats both the same way. Per-DB visibility, rate-limit selection, and quotas are the only places where the anonymous/authenticated distinction matters, and each is keyed off the resolved id, not a boolean.
- **Core value:** Bullet-proof, Simple
- **Why:** Conditional code paths between anonymous and authenticated are where adoption bugs live ("works for signed-in users but not anonymous", or vice-versa). Forcing parity through the same orchestrator is the only durable fix; it also keeps `GLOBAL-002` (behavior parity) honest, because the surface differences are limited to surface UX, not pipeline semantics.
- **Consequence in code:** `apps/api/src/ask/orchestrate.ts` accepts a resolved `principal: { kind: "user" | "anon", id: string }`. Validators, plan cache, executor, and summarizer all consume `principal`; none of them check `kind`. Tests cover anonymous + authenticated through identical fixtures.
- **Alternatives rejected:**
  - `if (isAnonymous)` branches at each pipeline step — drift over time, double the test surface.
  - Two separate routes for anonymous vs. authenticated — every endpoint duplicates, every bug fixes need two PRs.

### SK-ANON-007 — PoW challenge: Cloudflare Turnstile; triggers at 3 creates / 5 min per IP

- **Decision:** When an IP exceeds 3 anonymous DB-create requests in any rolling 5-minute window, subsequent creates require a Cloudflare Turnstile challenge (invisible/managed mode) before processing.
- **Core value:** Free, Bullet-proof
- **Why:** The per-IP 5/hour cap blocks bulk creation over long windows; Turnstile addresses short bursts (a bot at 1 req/s hits 3 creates in 3 s). Turnstile is preferred over raw hashcash because it is free on CF Workers (unlimited requests, free plan), requires zero KV writes for validation (a single `fetch` to `challenges.cloudflare.com/turnstile/v0/siteverify`), and runs entirely in-browser. Argon2/scrypt-based hashcash at useful difficulty (20-bit SHA-256 ≈ 200–500 ms solve) would require a WASM bundle and server-side nonce state. The 3-in-5-min trigger mirrors Cloudflare's own WAF recommendation for sensitive write endpoints.
- **Consequence in code:** `apps/api/src/middleware/rate-limit.ts` tracks the rolling 5-min create count per IP. At ≥ 3 without a valid `cf-turnstile-response` token, return `428 Precondition Required` with `{ code: "challenge_required", action: "Complete the browser challenge to continue." }`. Turnstile site-key + secret are Workers secrets; site-key is baked into the Astro front-end. Validation: `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` — no KV write.
- **Alternatives rejected:**
  - Raw hashcash (SHA-256, 20-bit) — valid self-hosted fallback if Turnstile is unavailable, but requires a challenge-issuance endpoint and HMAC-signed nonce management (ALTCHA pattern).
  - Argon2/scrypt — memory-hard; impractical in browser JS at useful difficulty without a WASM bundle.
  - KV-backed nonce tracking — 1,000 KV writes/day budget; too expensive.

### SK-ANON-008 — Anon principal id is `anon:<sha256(token)[:16]>`; cookie session wins when both present

- **Decision:** The `requirePrincipal` middleware (`apps/api/src/principal.ts`) accepts either a Better Auth cookie session OR `Authorization: Bearer anon_<token>`. The anon principal's id is `anon:<sha256(token)[:16]>` — a 64-bit, non-reversible derivation from the device token. When both shapes are present on the same request, the cookie session wins.
- **Core value:** Bullet-proof, Seamless auth, Free
- **Why:** Three properties forced this shape. (1) The orchestrator's `tenantId` is baked into RLS policies (`apps/api/src/db-create/neon-provision.ts`) and into OTel span attributes — putting the raw bearer there would leak it to every operator with span access. SHA-256 prefix is non-reversible and short enough to be safe in those contexts. (2) `apps/api/src/db-create/orchestrate.ts`'s `isAnonymous(tenantId)` check already keys off the `anon:` prefix to set `pkLive: null` (per SK-WEB-007); reusing it means no orchestrator branch (`SK-ANON-006`). (3) Cookie-wins is the only way `/v1/anon/adopt` can trigger on the seamless-auth path: a signed-in user that still has an `anon_*` token in `localStorage` is, by definition, an adopted user — the cookie reflects truth, the bearer is leftover state. 16 hex chars (= 64 bits) is collision-free at four-billion-device cardinality per birthday-bound math.
- **Consequence in code:** `principal.ts` exports `Principal = { kind: "user", id, session } | { kind: "anon", id, token }` and `getPrincipal(c)`. Routes that need cookie-only stay on `requireSession` (`/v1/anon/adopt`, `/v1/chat/messages`); routes that accept anon switch to `requirePrincipal`. `parseAnonBearer` rejects bare `Bearer anon_` (no entropy after the prefix). The 16-char prefix is the only place where the token-to-id mapping happens; do not invent a parallel hash anywhere else.
- **Alternatives rejected:**
  - Use the raw token as `tenantId` — the token leaks into every span, every D1 row, every RLS policy. Rotation impossible.
  - Hash the token with HMAC + secret (vs plain SHA-256) — adds an HMAC-secret deploy dependency for no security gain (the token itself is the secret, not the hash).
  - Anon-bearer wins over cookie when both present — would let a stale anon token mask a live signed-in identity; adoption never fires.

### SK-ANON-009 — Turnstile verify fails open when `TURNSTILE_SECRET` is unset

- **Decision:** `verifyTurnstile()` returns `{ ok: false, reason: "unconfigured" }` when no secret is configured. The `/v1/ask` route treats `unconfigured` as allow-through. Any other failure (`invalid` / `verify_failed`) returns 428 with the challenge envelope so the surface re-renders the widget.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** Local `wrangler dev` and integration tests run without Workers secrets — failing closed there means every contributor has to provision a Turnstile keypair before they can land an anon-create change. Failing open keeps the development edit loop fast while keeping the production posture safe: production ALWAYS has the secret set (`docs/runbook.md`), so production never hits the fail-open branch. The per-IP create cap (5/hour) still applies in dev, so even with Turnstile bypassed an abuser can't burn unlimited DBs.
- **Consequence in code:** `apps/api/src/turnstile.ts` returns the typed `unconfigured` reason (not a generic failure) so the route can branch on it. The route's `allowed = verify.ok || verify.reason === "unconfigured"` is the only place this fail-open branch exists; tests assert that the production-configured path NEVER fails open even when siteverify says success=false.
- **Alternatives rejected:**
  - Fail closed when secret is missing — every dev environment + test fixture needs Turnstile credentials; landing the `kind=create` branch becomes a credential-provisioning errand.
  - Treat `verify_failed` (network 5xx) as "allow through" — masks real Cloudflare outages; an attacker hammering the route would tip Turnstile over and bypass the gate.

### SK-ANON-010 — Global anon cap (100/hr / 1000/day / 10k/month) → seamless auth redirect (401 `auth_required`)

- **Decision:** Cumulative across **all** anonymous traffic — three rolling windows: 100 calls/hour, 1000/day, 10,000/month. When any window trips, `/v1/ask` returns `401 Unauthorized` with body `{ error: { status: "auth_required", code: "anon_global_cap", window, resetAt, signInUrl, action } }`. The web surface stashes the in-flight prompt in localStorage (`SK-ANON-011`) and redirects to `signInUrl` with a same-origin `return` query param. The user signs in, the post-OAuth landing page replays the queued prompt against `/v1/ask` with the now-authed cookie session — accountable identity, no anon cap. The per-IP query bucket (30/min, `SK-ANON-004` / `SK-RL-007`) and Turnstile burst gate (3-in-5min, `SK-ANON-007`) layer underneath this and continue to return 429 / 428 respectively.
- **Core value:** Free, Bullet-proof, Effortless UX, Seamless auth
- **Why:** `SK-ANON-004` covers per-IP abuse but says nothing about cumulative anon LLM spend. The `SK-WEB-008` directive ("demo === real LLM") makes that cumulative bill load-bearing — without a global ceiling, a Hacker News spike could empty the LLM credits before lunch. The auth-redirect framing keeps `GLOBAL-007` ("no login wall before first value") honest because the wall doesn't exist on call #1; it exists at #101 within the hour, when the anon tier has already delivered first value. At that point the user has reason to sign in (they want to keep going), so the wall is well-timed rather than punitive. `SK-RL-005`'s "next action" is now "sign in" instead of "wait for window reset" — same spirit (offer a way out), different verb. Numbers (100/1000/10000) are pinned in this skill rather than left to deploy-time tuning so reviewers can reason about behaviour without grepping env config.
- **Consequence in code:** `apps/api/src/anon-global-cap.ts` keys three KV buckets (`anon:global:hr:<bucket>`, `anon:global:day:<bucket>`, `anon:global:mo:<bucket>`) under fixed-window approximations of "rolling". `peek()` returns the first failing window (hour → day → month priority); `record()` increments all three after a request is served. `apps/api/src/index.ts` runs the global gate before the per-IP gate — global is the user-facing soft-promotion; per-IP is the bot-speed defense. The `signInUrl` is built server-side via `buildSignInUrl()` (only same-origin returns allowed; never echo a foreign Referer). The Worker's `MAGIC_LINK_WEB_ORIGIN` env var picks dev vs prod sign-in.
- **Alternatives rejected:**
  - Per-IP cap only — sustained low-rate abuse across a botnet (1 req/IP/min × 1000 IPs) sails past the per-IP gate and burns the LLM budget.
  - Single global counter (no hour/day/month tiering) — either the budget resets daily (a Hacker News afternoon empties the day; everyone who arrives after gets the wall for hours) or the budget is monthly (no shorter-window protection against a sudden spike). Three windows give the system three chances to back-pressure.
  - Return 429 with a `Retry-After` instead of 401 with a sign-in URL — wastes the abuse moment for a quota the user can never refresh as anonymous; the "wait" framing misses the actual next action.
  - Hard-fail (5xx) on cap — silent delivery failure; the frontend has no shape to render a sign-in CTA against.

### SK-ANON-011 — Never lose a prompt: drafts + pending + history in localStorage; same guarantee for authed

- **Decision:** Every prompt the user touches is durable in `localStorage`, on every surface, regardless of auth shape. Three slots: `nlqdb_draft` (the goal currently being typed, debounced-saved on every keystroke; rehydrated into the input on mount), `nlqdb_pending` (a submitted prompt that hit `auth_required` or any redirect-style failure — replayed by the post-OAuth landing page), and `nlqdb_history` (last 50 completed prompts with `{ goal, submittedAt, status, outcome }`). The same three slots exist for signed-in users — the `Authorization` shape on the request changes; the persistence guarantee does not.
- **Core value:** Bullet-proof, Effortless UX, Goal-first
- **Why:** "I lost what I typed" is the single most-broken trust signal in any AI surface. The auth-redirect flow (`SK-ANON-010`) makes prompt loss especially costly — a user who types a goal and then lands on a sign-in page, signs in, and finds the input empty associates "sign in" with "lose work" forever. Drafts cover the more common case (refresh, tab crash, accidental nav); history covers recall ("what did I just ask?") and seeds future server-side mirroring. Localizing in `localStorage` (not server-side) keeps the path zero-cost on the call's hot path and avoids a write before the user's identity even exists. Server-side mirroring for cross-device continuity is a Phase 2+ concern (and an Open Question on `SK-ANON-001`).
- **Consequence in code:** `apps/web/src/lib/prompt-storage.ts` exposes `saveDraft / loadDraft / clearDraft / makeDraftSaver` (debounced via `setTimeout`), `savePending / loadPending / clearPending`, and `appendHistory / loadHistory` (capped at 50 with oldest-evicted). `CreateForm.tsx` wires the draft saver to `onChange`, rehydrates on mount via `useEffect`, stashes pending on `auth_required` BEFORE the redirect, and appends history on every terminal outcome. The post-OAuth landing page (Phase 1 exit gate; `apps/web/src/pages/sign-in/...`) reads `nlqdb_pending`, replays it, and clears the slot. localStorage availability is checked through `safeStorage()` so privacy-mode browsers fall back to in-memory state without throwing.
- **Alternatives rejected:**
  - Server-side prompt store keyed by anon hash — mirroring works cross-device but creates a write-before-identity flow (the device is anonymous; we'd have to invent an "anon prompts" table that's the next adoption target). Same end-state, larger surface; deferred to Phase 2+.
  - URL-encode the prompt in the sign-in redirect — leaks goals into server logs and sign-in analytics; the prompt should never travel through a URL.
  - Drafts-only (no pending replay) — the auth-redirect arc terminates with the user seeing a fresh empty form; defeats the point of "seamless".

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-007** — No login wall before first value.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.

## Open questions / known unknowns

- **MCP-side anonymous identity.** The current design has no MCP anonymous token — every MCP call carries a host-scoped key minted at install time. Whether a future "MCP try-before-install" flow needs an anonymous shape (server-issued one-shot key with stricter limits) is open.
- **Pressure-sweep eviction order beyond "oldest first".** `docs/runbook.md §9.3` drops the oldest anonymous DB when total bytes exceed 300 MB. Whether to weight eviction by size (drop biggest-and-oldest first) is undecided; the simpler oldest-first is the current pick.
- **Cross-device anonymous continuity.** Per-device anonymous identity (per-browser `localStorage`, per-CLI keychain) is the Phase 1 design. Cross-device unification (e.g., a paste-this-code handshake) is deferred to Phase 2 — it adds complexity for a small fraction of users and the per-device model covers the majority use case.
- **Browser-storage clearing.** A user who clears `localStorage` before signing in loses access to their anonymous DB (the device-token hash is the only handle). No recovery path is currently designed; whether this is acceptable or needs a "lost my anonymous DB" support endpoint is open.

## Happy path walkthrough

### §15.4 P5 — Aarav, the Student

**Goal:** finish the CS50 final project (a blog).

| Step | Aarav does | nlqdb does |
|---|---|---|
| 1 | Opens `nlqdb.com` on the library laptop, types *"a blog with posts and authors"* | DB created anonymously (no signup), schema inferred, replies with the SQL it ran ("…in case you're curious — your assignment asks for it") |
| 2 | Pastes the SQL into his write-up | — |
| 3 | Types *"add a sample post by 'Aarav' titled 'hello world'"* | Inserts the row |
| 4 | Clicks "Copy starter HTML" in the chat — a pre-keyed `<nlq-data>` snippet lands on his clipboard | — |
| 5 | Pastes it into his static-HTML assignment | Renders the blog feed, no build step |
| 6 | *(Optional)* Signs in with GitHub to keep the DB past 72h | Anonymous DB adopted into his account in one SQL row (§4.1) |
| 7 | Submits the assignment | — |

**What Aarav never did:** ran `brew install postgresql`, dealt with a port conflict, installed a CLI, learned what `pg_hba.conf` is, gave up on day 1.

The chat **also taught him** the SQL it generated, so he understands what his own project does. The free tier costs us cents and produces a future P1.

### §15.5 The pattern

First action is always stating a goal. DB is a silent consequence. Four surfaces (chat, CLI, MCP, embed) are projections of one verb: *ask, in plain English, against the data you care about*.
