# SK-PIVOT-010 — E-06's preset on-ramp lives on the authed create surface, never the anonymous `/agents` CreateForm

- **Decision:** The `agent_memory_v1` preset on-ramp (E-06) targets the
  **authenticated** create surface (`POST /v1/databases { preset }` from the
  chat left-rail / `/app/new` for a signed-in user), gated behind
  `MEMORY_PRESET`. The original plan — render
  `<CreateForm preset="agent_memory_v1">` on the public `/agents` page so an
  anonymous visitor lands on the preset path — is dropped; `/agents` keeps its
  WS-07 "try this query" CTA → `/app/new` (run 36).
- **Core value:** Bullet-proof, Honest, Simple
- **Why:** The preset path is authenticated-only across **three** independent
  boundaries: (1) `POST /v1/databases` is `requireSession` and rejects
  `preset` unless `MEMORY_PRESET=1`;
  (2) the companion `POST /v1/memory/remember` write verb rejects `anon`
  (`auth_required`) and `pk_live` (`forbidden`, read-only) — only a
  user-session key writes memory; (3) `CreateForm` is
  anon-only by contract — it always sends `credentials:"omit"` + an anon
  bearer so the device-cap → sign-in handoff works (SK-ANON-008), so it
  structurally cannot call a `requireSession` endpoint. The memory wedge is
  authed by design ("the wedge feeds the waitlist, it does not open the
  product" — pivot hard rule), so the on-ramp belongs where a principal exists.
- **Consequence in code:** E-06 is resized from "low · 1 run · anon
  CreateForm" to "authed surface · `MEMORY_PRESET`-gated · flag enabled in
  prod first." The anon `/agents` CTA stays as shipped (run 36); the
  result-view MCP host-config snippet (E-06 step 3) still applies, on the
  authed surface. **No code shipped this run** — the flag is dark in prod, so
  any preset UI would return `preset_disabled` 400. E-06 worksheet + engine
  INDEX corrected.
- **Alternatives rejected:** **Rework CreateForm to ride the session cookie**
  — breaks SK-ANON-008 (a signed-in hero submit skips the device cap, the
  anon→sign-in handoff regresses). · **Add an anonymous preset-create
  endpoint** — opens the product to anon memory DBs, violating the pivot's
  waitlist-feed rule. · **Ship the `/agents` preset UI now against the dark
  flag** — every visitor hits `preset_disabled` 400; a broken on-ramp.
