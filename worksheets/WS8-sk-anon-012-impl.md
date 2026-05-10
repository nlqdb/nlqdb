# WS8 — SK-ANON-012 implementation (1-call gate + auth redirect + adopt + replay)

**Branch:** `claude/ws8-sk-anon-012-impl` off `origin/main` (assumes PR #146 / SK-ASK-014 + WS5 + WS7 all merged).
**SK-ID consumed:** `SK-ANON-012` (canonical home: `docs/features/anonymous-mode/FEATURE.md`, written in WS7).
**Hard deps:** WS7 (SK-ANON-012 doc), WS5 (`peekAnonCreateGate` / `commitAnonCreate` split + recordCreate-after-success).
**Soft deps:** WS4 (display-name) — UI surfaces of the post-signin landing should already use `displayName` if WS4 is in main.

## Goal

Implement the SK-ANON-012 decision from WS7. End-to-end user flow:

1. Anon user opens `nlqdb.com`, types a goal in the hero, submits.
2. Turnstile invisible verify passes; cap check passes (device cap = 0 < 1).
3. First create runs through `runCreatePath` (with all WS4/5/6 perf wins applied). Anon DB lands in Postgres; D1 row created; `commitAnonCreate(principal.id)` increments the device counter to 1; result returned.
4. User types a second goal (or hits "another idea"); submits.
5. `peekAnonCreateGate` finds count = 1 ≥ 1; returns `401 auth_required` envelope with `code: "anon_device_cap"` and `signInUrl`.
6. Client (`CreateForm.tsx`) stashes the 2nd-call prompt to `nlqdb_pending` (existing SK-ANON-011 path) and redirects to `signInUrl`.
7. User clicks magic-link / OAuth, lands on `/auth/post-signin?next=/app`.
8. Better Auth's `after` sign-in hook (server-side) reads the anon-bearer from the sign-in request and calls `recordAnonAdoption()` — the SK-ANON-003 one-row update migrates the call-1 DB to the new user.
9. `/auth/post-signin.astro` client script reads `nlqdb_pending`, fires `POST /v1/ask` with the goal under the new authed cookie session, clears the slot, navigates to `/app?db=<resulting_dbId>`.
10. ChatPanel loads with both DBs in the left rail (call-1 adopted, call-2 freshly created).

## Pre-read (mandatory)

- `CLAUDE.md` — root, P1/P3 (decision compliance), P5 (simplify), §8 (quality gates)
- `docs/features/anonymous-mode/FEATURE.md` — full file, with SK-ANON-012 now in place (post-WS7).
  - SK-ANON-003 (adoption is one row update)
  - SK-ANON-008 (cookie wins when both present; anon principal id derivation)
  - SK-ANON-010 (auth_required envelope shape — being reused)
  - SK-ANON-011 (`nlqdb_pending` slot + replay; same client code path)
- `docs/features/auth/FEATURE.md` — Better Auth wiring, hooks
- `apps/api/src/anon-rate-limit.ts` — the file being rekeyed
- `apps/api/src/anon-adopt.ts` — `recordAnonAdoption` (already exists per SK-ANON-003)
- `apps/api/src/auth.ts` — Better Auth instance + hooks
- `apps/api/src/index.ts` post-WS5 (with `peekAnonCreateGate` + `commitAnonCreate` split landed)
- `apps/api/src/anon-global-cap.ts` — for the parallel `auth_required` envelope pattern to mirror
- `apps/web/src/lib/prompt-storage.ts` — `savePending` / `loadPending` / `clearPending` (no changes needed; reused as-is)
- `apps/web/src/components/CreateForm.tsx` — already handles `auth_required` (lines 79-88); no changes needed there
- `apps/web/src/pages/auth/sign-in.astro` — pass `callbackURL=/auth/post-signin`
- [Better Auth — Hooks](https://better-auth.com/docs/concepts/hooks) — `createAuthMiddleware`, `after` hook, `ctx.context.newSession`
- [Better Auth — Basic Usage](https://better-auth.com/docs/basic-usage) — `callbackURL` / `newUserCallbackURL`
- [Supabase — Security of Anonymous Sign-ins](https://supabase.com/docs/guides/troubleshooting/security-of-anonymous-sign-ins-iOrGCL) — why Turnstile stays
- [Firebase — Account Linking](https://firebase.google.com/docs/auth/web/account-linking) — confirms "same UID, data preserved" is canonical

## Files to modify

### API (`apps/api/src/...`)

| Path | Change |
|---|---|
| `anon-rate-limit.ts` | Drop the IP-keyed `CREATE_HOUR_*` and `CREATE_BURST_*` constants and keys. Add `CREATE_DEVICE_MAX = 1` and `CREATE_DEVICE_KEY_PREFIX = "anon:create:device:"`. `peekCreate(ip)` becomes `peekDevice(principalId)` — same shape but the verdict's `reason` is `"device_cap"`. `recordCreate(ip)` becomes `recordDevice(principalId)`. The TTL on the device key is **90 days** (matches SK-ANON-002 server retention; the cap should reset when the anon device itself expires). `AnonRateLimiter` interface updates accordingly. |
| `index.ts` | (Building on WS5's `peekAnonCreateGate` / `commitAnonCreate` split.) `peekAnonCreateGate` keys on `principal.id` (which is already `anon:<hash>`), not `cf-connecting-ip`. On `peekDevice` failure, return **401** with the `auth_required` envelope: `{ error: { status: "auth_required", code: "anon_device_cap", signInUrl: buildSignInUrl(...), action: "Sign in to create another database — your draft is saved." } }`. Turnstile verify continues to run **before** the cap check (so the floor stays in place even when the cap is fresh; bots can mint anon tokens trivially). |
| `auth.ts` | Add a Better Auth `after` middleware on the sign-in endpoint (magic-link verify + OAuth callback paths). Inside the hook: read `request.headers.get('x-anon-bearer')`; if present and shaped like `anon_…`, await `recordAnonAdoption(env.DB, ctx.context.newSession.user.id, token)`. Swallow errors (the adoption is best-effort; sign-in must succeed regardless). The trigger is the **request-time** anon bearer — the client passes it as a header when initiating sign-in (see web changes below). The server-side hook is more secure than a client-side adopt call because the bearer never leaves the same-origin sign-in request. |

### Web (`apps/web/src/...`)

| Path | Change |
|---|---|
| `pages/auth/post-signin.astro` (new) | Static page with an inline `<script>` that runs the replay flow. See *Implementation notes* §4 below for the script body. |
| `pages/auth/sign-in.astro` | Build the sign-in URLs with `callbackURL=/auth/post-signin?next=<encoded /app>`. If the page already passes `return_to`, switch to `callbackURL` semantics (Better Auth's parameter name). The sign-in fetch (magic-link request / OAuth start) attaches `x-anon-bearer: <getOrMintAnonToken()>` as a header so the server-side `after` hook can adopt. |
| `lib/api.ts` | No change. The `auth_required` envelope shape from SK-ANON-010 is reused as-is. The `code` field (already in the envelope) gains a new value `"anon_device_cap"` — handled identically to `"anon_global_cap"` on the client (both stash pending + redirect). |
| `components/CreateForm.tsx` | No change. The `auth_required` branch (lines 79-88) already handles both shapes (cap key is server-side; client just looks at `kind === "auth_required"`). |

### Docs

| Path | Change |
|---|---|
| `docs/features/anonymous-mode/FEATURE.md` | SK-ANON-012 already landed in WS7. **Update** SK-ANON-011's *Consequence in code* with a one-line nested note: "Post-OAuth replay lives at `apps/web/src/pages/auth/post-signin.astro` (SK-ANON-012)." |
| `docs/features/auth/FEATURE.md` | Add a one-line *Consequence in code* note under whatever decision owns the sign-in flow: "On successful sign-in, the `after` middleware adopts the request's anon bearer (`x-anon-bearer` header) via `recordAnonAdoption()` per SK-ANON-012." |
| `docs/performance.md §3.1` | Add OTel span row: `nlqdb.anon.adopt` — wraps the `recordAnonAdoption` D1 update. |

## Implementation notes

1. **Cap key derivation.** The principal id for anon is `anon:<sha256(token)[:16]>` (SK-ANON-008). The cap key is `anon:create:device:<principalIdHash>`. The hash portion is what we already store everywhere else — no new derivation, no leaking the raw token into KV keys.

2. **Cap TTL.** 90 days. The cap should expire when the device itself expires (SK-ANON-002 server retention). A user who comes back 6 months later on the same device gets a fresh 1-call budget, but their old anon DB is gone — the two windows match.

3. **Turnstile placement.** Today's `peekAnonCreateGate` checks Turnstile inside the burst-trigger branch. Post-WS8 it runs **unconditionally** on every anon create — invisible verify, fail-open when `TURNSTILE_SECRET` is unset (SK-ANON-009 fail-open semantics intact for dev). On verify failure, return 428 challenge_required as today.

4. **`post-signin.astro` script.** Inline script — no React, no SDK — so the page can run before any heavy bundle loads:

   ```html
   <script>
     import { fetchSession } from "../../lib/session";
     import { loadPending, clearPending } from "../../lib/prompt-storage";
     import { postAskCreate } from "../../lib/api";

     const apiBase = ""; // same-origin per Hero.astro convention
     (async () => {
       const session = await fetchSession(apiBase);
       if (!session) {
         // Sign-in didn't take. Send back to sign-in with a friendly hint.
         location.replace("/auth/sign-in?error=session_lost");
         return;
       }
       const pending = loadPending();
       const next = new URLSearchParams(location.search).get("next") ?? "/app";
       if (!pending) {
         location.replace(next);
         return;
       }
       try {
         const outcome = await postAskCreate(apiBase, pending.goal);
         clearPending();
         if (outcome.ok) {
           const dbId = outcome.result.db;
           location.replace(`${next}?db=${encodeURIComponent(dbId)}`);
           return;
         }
       } catch {
         // Network error — leave pending in place so user can retry from /app.
       }
       clearPending();
       location.replace(next);
     })();
   </script>
   ```

   The page renders a lightweight "Signing you in…" message during the redirect so users see something stable.

5. **`x-anon-bearer` header on sign-in initiation.** When `sign-in.astro` POSTs to `/api/auth/sign-in/...`, attach the anon bearer:

   ```ts
   const anonToken = getOrMintAnonToken();
   await fetch(`${apiBase}/api/auth/sign-in/...`, {
     method: "POST",
     headers: {
       "content-type": "application/json",
       "x-anon-bearer": `anon_${anonToken}`,  // server reads this in the after hook
     },
     body: JSON.stringify({ email, callbackURL: "/auth/post-signin?next=/app" }),
   });
   ```

   The server-side hook reads the header off `ctx.request.headers` (Better Auth exposes it on the hook context). The header is same-origin only — never travels across a redirect.

6. **OAuth path adoption.** OAuth-init redirects the user away from the origin, so the `x-anon-bearer` header isn't on the callback. Two options:

   - **(Preferred) Stash the anon bearer in an HMAC-signed temporary cookie** at OAuth-init time. The `after` hook on the OAuth-callback reads + verifies + deletes it. One server round-trip; no client coordination beyond what Better Auth already orchestrates.
   - **Fallback.** Client-side adopt: post-OAuth landing page calls `POST /v1/anon/adopt` with the localStorage anon token. Works but adds a moving part. Use only if the cookie approach hits a Better Auth limitation.

   Implementation note: start with the cookie approach. The cookie name is `__Secure-anon-bearer`, `Path=/api/auth`, `HttpOnly`, `Secure`, `SameSite=Lax`, 10-minute Max-Age (long enough to survive OAuth round-trips, short enough that a stolen cookie doesn't outlive the flow).

7. **Magic-link path adoption.** Magic-link sign-in is initiated on the origin (anon bearer accessible) AND completed on the origin (verify endpoint). The `after` hook can read the same temp cookie approach OR a request header on the verify call. Mirror the OAuth path's cookie pattern for consistency.

8. **No new branches in the orchestrator.** Per SK-ANON-006. All the conditional logic lives in `index.ts` (the cap response) and in `auth.ts` (the post-signin adoption). The orchestrator stays auth-shape-agnostic.

9. **Race condition: simultaneous sign-in + 2nd create.** If the user fires the 2nd create AND clicks sign-in in the same instant, the 2nd create may race the cookie write. Today's `auth_required` returns same-status from both `anon_global_cap` and the new `anon_device_cap` — the client always falls into the same redirect path. The race resolves naturally: redirect wins, the in-flight 2nd-create's response is discarded.

10. **D1 idempotency on adopt.** `recordAnonAdoption` already returns `{ ok: true, adopted: false }` on conflict (SK-ANON-003). The hook's failure mode is "log it, continue" — sign-in is the user's priority, not the adoption. Failed adoptions are detectable via OTel span `nlqdb.anon.adopt` with `status=conflict` or `status=internal`.

11. **Anon bearer leakage check.** Per CLAUDE.md security guidance, audit every place the anon bearer surfaces:
    - `Authorization` header on `/v1/ask` — yes (existing).
    - `x-anon-bearer` header on sign-in initiation — new; same-origin only.
    - HMAC-signed temp cookie for OAuth round-trip — new; `__Secure-`, `HttpOnly`.
    - URL query params — **NO**. Never. (SK-ANON-011 *Alternatives rejected* names this risk; preserve it.)
    - Server logs / OTel spans — the bearer never lands there; only its 16-char sha256 prefix does (SK-ANON-008).

## Tests required

### Unit

- `peekDevice` on a fresh principal returns `ok: true`; `recordDevice` increments; second `peekDevice` returns `ok: false, reason: "device_cap"`.
- KV TTL on the device key is 90 days (assert via the put call's `expirationTtl` value).
- `auth.ts` after-hook calls `recordAnonAdoption` with the user id from `ctx.context.newSession.user.id` and the bearer from the request header / temp cookie.
- After-hook swallows `recordAnonAdoption` errors (don't fail sign-in on adopt failure).

### Integration (apps/api/test)

- Full flow: anon mints token → POST `/v1/ask` succeeds with 200, returns dbId. POST `/v1/ask` again with same anon-bearer returns 401 `auth_required` with `code: "anon_device_cap"`.
- Failed first create (e.g. mock `inferSchema` to return `ambiguous_goal`) does NOT consume the device cap (verifies WS5 fix C carried correctly into WS8).
- Sign-in with `x-anon-bearer` runs `recordAnonAdoption`; subsequent `GET /v1/databases` for the authed user returns the previously-anon DB.
- Sign-in with no anon bearer (clean sign-in) does NOT call adopt — no row update, no error.
- Turnstile verify failure on a fresh anon device returns 428, NOT 401 (Turnstile floor runs before cap check).

### Web (apps/web/test, if a test harness exists)

- `/auth/post-signin` script: no `nlqdb_pending` → redirects to `next`.
- `/auth/post-signin` script: with `nlqdb_pending` → POSTs `/v1/ask` then redirects to `next?db=<id>`.
- `/auth/post-signin` script: replay fails → clears pending, redirects to `next` (no infinite loop).
- `/auth/post-signin` script: session lost → redirects to `/auth/sign-in?error=session_lost`.

## Acceptance criteria

- [ ] `bun run typecheck && bun run lint && bun run test` green across all touched packages.
- [ ] Integration test verifies the full anon → adopt → replay arc end-to-end against a Neon dev branch.
- [ ] Production smoke: deploy to canary, manual run-through:
  - Anon create #1 → DB lands, dbId visible in response.
  - Anon create #2 → 401 `auth_required` with sign-in URL.
  - Click sign-in URL → magic link → land on `/auth/post-signin` → land on `/app?db=<id2>`.
  - `/app` left rail shows both DBs (`<id1>` adopted, `<id2>` fresh).
  - Both DBs are owned by the authed user (`SELECT user_id FROM databases WHERE id IN ($1, $2)` in a D1 shell).
- [ ] Turnstile is still active on call #1 (verify via OTel span `nlqdb.turnstile.verify` count).
- [ ] Latency of the 2nd-create-then-401 path: < 200 ms (it's a peek + KV read, nothing else).
- [ ] Latency of the post-signin replay: < 4 s end-to-end (sign-in landing → POST `/v1/ask` → redirect; bounded by the replayed `/v1/ask` itself, which post-WS5/6 is < 4 s on cold path).
- [ ] OTel span `nlqdb.anon.adopt` added; documented in `docs/performance.md §3.1`.

## CLAUDE.md compliance checklist

- [ ] **P1.** Implementation matches SK-ANON-012 as documented in WS7. No silent contradictions. If any field of SK-ANON-012 doesn't survive implementation contact, stop and amend the SK before patching code.
- [ ] **P3.** Cap key derivation lives in `anon-rate-limit.ts` only. Adoption logic lives in `auth.ts` only. No duplicated copies of the `auth_required` envelope shape (reuse SK-ANON-010's helper).
- [ ] **P5.** Net code: removing the burst gate (SK-ANON-007) compensates for the post-signin page addition. Cyclomatic complexity goes down.

## Out of scope

- Server-side cross-device anon continuity (SK-ANON-011 Open Question).
- MCP anonymous identity (SK-ANON-001 Open Question).
- Adopting **multiple** anon DBs at sign-in. The hero flow only creates one before auth-walling; multi-device adoption is the CLI's SK-ANON-005 concern, unchanged.
- Refactoring the global anon cap (SK-ANON-010 stays as-is — still the bot-floor over individual devices).

## Sources

- [Better Auth — Hooks](https://better-auth.com/docs/concepts/hooks)
- [Better Auth — Basic Usage / callbackURL](https://better-auth.com/docs/basic-usage)
- [Better Auth — OAuth](https://better-auth.com/docs/concepts/oauth)
- [Supabase Security of Anonymous Sign-ins](https://supabase.com/docs/guides/troubleshooting/security-of-anonymous-sign-ins-iOrGCL)
- [Firebase Account Linking](https://firebase.google.com/docs/auth/web/account-linking)
- [Firebase Best Practices for Anonymous Authentication](https://firebase.blog/posts/2023/07/best-practices-for-anonymous-authentication/)
- [OWASP — Cookie security headers (`__Secure-`, `HttpOnly`, `SameSite`)](https://owasp.org/www-community/controls/SecureCookieAttribute)
