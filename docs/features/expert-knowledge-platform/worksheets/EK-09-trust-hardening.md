# EK-09 — Trust hardening (F1-B): schema-only buyer queries + no-training interview provider

**Status:** in-flight — **founder-chosen 2026-08-07** (Option B of the EK-03
ToS draft: harden the product so the stronger trust claim becomes true,
then publish it) · **Repo:** nlqdb (narration skip) + `experts` (provider
pin) · **Risk:** low–med · **Runs:** 1–2 · **Prereqs:** none for the
knowledge-DB narration skip; EK-06 for the granted-path half; EK-05 for the
provider pin to have a surface · **Box 1 shipped 2026-08-09:**
`orchestrateAsk` skips the summarize hop by default for `agent_memory_v1`
DBs (`isAgentMemoryV1Db`), guarded by an `orchestrate.test.ts` assertion
that no `summarize` call fires and no summary is returned.

## Goal

Make `GLOBAL-037` (as amended) lane 2 schema-only for every buyer-facing
marketplace path, so the EK-03 draft's stronger claim — *"when buyers query
your knowledge, your rows are never sent to a language-model provider"* —
is literally true before it publishes.

1. **Narration skip, server-side** — knowledge-DB asks (and granted-path
   asks once EK-06 exists) behave as `Accept: application/json` by default:
   the summarize step is not invoked, rows go to the caller un-narrated.
   Agent buyers consume rows, not prose — this is the better product for
   them independent of the trust claim. A human surface may re-enable
   narration only with an explicit, disclosed toggle.
2. **No-training interview provider pin** — the interview/extraction model
   (lane 3) is pinned to a provider whose API terms exclude training on
   inputs/outputs; the provider abstraction in `experts` keeps the pin a
   config assertion, tested (a CI check fails if the interview model id
   falls outside the pinned allowlist).
3. **Egress test extension** — the `GLOBAL-037` lane-1 egress test asserts
   zero row-values in LLM requests for a knowledge-DB ask end-to-end
   (planning *and* the skipped narration), turning the ToS sentence into a
   guarded invariant (EK-03 box 4's honest-claims guard hooks here).

## Done when

- [x] Knowledge-DB asks skip narration by default; test proves no
      summarize call fires. (2026-08-09 — `orchestrateAsk` ORs
      `isAgentMemoryV1Db(db.id)` into the summarize skip; the
      `EK-09: knowledge-DB … skip narration by default` test in
      `apps/api/test/orchestrate.test.ts` asserts `summarize` is not called.)
- [ ] Granted-path asks inherit the skip (lands with EK-06).
- [ ] Interview provider pinned + CI-asserted in `experts`.
- [ ] Egress test extended; EK-03's stronger copy drafted into the
      approved delta file and a one-sentence wording sign-off re-queued in
      `blocked-by-human.md` (the Option A base text was founder-signed
      2026-08-10 and publishes with EK-05 without waiting here).
