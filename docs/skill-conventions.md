# Skill Conventions

How we structure `.claude/skills/` so every feature has one canonical place
for its decisions, and so agents (Claude Code, cold subagents, humans) load
the right context before touching code.

## 0. Why skills exist

Long reference docs (`docs/design.md`, `docs/implementation.md`,
`docs/plan.md`, `docs/runbook.md`) describe the system as a whole. They are
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
  Canonical text lives in `docs/decisions.md`. Each skill that is affected
  copies the decision inline with a `source:` line back to `decisions.md`.
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
**Cross-refs:** docs/design.md §X · docs/implementation.md §Y · docs/runbook.md §Z

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
- **Source:** canonical here · also referenced in docs/design.md §4.1

### GLOBAL-005 — Every mutation accepts Idempotency-Key
<duplicated verbatim from docs/decisions.md#GLOBAL-005>
- **Source:** docs/decisions.md#GLOBAL-005

## Open questions / known unknowns

- <bullets>
```

## 4. Decision-block format (the five fields are mandatory)

Every decision — `GLOBAL-*` or `SK-*-*` — must have all five fields:

1. **Decision:** one declarative sentence. What we will do.
2. **Core value:** one or more values from `docs/design.md §0` cited by
   name (Free, Open source, Simple, Effortless UX, Seamless auth, Fast,
   Creative, Goal-first, Bullet-proof, Honest latency). Every decision is
   anchored to at least one.
3. **Why:** the reasoning. The forces that pushed us here. Why the
   obvious alternative is worse.
4. **Consequence in code:** the concrete invariant or constraint this
   creates. What a reviewer should reject if violated.
5. **Alternatives rejected:** one line each, with the reason. Future
   readers will rediscover these — pre-empt the rediscovery loop.

Optional: `Source:` line that points at where the decision is canonical
(for duplicated GLOBALs) or where the long-form rationale lived before
the skill existed.

## 5. Duplication rule (anti-DRY by design)

If a decision affects N features, copy it into all N skill files. Every
copy carries:

```
- **Source:** docs/decisions.md#GLOBAL-NNN
```

This is intentional. A cold agent loading `SK-AUTH` should see every rule
that constrains auth, even rules that "really live" elsewhere. Cost: when
a GLOBAL changes, the duplicates must change with it. We pay that with
the sync rule in the root `AGENTS.md`: any edit to `docs/decisions.md`
requires updating every skill that copies the affected GLOBAL, in the
same PR.

To find duplicates: `grep -rn 'GLOBAL-005' .claude/skills/`. To enforce
sync, the byte-identity check runs on every push and PR:

```bash
bun scripts/check-skill-globals.ts          # verify
bun scripts/check-skill-globals.ts --fix    # mechanically realign
```

## 6. When to add a skill

Every feature gets a skill, even if the feature is not yet implemented:

- **Implemented:** populate fully. Every decision from
  `docs/design.md` / `docs/implementation.md` / `docs/plan.md` /
  `docs/runbook.md` that bears on this feature gets a `SK-*-*` ID and a
  full decision block.
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

1. **Every decision cites a core value.** Search every `### SK-` and
   `### GLOBAL-` block; each one has a `- **Core value:**` line.
2. **Every decision has all five fields.** Decision / Core value / Why /
   Consequence / Alternatives.
3. **Every duplicated GLOBAL carries a `Source:` line** pointing at
   `docs/decisions.md#GLOBAL-NNN`.
4. **No broken cross-refs.** `docs/design.md §4.1` style references
   resolve to a real heading.
5. **`when-to-load.globs` matches real paths.** A glob pointing at a
   non-existent directory is a sign the skill is stale or the feature
   moved.

A new skill that fails any of these is a draft, not a skill.

## 8. Where to look first

- `.claude/skills/_index.md` — table of every skill, status, top-level scope.
- `docs/decisions.md` — canonical text of every `GLOBAL-NNN`.
- Root `AGENTS.md` — the before-editing path map (which paths require
  which skills) and the three behavioral principles.
- Per-area `AGENTS.md` (`apps/<x>/AGENTS.md`, `packages/<x>/AGENTS.md`,
  `cli/AGENTS.md`) — local subset of the path map, plus area-specific
  commands.
