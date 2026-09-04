# Acquisition channels — venue mechanism notes

Companion shard to [`acquisition-channels.md`](acquisition-channels.md) (D4
split, 2026-08-12). The lean ledger table + tallies + "why this order" live in
that file; this shard holds the detailed **P2-verified mechanism notes and
parked founder payloads** for the heaviest venues, keyed by ledger row number.
When a row's inline status cell would grow past a one-line summary, relocate the
detail here and leave a `→ mechanism → [notes](acquisition-channels-mechanisms.md#row-N)`
pointer in the table — **relocate intel, never delete it**.

## Row #12

**Coding-agent in-repo artifacts** (Claude Code skill, Cursor rules, AGENTS.md, Codex) · key `agent-artifacts`

Artifacts served at `nlqdb.com/agent-artifacts/*`, surfaced to the coding-agent
read channel (R-04 docs guide + `llms.txt` `## For coding agents`), **and now
one-command installable**: `npx skills add https://github.com/nlqdb/nlqdb/tree/main/apps/web/public/agent-artifacts/nlqdb-memory`
(vercel-labs/skills CLI — re-verified by running it 2026-07-27, universal
install serves 17 hosts — pulls the skill from the public repo into
`.agents/skills/nlqdb-memory/SKILL.md`, which Cursor and Codex read directly,
plus a `.claude/skills/` symlink for Claude Code; no account, no publish. It
writes **no** Cursor rule and **no** `AGENTS.md` entry, so an `AGENTS.md`-only
host still needs the by-hand snippet). Every outbound link in every artifact
carries the key (the docs-guide primary link since 2026-07-26, via the rule-1
forwarder + the drift test covering both hosts). The `npx` line itself is a
github.com URL (not utm-taggable, like row #10), but a developer who installs it
lands on the skill's tagged links. Yield 0 pending real agent traffic; **live**
only when `/app/admin` shows an `agent-artifacts` visit. Still unattributable by
design: `claude mcp add` → browser OAuth reaches an account without loading an
apex page at all, so an agent that never clicks a link converts as `untracked`.

**Next step:** grow reach: `skills.sh` has **no submission flow** (P2
2026-07-23: the leaderboard is built from anonymous `npx skills` install
telemetry — skills appear automatically from real installs, no account, no
review), so the only remaining levers are organic install yield (populates the
leaderboard itself) + npm. **npm now carries it: 2026-07-27 the install command
moved onto `@nlqdb/mcp`'s README — the page npmjs.com renders — taking the
published surfaces 3 → 4** (site guide, `llms.txt`, artifacts index, package
page), pinned by `packages/mcp/test/readme.test.ts` and shipped to the registry
by the next patch (0.1.1, release PR #826; latest served is still 0.1.0). Next:
a headless `npx -y @nlqdb/mcp` config beside the browser-OAuth one *inside* the
artifacts — they still document the hosted route only.

## Row #20

**Integration marketplaces** (Supabase, Vercel templates, Neon partners, Astro) · key = venue slug (`supabase`, `vercel`, …)

Mechanisms P2-verified, all founder/build-gated; each a real referring domain
(astro.build / neon.com / vercel.com DR ~93) once shipped. **Astro (08-09):**
npm-publish with `astro-integration` keyword → `withastro/astro` issue
([docs](https://docs.astro.build/en/guides/integrations/)); blocked,
`@nlqdb/astro` is `private`. **Neon (08-10):** formal OAuth/API business
partnership via support/partner channels ([partners](https://neon.com/partners))
— account-walled → founder; authentic fit (nlqdb runs on Neon). **Vercel
Templates (08-10):** account-walled form, or a `vercel/examples` **GitHub PR**
needing MIT `LICENSE` + template `README`/`package.json` + a Vercel-hosted demo
URL ([examples](https://github.com/vercel/examples)) — agent-buildable, not a
one-run diff; MIT on the starter only, nlqdb stays FSL-1.1 (`GLOBAL-019`).
**Supabase (08-11):** Partner Catalog apply form at
[`supabase.com/partners`](https://supabase.com/partners)
([marketplace docs](https://supabase.com/docs/guides/platform/marketplace)) —
gates on **business viability** (registration + bank account, revenue, or VC
backing) + own T&C/Privacy/AUP + a Supabase-free name; account+business-walled →
founder, may not clear at $0 revenue. Fit is BYO-only (a Supabase user connects
their Postgres as a BYO source; nlqdb runs on Neon). **Sweep complete — all four
founder/build-gated, none agent-shippable as a one-run diff.**

**Next step:** **Astro:** withastro/astro issue on publish (`?utm_source=astro`).
**Neon:** founder opens partnership. **Vercel:** build Next.js-on-nlqdb starter +
demo, then PR/form (`?utm_source=vercel`). **Supabase:** founder applies once
viability bar clears (`?utm_source=supabase`).

## Row #22

**Claude Code plugin** (own git marketplace → Anthropic `claude-community`) · key `claude-plugin`

nlqdb is its own marketplace: `.claude-plugin/marketplace.json` at the repo root
lists one plugin whose source *is* `apps/web/public/agent-artifacts`, so
`/plugin marketplace add nlqdb/nlqdb` + `/plugin install nlqdb-memory@nlqdb`
wires the hosted MCP server **and** both R-07 skills in one step, with zero
copies to drift (verified end-to-end on the Claude Code CLI: validate passes, 2
skills + 1 MCP server). No account, no review, permanent — the whole channel is
agent-shippable, unlike every R-05 registry. The key rides `plugin.json`'s
`homepage`, the one link `/plugin` surfaces; the bundled skills keep
`agent-artifacts` (row #12), so plugin-install yield and skill-install yield
stay separable. **Two downstream venues need nothing from us:**
[claudemarketplaces.com](https://claudemarketplaces.com/about) (~300 k monthly
visitors) crawls GitHub **daily for `.claude-plugin/marketplace.json`** — no
submission exists — and SkillsMP crawls every public repo for `SKILL.md`. **One
needs a human:** Anthropic's `claude-community` marketplace (in-product `/plugin`
Discover tab) takes only a signed-in form (`clau.de/plugin-directory-submission`)
— **founder submitted 2026-08-05, pending Anthropic review** (platforms = Claude
Code only). `claude-plugins-official` is curated with **no application process**
— nothing to submit, ever.

**Next step:** watch `/app/admin` for `claude-plugin` yield → live; re-verify
crawl pickup at R-08 (2026-08-22).

## Row #25

**LobeHub MCP Marketplace** ([`lobehub.com/mcp`](https://lobehub.com/mcp)) · key `lobehub`

**untried — account-walled, founder-gated** (P2 2026-08-12). The **largest** MCP
directory surfaced this sweep (~56 k servers listed vs the official registry's
~2 k), absent from this ledger until now. **Mechanism (P2, publish doc
`market.lobehub.com/s/publish-mcp` 403s to anonymous fetch — consistent with the
gate):** submit via the `@lobehub/market-cli` CLI —
`lhm plugin submit https://github.com/nlqdb/nlqdb` — whose documented flow is
**login → GitHub ownership verification → new listing → `lhm.plugin.json`
manifest → publish → verify**. The `login` step is a LobeHub-account wall
(OAuth), so it is **founder work**, not agent-shippable; ownership-verify passes
trivially (we own `nlqdb/nlqdb`). **Not confirmed to auto-ingest the official
registry** — the market is CLI-submitted + curated (community additions go
through manual `[Request]`-style issues on `lobehub/lobehub`, an out-of-scope
repo), so a manual submit is required to appear *and* to carry our key
regardless. Sources: <https://lobehub.com/docs/usage/community/mcp-market>,
<https://market.lobehub.com/s/publish-mcp>,
[lobehub/lobehub#14133](https://github.com/lobehub/lobehub/issues/14133).

**Next step (founder):** `npx @lobehub/market-cli` →
`lhm plugin submit https://github.com/nlqdb/nlqdb`, login + verify ownership,
follow the CLI's `lhm.plugin.json` scaffold (read the exact current schema off
the publish doc at submit time), set the listing name to the brand line
(`nlqdb — your autonomous DBA`), description per `GLOBAL-041`, and
the homepage/link field to `https://nlqdb.com/agents/?utm_source=lobehub`; on
submit → in-flight, note the listing URL, then watch `/app/admin` for `lobehub`
yield → live.

## Row #26

**ExplainX.ai MCP directory** ([`explainx.ai/mcp-servers`](https://explainx.ai/mcp-servers)) · key `explainx`

**untried — account-walled, founder-gated** (P2 2026-08-17). A ~2 000-server MCP
directory that markets itself as the "best integrated discovery" for MCP servers
+ instruction-based skills (browse by category / stars / popularity; install into
Cursor, VS Code, Claude Desktop). **Mechanism (P2):** the footer links
`/submission-guidelines`, which routes submissions through the **`/submit` flow
(account required)** and requests *name, summary, category, tags, install command
pattern, and SKILL.md-style content*; submissions are pending/approved/rejected
(explicitly "not a security audit, endorsement, or quality certification"). The
guidelines also state listings "may be created or updated through internal
tooling, data partners, or public sources in addition to (or instead of) a
self-serve submission flow" — a possible ingest path — **but measured live this
cycle nlqdb is absent** (`explainx.ai/mcp-servers/nlqdb` → HTTP 404; not in site
search) ~26 days after the official-registry publish, so the narrow-cascade
finding holds: a manual submit is required to appear *and* to carry our key. The
account wall makes it **founder work**, not agent-shippable. Contact
`support@explainx.ai`. Sources:
<https://explainx.ai/mcp-servers>, <https://explainx.ai/submission-guidelines>,
<https://www.explainx.ai/blog/top-10-mcp-server-directories-2026>.

**Next step (founder):** sign in at `explainx.ai`, run the `/submit` flow, set
the name to the brand line (`nlqdb — your autonomous DBA`),
description per `GLOBAL-041`, install command pattern
`claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp` (strings owned
by `mcp-install.ts`), and the website/link field to
`https://nlqdb.com/agents/?utm_source=explainx`; on submit → in-flight, note the
listing URL, then watch `/app/admin` for `explainx` yield → live.

## Row #27

**cc-marketplace** ([`ananddtyagi/cc-marketplace`](https://github.com/ananddtyagi/cc-marketplace) → [`claudecodecommands.directory`](https://claudecodecommands.directory)) · key `github` ref (repo-linked; `ccdir` reserved for a homepage field if one surfaces)

**blocked-by-human** — cross-repo PR / account-walled, founder-gated (P2
2026-09-03); founder-queued 2026-09-04 as
[blocked-by-human #4](../blocked-by-human.md). A
688★, actively maintained (68 commits, ~28 open PRs) community directory of
Claude Code plugins + commands, built by @ananddtyagi and fronted by
`claudecodecommands.directory` (one-click `/plugin marketplace add
ananddtyagi/cc-marketplace`, then install). **Trust check (skillsclaude.org
lesson):** passes — real independent footprint (688 GitHub stars, named
maintainer with a public presence, cited across multiple 2026 MCP/plugin
directory round-ups), unlike the zero-footprint, security-flagged
skillsclaude.org that was dropped 2026-08-05. **Mechanism (P2):** submission is a
**cross-repo GitHub PR** to `ananddtyagi/cc-marketplace` per
[`PLUGIN_SCHEMA.md`](https://github.com/ananddtyagi/cc-marketplace/blob/main/PLUGIN_SCHEMA.md)
— add a plugin entry, validation runs automatically via GitHub Actions and a
failed validation blocks merge — plus a web form at
`claudecodecommands.directory/submit`. This session is scoped to `nlqdb/nlqdb`
only, so the cross-repo PR is **out of scope** (like the awesome-mcp-servers #10
and Cline #24 PRs, both founder-submitted). Not a registry crawler: it takes
explicit submissions and does not auto-ingest arbitrary public repos (contrast
SkillsMP, which crawls every repo for `SKILL.md`), so nlqdb will not appear on
its own. The directory renders **internal command pages** and links the repo,
not a homepage we control, so realistic yield is `github`-ref (repo-linked, no
utm key), same class as #24 Cline; reserve `?utm_source=ccdir` only if the
plugin.json `homepage` field surfaces as an outbound link in the listing.
Sources: <https://github.com/ananddtyagi/cc-marketplace>,
<https://github.com/ananddtyagi/cc-marketplace/blob/main/PLUGIN_SCHEMA.md>,
<https://claudecodecommands.directory>.

**Parked payload** — the `nlqdb-memory` plugin, strings owned by
`.claude-plugin/plugin.json` + `mcp-install.ts` (never hand-typed):
- **name:** `nlqdb-memory` · **version:** `0.1.0` (match the shipped
  `.claude-plugin/plugin.json`) · **license:** `FSL-1.1-ALv2` (GLOBAL-019)
- **description (lead with memory, SK-PIVOT-003):** `Persistent, queryable
  memory for your agent: a real Postgres it asks in plain English over MCP, so it
  can GROUP BY / JOIN / aggregate over what it remembered instead of recalling
  the nearest few rows. Bundles the hosted MCP server plus two skills.`
- **repository:** `https://github.com/nlqdb/nlqdb` · **author:** `nlqdb`
- **homepage (only if the submission accepts one):**
  `https://docs.nlqdb.com/agent-memory/?utm_source=ccdir`
- **install line (if a command field is asked for):**
  `/plugin marketplace add nlqdb/nlqdb` → `/plugin install nlqdb-memory@nlqdb`

**Next step (founder or a repo-unscoped agent):** open the cross-repo PR to
`ananddtyagi/cc-marketplace` (or the `claudecodecommands.directory/submit` form)
with the parked payload above; on submit → in-flight, note the listing URL, then
watch `/app/admin` for `github`-ref yield.
