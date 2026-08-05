# Expert-knowledge platform — competitive landscape

**Purpose.** Source of truth for the research behind
[`docs/future/expert-knowledge-platform.md`](../future/expert-knowledge-platform.md)
(the "Become AI" vision, founder-directed 2026-08-04). Compiled 2026-08-05
from a three-lane fan-out research pass (digital-clone cohort · platform
knowledge stores · vertical expert SaaS + vector-KB-as-a-service). Every
claim carries its source; third-party-reported numbers are flagged. The
question under test: **the wedge hypothesis** — everyone else stores *prose
to recall*; nlqdb would store *structure to compute on* (a carpenter's
material tolerances, a tutor's error taxonomy — things an agent can
`GROUP BY`).

**Verdict up front:** the hypothesis survives. No product found in 2025–2026
markets "turn your professional knowledge into a structured database AI
agents can query and compute over — and get paid when they do." Four players
each hold one corner (§5); none holds the intersection of (a) non-technical
authoring, (b) structured/computable representation, (c) agent-queryable
interface, (d) expert monetization. And no platform anywhere offers a
technical "we can't read it" — trust is contractual across the entire
landscape (§6).

---

## 1. Digital-clone / "monetize your expertise" cohort

### Delphi.ai — the consolidating category winner
- **Promise:** "Scale your insight" — a Digital Mind trained on your body of
  work answers 24/7 ([delphi.ai](https://www.delphi.ai/)).
- **Split:** creator pays SaaS ($0 / $79 / $299 / custom "Immortal",
  [pricing](https://www.delphi.ai/pricing)). Take rate contested: Delphi's
  own docs bot now says *"Delphi doesn't take a revenue share or platform
  fee"* and *"monetization isn't built into Delphi"* (docs.delphi.ai, fetched
  live) — contradicting marketing pages still advertising memberships and
  pay-as-you-go ([experts page](https://www.delphi.ai/industries/experts));
  third parties report a historical 15–20% creator-reported share
  ([personify.fyi](https://personify.fyi/blog/ai-clone-cost/)). **No
  published take rate as of 2026-08.**
- **Trust:** marketing says "never used for training models"
  ([Series A post](https://www.delphi.ai/blog/delphi-raises-16m-series-a-from-sequoia));
  the privacy policy reserves use *"to improve Delphi's models"* and the ToS
  takes a **perpetual, sublicensable, transferable license** to creator
  content ([privacy](https://www.delphi.ai/privacy), [terms](https://www.delphi.ai/terms)).
  No encryption claim; contractual only.
- **Representation — RAG blob, confirmed at the infra level:** chunk →
  augment → embed → one Pinecone namespace per mind; 100M vectors across
  12,000+ namespaces ([Pinecone case study](https://www.pinecone.io/customers/delphi/)).
  **No queryable schema; nothing an agent could aggregate.**
- **Traction:** $16M Series A led by **Sequoia** (June 2025), 2,000+ experts
  at raise, one creator (Matthew Hussey) at 7-figure clone revenue
  ([Series A post](https://www.delphi.ai/blog/delphi-raises-16m-series-a-from-sequoia),
  [Fast Company](https://www.fastcompany.com/91356476/delphi-ai-digital-mind)).
  Distribution: web chat + voice; API/SMS/WhatsApp enterprise-gated. No MCP.

### Coachvox AI — the coach-clone standard
- **Promise:** an AI version of the coach working unlimited clients 24/7
  ([coachvox.ai](https://coachvox.ai/)). Creator pays ~$83/mo annual.
- **Split:** monetization via Stripe Connect; **~10% platform commission +
  Stripe fees** (third-party-reported:
  [personify.fyi](https://personify.fyi/blog/ai-clone-cost/); not printed on
  the live [FAQ](https://coachvox.ai/faqs/)) — the closest existing instance
  of the founder's "small fee, Stripe-style" model.
- **Trust:** contractual — "used only for your AI model… never share it
  between models," with a carve-out to "improve our processes… technology or
  infrastructure" ([FAQ](https://coachvox.ai/faqs/)). Platform reads everything.
- **Representation:** prose in (articles, books, transcripts), chat out —
  per-coach RAG corpus. No schema.

### The rest of the cohort, compressed
- **Personal AI** ([personal.ai](https://www.personal.ai/faqs)): editable
  per-source "memory stack" — semi-structured blocks, but recall-only; no
  aggregation, no marketplace.
- **Kajabi** shipped **Kajabi MCP** (2026): structured, agent-queryable via
  MCP — but it exposes *commerce records* (offers, orders, contacts), not
  expertise; Expert Agents are the usual content-RAG persona
  ([netinfluencer](https://www.netinfluencer.com/kajabi-launches-mcp-integration-to-connect-ai-tools-directly-to-creator-business-accounts/)).
- **Meta AI Studio / Character.ai / Grok companions:** no creator payout for
  knowledge; entertainment personas; Meta's first-party personas shut down
  Jan 2025, Grok companions retiring 2026
  ([NBC](https://www.nbcnews.com/tech/social-media/meta-ai-insta-shuts-character-instagram-fb-accounts-user-outcry-rcna186177),
  [TechCrunch](https://techcrunch.com/2025/07/21/groks-ai-companions-drove-downloads-but-its-latest-model-is-the-one-making-money)).
- **Category churn is high:** Wisdom → acquired into Noom Vibe; AnyQuestion →
  absorbed by WHOOP (anyquestion.com 301s to whoop.com, verified live)
  ([uktech.news](https://www.uktech.news/funding/vc-funding/wisdom-noom-vibe-20240828),
  [Pitchbook](https://pitchbook.com/profiles/company/498226-69)). Underpricers
  (Personify at 0% commission, BuddyPro) attack Delphi/Coachvox on price with
  the same RAG shape.

## 2. Platform knowledge stores (OpenAI · Anthropic · Google · Poe)

- **GPT Store / custom GPTs:** knowledge files = OpenAI vector stores +
  `file_search` (chunk, embed, hybrid retrieval —
  [retrieval guide](https://developers.openai.com/api/docs/guides/retrieval)).
  The Jan-2024 **builder revenue program never publicly shipped** — still a
  closed US pilot 2.5 years later ("We are not currently accepting additional
  builders" — [OpenAI forum](https://community.openai.com/t/what-is-the-status-with-gpt-store-revenue-share/839172));
  energy pivoted to Apps SDK commerce, itself beta-gated. Consumer-tier chats
  with GPTs are trainable by default; builder-level opt-out exists
  ([GPTs data-privacy FAQ](https://help.openai.com/en/articles/8554402-gpts-data-privacy-faqs)).
  Uploaded knowledge files are **extractable by end users** (documented:
  [The Decoder](https://the-decoder.com/openais-custom-chatgpts-might-let-users-download-your-uploaded-knowledge-files/),
  [Cato](https://www.catonetworks.com/blog/how-to-steal-intellectual-property-from-gpts/)).
- **Claude Skills / plugins / MCP directory:** knowledge = markdown + files +
  scripts with progressive disclosure — no index, no query layer
  ([Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)).
  **No official monetization for skill authors** (paid-"Skills Marketplace"
  claims trace only to SEO farms — unverified); distribution is free/OSS
  GitHub marketplaces. Skills are explicitly excluded from ZDR; commercial
  tiers no-train by default ([consumer-terms update](https://www.anthropic.com/news/updates-to-our-consumer-terms)).
- **NotebookLM:** shared/featured notebooks = citation-grounded RAG over
  bounded sources; **no monetization** (paid tier gets analytics only); the
  strongest consumer no-training stance — "will not be used to directly train
  our foundational AI models" ([Google support](https://support.google.com/notebooklm/answer/17004255?hl=en),
  [public notebooks](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-public-notebooks/)).
- **Poe (Quora) — the one shipped knowledge-author revenue program among
  majors:** creator-set **price-per-message** plus up to $20/subscriber
  referral, live since Apr 2024, earnings dashboard, 23 regions
  ([Poe blog](https://poe.com/blog/new-on-poe-creator-monetization-via-price-per-message)).
  Representation is still RAG-with-citations; human-only consumption.
- **ElevenLabs Agents:** per-agent RAG KB; non-Enterprise tiers **train by
  default unless opted out** ([Deepgram review](https://deepgram.com/learn/elevenlabs-security-review-enterprise-guide));
  voice-library royalties prove the payout rail exists, but not for knowledge.

## 3. Vertical expert-systems SaaS

- **UpToDate (Wolters Kluwer):** 7,600+ commissioned physician authors;
  evidence-graded prose monographs + 2025 GenAI retrieval on top; $579/yr
  subscription; contributor compensation unpublished, no open marketplace
  ([about](https://www.wolterskluwer.com/en/solutions/uptodate/about),
  [Expert AI release](https://www.wolterskluwer.com/en/news/uptodate-expert-ai-genai-clinical-decision-support)).
- **BRYTER / Josef (legal no-code):** genuine non-technical authoring of
  **executable rule/decision-tree logic** — the strongest "computable expert
  knowledge" UX found — but app-shaped (input → decision → document), not an
  aggregable database, and **no platform marketplace**: firms monetize
  through their own client relationships and keep 100%
  ([bryter.com](https://bryter.com/blog/monetizing-law-firm-innovation/),
  [joseflegal.com](https://joseflegal.com/josef-no-code/)).
- **Blue J (tax) — the cautionary tale:** built **structured factor models**
  (questionnaire-encoded fact patterns → ML outcome prediction, ~90%
  accuracy claims), then pivoted its flagship to **generative RAG** over
  licensed corpora ([Tax Notes](https://www.taxnotes.com/featured-analysis/rise-robotic-tax-analyst/2022/12/30/7fh92),
  [OpenAI case study](https://openai.com/index/blue-j/)). Strong contractual
  trust: SOC 2 + signed no-train agreements with OpenAI/Google
  ([security](https://www.bluej.com/security)).
- **XOi (trades) — the sleeper:** a real schema (assets × 100+ attributes ×
  18M+ jobs, 85k models / 150+ manufacturers) an agent could aggregate over —
  but captured as **workflow exhaust**, not deliberately authored, and the
  technician earns nothing ([xoi.io](https://xoi.io/)); $230M growth round
  2025 ([pulse2](https://pulse2.com/xoi-profile-aaron-salow-interview/)).
- **Education (CogniSpark, Khanmigo):** document-upload → tutor persona;
  prose; no expert economics.

## 4. Vector-KB-as-a-service

All five examined (CustomGPT.ai, Chatbase, Pinecone Assistant, Vectara,
Ragie) are SaaS subscriptions with **no marketplace and no owner earnings**;
all are similarity-retrieval over embedded chunks; all pledge no-training
contractually; **none offers E2E** — the trust ceiling is customer-managed
keys: **Pinecone CMEK** (Enterprise, AWS KMS —
[docs](https://docs.pinecone.io/guides/production/configure-cmek)) and
**Vectara BYOK** (Scale plan, per-corpus keys, VPC/on-prem —
[security](https://www.vectara.com/legal/security-at-vectara)). Ragie adds
plain-language **entity extraction** (structured extraction exists, surface
is still retrieval — [ragie.ai](https://www.ragie.ai/)). Sources also:
[customgpt.ai/security](https://customgpt.ai/security/),
[chatbase.co/security](https://www.chatbase.co/security).

## 5. Nearest misses to the wedge — who holds which corner

| Corner | Closest player | What they have | What they lack |
|---|---|---|---|
| Structured representation | **Pinecone Nexus** (public preview 2026-07): "Manifests" turn raw docs into "organized, queryable knowledge artifacts" at setup time; benchmark ~90% vs 65% RAG baseline ([SiliconANGLE](https://siliconangle.com/2026/07/02/pinecone-releases-nexus-public-preview-bring-business-knowledge-ai-agents/)) | Setup-time curation beats query-time RAG | Engineering-team audience; distillation of docs, not expert authoring; zero monetization |
| Positioning | **Skill Refinery** (Apr 2026): "the Shopify model for expert knowledge" — IP → "skill cards" served over MCP, creator storefronts ([release](https://news.marketersmedia.com/matt-cretzman-launches-skill-refinery-to-deliver-expert-knowledge-inside-ai-tools/89187750)) | The pitch, MCP delivery, subscriptions | Cards are procedural units — no relational schema, no aggregation; early, PR-heavy, no published split |
| Monetization mechanics | **Paydog** ([paydog.app](https://paydog.app/)): "package your expertise as a paid AI server" — per-query/$12-mo/one-time, OAuth-gated MCP | Pay-per-answer over MCP | Representation is "indexed, vectorized documents" — prose |
| Holding structured expert data | **XOi** / **Kajabi MCP** / **Ragie extraction** (§3–§4) | Real schemas or extraction | Not marketed as expertise, no deliberate authoring, no expert earnings |

Marketplace-economics reference points: Pickaxe creators keep 90–92%
([pickaxe.co](https://pickaxe.co/sell-your-ai)); Poe price-per-message (§2);
Coachvox ~10%; general AI-marketplace cuts run 15–30%
([fast.io](https://fast.io/resources/top-ai-agent-marketplaces/)).

### §5b. Kill-test addendum (2026-08-05, second pass — founder-requested)

The founder's admission criterion: *"if there are exactly similar then maybe
we shouldn't invent."* A dedicated refutation sweep (10 search phrasings +
direct fetches of every candidate) **found no exact clone — ~85% confidence.**
No product combines non-technical authoring with a computable schema; the
market splits into two lanes that never intersect:

- **Expert-monetization lane (prose inside):** Skill Refinery (50/50 split;
  MCP tools are `search_skills`/`get_skill`/`list_skills` — a retrieval
  catalog, not a database; PR-driven, no independent traction —
  [site](https://www.mattcretzman.com/skill-refinery)) · Paydog (Stripe-style
  creator pricing, **waitlist-stage**, showcased numbers are mockups —
  [paydog.app](https://paydog.app/)) · Kopai (per-message, 70% to creator,
  tiny live traction — [Product Hunt](https://www.producthunt.com/products/kopai-the-marketplace-for-ai-agents)) ·
  PLM Network (70/20/10 RAG-container royalties, press-release-driven —
  [cioinfluence](https://cioinfluence.com/machine-learning/startup-launches-first-ai-knowledge-clearinghouse-paying-experts-royalties-for-ai-use-of-their-work/)).
- **Structured-data-monetization lane (no authoring):** **OnDB** — the most
  similar mechanics found and the likeliest convergence threat: paid
  per-query endpoints over real schemas (Postgres/ClickHouse/…, HTTP-402
  settlement, "if it has a schema, it works") but sellers must *bring* a
  database; early-access, data-vendor audience ([ondb.ai](https://www.ondb.ai/)) ·
  datapoint.market (agents buy datasets, x402/USDC, alpha) · Human
  Native→Cloudflare pay-per-crawl content licensing.

Big-platform check: Google plans a Q4-2026 *agent* marketplace, Anthropic's
marketplace sells enterprise tools, OpenAI bills agent usage — none pays
experts for knowledge ([TNW](https://thenextweb.com/news/google-cloud-next-ai-agents-agentic-era)).
The x402 agentic-payment rail (Coinbase/Cloudflare) is an accelerant, not a
competitor. **Timing read:** the two half-lanes are converging monthly
(Kopai ~06/2026, PLM 07/2026, Nexus 07/2026, OnDB early access) — the
white-space window is quarters, not years.

## 6. Synthesis — four findings

1. **The representation gap is real and category-wide.** Every expertise
   platform and every KB service stores prose for similarity recall. The
   only structured, agent-queryable data found anywhere is commerce records
   (Kajabi MCP) or workflow exhaust (XOi) — never deliberately-authored
   expertise. *"A tutor's error taxonomy an agent can `GROUP BY`"* has no
   incumbent.
2. **Trust is marketed everywhere, substantiated nowhere.** Best-in-class is
   a contractual no-train pledge — and the biggest brand's legal documents
   are *weaker* than its marketing (Delphi's perpetual sublicensable license
   + "improve Delphi's models" reservation vs "never used for training"
   copy). The technical ceiling across the whole landscape is
   enterprise-gated customer-managed keys (Pinecone CMEK, Vectara BYOK).
   Nobody can say "we cannot read it" — so a platform that *could* say
   something materially stronger, truthfully, has an open lane. nlqdb's
   floor is already unusual: schema-only LLM egress
   ([`GLOBAL-037`](../decisions/GLOBAL-037-schema-only-llm-egress.md)) plus
   FSL self-host.
3. **Creator-economy demand is proven; platform promises are not.** Delphi
   (Sequoia $16M, a 7-figure creator) proves professionals pay to package
   expertise and consumers pay to use it. The GPT Store proves the
   anti-pattern: a dangled revenue program that never shipped burns creator
   trust. Poe proves shipped, boring, per-message payouts work. Lesson for
   the fee pillar: **real, disclosed, boring — never dangled.**
4. **The counter-current is the risk to respect.** The market has repeatedly
   moved *away* from structure toward prose+LLM — Blue J abandoned its factor
   models for RAG; UpToDate layered GenAI on prose instead of structuring it
   — because structured authoring cost experts too much. The 2025–2026
   counter-counter-current (Nexus's setup-time curation winning 90% vs 65%)
   says structure wins on quality *when authoring is cheap*. That is exactly
   nlqdb's bet: the NL interface + interview-style extraction is what makes
   structure affordable to a non-technical expert.

## 7. Threats fed to `docs/competitors.md`

Only one entrant touches nlqdb's *current* lanes: **Pinecone Nexus**
(structure-first knowledge artifacts for agents, P2-adjacent) — added to
`docs/competitors.md` §4. The clone cohort (Delphi, Coachvox) and Skill
Refinery/Paydog compete only with the *future* expert-knowledge platform,
not with any shipped nlqdb surface; they are tracked here, not in the
threat matrix, until that vision is promoted.

## How to update this file

Re-verify before promoting the vision to a feature (postures and pricing
change fast; Delphi's take-rate story changed within 2025–26 alone). Keep
≤ 20 KB per `D4` — compress or shard §1–§4 before adding new categories.
