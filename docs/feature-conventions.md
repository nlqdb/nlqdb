# Feature Conventions

How we structure `docs/features/` so every feature has one canonical place
for its decisions, and so agents (Claude Code, cold subagents, humans) load
the right context before touching code.

## 0. Why feature docs exist

Long reference docs (`docs/architecture.md`, `docs/runbook.md`) describe the system as a whole. They are
the wrong place to look up "what decisions govern this one feature I am
about to edit." Feature docs are that place.

A `FEATURE.md` is **mandatory pre-reading** for any change that touches the
feature it covers — including changes that *might* affect it indirectly
(see the `when-to-load.globs` field).

## 1. File layout

```
docs/features/
├── <feature-name>/
│   ├── FEATURE.md                   # canonical decisions + scope for this feature
│   └── decisions/                   # optional: one file per SK-* once the feature
│       └── SK-<PREFIX>-NNN-<slug>.md  # crosses CLAUDE.md D4's 20 KB ceiling
└── …
```

One folder per feature. `<feature-name>` is kebab-case, matches the SK-ID
prefix (`auth` → `SK-AUTH-001`), and is stable — renames break every
breadcrumb pointing at it, so don't.

Feature docs have no "imports." If a decision applies to multiple features
it is referenced by `GLOBAL-NNN` ID (see §5), never duplicated.

**Sharding (when `FEATURE.md` crosses 20 KB).** CLAUDE.md `D4` caps every
markdown file at 20 KB. Small features keep all decisions inline in
`FEATURE.md`. When the accumulating decision bodies would push the file
over the cap, extract the bodies into a sibling `decisions/` directory —
one file per `SK-*-*`, named `<ID>-<slug>.md` (e.g.
`SK-AUTH-007-cookie-cache-with-kv-revocation.md`) — and rewrite the
`## Decisions` section of `FEATURE.md` as an index of links (see §3).
The directory mirrors the `docs/decisions/` pattern used for GLOBALs.
The decision IDs and the five-field block format are unchanged; only
the file boundary moves.

For an example of the sharded shape, see
[`docs/features/auth/`](features/auth/).

## 2. Decision IDs

Two namespaces, both globally unique:

- `GLOBAL-NNN` — cross-cutting decisions that apply to multiple features.
  Canonical text lives in `docs/decisions/GLOBAL-NNN-<slug>.md` (one
  file per decision) and **only there**. The index in
  `docs/decisions.md` links to every GLOBAL by ID. Features that are
  affected reference the GLOBAL by ID; they don't duplicate the
  decision body. (See §5.)
- `SK-<FEATURE>-NNN` — decisions local to one feature. Canonical text lives
  in that feature's `FEATURE.md`. Numbering is per-feature, monotonic, and
  sticky — never renumber. ("SK" is a historical prefix retained for ID
  stability; treat it as opaque.)

IDs are immutable once a feature cites them. If a decision is reversed,
add a new ID (`SK-AUTH-014` supersedes `SK-AUTH-007`) and mark the old one
`Status: superseded by SK-AUTH-014`. Don't delete.

## 3. FEATURE.md template

```markdown
---
name: <feature-name>
description: <one sentence — Claude uses this to decide when to load>
when-to-load:
  globs:
    - apps/api/src/routes/auth/**
    - packages/auth-internal/**
  topics: [auth, login, session, refresh]
---

# Feature: <Name>

**One-liner:** <what this feature is>
**Status:** implemented (Slice N) | partial | planned (Phase X)
**Owners (code):** <paths>
**Cross-refs:** docs/architecture.md §X · docs/runbook.md §Z · GLOBAL-NNN, GLOBAL-MMM (canonical text in docs/decisions/GLOBAL-NNN-<slug>.md; index in docs/decisions.md)

## Touchpoints — read this feature doc before editing

- <path glob 1>
- <path glob 2>

## Decisions

### SK-AUTH-001 — <Title>

- **Decision:** <one sentence>
- **Core value:** Simple, Bullet-proof
- **Why:** <paragraph>
- **Consequence in code:** <what this means concretely>
- **Alternatives rejected:** <one line each>
- **Source:** canonical here · also referenced in docs/architecture.md §4.1

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../decisions/) (one file per
GLOBAL; index in [`docs/decisions.md`](../decisions.md)). The list
below names the rules that constrain this feature; any feature-local
commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
  - *In this feature:* <feature-local note — only when the feature adds a
    feature-specific implication. Omit the bullet entirely if there's
    nothing feature-local to say.>
- **GLOBAL-014** — OTel span on every external call.

## Open questions / known unknowns

- <bullets>
```

## 4. Decision-block format (the five fields are mandatory)

Every `SK-*-*` decision must have all five fields:

1. **Decision:** one declarative sentence. What we will do.
2. **Core value:** one or more values from `docs/architecture.md §0` cited by
   name (Free, Open source, Simple, Effortless UX, Seamless auth, Fast,
   Creative, Goal-first, Bullet-proof, Honest latency). Every decision is
   anchored to at least one.
3. **Why:** the reasoning. The forces that pushed us here. Why the
   obvious alternative is worse.
4. **Consequence in code:** the concrete invariant or constraint this
   creates. What a reviewer should reject if violated.
5. **Alternatives rejected:** one line each, with the reason. Future
   readers will rediscover these — pre-empt the rediscovery loop.

The same five fields are required for `GLOBAL-NNN` blocks in
`docs/decisions/GLOBAL-NNN-<slug>.md`. Feature docs don't repeat these
fields — they reference the GLOBAL by ID (see §5).

Optional: `Source:` line on `SK-*` blocks that points at where the
long-form rationale lived before the feature doc existed.

### 4a. Sharded layout (when `FEATURE.md` would cross 20 KB)

Once the decision bodies push `FEATURE.md` over CLAUDE.md `D4`'s 20 KB
cap, extract each `### SK-*-*` body into a sibling file under
`decisions/` and replace the inline `## Decisions` section with a link
index:

```markdown
## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-<PREFIX>-NNN`. The list below is the index; open the linked file for the full five-field block.

- [**SK-AUTH-001**](decisions/SK-AUTH-001-better-auth-on-workers-d1.md) — Better Auth on Workers + D1 is the auth library.
- [**SK-AUTH-002**](decisions/SK-AUTH-002-sign-in-methods.md) — Sign-in methods at launch: magic link, passkey, GitHub, Google. No passwords, ever.
```

Each shard file is a self-contained five-field block with an `# SK-*-*`
H1 title (the ID + decision name on one line). IDs, numbering, and the
five-field requirement (§4) are unchanged — only the file boundary
moves. `docs/features/auth/` is the working example. The same pattern
applies to GLOBALs (`docs/decisions/GLOBAL-NNN-<slug>.md`) — feature
shards are the local equivalent.

## 5. Single source of truth (reference, don't duplicate)

`GLOBAL-NNN` decisions live in `docs/decisions/GLOBAL-NNN-<slug>.md`
(one file per decision) and **only there**. The index in
`docs/decisions.md` links to every GLOBAL by ID. A feature affected by
a GLOBAL adds a line to its `## GLOBALs governing this feature`
section like:

```markdown
- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
  - *In this feature:* <feature-local implication, only when there is one>
```

The feature names the ID + title and adds feature-local commentary if the
GLOBAL has a non-obvious implication for this feature ("this is a
mutation, so the dedupe store keys on `(user_id, key)`"; "the create
path emits four spans named exactly X / Y / Z / W"). When there's
nothing feature-local to say, the rule is just listed by ID.

**Why not duplicate the GLOBAL body into every feature that cites it?**
We tried that earlier ("anti-DRY by design"). It produced silent drift
across N features every time a GLOBAL was edited, and the only way to
police it was a CI byte-identity check that itself needed maintenance.
Modern agent context windows easily fit a single GLOBAL shard
alongside a FEATURE.md; the duplication was a workaround for a
2024-era constraint that no longer binds.

To find every feature affected by a GLOBAL: `grep -rn 'GLOBAL-005'
docs/features/`.

## 6. When to add a feature doc

Every feature gets a `FEATURE.md`, even if the feature is not yet implemented:

- **Implemented:** populate fully. Every decision from
  `docs/architecture.md` (incl. §10 phase plan) and `docs/runbook.md`
  that bears on this feature gets a `SK-*-*` ID and a full decision
  block.
- **Partial:** populate the implemented decisions; mark the gaps under
  *Open questions*.
- **Planned:** stub only — frontmatter, status `planned (Phase X)`, scope,
  and a placeholder *Decisions: TBD when implemented*. Stubs exist so the
  ID prefix is reserved.

When a new feature is conceived, the folder is created **before**
the first line of code lands. The PR that introduces the feature also
introduces the `FEATURE.md`, with at least one decision in it.

**Adding a new feature — checklist:**

1. Create `docs/features/<feature-name>/FEATURE.md` from the §3 template.
2. Add the path-glob → feature mapping to root [`AGENTS.md`](../AGENTS.md) §5
   and the relevant per-area `AGENTS.md`.
3. Reserve the SK-ID prefix (e.g. `SK-NEW-FEATURE-NNN`); pick a
   monotonic numbering and never re-use IDs.

## 7. Quality gates (run before any PR that touches a feature doc)

These are grep-driven, no tooling needed:

1. **Every `SK-*` decision cites a core value.** Search every `### SK-`
   block; each one has a `- **Core value:**` line.
2. **Every `SK-*` decision has all five fields.** Decision / Core value
   / Why / Consequence / Alternatives.
3. **GLOBALs are referenced, not duplicated.** No `### GLOBAL-NNN`
   block under `docs/features/` — only one-liner references in the
   `## GLOBALs governing this feature` section. Verify with
   `grep -rn '^### GLOBAL-' docs/features/` (should print nothing).
4. **No broken cross-refs.** `docs/architecture.md §4.1` style references
   resolve to a real heading.
5. **`when-to-load.globs` matches real paths.** A glob pointing at a
   non-existent directory is a sign the feature doc is stale or the feature
   moved (planned features are an explicit exception).

A new `FEATURE.md` that fails any of these is a draft, not a feature doc.

## 8. Where to look first

- `docs/features/` — one folder per feature; each `FEATURE.md` is canonical.
  The folder listing is the index (each `FEATURE.md`'s `Status:` line is
  the canonical status).
- `docs/decisions.md` — index of every `GLOBAL-NNN`; bodies live in
  `docs/decisions/GLOBAL-NNN-<slug>.md` (one file per decision).
- Root `AGENTS.md` — the before-editing path map (which paths require
  which feature docs) and the five behavioral principles.
- Per-area `AGENTS.md` (`apps/<x>/AGENTS.md`, `packages/<x>/AGENTS.md`,
  `cli/AGENTS.md`) — local subset of the path map, plus area-specific
  commands.
