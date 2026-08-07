# EK-03 · ToS/DPA "not allowed" delta — founder-review draft

**Status:** **drafted 2026-08-07, awaiting founder approval.** Legal text is a
founder sign-off, not an agent merge (EK-03 box 3 / P6). This file is the
staged text; **nothing here is live** until the founder approves it and a
follow-up run lands it into [`/terms`](../../../../apps/web/src/pages/terms.astro)
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
the agent-doable remainder (drafting, substance mapping, placement) is done;
one genuinely-founder-shaped item is parked:

- 🔒 **Founder: read + approve the two clause blocks below, then a follow-up
  run publishes them into `/terms` and `/privacy` (dating both pages).**
  Conservative default applied while parked: **publish nothing** — the live
  legal pages are untouched by this run.

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
>   make against it. We will not use it — the rows, anything derived from
>   them, or metadata about them — to train, fine-tune, or improve any model,
>   ours or anyone else's.
> - **What the service necessarily does.** To answer a question, our engine
>   reads the relevant rows on the server to produce the answer — that is the
>   service you turned on. Only the structure of your data (table and column
>   names), never your row values, is ever sent to a third-party
>   language-model provider.
> - **Isolation.** Each expert's knowledge is kept separate. Another person's
>   agent can reach yours only through a grant you create and can revoke.
> - **Run it yourself.** You can run nlqdb's engine on your own infrastructure
>   and keep your knowledge entirely in your hands. A one-click
>   hosted-on-your-own-account option is on our roadmap.

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
> or improve any model, and do not sell or share it. As with every query, only
> the structure of your data (table and column names) — never your row values —
> is sent to a language-model provider. You can revoke any buyer's access at
> any time, and you can delete your Expert Knowledge at any time; deletion
> follows the retention timeline above. Where the marketplace makes us a
> processor of personal data on your behalf, the processor terms are presented
> in the selling flow before you publish.

---

## Substance map (SK-EKP-001 honesty check)

Every sentence above is either a **contractual prohibition** (a real "will
not") or backed by a **shipped technical mechanism** — no capability claim
exceeds substance, and nowhere does the text say we *cannot* read the data.

| Claim in the draft | Kind | Backed by |
|---|---|---|
| "not allowed to read/use … other than running your queries" | contractual | ToS prohibition (this text) |
| "will not use it to train/fine-tune/improve any model" | contractual + technical | this text + `/privacy` "don't train" line |
| "engine reads the relevant rows on the server" (honest carve) | truthful disclosure | server-side NL→SQL reality — *not* a "can't read" claim |
| "only structure … never row values … to a third-party LLM" | technical | [`GLOBAL-037`](../../../decisions/GLOBAL-037-schema-only-llm-egress.md) schema-only egress |
| "each expert's knowledge is kept separate" | technical | RLS per-tenant isolation (`SK-PIVOT-009`) |
| "revoke access … at any time" | technical | grant primitive, revocation bound ([`SK-EKP-008`](../decisions/SK-EKP-008-grant-primitive-design.md)) |
| "delete … at any time" | technical | delete guarantee (`SK-HDC-016`) |
| "run it on your own infrastructure" | technical | source-available / self-host engine (`GLOBAL-019` FSL, `SK-PIVOT-005`) |
| "one-click hosted-on-your-own-account … on our roadmap" | **roadmap** | explicitly future — not a current claim (`SK-EKP-001`) |

Guardrails honoured: no "can't read" phrasing; the schema-only egress line is
the `GLOBAL-037` floor stated plainly; sovereign hosting is labelled roadmap;
no fee percentage anywhere (`SK-EKP-002`).

## Sources (P2 — 2026 legal norms)

The prohibition wording follows the 2026 SaaS/AI-DPA norm — explicit,
unconditional, covering prompts/uploads/logs/metadata, and (for a data
marketplace) rights that travel with the asset while confidentiality permits
the owner's own agents to query but bars provider training/reuse:

- [toslawyer.com — Terms of Service for AI Products (2026)](https://toslawyer.com/terms-of-service-for-ai-products-what-your-agreement-must-include-in-2026/)
- [toslawyer.com — Data Processing Agreements in 2026](https://toslawyer.com/data-processing-agreements-explained-what-every-saas-company-needs-in-2026/)
- [cloudeagle.ai — AI contract clauses: does your data train someone else's model](https://www.cloudeagle.ai/blogs/ai-contract-clauses)
- [troveo.ai — AI training data marketplaces: rights travel with the asset (2026)](https://www.troveo.ai/resources/ai-training-data-marketplace)
