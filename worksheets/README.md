# Worksheets

## Active batch — hero-chat hardening (WS4-WS8)

Five work-streams that together fix the hero-create flow's three live issues
(slow create, ugly random-suffix names, no auth gate). All branch off
`origin/main` (PR #146 / `SK-ASK-014` already landed in `132768c`).

| WS | Title | Owner branch | Hard deps | Soft deps |
|---|---|---|---|---|
| [WS4](./WS4-display-name.md) | `displayName(dbId)` helper + table-header title casing | `claude/ws4-display-name` | none | none |
| [WS5](./WS5-ask-handler-perf.md) | `/v1/ask` perf + cap-accounting fixes (parallel reads, engine override for anon, recordCreate-after-success) | `claude/ws5-ask-handler-perf` | none | none |
| [WS6](./WS6-neon-batch-provisioner.md) | Neon `sql.transaction([...])` batch provisioner (SK-HDC-012) | `claude/ws6-neon-batch` | none | none |
| [WS7](./WS7-sk-anon-012-doc.md) | SK-ANON-012 documentation — per-device 1-create cap → `auth_required`; supersedes SK-ANON-007 (doc-only) | `claude/ws7-sk-anon-012-doc` | none | none |
| [WS8](./WS8-sk-anon-012-impl.md) | SK-ANON-012 implementation — cap rekey + auth-redirect envelope + post-signin replay | `claude/ws8-sk-anon-012-impl` | **WS7 + WS5** | WS4 |

**Parallel groups:**

- **Group A (all parallel):** WS4, WS5, WS6, WS7. Touch disjoint file regions (or doc-only). Land independently in any order.
- **Group B (sequential after Group A):** WS8. Hard deps on WS7 (the SK-ID it implements) and WS5 (the `peekAnonCreateGate` / `commitAnonCreate` split it builds on).

SK-IDs reserved in this batch:

- **SK-HDC-012** — Provisioner batches DDL+RLS+sample inserts in one Neon HTTP transaction (WS6).
- **SK-ANON-012** — Per-device 1-create cap → `auth_required` envelope; supersedes SK-ANON-007 (WS7 documents; WS8 implements).

### Merge sequence guide

This is the order to land the branches. Each step is gated on the previous one's PR being **merged to main** (not just open).

```
              ┌─────────── PR #146 (SK-ASK-014) merged ───────────┐
              │                                                    │
              ▼                                                    ▼
     ┌─── Group A (parallel) ───────────────────────────┐
     │                                                  │
     ▼                ▼                ▼                ▼
   WS4              WS5              WS6              WS7
 display          perf+cap         neon-batch       SK-ANON-012
                                                     doc (review!)
     │                │                │                │
     └────────────────┴────────────────┴────────────────┘
                                 │
                                 ▼
                       ┌─── Group B ───┐
                       │               │
                       ▼               ▼
                     WS8 SK-ANON-012 impl
```

**Recommended day-by-day cadence:**

1. **Day 0+.** Kick off four cold agents in parallel — WS4, WS5, WS6, WS7. Each starts from a freshly-fetched `origin/main`.
2. **Day 1.** Review WS7 first (it's doc-only, the smallest review, but gates WS8). Sign off on the SK-ANON-012 decision text. Land WS7.
3. **Day 1-2.** Review + land WS4 (low risk). Then WS5 (touches `index.ts` — verify no regression with WS7's decision change). Then WS6 — note the gating integration test against a Neon dev branch; if it fails, the fallback path (WebSocket Pool) lands in the same PR with a one-line SK-HDC-012 amendment.
4. **Day 2-3.** Kick off WS8 cold agent. Branch off main (which now has WS4+WS5+WS6+WS7). Land WS8.
5. **Day 3+.** Canary deploy, smoke test the full hero arc per WS8's *Production smoke* acceptance criteria.

**Conflict-resolution rules:**

- WS5 and WS8 both touch `apps/api/src/index.ts`. WS5 lands first — WS8 inherits the `peekAnonCreateGate` / `commitAnonCreate` split as a load-bearing seam.
- WS4 and WS8 both modify `apps/web/src/pages/auth/...`. WS4 doesn't touch those files; only WS8 adds `post-signin.astro`. No conflict.
- WS6 and WS5 both touch `apps/api/src/db-create/...`. WS5 modifies `orchestrate.ts` (engine override); WS6 modifies `neon-provision.ts` and `build-deps.ts`. No conflict.
- WS7 and WS8 both touch `docs/features/anonymous-mode/FEATURE.md`. WS7 adds the SK-ANON-012 block; WS8 only edits cross-refs in SK-ANON-011 and SK-ASK-009. WS7 must land first.

**If a cold agent's PR fails to rebase cleanly on main:** stop, ask for review. Do not force-resolve conflicts on a multi-agent flow — the conflict often signals a missed dep.

### Background — why this work

CF Workers wall-time analytics for `/v1/ask kind=create` over a 30-min sample showed p50 = 8-14 s, p99 > 12 s. CPU time < 200 ms; the rest is awaited I/O dominated by (a) Neon HTTP per-statement round trips during provisioning (~4-8 s), (b) the schema-inference LLM call (~2-3 s), (c) classifier LLM (~700 ms when not skipped). WS5 + WS6 together drop the floor to ~3-4 s.

Separately, the user reported "weird names/slugs" leaking into the UI (WS4 fix) and "1 call then auth in the hero" as a product requirement (WS7/WS8). Full diagnosis + research receipts in the thread that produced this batch.

### Skill prereads (mandatory, per worksheet)

Every worksheet's cold agent reads:

- `CLAUDE.md` — root
- `docs/skill-conventions.md` (SK-* block format)
- The specific FEATURE.md the worksheet touches (each worksheet lists them)
