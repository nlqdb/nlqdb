# WS-10 — FSL self-host messaging + fix GLOBAL-019 / architecture §0 wording

**Status:** ⬜ not started
**Sequence:** 10 of 13 · **Risk:** low · **Runs:** 1 · **Prereqs:** none · **Gate:** none

## Goal

State the open/free, anti-VC angle **truthfully under FSL-1.1** — and fix the
two docs that currently claim plain "Apache-2.0 today" when the license is
FSL-1.1-ALv2 (delayed Apache). The founder chose "FSL but push self-host"
(SK-PIVOT-005), so the messaging is "source-available, self-hostable for
non-competing use, BYO LLM key at 0% markup, no per-call fees, no pricing
page" — **not** "Apache-2.0, `docker compose up`."

## Scorecard number it moves

Distribution (resonates with the self-hosted-agent crowd) + doc-accuracy
(removes a contradiction). `Pivot:` "FSL angle live".

## Read first

- `README.md:251-256` (the real license: FSL-1.1-ALv2)
- `docs/decisions/GLOBAL-019-apache2-open-source-core.md` (says "Apache-2.0")
- `docs/architecture.md:16` (`§0` core values — also says "Apache-2.0")
- `GLOBAL-036` reconciliation note (authorises this correction)

## Steps

1. **GLOBAL-019** — correct the body so "Apache-2.0" reads "FSL-1.1-ALv2
   (source-available; auto-converts to Apache-2.0 two years after each
   release)". Preserve the decision's spirit (open core; Cloud is convenience,
   not a moat; anyone can self-host for non-competing use). Keep the ID.
2. **architecture.md §0** — same correction to the "Open source" bullet.
3. Add the FSL-accurate self-host band copy where the wedge needs it:
   `/agents` (WS-07 references this), `pricing.astro` (the BYO-key/no-per-call
   line), and the README body (not the H1 — that's WS-13).
4. Grep for other stale "Apache-2.0" claims in user-facing copy
   (`grep -rn "Apache-2.0\|Apache 2.0" apps/web docs README.md`) and reconcile.

## Done when

- [ ] GLOBAL-019 + architecture.md §0 say FSL-1.1→Apache, not "Apache-2.0 today".
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
