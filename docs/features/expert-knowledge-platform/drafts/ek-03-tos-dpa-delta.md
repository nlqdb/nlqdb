# EK-03 · ToS/DPA "not allowed" delta — founder-review draft

**Status:** **drafted 2026-08-07, rewritten same day after Fable review
(verdict on the first draft: UNSOUND), awaiting founder approval.** The
first draft claimed *"never your row values … sent to a third-party
language-model provider"* — **false against shipped code**: the `/v1/ask`
summarize step sends up to 50 result rows to the LLM provider
(`apps/api/src/ask/orchestrate.ts` → `llm.summarize({rows})`), skipped only
on `Accept: application/json`; the live privacy page already discloses this
honestly. This rewrite is truthful **as shipped** (Option A). The founder
may instead choose **Option B** (§ below): harden the product so the
stronger claim becomes true, then publish that. Legal text is a founder
sign-off, not an agent merge (EK-03 box 3 / P6). **Nothing here is live**
until the founder approves and a follow-up run lands it into
[`/terms`](../../../../apps/web/src/pages/terms.astro)
and [`/privacy`](../../../../apps/web/src/pages/privacy.astro).

**Governing decision:** [`SK-EKP-001`](../FEATURE.md) — the loud trust pillar
is *"we are not allowed to use or read this data — it is only theirs"*: a
**contractual prohibition** stated on top of the **true technical floor**
([`GLOBAL-037`](../../../decisions/GLOBAL-037-schema-only-llm-egress.md)
schema-only egress, RLS isolation, delete, FSL self-host). Copy never claims
*"we can't read it"* while operators technically can. Sovereign hosting is a
**roadmap** statement, not a current claim.

**Slice:** [`EK-03`](../worksheets/EK-03-trust-surface.md) box 3. The landing +
copy (boxes 1–2) and the honest-claims guard (box 4) are later runs — they
enumerate *this* floor, so the contract text lands first (SK-EKP-001: trust
copy never exceeds substance).

---

## The founder call (GLOBAL-033)

Per [`GLOBAL-033`](../../../decisions/GLOBAL-033-resolution-defaults.md)
the agent-doable remainder (drafting, substance mapping, placement) is done.
The one genuinely founder-shaped item — signing off the legal wording and
publishing it — is queued in the single channel the founder reads,
[`blocked-by-human.md`](../../../blocked-by-human.md). It is a **legal human
action, not a `🔒` decision-to-lock**: `SK-EKP-001` is already locked, so
publishing only *executes* it — there is no new `GLOBAL-*`/`SK-*` to mint.
Conservative default already applied: **publish nothing** — the live legal
pages are untouched by this run.

No fee wording appears here (`SK-EKP-002`: trust-loud, fee-quiet — seller-facing
fee disclosure lives in the EK-05 selling flow, not the trust/legal surface).

---

## Block A — add to `/terms`

Placement: a new `<h2>` **"Expert knowledge you publish"** immediately after
the existing *"Your data and databases"* section.

> ## Expert knowledge you publish
>
> If you use nlqdb to author or publish your professional knowledge as
> structured, queryable data ("**Expert Knowledge**"), the following apply on
> top of the rest of these terms:
>
> - **You own it.** Your Expert Knowledge stays yours. Publishing it grants
>   only the specific, revocable read access you choose in the selling flow —
>   nothing more. You can revoke that access, and delete the knowledge, at any
>   time.
> - **What we will not do.** We are not allowed to read, use, mine, benchmark,
>   resell, or redistribute the content of your Expert Knowledge for any
>   purpose other than running the queries you (or the buyers you authorise)
>   make against it. We will never use it — the rows, anything derived from
>   them, or metadata about them — to train, fine-tune, or improve our own
>   models, and we do not grant anyone the right to train on it.
> - **What the service necessarily does.** To answer a question, our engine
>   reads the relevant rows on the server to produce the answer — that is the
>   service you turned on. Two things pass through our language-model
>   subprocessors (listed in the <a href="/privacy/">privacy policy</a>):
>   your data's **structure** — table and column names, types, and the
>   descriptions you author — which is how questions become queries; and,
>   when we narrate an answer in plain language, the **rows that answer
>   returned**. You can turn narration off (API callers: request JSON-only
>   responses), and when you author knowledge through the interview, your
>   answers pass through the interview model — that is the authoring service
>   itself.
> - **Isolation.** Each expert's knowledge is kept separate. Another person's
>   agent can reach yours only through a grant you create and can revoke.
> - **Run it yourself.** You can run nlqdb's engine on your own
>   infrastructure under its source-available license (FSL-1.1, which
>   permits any non-competing use) and keep your knowledge entirely in your
>   hands. A one-click hosted-on-your-own-account option is on our roadmap.

## Block B — add to `/privacy`

Placement: a new `<h2>` **"Expert knowledge published to the marketplace"**
immediately after the existing *"What we don't do"* section (which already
carries the site-wide *"we don't use your data to train our own models"* line;
this block states the stronger, expert-knowledge-specific commitment).

> ## Expert knowledge published to the marketplace
>
> If you publish Expert Knowledge (see the <a href="/terms/">Terms</a>), we
> process it only to run the queries you or the buyers you authorise make
> against it. We do not read it for any other purpose, do not use it to train
> or improve our own models, do not grant anyone the right to train on it,
> and do not sell or share it. What reaches a language-model provider is
> what the "Query text" section above describes for every database: your
> question and your schema to write the query, and — only when an answer is
> narrated in plain language — the rows that answer returned (JSON-only API
> responses skip narration). You can revoke any buyer's access at
> any time, and you can delete your Expert Knowledge at any time; deletion
> follows the retention timeline in the "How long we keep it" section. Where
> the marketplace makes us a
> processor of personal data on your behalf, the processor terms are presented
> in the selling flow before you publish.

**Companion edit (same PR as publish):** the existing "What we collect →
Query text" bullet stays the canonical disclosure; this block references it
rather than restating it, so the page cannot assert two different egress
stories (the first draft's fatal defect).

---

## Substance map (SK-EKP-001 honesty check)

Every sentence above is either a **contractual prohibition** (a real "will
not") or backed by a **technical mechanism** — shipped today, except the
grant/revocation clause whose mechanism is designed and gates publish (see the
table). No capability claim exceeds substance *at publish time*, and nowhere
does the text say we *cannot* read the data.

| Claim in the draft | Kind | Backed by |
|---|---|---|
| "not allowed to read/use … other than running your queries" | contractual | ToS prohibition (this text) |
| "will never use it to train … **our own** models; we do not grant anyone the right" | contractual | this text + `/privacy` "don't train our own models" line — deliberately **not** "anyone else's model won't train": row egress to free-tier LLM providers is governed by their terms, so that promise is only makeable under Option B |
| "engine reads the relevant rows on the server" (honest carve) | truthful disclosure | server-side NL→SQL reality — *not* a "can't read" claim |
| "structure to write the query; returned rows only when narrating; opt-out" | technical, **as shipped** | planning path: [`GLOBAL-037`](../../../decisions/GLOBAL-037-schema-only-llm-egress.md) schema-only prompt assembly · narration path: `orchestrate.ts` summarize (skipped on `Accept: application/json`) · interview path: the authoring service (SK-EKP-007 INV-EKP-037) |
| "each expert's knowledge is kept separate" | technical | RLS per-tenant isolation (`SK-PIVOT-009`) |
| "revoke access … at any time" | technical (planned) | grant primitive + revocation bound, *designed* in [`SK-EKP-008`](../decisions/SK-EKP-008-grant-primitive-design.md) but not yet built (FEATURE.md open question); ships with the EK-05 selling flow — this clause publishes only once it does |
| "delete … at any time" | technical | delete guarantee (`SK-HDC-016`) |
| "run it on your own infrastructure" | technical | source-available / self-host engine (`GLOBAL-019` FSL, `SK-PIVOT-005`) |
| "one-click hosted-on-your-own-account … on our roadmap" | **roadmap** | explicitly future — not a current claim (`SK-EKP-001`) |

Guardrails honoured: no "can't read" phrasing; egress is disclosed exactly
as shipped (planning / narration / interview, with the narration opt-out);
sovereign hosting is labelled roadmap; no fee percentage anywhere
(`SK-EKP-002`).

---

## Option B — **founder-chosen 2026-08-07** (harden the product, then publish the stronger claim)

The founder picked B: the marketing-grade sentence — *"your knowledge rows
are never sent to a language-model provider when buyers query them"* —
becomes **true** with two product changes
([`EK-09`](../worksheets/EK-09-trust-hardening.md)), and only then does the
stronger copy swap in and publish (with the founder's final wording
sign-off). Option A's truthful text above remains the fallback if B's
slices stall:

1. **Knowledge-DB queries skip narration by default** (server-side: the
   granted/knowledge-DB ask path behaves as `Accept: application/json`;
   buyers' agents consume rows, not prose — arguably the better product for
   agent buyers anyway).
2. **The interview model is pinned to a no-training provider** (e.g. an API
   whose terms exclude training on inputs/outputs) for the authoring path,
   so the training promise can extend beyond "our own models."

Both are `EK-09`'s Done-when boxes; neither exists today. Until both ship,
Option A's truthful text is the only publishable version (SK-EKP-001: trust
copy never exceeds substance). Publish order: EK-09 green → stronger copy
drafted into this file → founder wording sign-off → live.

## Sources (P2 — 2026 legal norms)

The prohibition wording follows the 2026 SaaS/AI-DPA norm — explicit,
unconditional, covering prompts/uploads/logs/metadata, and (for a data
marketplace) rights that travel with the asset while confidentiality permits
the owner's own agents to query but bars provider training/reuse:

- [toslawyer.com — Terms of Service for AI Products (2026)](https://toslawyer.com/terms-of-service-for-ai-products-what-your-agreement-must-include-in-2026/)
- [toslawyer.com — Data Processing Agreements in 2026](https://toslawyer.com/data-processing-agreements-explained-what-every-saas-company-needs-in-2026/)
- [cloudeagle.ai — AI contract clauses: does your data train someone else's model](https://www.cloudeagle.ai/blogs/ai-contract-clauses)
- [troveo.ai — AI training data marketplaces: rights travel with the asset (2026)](https://www.troveo.ai/resources/ai-training-data-marketplace)
