# WS7 — SK-ANON-012 documentation (decision change, doc-only)

**Branch:** `claude/ws7-sk-anon-012-doc` off `origin/main` (PR #146 / SK-ASK-014 already landed in `132768c`).
**SK-ID reserved:** `SK-ANON-012` — Per-device 1-create cap → `auth_required` envelope; supersedes the SK-ANON-007 burst gate. Amends SK-ANON-010 per-window numbers to add a per-device tier.
**Hard deps:** none. **Soft deps:** none. Doc-only; lands before WS8 (impl).

## Goal

Document the decision change that backs the hero "1 free call, then auth" flow. The user-facing requirement is:

> Allow only 1 anon call in the homepage hero; the 2nd call redirects to auth. Remember both the 1st call result AND the 2nd-call prompt and apply them to the authenticated user.

The mechanism uses existing infrastructure:

- The 1st-call **result** (the anon DB) is already preserved server-side (90-day retention per SK-ANON-002) and adopted via `/v1/anon/adopt` (SK-ANON-003 — one-row update, no data move).
- The 2nd-call **prompt** is preserved client-side in `nlqdb_pending` (SK-ANON-011), replayed by the post-OAuth landing page (which is the missing Phase-1 exit gate piece).
- The 2nd-call **trigger to auth** uses the existing `auth_required` 401 envelope from SK-ANON-010.

What changes per SK-ANON-012:

1. The per-IP create cap (today 5/hr per IP, SK-ANON-007) drops to **1 per device**, keyed on `sha256(anon_token)[:16]` rather than IP. IP-keyed caps false-positive in coffee shops / universities; device-keyed caps the actual abuse vector (one anon bearer = one device).
2. The 2nd create returns `401 auth_required` (the same envelope SK-ANON-010 uses for global cap) instead of `428 challenge_required` (the Turnstile route SK-ANON-007 took today).
3. SK-ANON-007's Turnstile burst gate (3-in-5-min → 428) is **superseded** because a single create already auth-walls at #2.
4. **Turnstile stays as a bot shield on the 1st anon call**, configured as the standard Turnstile invisible/managed verify on every anon create (not gated on count). Anonymous endpoints are the #1 abuse vector per [Supabase security guidance](https://supabase.com/docs/guides/troubleshooting/security-of-anonymous-sign-ins-iOrGCL) and [Firebase best practices](https://firebase.blog/posts/2023/07/best-practices-for-anonymous-authentication/). Dropping it entirely on call #1 would weaken the posture.

This worksheet is **doc-only**. The implementation lives in WS8.

## Pre-read (mandatory)

- `CLAUDE.md` §2 P1 (don't contradict documented decisions silently), §2 P3 (decisions live in one place), §2 P4 (the four doc rules), §10.2 (bug-fix flow when the decision is the bug)
- `docs/skill-conventions.md` §4 (5-field decision format), §5 (skills reference GLOBALs by ID — not relevant here, but worth re-reading), §6 (superseded status formatting)
- `docs/features/anonymous-mode/FEATURE.md` — the whole file. SK-ANON-007 and SK-ANON-010 are the touched decisions.
- `docs/features/anonymous-mode/FEATURE.md` SK-ANON-003 (one-row adoption — unchanged, but this skill builds on it)
- `docs/features/anonymous-mode/FEATURE.md` SK-ANON-011 (nlqdb_pending replay slot — unchanged, but used by WS8)
- `docs/decisions/GLOBAL-007-no-login-wall.md` — the cross-cutting rule SK-ANON-012 must not violate

## Decision summary (the 5-field block to add)

### SK-ANON-012 — Per-device 1-create cap; second create → `auth_required` envelope; supersedes SK-ANON-007 burst gate

- **Decision:** The anonymous create cap drops from "5 creates/hour per IP + 3-in-5-min Turnstile burst (SK-ANON-007)" to **"1 create per device, then `auth_required`"**. The cap is keyed on `sha256(anon_token)[:16]` (the same principal id derivation as SK-ANON-008), not on IP. The 2nd create returns `401 Unauthorized` with the SK-ANON-010 `auth_required` envelope (`{ status: "auth_required", code: "anon_device_cap", signInUrl, action }`) — same shape and same client handling as the global-cap path. **Turnstile invisible verification remains** on every anon create as the bot shield (not gated on burst count). SK-ANON-007's burst gate (3-in-5-min → 428) is **superseded** — auth-walling at create #2 makes a burst rate-limit redundant for the create path. The 1st-call **result** (the anon DB) is preserved server-side and adopted via `/v1/anon/adopt` (SK-ANON-003) the moment the user signs in. The 2nd-call **prompt** is replayed by the post-OAuth landing page from `nlqdb_pending` (SK-ANON-011).

- **Core value:** Free, Bullet-proof, Effortless UX, Seamless auth

- **Why:** SK-ANON-007's 5/hr-per-IP + 3-burst-per-IP shape was sized for "let users explore, gate abuse" — that's a fit for the original anon flow where multiple creates per device were expected. The user research (`docs/runbook.md §10` personas) shows that hero users create one DB and stop until they have a goal worth iterating; the second create is overwhelmingly motivated enough to justify a sign-in step. Lowering the cap to 1-per-device aligns the gate with the actual user behaviour, hits a meaningful "sign in to keep going" moment instead of a "wait 12 minutes" moment, and folds two mechanisms (cap + Turnstile burst) into one (cap + sign-in CTA). The device key (vs IP) drops the coffee-shop / NAT false-positive class — multiple users on one IP each get one anon DB. Turnstile invisible-mode stays because [Supabase security docs](https://supabase.com/docs/guides/troubleshooting/security-of-anonymous-sign-ins-iOrGCL) and [Firebase best practices](https://firebase.blog/posts/2023/07/best-practices-for-anonymous-authentication/) both name anon endpoints as the #1 bot-abuse surface. `GLOBAL-007` ("no login wall before first value") is preserved because the wall lands at #2, not #1 — the first DB always materializes anonymously. The auth-redirect framing (vs a Retry-After 429) keeps `SK-RL-005`'s "next action is something the user can do" spirit honest: the user *can* sign in; they *cannot* wait their way out of the gate.

- **Consequence in code:**
  - `apps/api/src/anon-rate-limit.ts`: `CREATE_HOUR_MAX` drops from 5 to **1**; the key prefix changes from `anon:create:hr:<ip>` to `anon:create:device:<principalIdHash>`. The burst keys (`CREATE_BURST_*`) are deleted along with `peekCreate`'s `needsChallenge` path. New `peekDevice(principalId)` and `recordDevice(principalId)` methods replace `peekCreate(ip)` / `recordCreate(ip)`. The Turnstile verification (SK-ANON-009 fail-open semantics intact) now runs unconditionally on every anon create, not gated on count.
  - `apps/api/src/index.ts`: the `checkAnonCreateGate` (per WS5 split into peek + commit) returns the **`auth_required` envelope** on `peekDevice` failure, not the `ip_create_cap` 429. The 401 body uses `code: "anon_device_cap"` to distinguish from `anon_global_cap` (SK-ANON-010). The `signInUrl` is built via the same `buildSignInUrl()` helper SK-ANON-010 uses.
  - **Adoption hook (server-side):** Better Auth's `after` middleware on the sign-in endpoint reads `Authorization: Bearer anon_<token>` from the request and calls `recordAnonAdoption(env.DB, userId, token)`. The adopt query is the existing SK-ANON-003 `UPDATE databases SET adopted_at = now(), user_id = ?` row update. Idempotent — replay-safe.
  - **Post-OAuth landing (client-side):** `apps/web/src/pages/auth/post-signin.astro` (new) runs on mount: `fetchSession()` → if `nlqdb_pending` is set, `POST /v1/ask` with the pending goal → `clearPending()` → redirect to `/app?db=<dbId>` (or `/app` if the replay produced no dbId). The page is what `callbackURL` points to from `sign-in.astro`.
  - The 1st-call cap commit lands AFTER successful provision (WS5 fix C). A failed first create does not consume the device cap.
  - `docs/features/anonymous-mode/FEATURE.md`: SK-ANON-007 marked `Status: superseded by SK-ANON-012`. SK-ANON-010 amended with a *Skill-local note* under SK-ANON-012 cross-referring the new per-device window. No SK-IDs renumbered.

- **Alternatives rejected:**
  - **Keep 5/hr-per-IP, drop only the burst gate.** Doesn't deliver the user requirement ("1 call then auth"). The 5/hr cap was too lenient for the new framing.
  - **2 creates per device before auth.** Off by one — the second-create moment is the right teaching moment for sign-in. Two creates implies the user is iterating, at which point the sign-in CTA fires too late.
  - **Drop Turnstile entirely.** [Supabase](https://supabase.com/docs/guides/troubleshooting/security-of-anonymous-sign-ins-iOrGCL) and [Firebase](https://firebase.blog/posts/2023/07/best-practices-for-anonymous-authentication/) both flag anon endpoints as the #1 abuse vector. A 1-per-device cap is a per-honest-user limit, not a per-bot limit — bots can mint anon tokens for free. Turnstile keeps the bot floor.
  - **Cap on per-IP (today's key) instead of per-device.** Coffee-shop / university / hotel-wifi scenarios collapse multiple users to one IP. Device-keyed caps the abuse vector (one anon bearer) without false-positiving honest co-located users.
  - **Server-side prompt mirroring (vs client `nlqdb_pending`).** Same end-state as today's design; deferred to Phase 2+ per SK-ANON-011's Open Question on cross-device prompt history.
  - **Adoption client-side (`POST /v1/anon/adopt` from `/auth/post-signin`).** Works, but the anon-bearer travels through `localStorage` at sign-in time and the client-side fetch is one more failure mode (network, cache). Server-side Better Auth `after` hook is one less moving part and the bearer rides the sign-in request header — the [Better Auth Hooks docs](https://better-auth.com/docs/concepts/hooks) confirm this is the supported pattern.

## Files to modify

| Path | Change |
|---|---|
| `docs/features/anonymous-mode/FEATURE.md` | Insert SK-ANON-012 block (above SK-ANON-013 if any exists; otherwise at the end of the *Decisions* section). Mark SK-ANON-007 with `**Status:** superseded by SK-ANON-012` and a one-line note under its existing block. Amend SK-ANON-010's *Consequence in code* with one nested line under it: "Per-device cap (SK-ANON-012) is the first window; the global cap layers above it." |
| `docs/features/ask-pipeline/FEATURE.md` | Add a one-line *Consequence in code* cross-ref under SK-ASK-009 to the new SK-ANON-012 + its post-signin replay flow (so the prelude reads correctly when the call returns `auth_required`). |

## Files to create

None. WS7 is doc-only.

## Acceptance criteria

- [ ] SK-ANON-012 block lands in `docs/features/anonymous-mode/FEATURE.md` with all 5 fields populated per `docs/skill-conventions.md` §4.
- [ ] SK-ANON-007 is marked superseded; its body is preserved (sticky-ID rule per CLAUDE.md §10.2).
- [ ] No `### GLOBAL-NNN` block lands under `docs/features/` (CLAUDE.md §8 quality gate 3).
- [ ] `grep -rn "SK-ANON-007" docs/` shows references in SK-ANON-012 and in the SK-ANON-007 block itself, not orphaned.
- [ ] `grep -rn "SK-ANON-012" docs/` finds the canonical home + all cross-refs (anonymous-mode, ask-pipeline).
- [ ] `bun run lint` (markdown style) green.
- [ ] User sign-off on the *Decision*, *Why*, and *Alternatives rejected* fields before WS8 lands.

## CLAUDE.md compliance checklist

- [ ] **P1.** This worksheet is a decision change. It does not silently contradict the prior decision — it explicitly supersedes SK-ANON-007 with a written rationale.
- [ ] **P3.** SK-ANON-012's canonical home is `docs/features/anonymous-mode/FEATURE.md`. SK-ANON-007's body is preserved. No GLOBAL involved (per-feature decision, not cross-cutting).
- [ ] **P4 D1.** No open questions in this block — both the cap key (device hash) and the value (1) are specified. Turnstile retention is explicit. The numbers are pinned in this skill, not deferred to env config.
- [ ] **P4 D2.** Nothing ambiguous. If reviewers find ambiguity, fix the wording before landing.
- [ ] **P4 D3.** The reader leaves with a clearer picture: one mechanism, one cap, one envelope.
- [ ] **P4 D4.** `docs/features/anonymous-mode/FEATURE.md` is well under 20 KB; adding SK-ANON-012 doesn't push it over. Verify with `wc -c`.

## Out of scope

- The implementation. WS8 owns it.
- Changing the global anon cap numbers (SK-ANON-010 stays at 100/hr / 1000/day / 10k/month — the per-device cap is the *first* window; global is the bot-floor over it).
- Cross-device anon continuity (SK-ANON-011 Open Question, Phase 2+).
- MCP anonymous identity (still an SK-ANON-001 Open Question).

## Sources

- [Supabase Security of Anonymous Sign-ins](https://supabase.com/docs/guides/troubleshooting/security-of-anonymous-sign-ins-iOrGCL)
- [Firebase — Best Practices for Anonymous Authentication](https://firebase.blog/posts/2023/07/best-practices-for-anonymous-authentication/)
- [Better Auth — Hooks](https://better-auth.com/docs/concepts/hooks)
- [Better Auth — Basic Usage (newUserCallbackURL)](https://better-auth.com/docs/basic-usage)
- Internal: `docs/runbook.md §10` (personas justifying the "1 call then auth" cadence)
