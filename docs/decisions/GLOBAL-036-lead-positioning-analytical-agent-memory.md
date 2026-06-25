# GLOBAL-036 — Lead positioning: analytical memory for AI agents (dual front door)

- **Decision:** nlqdb's lead go-to-market wedge is **analytical memory for
  AI agents** — a real, queryable database (full NL→SQL: `GROUP BY`,
  `JOIN`, `HAVING`, subqueries, aggregations; the agent can also create and
  migrate its own schema) that an agent uses as memory, positioned against
  fact-retrieval memory layers (Mem0, Zep, Letta, LangMem) and vector
  stores. The wedge is delivered through **two front doors**:
  1. **`nlqdb.com` stays a coherent generalist site**, but its home leads
     with the agent-memory narrative and demotes the other three personas
     (P1 solo builder · P3 analyst · P4 backend engineer) to an
     *"also works for…"* sub-section. No off-wedge page is deleted — the
     Supabase/Vanna/Wren AI/AskYourDatabase/Outerbase comparison pages and
     their solve pages keep earning SEO/AEO coverage; they are reordered and
     framed as secondary, not removed.
  2. **A dedicated `/agents` landing is the deep, single-story front door**
     external links (Hacker News, Reddit, Discord, MCP directories) point
     at — the multi-competitor capability matrix, the typed-plan trust
     boundary, the self-host/BYO-key angle, and one live demo.
  The moat we **lead with is what is true today**: real analytical SQL over
  structured rows + the **typed-plan trust boundary** (LLM emits JSON → our
  compiler emits SQL → `libpg_query` re-validates → diff preview before any
  write), plus the honest open/free angle under **FSL-1.1** (self-hostable
  for non-competing use, bring-your-own-LLM key at 0% markup, no per-call
  fees, no pricing page). The **full headline reposition** (wordmark
  tagline, `README` H1, `llms.txt` lede, `SoftwareApplication` JSON-LD
  description) was sequenced **last and founder-gated**; the founder
  **tripped that gate on 2026-06-24** (SK-PIVOT-013 in the feature doc), so
  all four lead strings now lead with the wedge. Every prior slice shipped
  **additively**, so the reposition reverts in a single `git revert` if the
  funnel doesn't follow.

- **Core value:** Goal-first, Creative, Free, Open source, Honest latency

- **Why:** Agent memory is the one adjacent category where nlqdb does
  something the funded incumbents **structurally cannot** without rebuilding
  their storage layer: Mem0/Zep/Letta store facts in vector DBs and retrieve
  them; they cannot `GROUP BY` or `JOIN`. nlqdb already *is* a database, so
  "analyze your agent's memory, don't just recall it" is a category
  distinction, not a feature race (`docs/research/deepseek-moat-framing.md`).
  The repo already carries the angle as a pillar (a Mem0 `/vs` page, a
  `give-ai-agent-persistent-memory` solve page, a carousel slide, persona P2
  in `docs/research/personas.md`) — so this is a **reweighting**, not a
  rebuild, which is why it ships through additive surfaces and a daily-loop
  backlog rather than a big-bang relaunch. The dual front door resolves the
  standing tension `docs/competitors.md §gap-analysis` names — the
  four-persona spread is "either a moat or a focus problem" — by giving the
  wedge a focused home (`/agents`) without throwing away the generalist
  SEO surface. Leading on the **true** moat (analytical SQL + typed-plan
  trust) rather than an aspirational one (Apache-2.0 + `docker compose up`,
  not yet shipped) keeps the claim honest while the self-host container is
  pulled forward.

- **Consequence in code & docs:**
  - A new feature owns the rollout:
    [`docs/features/agent-memory-pivot/FEATURE.md`](../features/agent-memory-pivot/FEATURE.md)
    (prefix `SK-PIVOT-NNN`), with a sequenced, daily-loop-sized worksheet
    backlog under `worksheets/`. The §5 path map in
    [`AGENTS.md`](../../AGENTS.md) gains the feature's globs.
  - Every new wedge surface obeys the existing machinery: comparison pages
    via `competitors.ts` (`SK-CMP-*`), solve pages via `solve.ts`
    (`SK-SOLVE-*`), demand-signal on every CTA (`GLOBAL-024`), analytics via
    `GLOBAL-034`. New competitors are anchored in `docs/competitors.md`
    before their page ships.
  - The wedge feeds the **waitlist** as a demand signal alongside the open
    product. Messaging ships; the engine bar is not re-escalated.
  - The headline reposition (WS-13) was the single founder-gated worksheet
    (last in the sequence). **Tripped 2026-06-24 — see SK-PIVOT-013.** The
    follow-on home-flow reposition (the home's PROOF, not just its headline,
    leads the wedge) tripped in the same session — **see SK-PIVOT-014**: the
    hero's primary action becomes the SK-WEB-016 `<McpInstall>` row
    (SK-WEB-017 supersedes SK-WEB-002's "one input IS the hero" in place;
    the no-signup-wall floor + morph-to-chat are retained as a secondary
    affordance), the `Demo.astro` beat shows the agent loop instead of the
    generalist orders table, and the dual-front-door seam to the generalist
    flow is one quiet `.alsoworks` line below the three beats linking
    `/app/new` (one click away, never on the main canvas). The off-wedge
    `/vs` + `/solve` pages and `/integrations` still keep the generalist
    umbrella reachable.
  - The open/free angle is messaged under **FSL-1.1** truthfully — see
    [`GLOBAL-019`](./GLOBAL-019-apache2-open-source-core.md), whose stale
    "Apache-2.0 today" wording is corrected to "FSL-1.1-ALv2,
    source-available, auto-converts to Apache-2.0" in the same effort.

- **Alternatives rejected:**
  - **Full reposition now** (swap the hero/README/llms.txt to lead with
    agent memory immediately) — an irreversible brand bet placed *before*
    the wedge content (matrix, `/agents` page, demo) exists; high risk for
    no extra signal versus shipping the content first.
  - **Drop the off-wedge pages** to fully commit — discards live SEO/AEO
    surface (six `/vs` + five solve pages) that costs nothing to keep and
    still converts adjacent searchers; focus is achievable by reordering.
  - **Single generalist door only** (reweight home, no `/agents` page) — a
    blended home converts the agent-builder reader worse than a dedicated
    single-story landing; the deep page is the artifact HN/Discord links
    want.
  - **Lead on "Apache-2.0 / self-host / `docker compose up`"** (the framing
    doc's literal pitch) — false today: the license is FSL-1.1 and no
    self-host image has shipped. Leading on an unshipped claim violates
    Honest latency; we lead on the true moat and pull the container forward
    to make the self-host claim land later.
  - **Promote nothing; leave it a research doc** — keeps the strongest wedge
    unowned and undated, so it never ships; a daily-loop backlog is what
    turns the thesis into merged PRs.

## Reconciliation with existing decisions

- [`GLOBAL-019`](./GLOBAL-019-apache2-open-source-core.md) — open-source
  core. This GLOBAL leans on it for the anti-VC angle, and corrects its
  stale "Apache-2.0 today" wording to the accurate FSL-1.1→Apache shape.
- [`GLOBAL-024`](./GLOBAL-024-demand-signal-telemetry.md) — every new wedge
  CTA emits the typed demand-signal event (the waitlist is the conversion).
- [`GLOBAL-025`](./GLOBAL-025-north-star.md) — KPI advanced is **onboarding**
  (a sharper wedge lifts landing→waitlist conversion) and **UX** (clearer
  story); **engine quality and performance are untouched** by messaging work.
- [`GLOBAL-033`](./GLOBAL-033-resolution-defaults.md) — the three strategy
  bets this GLOBAL encodes (pivot intensity, open/free framing, fate of the
  off-wedge personas) were founder-resolved 2026-06-16; tactical follow-ons
  are agent-decidable from the worksheets.
