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
**Status:** scaffolded (Phase 2) — site is live with stub pages (Quickstart, HTTP API, SDK, MCP, CLI). Real content is per-section follow-up work, tracked under *Open questions* below.
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

## Slicing (SK-DOCS-003 implementation)

| Slice | Source | Target page(s) | Tool | Effort |
|---|---|---|---|---|
| a | `packages/sdk/src/**.ts` | `/reference/sdk/` | TypeDoc + `typedoc-plugin-markdown` → MDX | ~1 h |
| b | `examples/<name>/README.md` + code | `/tutorials/<name>/` | Astro `import` or remark-import; one page per `examples/<name>/` | ~2 h |
| c | `nlq help --json` | `/cli/` | Build script that shells out + writes MDX | ~1 h |
| d | `apps/api/openapi.yaml` (TODO: schema does not yet exist) | `/reference/http-api/` | Widdershins or Redocly Markdown | ~half day; blocked on schema |
| e | `tests/personas/P*/run.ts` transcripts | `/tutorials/<persona>/walkthrough/` | Playwright `--reporter=markdown` + screenshot embed | ~1 day; optional, slice b probably covers 90% |

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-013** — Free-tier bundle budget. *In this feature:* the static-assets build must fit Workers' free-tier limits (no Workers script execution per request — assets only).
- **GLOBAL-017** — One way to do each thing. *In this feature:* one docs site, one host. Don't fork "internal" vs "external" docs sites — internal stays in-repo, external is `docs.nlqdb.com`.

## Open questions / known unknowns

- **Quickstart content.** The 60-second walkthrough copy is stub. Decision deferred until the Phase 1 hosted-`db.create` flow lands so the steps are real, not aspirational.
- **HTTP API reference auto-gen vs hand-written.** OpenAPI schema does not yet exist in the repo; hand-write a minimal reference now, revisit auto-gen if/when the schema is published.
- **Search.** Starlight's built-in Pagefind covers v0. Algolia DocSearch (free for OSS) is the upgrade path if/when content grows past ~50 pages.
- **Analytics.** Cloudflare Web Analytics (free, no SDK) is the plan — wire it up alongside `apps/web` in the same task; see `docs/research/email-and-marketing.md §4`.
