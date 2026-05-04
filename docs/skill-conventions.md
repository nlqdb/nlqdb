# Skill Conventions

How we structure `.claude/skills/` so every feature has one canonical place
for its decisions, and so agents (Claude Code, cold subagents, humans) load
the right context before touching code.

## 0. Why skills exist

Long reference docs (`docs/architecture.md`, `docs/runbook.md`) describe the system as a whole. They are
the wrong place to look up "what decisions govern this one feature I am
about to edit." Skills are that place.

A skill is **mandatory pre-reading** for any change that touches the
feature it covers — including changes that *might* affect it indirectly
(see the `when-to-load.globs` field).

## 1. File layout

```
.claude/skills/
├── _index.md                      # one-line summary of every skill, status, links
├── <feature-name>/
│   └── SKILL.md                   # canonical decisions + scope for this feature
└── …
```

One folder per feature. `<feature-name>` is kebab-case, matches the SK-ID
prefix (`auth` → `SK-AUTH-001`), and is stable — renames break every
breadcrumb pointing at it, so don't.

Skills have no "imports." If a decision applies to multiple features it is
**duplicated verbatim** into every relevant skill (see §4).

## 2. Decision IDs

Two namespaces, both globally unique:

- `GLOBAL-NNN` — cross-cutting decisions that apply to multiple features.
  Canonical text lives in `docs/decisions.md` and **only there**. Skills
  that are affected reference the GLOBAL by ID; they don't duplicate the
  decision body. (See §5.)
- `SK-<FEATURE>-NNN` — decisions local to one feature. Canonical text lives
  in that feature's `SKILL.md`. Numbering is per-feature, monotonic, and
  sticky — never renumber.

IDs are immutable once a skill cites them. If a decision is reversed,
add a new ID (`SK-AUTH-014` supersedes `SK-AUTH-007`) and mark the old one
`Status: superseded by SK-AUTH-014`. Don't delete.

## 3. SKILL.md template

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
**Cross-refs:** docs/architecture.md §X · docs/runbook.md §Z · GLOBAL-NNN, GLOBAL-MMM (canonical text in docs/decisions.md)

## Touchpoints — read this skill before editing

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

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list
below names the rules that constrain this feature; any skill-local
commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
  - *In this skill:* <skill-local note — only when the skill adds a
    feature-specific implication. Omit the bullet entirely if there's
    nothing skill-local to say.>
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
`docs/decisions.md`. Skills don't repeat these fields — they reference
the GLOBAL by ID (see §5).

Optional: `Source:` line on `SK-*` blocks that points at where the
long-form rationale lived before the skill existed.

## 5. Single source of truth (reference, don't duplicate)

`GLOBAL-NNN` decisions live in `docs/decisions.md` and **only there**. A
skill affected by a GLOBAL adds a line to its `## GLOBALs governing
this feature` section like:

```markdown
- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
  - *In this skill:* <skill-local implication, only when there is one>
```

The skill names the ID + title and adds skill-local commentary if the
GLOBAL has a non-obvious implication for this feature ("this is a
mutation, so the dedupe store keys on `(user_id, key)`"; "the create
path emits four spans named exactly X / Y / Z / W"). When there's
nothing skill-local to say, the rule is just listed by ID.

**Why not duplicate the GLOBAL body into every skill that cites it?**
We tried that earlier ("anti-DRY by design"). It produced silent drift
across N skills every time a GLOBAL was edited, and the only way to
police it was a CI byte-identity check that itself needed maintenance.
Modern agent context windows easily fit `docs/decisions.md` alongside a
SKILL.md; the duplication was a workaround for a 2024-era constraint
that no longer binds.

To find every skill affected by a GLOBAL: `grep -rn 'GLOBAL-005'
.claude/skills/`.

## 6. When to add a skill

Every feature gets a skill, even if the feature is not yet implemented:

- **Implemented:** populate fully. Every decision from
  `docs/architecture.md` (incl. §10 phase plan) and `docs/runbook.md`
  that bears on this feature gets a `SK-*-*` ID and a full decision
  block.
- **Partial:** populate the implemented decisions; mark the gaps under
  *Open questions*.
- **Planned:** stub only — frontmatter, status `planned (Phase X)`, scope,
  and a placeholder *Decisions: TBD when implemented*. Stubs exist so the
  ID prefix is reserved and `_index.md` is comprehensive.

When a new feature is conceived, the skill folder is created **before**
the first line of code lands. The PR that introduces the feature also
introduces the skill, with at least one decision in it.

## 7. Quality gates (run before any PR that touches a skill)

These are grep-driven, no tooling needed:

1. **Every `SK-*` decision cites a core value.** Search every `### SK-`
   block; each one has a `- **Core value:**` line.
2. **Every `SK-*` decision has all five fields.** Decision / Core value
   / Why / Consequence / Alternatives.
3. **GLOBALs are referenced, not duplicated.** No `### GLOBAL-NNN`
   block under `.claude/skills/` — only one-liner references in the
   `## GLOBALs governing this feature` section. Verify with
   `grep -rn '^### GLOBAL-' .claude/skills/` (should print nothing).
4. **No broken cross-refs.** `docs/architecture.md §4.1` style references
   resolve to a real heading.
5. **`when-to-load.globs` matches real paths.** A glob pointing at a
   non-existent directory is a sign the skill is stale or the feature
   moved (planned skills are an explicit exception).

A new skill that fails any of these is a draft, not a skill.

## 8. Where to look first

- `.claude/skills/_index.md` — table of every skill, status, top-level scope.
- `docs/decisions.md` — canonical text of every `GLOBAL-NNN`.
- Root `AGENTS.md` — the before-editing path map (which paths require
  which skills) and the three behavioral principles.
- Per-area `AGENTS.md` (`apps/<x>/AGENTS.md`, `packages/<x>/AGENTS.md`,
  `cli/AGENTS.md`) — local subset of the path map, plus area-specific
  commands.
