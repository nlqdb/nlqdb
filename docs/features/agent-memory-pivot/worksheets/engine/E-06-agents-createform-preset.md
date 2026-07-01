# E-06 — preset on-ramp on the authed create surface (`MEMORY_PRESET`-gated)

**Status:** ⬜ not started — **redirected** (SK-PIVOT-010, run 37): the anon
`/agents` CreateForm path is infeasible; the on-ramp is authed-only.
**Sequence:** Engine 6 of 7 · **Risk:** med · **Runs:** ~2 · **Prereqs:** E-01 ✅, WS-07 ✅, **`MEMORY_PRESET=1` enabled in prod** (currently dark — a plain non-secret var, gated on E-03 security scoping shipping first) · **Gate:** none

## Finding (run 37, SK-PIVOT-010) — why the original mechanism was dropped

The original goal was "render `<CreateForm preset="agent_memory_v1">` on the
public `/agents` page so an anonymous visitor lands on the preset path." That
is infeasible across **three independent authentication boundaries**:

1. `POST /v1/databases` (the only preset-create endpoint) is `requireSession`
   and rejects `preset` unless `MEMORY_PRESET=1` (`apps/api/src/index.ts:2357,2390`).
2. The companion `POST /v1/memory/remember` write verb rejects `anon`
   (`auth_required`) and `pk_live` (`forbidden`, read-only) — only a
   user-session key writes memory (`index.ts:1426-1433`). A memory DB an anon
   can create but can't write to is useless.
3. `CreateForm` is **deliberately anon-only**: it always sends
   `credentials:"omit"` + an anon bearer so the device-cap → sign-in handoff
   works (SK-ANON-008). It never carries a session, so it structurally cannot
   call a `requireSession` endpoint.

Reworking CreateForm to ride the session cookie would break SK-ANON-008; an
anon preset endpoint would "open the product" against the pivot's
authed-on-ramp rule. So the on-ramp belongs on the **authed** create surface.

## Goal (redirected)

A signed-in agent-builder gets a working memory DB in zero schema-design
steps from the authed create surface (chat left-rail "+ New" / `/app/new`),
`MEMORY_PRESET`-gated. The anonymous `/agents` page keeps its WS-07 "try this
query" CTA → `/app/new` (run 36) — once the visitor signs in, the preset
on-ramp is there. **Do not ship any preset UI until `MEMORY_PRESET=1` is
enabled in prod** (it is dark today — every preset call returns
`preset_disabled` 400).

## Scorecard number it moves

Onboarding: `/agents` → first-memory-DB conversion rate. Add a new funnel
row "memory-preset DBs created" if the boolean isn't enough.

## Read first

- `docs/features/web-app/FEATURE.md`
- `apps/web/src/components/CreateForm.tsx` (the home + `/app/new` shared
  component — note the `placeholder` + `messageFor` strings)
- `apps/web/src/pages/agents/**` (WS-07's landing — this slice plugs into it)
- E-01's `{ preset: "agent_memory_v1" }` input field

## Steps (redirected — authed surface, after `MEMORY_PRESET=1` is on in prod)

1. **Prerequisite:** enable `MEMORY_PRESET=1` in prod (a plain non-secret var —
   agent-settable via PR to `apps/api/wrangler.toml` `[vars]`, or founder via the
   CF dashboard). Do this only after E-03 (per-agent isolation) ships; enabling it
   earlier exposes memory with no cross-agent scoping. Until then this slice ships
   nothing — preset calls 400 `preset_disabled`.
2. On the **authed** create surface (chat left-rail "+ New" / `/app/new` for a
   signed-in session — the surface that already calls `POST /v1/databases`
   with the session cookie, **not** the anon `CreateForm`), add an opt-in
   "agent memory" create option that posts `{ preset: "agent_memory_v1" }`.
   The anonymous home/`/agents` flows stay generalist + anon (untouched).
3. The result view gets an agent-memory-shaped snippet: an **MCP server-config
   blob** the user pastes into Claude Desktop / Cursor, rather than the
   `<nlq-data>` HTML snippet that's right for the home flow.
4. Demand-signal event `agents.preset_db_created` per GLOBAL-024.
5. `bun run --filter @nlqdb/web check && test`.

## Done when

- [ ] The authed create surface can post `{ preset: "agent_memory_v1" }`.
- [ ] Anonymous home + `/agents` flows stay generalist + anon (unchanged).
- [ ] Result view shows an MCP host-config snippet for memory DBs (not the `<nlq-data>` snippet — which is wrong shape for agents).
- [ ] Demand-signal event fires on create.
- [ ] Engine INDEX tracker + status ticked.

## Artifact

A short walkthrough screenshot-free post: "from sign-in to a working memory
MCP server in 60 seconds" → `distribution-queue.md`.

## Rollback

`MEMORY_PRESET` unset → the preset create option disappears (endpoint 400s);
the generalist create is unaffected. Existing memory DBs unaffected.
