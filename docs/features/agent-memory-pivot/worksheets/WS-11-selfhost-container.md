# WS-11 — Pull the self-host container forward (`ghcr.io/nlqdb/api`)

**Status:** ⬜ not started
**Sequence:** 11 of 13 · **Risk:** high · **Runs:** multi · **Prereqs:** WS-10 ✅ · **Gate:** infra-gated (founder)

## Goal

Make the self-host claim *true*. The container image (`ghcr.io/nlqdb/api`) is
a Phase-3 item today; the FSL/anti-VC wedge (WS-10) leans on self-hostability,
so it's pulled forward. **This is not a copy-only daily run** — it touches
build, CI, secrets, and the Workers-vs-container runtime story.

## Why this is gated, not a normal slice

- Spans **multiple runs** and **infra** (image build, GHCR publish, a
  self-host config path, docs).
- May need decisions an agent can't make alone (what the self-host runtime
  is, given the prod target is Cloudflare Workers; which managed deps a
  self-hoster must bring — Postgres, KV-equivalent, secrets).
- Per `.claude/commands/daily.md` rule 4, anything needing prod secrets /
  console / money/legal goes to `docs/blocked-by-human.md`, not parked here.

## Steps (founder/infra to scope first)

1. Add a `docs/blocked-by-human.md` bullet capturing the founder decision
   needed: "self-host runtime target + which deps a self-hoster brings."
2. Once scoped: a `Dockerfile`/build for the API runnable outside Workers (or
   a documented Workers-compatible self-host path), GHCR publish in CI, and a
   `docs.nlqdb.com/self-host/` page.
3. Update `phase-plan.md`: move the container line out of Phase 3 into the
   pivot's Phase-2 distribution scope, noting WS-10 depends on it being true.
4. Only after the image runs: upgrade `/agents` + README copy from
   "source-available / self-hostable" to "self-host it: `…`".

## Done when

- [ ] Founder scope captured in `blocked-by-human.md` and resolved.
- [ ] `ghcr.io/nlqdb/api` publishes from CI; a self-hoster can run the API.
- [ ] `docs.nlqdb.com/self-host/` exists; phase-plan updated.
- [ ] WS-10 copy upgraded to the now-true running-self-host claim.
- [ ] INDEX tracker + status ticked.

## Artifact

"Self-host nlqdb in 5 minutes" walkthrough → `distribution-queue.md`.

## Rollback

Container is additive (new artifact + docs page). Revert the phase-plan +
copy upgrade; fall back to WS-10's "source-available" wording.
