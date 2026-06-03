---
name: docs-site
description: User-facing documentation site at `docs.nlqdb.com` — Astro Starlight on Cloudflare Workers Static Assets.
when-to-load:
  globs:
    - apps/docs/**
  topics: [docs, starlight, astro, documentation]
---

# Feature: Docs Site

**One-liner:** User-facing documentation site at `docs.nlqdb.com` — Astro Starlight on Cloudflare Workers Static Assets.
**Status:** partial (Phase 2) — site is live with the three autogen pipelines from SK-DOCS-003 wired (SDK reference, tutorials, CLI reference). `SK-DOCS-004` (every quickstart starts at key acquisition) is satisfied for `examples/html/` and the docs hero; the same Step-0 pattern is pending for the remaining `examples/<framework>/` READMEs. HTTP API reference (slice d) is blocked on `apps/api` emitting OpenAPI; persona-transcript embedding (slice e) is deferred per the slicing table.
**Owners (code):** `apps/docs/**`
**Cross-refs:** docs/architecture.md §3 (surfaces) · docs/phase-plan.md §2.7 · `apps/docs/AGENTS.md`

## Touchpoints — read this feature before editing

- `apps/docs/astro.config.mjs` (sidebar, integrations, site URL)
- `apps/docs/wrangler.toml` (custom-domain, assets binding)
- `apps/docs/src/content/docs/**` (page bodies, .mdx)
- `.github/workflows/deploy-docs.yml` (CI)

## Decisions

- **SK-DOCS-001** — Astro Starlight + Cloudflare Workers Static Assets.
  - **Decision:** The docs site is Astro Starlight (Astro 5 + `@astrojs/starlight`), built to static HTML, served by a Cloudflare Worker via Workers Static Assets (`apps/web` pattern). `custom_domain = true` in `wrangler.toml` auto-provisions DNS + cert for `docs.nlqdb.com`.
  - **Core value:** A docs site that ships in the same deploy flow as every other surface — `wrangler deploy` via GH Actions on every merge — with zero per-host glue.
  - **Why:** Astro is already in `apps/web`, so the toolchain is shared. Starlight is the Astro team's docs preset and handles search, sidebar, code blocks, dark mode out of the box. Workers Static Assets is the lighter sibling of Cloudflare Pages and is the platform Cloudflare is steering toward; it gives us one `wrangler deploy` per surface and one cert auto-provisioned via `custom_domain = true`, matching the `apps/mcp` pattern.
  - **Consequence in code:** New docs pages are `.mdx` files under `apps/docs/src/content/docs/`; the sidebar is hand-edited in `astro.config.mjs`. No Cloudflare adapter — Astro pre-renders everything. PRs that introduce a server-rendered route here fail review (the site must remain fully static so it can be served by Static Assets with no Worker code).
  - **Alternatives considered:**
    - **Mintlify** — best DX in the category, but $150/mo above 2 users; violates the `$0/mo while no paying customers` rule from `README.md §"Cost ladder"`.
    - **Docusaurus** — React-based; works, but Astro already in the stack means Starlight has zero new toolchain cost.
    - **Cloudflare Pages git integration** — `docs/history/ci-actions-repo-layout.md` documents the move *away* from Pages git integrations for `apps/web` and `packages/elements` in favour of GH-Actions-driven `wrangler deploy`; matching that pattern keeps the deploy model uniform across surfaces.

- **SK-DOCS-002** — User-facing content only; internal docs stay in the repo.
  - **Decision:** The site publishes only content useful to end-users of nlqdb: Quickstart, HTTP API reference, SDK reference, MCP setup, CLI reference. Internal `docs/` content (`decisions.md`, per-feature `FEATURE.md`, `runbook.md`, `phase-plan.md`, `architecture.md`, research notes) is **not** copied or imported into `apps/docs/`. It stays in the GitHub repo where the agent/feature workflow can edit it freely.
  - **Core value:** Public docs can move at marketing speed; internal docs can move at engineering speed; neither pollutes the other.
  - **Why:** Internal docs reference `GLOBAL-NNN` / `SK-*-NNN` IDs, hold cost/business context, and are written for agents and contributors. Surfacing them on a user-facing site invites confusion ("is this stable API?") and forces editorial overhead on every internal change.
  - **Consequence in code:** Reviewers reject PRs that symlink, import, or copy `docs/**` content into `apps/docs/`. Cross-links from the docs site to the repo are explicit GitHub URLs.
  - **Alternatives considered:** Single source of truth with selective rendering — rejected because the audiences want different prose styles; what reads as a precise decision record to an agent reads as opaque jargon to a user.

- **SK-DOCS-003** — Reference docs are auto-generated; hand-written prose is exception, not rule.
  - **Decision:** The site has five content layers, ordered by drift risk. (1) **HTTP API reference** ← generated from an OpenAPI schema once `apps/api/openapi.yaml` exists. (2) **SDK reference** ← generated from `packages/sdk/src/**.ts` via TypeDoc → Starlight MDX. (3) **CLI reference** ← generated from `nlq help --json` output via a build script. (4) **Tutorials** ← imported from `examples/<name>/` directories (the same examples our persona e2e tests already walk). (5) **Concepts / overview** ← hand-written, narrative, changes once a quarter. Reviewers reject PRs that hand-write what should land in layers 1–4. Slicing order: SDK reference (slice a, ~1 h) → tutorials from `examples/` (slice b, ~2 h) → CLI from `--help` (slice c, ~1 h) → OpenAPI HTTP reference (slice d, ~half day). Persona-transcript embeds are slice e and optional.
  - **Core value:** Docs match shipped behaviour because they are *derived from* shipped behaviour. The only way to make docs stale is to also break the source — which CI catches.
  - **Why:** Hand-written reference docs always drift, no matter how disciplined the team. The four sources above already exist (or will exist as the system matures) and already carry the canonical truth. The persona e2e suite (`tests/personas/P*`, `tests/opencheck/`) already walks the user journeys that tutorials describe; coupling the tutorial source to the tested example means a failing persona test blocks the docs deploy, so the tutorial cannot diverge silently from product behaviour.
  - **Consequence in code:** `deploy-docs.yml`'s `paths:` filter includes `packages/sdk/**`, `examples/**`, `cli/**`, and (later) `apps/api/openapi.yaml` so source changes trigger a docs rebuild. The build pipeline lives in `apps/docs/scripts/gen-{sdk,cli,api}.ts` (added per slice). Each stub MDX file currently in `src/content/docs/` carries an explicit `TODO: replace with autogen from <source>` line; removing the TODO without wiring autogen is a review-block.
  - **Alternatives considered:**
    - **Hand-written everything, with a "review docs every quarter" calendar reminder** — rejected; the calendar reminder is the team's pain, not the system's, and pain heuristics decay.
    - **Stainless / Speakeasy generated SDK + docs in one** — interesting once OpenAPI exists; defer until layer (1) is in place. Compatible with this decision, not a substitute.
    - **Notion / Mintlify with their built-in API reference** — Mintlify is hand-written too; the autogen story is about pipeline, not host. Host stays Starlight per `SK-DOCS-001`.

- **SK-DOCS-004** — Every quickstart starts at key acquisition; tutorials never paste a `pk_live_` placeholder without showing where the key comes from.
  - **Decision:** Every tutorial page on `docs.nlqdb.com` whose first runnable snippet contains an `api-key="pk_live_..."` placeholder MUST begin with a **Step 0 — Get your key** section that points the reader to `nlqdb.com`'s create flow, the sign-in adoption ([`SK-ANON-003`](../anonymous-mode/FEATURE.md)), and the chat's Copy snippet ([`SK-WEB-007`](../web-app/FEATURE.md)). This applies to the autogenerated tutorial pages from `examples/<name>/README.md` (`SK-DOCS-003` slice b) — the requirement lives in the example README's source, not in `gen-examples.ts`, so the autogen pipeline stays pure pass-through. The docs root (`apps/docs/src/content/docs/index.mdx`) carries "Get a key in 60s" as its first `<CardGrid>` item and as the hero's primary action.
  - **Core value:** Effortless UX, Goal-first, Bullet-proof
  - **Why:** The docs Quickstart card is the first link from `docs.nlqdb.com/`, but the canonical tutorial snippet says `api-key="pk_live_xxx"` and never explains where the key comes from. A fresh visitor following the documented path hits a chicken-and-egg: paste this HTML to get started — using a key you don't have yet. The marketing site has the create flow, but `docs.nlqdb.com` never points at it. Forcing key-acquisition as Step 0 in every tutorial closes that loop without restructuring the site or hand-writing concepts pages.
  - **Consequence in code:** `examples/html/README.md`'s first H2 is *Step 0 — Get your key (60 seconds)* pointing at `nlqdb.com` → sign-in → chat → Copy snippet. Other framework tutorials (`examples/react/`, `examples/vue/`, …) that paste a `pk_live_` follow the same shape; reviewers reject quickstart edits that drop Step 0 or reorder it below a copyable snippet. `apps/docs/src/content/docs/index.mdx` lists *Get a key in 60s* as its first `<CardGrid>` item and primary hero action.
  - **Alternatives considered:**
    - **Dedicated `/onboarding/get-a-key/` page linked from every tutorial.** Works but adds an extra click; the Step-0 inline approach keeps the read in one place.
    - **Restructure `docs.nlqdb.com` to host the create flow itself.** Forks the goal — the marketing site is `nlqdb.com`'s job; docs is reference + tutorials. Two sources of truth for "first 60 seconds" is worse than one.
    - **Hand-wave: "Get a key from the dashboard."** What the docs used to imply. Fails for fresh visitors who don't yet know `/app/keys` exists, and contradicts `SK-WEB-007`'s "the key is never a separate errand".

- **SK-DOCS-005** — Pre-alpha state is a hand-written page; every gated surface (HTML / curl / CLI / MCP / HTTP-API reference) links to it.
  - **Decision:** While [`GLOBAL-027`](../../decisions/GLOBAL-027-pre-alpha-gate.md) is active, a single page at `docs.nlqdb.com/pre-alpha/` carries the canonical gate explainer (stable lane targets, response envelope shape, waitlist CTA, invite-code paths for curl / CLI / SDK / MCP). Live lane *numbers* stay off the docs page and are sourced from `apps/api/src/gate/eval-baseline.ts` (the canonical SK-GATE-001 file) so a weekly cron PR doesn't ripple into the docs. Every other page that documents a gated surface adds a one-line `<Aside type="caution">` callout linking to `/pre-alpha/`; example READMEs that get autogenerated into tutorials add the same callout inline so the rendered tutorial matches. The page is sidebar-pinned with a `gated` badge. When both eval lanes clear, the removal PR (`pre-alpha-gate/FEATURE.md` *Open questions / Removal PR*) deletes this page, its sidebar entry, and the Asides in one diff — the gate removal becomes the deletion trigger.
  - **Core value:** Effortless UX, Honest latency, Bullet-proof
  - **Why:** Without this, a fresh visitor following [SK-DOCS-004](#sk-docs-004) lands on `nlqdb.com` → "Create the DB" → graceful `feature_gated` panel and concludes the docs lied about "60 seconds". The marketing UI is honest; the docs site was not. A single canonical page (rather than copy on every tutorial) keeps the lift cost ~zero when the gate evaporates — one delete instead of one delete per surface.
  - **Consequence in code:** `apps/docs/src/content/docs/pre-alpha.mdx` is the sole body. `astro.config.mjs` pins it first in the sidebar with `badge: { text: "gated", variant: "caution" }`. `index.mdx`, `mcp.mdx`, `reference/http-api.mdx` each carry a single `<Aside type="caution">` linking to `/pre-alpha/`. `examples/{html,curl,cli}/README.md` carry a one-paragraph Markdown callout that the autogen pipeline ([SK-DOCS-003](#sk-docs-003) slice b) renders verbatim. Reviewers reject hand-rewriting the gate envelope anywhere except `/pre-alpha/`.
  - **Alternatives considered:**
    - **One inline section on every page.** Drift risk: when the lane numbers change ([SK-GATE-001](../pre-alpha-gate/FEATURE.md)), every page needs an edit.
    - **Banner injected globally via Starlight `<head>` override.** Heavier change, harder to remove when the gate lifts, doesn't carry the invite-code envelope (it would link out anyway).
    - **Pre-alpha-only sub-site (`pre-alpha.nlqdb.com`).** Doubles hosting + DNS for a transient state — wasteful.

## Slicing (SK-DOCS-003 implementation)

| Slice | Source | Target page(s) | Tool | Status |
|---|---|---|---|---|
| a | `packages/sdk/src/**.ts` | `/reference/sdk/` | TypeDoc + `typedoc-plugin-markdown` → MDX via `apps/docs/scripts/gen-sdk.ts` | ✅ done — commit `d8d8bc5` |
| b | `examples/<name>/README.md` | `/tutorials/<name>/` | Build script `apps/docs/scripts/gen-examples.ts` (one page per `examples/<name>/`) | ✅ done — commit `d8d8bc5` |
| c | `nlq help --json` | `/cli/` | Build script `apps/docs/scripts/gen-cli.ts` (shells out to `nlq help --json`; relies on `internal/cmd/help.go`) | ✅ done — commit `d8d8bc5` |
| d | `apps/api/openapi.yaml` | `/reference/http-api/` | Widdershins or Redocly Markdown | ⏸ blocked on `apps/api` emitting OpenAPI — tracked under `ask-pipeline/FEATURE.md` Open questions |
| e | `tests/personas/P*/run.ts` transcripts | `/tutorials/<persona>/walkthrough/` | Playwright `--reporter=markdown` + screenshot embed | ⏸ deferred — slice b covers ~90 % |

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-013** — Free-tier bundle budget. *In this feature:* the static-assets build must fit Workers' free-tier limits (no Workers script execution per request — assets only).
- **GLOBAL-017** — One way to do each thing. *In this feature:* one docs site, one host. Don't fork "internal" vs "external" docs sites — internal stays in-repo, external is `docs.nlqdb.com`.
- **GLOBAL-034** — Analytics stack. *In this feature:* the docs site embeds the same Cloudflare Web Analytics beacon as `apps/web`; no separate analytics provider.

## Open questions / known unknowns

- **HTTP API reference (slice d).** Blocked on `apps/api` emitting an OpenAPI schema (tracked under `ask-pipeline/FEATURE.md` Open questions). The `/reference/http-api/` page currently links readers at the SDK reference, which carries the canonical wire shape per `GLOBAL-001`. When the schema lands, wire `apps/docs/scripts/gen-api.ts` (widdershins) and remove the placeholder.
- **Search.** Starlight's built-in Pagefind covers v0. Algolia DocSearch (free for OSS) is the upgrade path if/when content grows past ~50 pages.
- **Analytics** — Resolved by [`GLOBAL-034`](../../decisions/GLOBAL-034-analytics-stack.md): Cloudflare Web Analytics (free, no SDK). **Parked until** the `apps/web` analytics-wiring slice, which drops the same CF beacon `<script>` here in the same task.
