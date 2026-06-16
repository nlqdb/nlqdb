# WS-10 — FSL self-host messaging

**Status:** ⬜ not started
**Sequence:** 10 of 13 · **Risk:** low · **Runs:** 1 · **Prereqs:** none · **Gate:** none

> The GLOBAL-019 + `architecture.md §0` doc-wording fix that used to live here
> shipped in the pivot PR (a factual sync — the license is already
> FSL-1.1-ALv2). This worksheet is now just the new user-facing FSL copy.

## Goal

State the open/free, anti-VC angle **truthfully under FSL-1.1** in user-facing
copy. The founder chose "FSL but push self-host" (SK-PIVOT-005), so the
messaging is "source-available, self-hostable for non-competing use, BYO LLM
key at 0% markup, no per-call fees, no pricing page" — **not** "Apache-2.0,
`docker compose up`."

## Scorecard number it moves

Distribution (resonates with the self-hosted-agent crowd) + doc-accuracy
(removes a contradiction). `Pivot:` "FSL angle live".

## Read first

- `README.md:251-256` (the real license: FSL-1.1-ALv2)
- `GLOBAL-019` (now states FSL-1.1→Apache, corrected in the pivot PR)

## Steps

1. Add the FSL-accurate self-host band copy where the wedge needs it:
   `/agents` (WS-07 references this), `pricing.astro` (the BYO-key/no-per-call
   line), and the README body (not the H1 — that's WS-13).
2. Grep for stale "Apache-2.0" claims still in user-facing copy
   (`grep -rn "Apache-2.0\|Apache 2.0" apps/web README.md`) and reconcile.

## Done when

- [ ] Self-host angle stated in FSL-accurate terms on `/agents` + pricing + README body.
- [ ] No remaining "Apache-2.0 today" claim in user-facing copy.
- [ ] INDEX tracker + status ticked.

## Artifact

A short "what FSL-1.1 means for self-hosting nlqdb" note → `distribution-queue.md`.

## Rollback

Revert the wording diffs — doc + copy only.

> **Note:** the messaging here promises self-host; **WS-11 makes it true.**
> Do not claim a *running* self-host image before WS-11 ships — keep the copy
> to "source-available / self-hostable for non-competing use" until the
> container lands.
