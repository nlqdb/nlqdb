# WS-02 — Product app + onboarding

**Scope:** `apps/web/src/pages/{app,auth}/`, `apps/web/src/components/`
(CreateForm, chat/*, keys/*, FeatureGatedView), `apps/web/src/lib/`.
**Pre-reads:** `docs/features/web-app/FEATURE.md`,
`docs/features/onboarding/FEATURE.md`,
`docs/features/anonymous-mode/FEATURE.md`,
`docs/features/pre-alpha-gate/FEATURE.md`,
`docs/features/api-keys/FEATURE.md`, `docs/features/trust-ux/FEATURE.md`.
**Default KPI:** Onboarding / UX.
**Constraints:** SK-ANON-011 (never lose a prompt; localStorage is the
durable store), SK-ANON-012 (per-device 1-call anon cap is intentional),
SK-WEB-007 (chat Copy-snippet inlines the real `pk_live_`), SK-WEB-009
(host-only session cookie; marketing site can't see auth — accepted
trade-off, do NOT "fix"), GLOBAL-011 (trace always visible), GLOBAL-012
(one-sentence errors).

The review found **no P1s** on the critical signup→first-query path
(measured ~13-16s landing→first answer). Everything below is friction
reduction.

---

## WS02-T1 (P2) — Gate screen shows "BIRD"/"Spider" bars with no explanation

- **Files:** `apps/web/src/components/FeatureGatedView.tsx` (~lines 19-22)
- **Problem:** A gated visitor sees two progress bars labelled BIRD and
  Spider with thresholds. Nothing on screen says these are NL→SQL accuracy
  benchmarks, so the most honest screen in the product reads as jargon.
- **Fix:** One visible sentence under the bars, e.g. "BIRD and Spider are
  public NL→SQL accuracy benchmarks — nlqdb opens up when it clears both
  targets." Keep the existing `aria-label`. Thresholds come from
  GLOBAL-027; don't restate the numbers in copy (they render from data).
- **Accept:** Explanation visible to sighted users; waitlist CTA unchanged.

## WS02-T2 (P2) — Session probe caches forever; sign-out can look signed-in

- **Files:** `apps/web/src/lib/session.ts` (`fetchSession` promise cache,
  ~lines 10-40)
- **Problem:** The probe result is cached in a module-level promise and
  never invalidated. After sign-out + back-nav (bfcache) or in a second
  tab, stale "signed-in" state can render. Sign-out is trust-critical.
- **Fix:** Invalidate the cache on `pageshow` (persisted) /
  `visibilitychange`, and export an explicit `invalidateSession()` the
  sign-out path calls. Keep dedup behaviour for the initial load burst.
- **Accept:** Manual check — sign out, navigate back: no authed shell.
  Unit test for the invalidation if the lib has tests.

## WS02-T3 (P2) — Pending-prompt loss is silent

- **Files:** `apps/web/src/components/chat/ChatPanel.tsx` (~lines 202-208,
  `loadPending()`), `apps/web/src/pages/auth/post-signin.astro`
- **Problem:** SK-ANON-012's auth wall promises "your prompt is saved".
  If `nlqdb_pending` is missing post-signin (privacy mode, cleared
  storage), the composer is just empty — the promise silently breaks.
- **Fix:** Only when the post-signin flow *expected* a pending prompt
  (e.g. a query-flag like `?replay=1` set by the wall redirect — do NOT
  put the prompt text itself in the URL, per SK-ANON-011) and none is
  found, show a one-time dismissible notice: "Couldn't recover your
  previous message — re-type it here." Storage stays the mechanism;
  this only acknowledges the rare failure.
- **Accept:** Normal replay path unchanged; simulated-loss path shows the
  notice once.

## WS02-T4 (P2) — Marketing snippet hint doesn't say where the key comes from

- **Files:** `apps/web/src/components/CreateForm.tsx` (~lines 250-251,
  288-290)
- **Problem:** The anon embed snippet correctly shows
  `api-key="pk_live_REPLACE_ME"` (SK-WEB-010 — intentional, don't inline
  a key), but the hint under it doesn't say where the real key will be.
  A user who pastes the snippet first and signs in later is left guessing.
- **Fix:** Extend the hint copy: "Sign in (free) to keep this DB — your
  `pk_live_` key then appears in every chat reply's Copy snippet and at
  /app/keys." Copy-only change.
- **Accept:** Hint names both key locations; snippet itself unchanged.

## WS02-T5 (P3) — Polish batch (one commit)

1. **Anon key shape-check** — `apps/web/src/components/chat/CopySnippet.tsx`
   (~line 65): `readAnonPkLive()` returns whatever localStorage holds;
   guard with `startsWith("pk_live_")` → null so a corrupted slot hits the
   existing "Couldn't copy" fallback instead of producing a 401-ing embed.
2. **Keys loading state** — `apps/web/src/components/keys/KeysPanel.tsx`
   (~line 86): replace bare "Loading…" with 3 pulsing skeleton rows
   mirroring the list layout.
3. **Stale deep-link** — `apps/web/src/components/chat/ChatPanel.tsx`
   (~lines 176-182): when `?db=<id>` isn't in `/v1/databases`, drop the
   param and show one-time "That database no longer exists — showing all
   databases."
4. **DiffChip keyboard hint** — `apps/web/src/components/chat/DiffChip.tsx`
   (~line 33): if Escape-to-cancel is wired, say so in the hint; if not,
   wire it or leave the buttons as the affordance (don't promise unwired
   keys).
5. **Error-copy tense sweep** — `apps/web/src/components/CreateForm.tsx`
   (~lines 366-388): normalize `messageFor()` strings to imperative,
   action-first (GLOBAL-012 already satisfied; this is consistency only).
- **Accept:** Each item individually verifiable; no behaviour change
  beyond the listed states; `bun run test` green.
