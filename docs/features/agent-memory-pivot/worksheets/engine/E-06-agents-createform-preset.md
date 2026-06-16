# E-06 — `/agents` CreateForm uses the `agent_memory_v1` preset by default

**Status:** ⬜ not started
**Sequence:** Engine 6 of 7 · **Risk:** low · **Runs:** 1 · **Prereqs:** E-01 ✅, WS-07 ✅ · **Gate:** none

## Goal

The `/agents` landing (WS-07) should land the user on the **memory
preset**, not the generalist schema-inference path. One small UX slice that
makes the on-ramp match the wedge: the agent-builder reader who clicks
"create" gets a working memory DB in zero schema-design steps.

## Scorecard number it moves

Onboarding: `/agents` → first-memory-DB conversion rate. Add a new funnel
row "memory-preset DBs created" if the boolean isn't enough.

## Read first

- `docs/features/web-app/FEATURE.md`
- `apps/web/src/components/CreateForm.tsx` (the home + `/app/new` shared
  component — note the `placeholder` + `messageFor` strings)
- `apps/web/src/pages/agents/**` (WS-07's landing — this slice plugs into it)
- E-01's `{ preset: "agent_memory_v1" }` input field

## Steps

1. Pass a `preset` prop to `<CreateForm>`; when `preset === "agent_memory_v1"`,
   the create call uses the preset path (skips the classifier, deterministic
   DDL).
2. Wire `/agents` to render `<CreateForm preset="agent_memory_v1" />`.
   Tweak the placeholder + helper copy to the memory shape ("what your agent
   should remember — e.g. user preferences, decisions, tool outcomes").
   **Home (`/`) CreateForm is unchanged** (generalist).
3. The "Embed this DB" result view (`CreateForm.tsx:217-301`) gets an
   agent-memory-shaped snippet: an MCP server-config blob the user pastes
   into Claude Desktop / Cursor, rather than the `<nlq-data>` HTML
   snippet that's right for the home flow. Both snippets live in
   `apps/web/src/data/snippets.ts`.
4. Demand-signal event `agents.preset_db_created` per GLOBAL-024.
5. `bun run --filter @nlqdb/web check && test`.

## Done when

- [ ] `<CreateForm preset="agent_memory_v1">` calls the preset path.
- [ ] `/agents` lands users on it; home stays generalist.
- [ ] Result view shows an MCP host-config snippet for memory DBs (not the `<nlq-data>` snippet — which is wrong shape for agents).
- [ ] Demand-signal event fires on create.
- [ ] Engine INDEX tracker + status ticked.

## Artifact

A short walkthrough screenshot-free post: "from `/agents` to a working
memory MCP server in 60 seconds" → `distribution-queue.md`.

## Rollback

Default the `preset` prop to undefined; `/agents` falls back to the
generalist create. Existing memory DBs unaffected.
