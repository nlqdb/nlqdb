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
**Status:** implemented (Phase 1) — anon `/v1/ask` create, per-device cap (`SK-ANON-012`), global cap (`SK-ANON-010`), and the Better Auth `after`-middleware adoption hop (`recordAnonAdoption`) are live on `main`. Open items are quality-eval calibration and the Phase 2 cross-device prompt-history mirror (see Open questions).
**Owners (code):** `apps/web/**`, `cli/**`, `apps/api/src/anon-adopt.ts`
**Cross-refs:** [GLOBAL-007](../../decisions/GLOBAL-007-no-login-wall.md) · docs/architecture.md §0.1, §3.3, §3.6.4, §4.1, §14.3, §14.6 · docs/runbook.md §10 (P1, P5 first-touch) · docs/phase-plan.md (partial status) · docs/runbook.md §9 (anonymous-db lifecycle)

## Touchpoints — read this feature before editing

- `apps/web/**`
- `cli/**`
- `apps/api/src/anon-adopt.ts`

## Decisions

### SK-ANON-001 — `localStorage` token on web; OS-keychain anonymous token on CLI

- **Decision:** Anonymous identity is an opaque token. On the web it lives in `localStorage` (visible to the page; no server cookie required for first value). On the CLI, the anonymous token is minted by `nlq` and written to the OS keychain (`zalando/go-keyring`) with the same fallback behavior as a real session token. The MCP server inherits identity from the host's installed key, so MCP has no separate anonymous token.
- **Core value:** Free, Effortless UX, Goal-first
- **Why:** Per-surface storage matches each surface's idioms — `localStorage` is what every web app uses, the keychain is what every CLI uses. Reusing `GLOBAL-010`'s storage primitive on the CLI means anonymous tokens benefit from the same encryption-at-rest and same shell-history-leak protection as a real session. A single shared anonymous-token format would have forced the web to use cookies (heavier) or the CLI to use a config file (rejected by `GLOBAL-010`).
- **Consequence in code:** Web reads/writes `localStorage["nlqdb_anon"]` for the bearer token. Per `SK-ANON-011`, three additional localStorage slots — `nlqdb_draft`, `nlqdb_pending`, `nlqdb_history` — carry the prompt-persistence guarantee under the same storage primitive. CLI uses the keychain abstraction with key `nlqdb-anon-<machine_id>`. The API treats both bearer values as `Authorization: Bearer anon_…`. No surface invents a third storage path. The hero's `postAskCreate` (`apps/web/src/lib/api.ts`) sends `credentials: "omit"` so the session cookie is dropped from the `/v1/ask` POST even when the user is already signed in — without that the same-origin browser default would ride the `__Secure-better-auth.session_token` cookie, `SK-ANON-008`'s cookie-wins precedence would resolve the request as the authed user, and the SK-ANON-012 device cap → sign-in handoff would never fire from the hero.
- **Alternatives rejected:** cookie-based anon identity on the web (adds a server round-trip before the chat materializes) and a plaintext CLI config file (banned by `GLOBAL-010`).

### SK-ANON-002 — 72h adoption window from the user's perspective; 90-day server retention

- **Decision:** The user-facing message is "anonymous DBs live for 72h — sign in to keep them." The server-side retention policy in `docs/runbook.md §9` is more generous (90 days from last query, with a 10 MB per-DB hard cap and pressure-sweep at 300 MB total). The 72h number is a *promise*, not a *limit*.
- **Core value:** Honest latency, Bullet-proof, Goal-first
- **Why:** Promising 72h and keeping the data 90 days means the user is never surprised by data loss. The server policy is sized to actual capacity (`docs/runbook.md §9.1` does the math against the 0.5 GB Neon Free cap); the user-facing copy is a worst-case promise that's also short enough to feel urgent (drives adoption) but not so short it strands legitimate weekend-only users.
- **Consequence in code:** All user-facing copy says "72h". The sweep job at `apps/api/src/db-sweep/sweep.ts` runs daily, drops anonymous DBs whose `last_queried_at < now() - 90 days`, and pressure-sweeps the oldest if total bytes exceed 300 MB. CLI's first-run banner: *"Saved as anonymous. Run `nlq login` within 72h to keep it."* (`docs/features/cli/FEATURE.md`). Tests on `sweep-skips-adopted.test.ts` guarantee adopted DBs are never touched.
- **Alternatives rejected:** promise-90d/limit-90d (no urgency to sign in) and promise-24h/limit-24h (strands weekend-only users like Maya in `docs/runbook.md §10`).

### SK-ANON-003 — Adoption is a metadata retarget, never a data move (amended 2026-07-11)

- **Decision:** Sign-in adopts anonymous DBs by re-keying `databases.tenant_id` in D1 to the user id **plus a constant-size Postgres ACL retarget per hosted DB**: role-if-missing + USAGE/DML/sequence grants + the `WITH SET` membership exec needs, and `ALTER POLICY tenant_isolation` to the new tenant literal (`anon-adopt.ts::retargetAdoptedDbAcl`). Schema and rows never move.
- **Core value:** Bullet-proof, Effortless UX, Seamless auth
- **Why:** A data move is a migration path — every migration can lose data; metadata-only adoption stays sub-second at any DB size (`GLOBAL-008`). The 2026-07-11 amendment: least-privilege exec (#614, 2026-07-05) made the querying tenant's role + RLS literal load-bearing, so the original D1-only flip left every adopted DB permanently unqueryable — exec's `SET LOCAL ROLE tenant_<hash(adopter)>` hit grants and a baked `tenant_isolation` literal that still named the anon creator (surfaced as opencheck `#authed-state-preserved` failing with `db_unreachable`).
- **Consequence in code:** `recordAnonAdoption` flips D1 (`RETURNING` all migrated rows), then best-effort `retargetAdoptedDbAcl` per hosted-postgres row — a failed retarget logs `anon_adopt_regrant_failed` but never fails the sign-in. Statements mirror the provision batch (`neon-provision.ts`).
- **Alternatives rejected:** data copy into a user schema (slow, fragile, double-storage); an explicit "keep this" click (adds a step to the seamless arc). ~~exec-time self-heal on `SET ROLE` failure~~ — **superseded 2026-07-12 by `SK-ASK-024`** (ask-pipeline): a transient retarget miss proved *permanent*, not sign-in-local (18/18 deterministic `22023` diag rows over one e2e dispatch; a fresh browser mints a fresh anon token, so replay never re-runs the ACL loop), and the heal rides the exec *failure* path, not the hot path.

### SK-ANON-004 — Anonymous tier has its own rate-limit bucket distinct from authenticated

- **Decision:** The API has an explicit anonymous-mode rate-limit tier — a per-IP bucket, separate from per-(user_id, key) buckets used for authenticated calls, with tighter limits. The operative caps layered above it are `SK-ANON-012` (per-device 1-call cap on `/v1/ask`) and `SK-ANON-010` (global anon cap → seamless auth redirect); this decision owns only the bucket separation.
- **Core value:** Free, Bullet-proof
- **Why:** Anonymous traffic has no accountable identity — sharing the authenticated bucket lets one abuser exhaust legitimate users' budget; a separate, tighter tier bounds the blast radius.
- **Consequence in code:** `apps/api/src/middleware/rate-limit.ts` selects bucket by auth shape: anonymous → IP bucket (smaller window, lower cap); authenticated → user/key bucket. The anonymous-create caps live alongside the rate-limit middleware. PoW on signup is the escape valve if a coordinated wave hits the IP bucket.
- **Alternatives rejected:** one shared anon+authed bucket (abuse wins) and PoW-everywhere with no anon rate limit (PoW is friction; reserve it for active-abuse states).

### SK-ANON-005 — `nlq login` adopts every anonymous DB on the device in one action

- **Decision:** The CLI's `nlq login` device-code flow, on success, automatically adopts every anonymous DB associated with the device's anonymous token — not one at a time, not "ask the user which to keep." The session message names the count: *"Signed in as maya@example.com. Adopted 1 anonymous DB: orders-tracker-a4f."*
- **Core value:** Seamless auth, Effortless UX, Goal-first
- **Why:** The intent of `nlq login` is "keep my work" — adopting everything is the right default; the dashboard supports dropping one later.
- **Consequence in code:** Device-code token endpoint, on a successful exchange, reads the device's anonymous-token hash and runs the adopt update for every matching `databases` row. CLI prints the count + slugs. Web mirror: post-OAuth callback runs the same adopt path against the browser's `localStorage` token.
- **Alternatives rejected:** per-DB confirmation prompts (slow, out-of-character for a CLI) and explicit `nlq adopt <db>` (silently drops user work after 90 days).

### SK-ANON-006 — Anonymous flow has zero conditional branches in the orchestrator

- **Decision:** `/v1/ask`'s orchestrator does not branch on `is_anonymous`. Anonymous identity is just one shape of `Authorization` header (`Bearer anon_…`); the orchestrator resolves a `user_id` (or anonymous-device id) up front and the rest of the pipeline treats both the same way. Per-DB visibility, rate-limit selection, and quotas are the only places where the anonymous/authenticated distinction matters, and each is keyed off the resolved id, not a boolean.
- **Core value:** Bullet-proof, Simple
- **Why:** Conditional code paths between anonymous and authenticated are where adoption bugs live ("works for signed-in users but not anonymous", or vice-versa). Forcing parity through the same orchestrator is the only durable fix; it also keeps `GLOBAL-002` (behavior parity) honest, because the surface differences are limited to surface UX, not pipeline semantics.
- **Consequence in code:** `apps/api/src/ask/orchestrate.ts` accepts a resolved `principal: { kind: "user" | "anon", id: string }`. Validators, plan cache, executor, and summarizer all consume `principal`; none of them check `kind`. Tests cover anonymous + authenticated through identical fixtures.
- **Alternatives rejected:** `if (isAnonymous)` branches at each pipeline step (drift, double test surface) and separate anon/authed routes (every endpoint duplicates; every bug fix needs two PRs).

### SK-ANON-007 — PoW challenge: Cloudflare Turnstile; triggers at 3 creates / 5 min per IP

- **Status:** superseded by SK-ANON-012. Turnstile is retained as the bot-floor on the create path, unconditional (not burst-gated); widget still unshipped (SK-ANON-009).

### SK-ANON-008 — Anon principal id is `anon:<sha256(token)[:16]>`; cookie session wins when both present

- **Decision:** The `requirePrincipal` middleware (`apps/api/src/principal.ts`) accepts either a Better Auth cookie session OR `Authorization: Bearer anon_<token>`. The anon principal's id is `anon:<sha256(token)[:16]>` — a 64-bit, non-reversible derivation from the device token. When both shapes are present on the same request, the cookie session wins.
- **Core value:** Bullet-proof, Seamless auth, Free
- **Why:** Three properties forced this shape: (1) `tenantId` is baked into RLS policies (`apps/api/src/db-create/neon-provision.ts`) and OTel span attributes — the raw bearer would leak to every operator with span access; SHA-256 prefix is non-reversible and short enough to be safe there. (2) `isAnonymous(tenantId)` in `db-create/orchestrate.ts` already keys off the `anon:` prefix to set `pkLive: null` (`SK-WEB-007`); reusing it avoids an orchestrator branch (`SK-ANON-006`). (3) Cookie-wins is the only way `/v1/anon/adopt` can trigger on the seamless-auth path — a stale `anon_*` token in `localStorage` after sign-in is leftover state, not truth. 16 hex chars (64 bits) is collision-free at four-billion-device cardinality per birthday-bound math.
- **Consequence in code:** `principal.ts` exports `Principal = { kind: "user", id, session } | { kind: "anon", id, token }` and `getPrincipal(c)`. Routes that need cookie-only stay on `requireSession` (`/v1/anon/adopt`, `/v1/chat/messages`); routes that accept anon switch to `requirePrincipal`. `parseAnonBearer` rejects bare `Bearer anon_` (no entropy after the prefix). The 16-char prefix is the only place where the token-to-id mapping happens; do not invent a parallel hash anywhere else. The one exception to cookie-wins is the hero's `credentials: "omit"` bypass (`SK-ANON-001`), which drops the session cookie so the hero hits the SK-ANON-012 device cap instead of resolving as the authed user; cookie-wins still governs every other `requirePrincipal` route.
- **Alternatives rejected:**
  - Use the raw token as `tenantId` — the token leaks into every span, every D1 row, every RLS policy. Rotation impossible.
  - Hash the token with HMAC + secret (vs plain SHA-256) — adds an HMAC-secret deploy dependency for no security gain (the token itself is the secret, not the hash).
  - Anon-bearer wins over cookie when both present — would let a stale anon token mask a live signed-in identity; adoption never fires.

### SK-ANON-009 — Turnstile verify fails open when `TURNSTILE_SECRET` is unset

- **Decision:** `verifyTurnstile()` returns `{ ok: false, reason: "unconfigured" }` when no secret is configured, and `unconfigured` is allow-through in **every** environment. Any other failure (`invalid` / `verify_failed`) returns 428 with the challenge envelope. Set `TURNSTILE_SECRET` only in the release that ships the real widget — `solveChallenge()` (`apps/web/src/lib/turnstile.ts`) is a stub, so a configured secret with no widget makes every anon create an unrecoverable 428.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** Dev/tests run without Workers secrets — and no Turnstile keypair was ever provisioned in prod either. A 2026-07 hardening made `unconfigured` fail closed in prod on the false premise the secret was set; every prod anon create 428'd for ≥ a week (stranger walkers 0/9, caught run 56). Until the widget ships, the abuse bound is the SK-ANON-012 per-device cap + SK-ANON-010 global caps + per-IP buckets.
- **Consequence in code:** `apps/api/src/turnstile.ts` returns the typed `unconfigured` reason; the only fail-open branch is `turnstileAllowed` in `apps/api/src/anon-create-gate.ts`. Tests assert a configured secret never fails open on an invalid token.
- **Alternatives rejected:** fail-closed on a missing secret (re-creates the run-56 outage whenever secret and widget ship out of lockstep) and allowing `verify_failed` through (masks Cloudflare outages; hammering Turnstile would bypass the gate).

### SK-ANON-010 — Global anon cap (100/hr / 1000/day / 10k/month) → seamless auth redirect (401 `auth_required`)

- **Decision:** Cumulative across **all** anonymous traffic — three rolling windows: 100 calls/hour, 1000/day, 10,000/month. When any window trips, `/v1/ask` returns `401 Unauthorized` with body `{ error: { status: "auth_required", code: "anon_global_cap", window, resetAt, signInUrl, action } }`. The web surface stashes the in-flight prompt in localStorage (`SK-ANON-011`) and redirects to `signInUrl` with a same-origin `return` query param. The user signs in, the post-OAuth landing page replays the queued prompt against `/v1/ask` with the now-authed cookie session — accountable identity, no anon cap. The per-IP query bucket (30/min, `SK-ANON-004` / `SK-RL-007`) layers underneath this and continues to return 429. The per-device cap (`SK-ANON-012`, 1 anon `/v1/ask` per device → `auth_required`) gates anon traffic ahead of the global cap with the same envelope shape.
- **Core value:** Free, Bullet-proof, Effortless UX, Seamless auth
- **Why:** `SK-ANON-004` covers per-IP abuse but not cumulative anon LLM spend, which `SK-WEB-008` ("demo === real LLM") makes load-bearing — a Hacker News spike could empty the LLM credits before lunch. The auth-redirect framing keeps `GLOBAL-007` honest: the wall lands after first value, when the user has reason to sign in (`SK-RL-005`'s "next action" becomes "sign in", not "wait"). Numbers (100/1000/10000) are pinned here so reviewers can reason without grepping env config.
- **Consequence in code:** `apps/api/src/anon-global-cap.ts` (three fixed-window KV buckets; `peek()` fails hour → day → month, `record()` increments all three post-serve). `apps/api/src/index.ts` runs the global gate before the per-IP gate — global is the user-facing soft-promotion; per-IP is the bot-speed defense. `signInUrl` is built server-side via `buildSignInUrl()` (same-origin returns only; never echo a foreign Referer); `MAGIC_LINK_WEB_ORIGIN` picks dev vs prod sign-in.
  - Per-device cap (`SK-ANON-012`) is the first gate on every anon `/v1/ask`; the global cap layers above it. Both return the same `auth_required` envelope shape so the surface has one handler.
- **Alternatives rejected:**
  - Per-IP cap only — sustained low-rate abuse across a botnet (1 req/IP/min × 1000 IPs) sails past the per-IP gate and burns the LLM budget.
  - Single global counter (no hour/day/month tiering) — a daily budget empties in one Hacker News afternoon; a monthly one gives no spike protection. Three windows give three chances to back-pressure.

### SK-ANON-011 — Never lose a prompt: drafts + pending + history in localStorage; same guarantee for authed

- **Decision:** Every prompt the user touches is durable in `localStorage`, on every surface, regardless of auth shape. Three slots: `nlqdb_draft` (the goal currently being typed, debounced-saved on every keystroke; rehydrated into the input on mount), `nlqdb_pending` (a submitted prompt that hit `auth_required` or any redirect-style failure — replayed by the post-OAuth landing page), and `nlqdb_history` (last 50 completed prompts with `{ goal, submittedAt, status, outcome }`). The same three slots exist for signed-in users — the `Authorization` shape on the request changes; the persistence guarantee does not.
- **Core value:** Bullet-proof, Effortless UX, Goal-first
- **Why:** "I lost what I typed" is the most-broken trust signal in any AI surface. The auth-redirect flow (`SK-ANON-010`, `SK-ANON-012`) makes prompt loss especially costly — sign-in associated with empty-input forever destroys the seamless promise. Drafts cover refresh/tab-crash; history seeds future server-side mirroring. Localizing in `localStorage` keeps the path zero-cost and avoids a write before identity exists. Server-side mirroring for cross-device continuity is Phase 2+ (Open Question on `SK-ANON-001`).
- **Consequence in code:** `apps/web/src/lib/prompt-storage.ts` exposes `saveDraft / loadDraft / clearDraft / makeDraftSaver` (debounced via `setTimeout`), `savePending / loadPending / clearPending`, and `appendHistory / loadHistory` (capped at 50 with oldest-evicted). `CreateForm.tsx` wires the draft saver to `onChange`, rehydrates on mount via `useEffect`, stashes pending on `auth_required` BEFORE the redirect, and appends history on every terminal outcome. Post-OAuth replay lives at `apps/web/src/pages/auth/post-signin.astro` (SK-ANON-012). localStorage availability is checked through `safeStorage()` so privacy-mode browsers fall back to in-memory state without throwing. localStorage is per-origin — the marketing→app hop carries the slots in a URL fragment (`SK-ANON-015`).
- **Alternatives rejected:**
  - Server-side prompt store keyed by anon hash — mirroring works cross-device but creates a write-before-identity flow (the device is anonymous; we'd have to invent an "anon prompts" table that's the next adoption target). Same end-state, larger surface; deferred to Phase 2+.
  - Query-string-encode the prompt in the sign-in redirect — leaks goals into server logs and sign-in analytics; the prompt never travels in any URL part the server sees. (The `SK-ANON-015` *fragment* handoff satisfies this: fragments are never sent in HTTP requests.)
  - Drafts-only (no pending replay) — the auth-redirect arc terminates with the user seeing a fresh empty form; defeats the point of "seamless".

### SK-ANON-012 — Per-device 1-call cap on `/v1/ask`; second anon call → `auth_required` envelope; supersedes SK-ANON-007 burst gate

- **Decision:** **1 anon `/v1/ask` call per device, then `auth_required`** — gating ALL anon traffic past the first successful call (not just creates), so `routeAsk`'s 1-DB auto-target can't sneak a 2nd query past the wall. Keyed on `sha256(anon_token)[:16]` (`SK-ANON-008`'s principal id), not IP; checked at the TOP of `/v1/ask`. The 2nd call returns `401` with the `SK-ANON-010` envelope (`code: "anon_device_cap"`) — same shape, same client handling as the global cap. **Turnstile invisible verification remains** on every anon create as the bot shield (unconditional; `SK-ANON-007`'s 3-in-5-min burst gate is **superseded**). The 1st-call **result** (the anon DB) is preserved server-side and adopted via `/v1/anon/adopt` (`SK-ANON-003`) on sign-in. The 2nd-call **prompt** replays from `nlqdb_pending` (`SK-ANON-011`).
- **Core value:** Free, Bullet-proof, Effortless UX, Seamless auth
- **Why:** Hero users create one DB and stop until they have a goal worth iterating; the second message is motivated enough to justify sign-in. 1-per-device folds two mechanisms (cap + Turnstile burst) into one; gating `/v1/ask` (not just creates) closes the auto-target loophole ("spin up an orders tracker" → "show me the rows" would sail past a create-only wall). Device-keyed (vs IP) drops coffee-shop / NAT false-positives; Turnstile stays as the bot floor (anon endpoints are the #1 abuse surface per Supabase / Firebase guidance). `GLOBAL-007` holds because the wall lands at #2, not #1.
- **Consequence in code:** The cap is `peekDevice`/`recordDevice` (cap 1, key `anon:create:device:`, 90-day TTL per `SK-ANON-002`) in `anon-rate-limit.ts`, checked at the TOP of `/v1/ask` in `index.ts` before `routeAsk` — on cap, the `auth_required` envelope with `code: "anon_device_cap"` (distinct from `anon_global_cap`, same `buildSignInUrl()`). The commit lands only AFTER a successful orchestrator outcome, so a typo doesn't burn the cap. `anon-create-gate.ts` is now Turnstile-only (`SK-ANON-009` fail-open intact, unconditional). **Adoption is server-side-primary:** a Better Auth `after` hook on `/magic-link/verify` + `/callback/*` reads the HMAC-signed `__Secure-anon-bearer` cookie (stashed by `sign-in.astro`) and runs `recordAnonAdoption` (`SK-ANON-003`, idempotent; `nlqdb.anon.adopt` span). Two client fallbacks cover a dropped / third-party-partitioned cookie: an already-signed-in short-circuit in `sign-in.astro`, and a defense-in-depth retry from `/auth/post-signin` — both via the shared `adoptAnonNow` (`apps/web/src/lib/anon-adopt.ts`), which also adopts a handoff-displaced token (`SK-ANON-015`).
- **Alternatives rejected:**
  - Drop Turnstile entirely — [Supabase](https://supabase.com/docs/guides/troubleshooting/security-of-anonymous-sign-ins-iOrGCL) and [Firebase](https://firebase.blog/posts/2023/07/best-practices-for-anonymous-authentication/) both flag anon endpoints as the #1 abuse vector. A 1-per-device cap is a per-honest-user limit, not a per-bot limit — bots can mint anon tokens for free. Turnstile keeps the bot floor.
  - Cap on per-IP (today's key) instead of per-device — coffee-shop / university / hotel-wifi scenarios collapse multiple users to one IP. Device-keyed caps the abuse vector (one anon bearer) without false-positiving honest co-located users.
  - Adoption client-side (`POST /v1/anon/adopt` from `/auth/post-signin`) — works, but the anon-bearer travels through `localStorage` at sign-in time and the client-side fetch is one more failure mode (network, cache). Server-side Better Auth `after` hook is one less moving part and the bearer rides the sign-in request header — the [Better Auth Hooks docs](https://better-auth.com/docs/concepts/hooks) confirm this is the supported pattern.

### SK-ANON-013 — Anon `/v1/ask` short-circuits to `runCreatePath` when no `dbId` is pinned

- **Decision:** `apps/api/src/index.ts` returns `runCreatePath()` directly when `principal.kind === "anon" && !parsed.body.dbId`, after the anon gates (global cap, per-IP query bucket, per-device peek) clear. `routeAsk`, `listDatabasesForTenant`, and `recentTablesStore.load` are skipped. Anon SDK users with a pinned `dbId` still flow through the query path. The 2nd anon call is already blocked at `peekDevice` (SK-ANON-012). The branch lives in the route handler — `orchestrateAsk` remains anon-blind, preserving SK-ANON-006.
- **Core value:** Free, Effortless UX, Bullet-proof, Goal-first
- **Why:** Anon has no data to query — the classifier was designed for authed users with multiple DBs. Running it for anon traded zero UX value for cheap-tier LLM latency, SK-ASK-011 speculative complexity (removed in SK-ASK-017), MRU pollution, and the `kind=query` misclassification → 502 cascade observed in prod. Post-OAuth replays queued prompts as authed calls — nothing is lost.
- **Consequence in code:** 2-line short-circuit in `apps/api/src/index.ts` (after `runCreatePath` is defined, before `kickoffAskPrelude`). Existing gates + `commitAnonCreate` inside `runCreatePath` keep SK-ANON-012 accurate. Coverage in `apps/api/test/ask.test.ts` asserts the response is never a routeAsk-only outcome (502 `llm_failed` / 409 `clarify_required`).
- **Alternatives rejected:** Skip classifier even with pinned `dbId` — breaks SDK follow-ups. Keep classifier, only remove speculation — misclassification was the user-visible failure. Branch inside `orchestrateAsk` — contradicts SK-ANON-006. Auto-adopt stale anon DBs — adds a D1 write; the 90-day sweep handles cleanup.

### SK-ANON-014 — Adoption returns the migrated `dbId`; post-signin pins it via `?db=<id>` on the redirect

- **Decision:** `recordAnonAdoption` returns the migrated `dbId` alongside `{ ok, adopted }` on every successful call — first-adoption captures it from `UPDATE databases ... RETURNING id` and persists it to a new `anon_adoptions.database_id` column (migration `0012_anon_adoption_db_id.sql`); replay reads it back from that column. Both adoption routes — `POST /api/auth/anon-adopt-now` and `POST /v1/anon/adopt` — echo `dbId` in their JSON response. `/auth/post-signin` reads it from `anon-adopt-now`'s body and appends `?db=<dbId>` to the redirect `next` URL so `ChatPanel` pins the adopted DB synchronously on mount (`readDbIdFromUrl()` already wired). `null` is the legal fallback when the sweep job has evicted the anon DB before adoption fires; clients degrade to the existing newest-DB heuristic (`ChatPanel.tsx onLoaded`).
- **Core value:** Seamless auth, Effortless UX, Goal-first, Bullet-proof
- **Why:** Without `?db=<id>` the landing redirects to `/app` and `ChatPanel` auto-pins `databases[0]` (newest by `created_at`) after the rail fetch — which flashes the global-pick hint, mis-pins when a more-recent DB exists (parallel CLI / stale tab), and pins nothing if `/v1/databases` partitions, collapsing the seamless arc into a "pick a DB" step. Threading the dbId through the existing auth-handoff hop fixes all three. It must live on `anon_adoptions` because the after-middleware (`SK-ANON-012`) is the primary adopter, so by the time `/auth/post-signin` calls `anon-adopt-now` the UPDATE is a no-op and `RETURNING` is empty — the column gives the replay path a reliable read.
- **Consequence in code:** Migration `0012_anon_adoption_db_id.sql` adds nullable `anon_adoptions.database_id` (no FK — the sweep may evict the DB first; a dangling row is harmless). `anon-adopt.ts`'s `AdoptResult.ok` carries `dbId`: captured from the `UPDATE … RETURNING id` on first-adoption, back-filled onto the column, read back on replay. Both `POST /v1/anon/adopt` and `POST /api/auth/anon-adopt-now` echo `dbId`; `/auth/post-signin` appends `?db=<id>` to the redirect (URL-parsed so existing params survive); the mock IdP routes through `/auth/post-signin` so it inherits the pin. **Replay exception (`SK-ANON-015`):** when the redirect's `next` carries `replay=1`, post-signin skips the pin and `ChatPanel`'s `onLoaded` skips the newest-DB fallback — a rehydrated pending prompt lands on "All databases" with the composer focused so the classifier routes it.
- **Alternatives rejected:**
  - Infer the adopted dbId in `ChatPanel` from the rail's most-recent `adopted_at` — needs `adopted_at` on `DatabaseSummary` (absent) and still waits for the rail fetch (same flash).
  - Pass the dbId via URL from `sign-in.astro`'s eager path — only covers the already-signed-in path; the primary after-hook → 302 path never runs that JS.

### SK-ANON-015 — Cross-origin prompt/identity handoff rides the URL fragment; replay lands unpinned on "All databases"

- **Decision:** `nlqdb.com` and `app.nlqdb.com` (`SK-AUTH-016`) are different browser origins — the `SK-ANON-011` slots and the `SK-ANON-001` token don't cross on their own. Every marketing→app sign-in navigation carries `{anon, pending, draft}` in the URL **fragment** (`#nlq=<url-encoded json>`): `CreateForm` attaches it to the `auth_required` redirect, and `/auth/sign-in` served from a non-app origin hops to its app-origin copy with the fragment attached — hence every sign-in link stays a **relative** path (no direct `app.nlqdb.com` hrefs). The receiving `sign-in.astro` imports the payload into localStorage and strips the fragment before anything reads `nlqdb_anon`; a differing pre-existing token is parked in `nlqdb_anon_prev` and adopted alongside the active one. **The fragment is attacker-writable**, so the import is double-gated: payloads are shape-validated (string fields, length caps, the `anon_` mint format) AND honored only behind a trusted referrer (same origin, `nlqdb.com`/`*.nlqdb.com`, or localhost — `Base.astro` pins `strict-origin-when-cross-origin`, and a referrer can't be forged upward). A foreign/missing referrer drops the payload but still strips the fragment — preventing anon-token fixation (login-CSRF) and prompt clobbering by a crafted `#nlq=` link. Relatedly, `post-signin.astro` pins its `?next=` redirect to a same-origin path (no open redirect / `javascript:` URI). On the replay arc (`replay=1` + rehydrated pending) the chat lands on "All databases" — no `?db=` pin, no newest-DB auto-pin — with the composer pre-filled and focused, so the classifier routes the replayed goal.
- **Core value:** Bullet-proof, Effortless UX, Seamless auth
- **Why:** Fragments are never sent in HTTP requests (RFC 3986 §3.5) and are excluded from `Referer`, so prompts and bearers stay out of server logs and analytics — the transport properties `SK-ANON-011`/`SK-ANON-012` demand. Without the handoff the "never lose a prompt" promise broke exactly on the auth arc it exists for — observed in prod: the pending prompt stranded on `nlqdb.com` while adoption ran with a stale app-origin token.
- **Consequence in code:** `apps/web/src/lib/handoff.ts` (`attachHandoff` / `importHandoffFromLocation`); `apps/web/src/lib/anon-adopt.ts` (`adoptAnonNow`, shared by `sign-in.astro` and `post-signin.astro`, adopts `nlqdb_anon` + `nlqdb_anon_prev`); the marketing→app hop + fragment import at the top of `sign-in.astro`; the replay exception in `post-signin.astro` `withDbId` and `ChatPanel.tsx` `onLoaded`.
- **Alternatives rejected:**
  - Query-string transport — leaks prompt + bearer to server logs; rejected in `SK-ANON-011` and still banned.
  - Cookie stashed by a cross-site fetch from the marketing origin — third-party cookie partitioning (Chrome, Safari ITP) silently drops it; that is the failure mode the post-signin fallback already exists for.
  - Server-side prompt store keyed by anon hash — Phase 2+ per `SK-ANON-011`; the fragment is zero-infrastructure and needs no write-before-identity.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-007** — No login wall before first value.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* the 72h anon-TTL warning emits `feature.requested.persist_anon_db`; the anonymous-mode rate-limit hits surface `feature.requested.heavier_tier`. These are the in-product half of the [`founder-playbook §1`](../../founder-playbook.md) design-partner recruitment loop.

## Open questions / known unknowns

- **Cross-device anonymous continuity — Parked until Phase 2.** Per-device identity (browser `localStorage`, CLI keychain) is Phase 1; cross-device unification (paste-a-code handshake) waits until a signed-out user asks to move a DB between devices.

## Happy path walkthrough

P5 Aarav (CS50 student) — anonymous DB → adopt-on-sign-in → embed via `<nlq-data>` — is canonical in `docs/runbook.md §10.2.5`. The broader pattern ("first action is a goal, DB is a silent consequence; four surfaces are projections of one verb") lives in the same persona section.
