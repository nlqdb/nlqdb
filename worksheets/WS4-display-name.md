# WS4 — Display-name helper + table-header title casing

**Branch:** `claude/ws4-display-name` off `origin/main` (PR #146 / SK-ASK-014 already landed in `132768c`).
**SK-ID:** none new — registered as one-line *Consequence in code* additions under `SK-HDC-001` and `SK-WEB-005`. Pure-UI convention, no tradeoffs worth a 5-field block.
**Hard deps:** none. **Soft deps:** none. Parallel-safe.

## Goal

User-visible names today expose the random 6-hex suffix from the `db_<slug>_<6hex>` orchestrator-minted id. Three surfaces leak it:

- `CreateForm.tsx:180` renders `{result.db}` → `db_orders_tracker_a4fxyz`
- `CreateForm.tsx:183` renders `{result.schemaName}` → `orders_tracker_a4fxyz`
- `ChatPanel.tsx:530,677` + `LeftRail.tsx` render `slug` → `orders-tracker-a4fxyz`

This worksheet introduces a single `displayName(dbId)` helper, surfaces it on the SDK's `DatabaseSummary` shape, and renders it everywhere a human reads a name. The `dbId` stays the wire identifier; `slug` stays for URL contexts where global uniqueness matters; `displayName` is what humans read.

Also: LLM-emitted snake_case table/column names (`order_items`, `customer_id`) render raw in result tables today. Adds a `prettifyHeader()` UI helper that title-cases them at the render layer.

## Pre-read (mandatory)

- `CLAUDE.md` — root, esp. §2 P5 (simplify), §8 (quality gates)
- `docs/features/hosted-db-create/FEATURE.md` — SK-HDC-001 (where the dbId format is owned)
- `docs/features/web-app/FEATURE.md` — for SK-WEB-005 (chat reply shape)
- `apps/api/src/databases/list.ts` — current `deriveSlug` lives here; `displayName` lands next to it
- `packages/sdk/src/index.ts` — `DatabaseSummary` type to extend
- `apps/web/src/components/CreateForm.tsx` — primary hero surface
- `apps/web/src/components/chat/{ChatPanel,LeftRail,Data}.tsx` — chat surfaces

## Interface contract

```ts
// apps/api/src/databases/list.ts
//
// db_orders_tracker_a4fxyz → "orders tracker"
//
// Strips the orchestrator-minted `db_` prefix and the trailing
// `_<6 lowercase hex>` suffix that `defaultRandomSuffix()` in
// build-deps.ts emits. ids that don't match the pattern
// (legacy / hand-inserted rows) fall back to the slug form.
export function displayName(dbId: string): string;
```

```ts
// packages/sdk/src/index.ts
export type DatabaseSummary = {
  id: string;
  slug: string;            // unchanged — URL/technical
  displayName: string;     // NEW — what humans read
  // ...existing fields
};
```

```ts
// apps/web/src/lib/text.ts (new)
//
// snake_case → "Snake case" / kebab-case → "Kebab case".
// Used by CreateForm + chat/Data table headers for LLM-emitted
// identifiers. Idempotent on already-title-cased input.
export function prettifyHeader(identifier: string): string;
```

## Files to create

| Path | Purpose |
|---|---|
| `apps/api/src/databases/list.test.ts` | Unit tests for `displayName` (round-trip + edge cases) |
| `apps/web/src/lib/text.ts` | `prettifyHeader` helper |
| `apps/web/src/lib/text.test.ts` | Unit tests for `prettifyHeader` |

## Files to modify

| Path | Change |
|---|---|
| `apps/api/src/databases/list.ts` | Add `displayName()` export. Add `displayName` field to `DatabaseSummaryRow`; populate in `toSummary()`. |
| `apps/api/src/index.ts` | `GET /v1/databases` and `POST /v1/ask kind=create` response builders include `displayName`. (After PR #146 lands, this is one extra field on `formatCreateJsonResponse` and the list-databases handler.) |
| `packages/sdk/src/index.ts` | Add `displayName: string` to `DatabaseSummary`; add `displayName` to `AskCreateResult`. |
| `apps/web/src/lib/api.ts` | Add `displayName: string` to `CreateResult`. |
| `apps/web/src/components/CreateForm.tsx` | Render `result.displayName` (NOT `result.db`) in the result header. Drop the `<code>{result.schemaName}</code>` line (technical noise — moved into the trace/details expander if it exists, else delete). Apply `prettifyHeader` to `<th>{c}</th>` in `SampleTable`. |
| `apps/web/src/components/chat/ChatPanel.tsx` | `chat-main__header` shows `activeDb?.displayName ?? "All databases"`. "Created database" message in `ReplyView` uses `created.displayName`. `deriveSlugFromId` → derive `displayName` for the optimistic post-create summary. `Reply.state.created` carries `displayName` not `dbSlug`. |
| `apps/web/src/components/chat/LeftRail.tsx` | Render `displayName` in the rail list items; keep `slug` only as a hover-title (`title={db.slug}`) for power users who recognize the URL form. |
| `apps/web/src/components/chat/Data.tsx` | Apply `prettifyHeader` to column headers in the result table. |
| `docs/features/hosted-db-create/FEATURE.md` | Add to SK-HDC-001 *Consequence in code* (one line, nested): "Surfaces render `displayName(dbId)` for human-readable names; `slug` stays for URL/technical contexts." |
| `docs/features/web-app/FEATURE.md` | Add to SK-WEB-005 *Consequence in code* (one line): "Result-table column headers are rendered through `prettifyHeader()` so LLM-emitted snake_case identifiers display as `Title Case`." |

## Implementation notes

1. **Suffix regex.** `defaultRandomSuffix()` in `build-deps.ts` emits 6 lowercase-hex chars from `crypto.randomUUID()`. The strip regex is `/_[a-f0-9]{6}$/`. Anything not matching falls back to `deriveSlug()` minus the `db_` prefix, with underscores → spaces. Test: legacy id `db_foo` → `"foo"`; hand-inserted `weirdname` → `"weirdname"`.
2. **Per-row migration.** No D1 migration needed. `displayName` is derived from `id` on every read; the column doesn't exist. If a future feature adds a user-editable display name, add the column then; today it's a pure projection.
3. **Title-casing rules.** `prettifyHeader("order_items")` → `"Order items"` (sentence case, NOT title case per Unicode UAX #29 — too aggressive on acronyms like `id`/`url`). `"customer_id"` → `"Customer id"`. Numbers preserved (`v2_table` → `"V2 table"`). Already-pretty input (`"Customer ID"`) round-trips unchanged.
4. **No backwards-compat shims.** Per CLAUDE.md §2 P5, drop the now-unused `schemaName` render from `CreateForm`. If a surface needs it later for a "show SQL" expander, add it as a `<details>`-gated trace row at that time.
5. **`deriveSlugFromId` in ChatPanel.** This duplicates `deriveSlug` from `apps/api/src/databases/list.ts`. Replace the inline copy with an import from a shared `apps/web/src/lib/names.ts` (or re-export through SDK). Same applies if any other surface dupes the derivation.

## Tests required

- `displayName("db_orders_tracker_a4fxyz")` → `"orders tracker"`
- `displayName("db_a4fxyz")` → `"a4fxyz"` (no slug, only suffix-shaped — keep whole)
- `displayName("legacy_no_prefix")` → `"legacy no prefix"` (fallback path)
- `displayName("db_x_999000")` → `"x"` (numeric-only hex tail)
- `prettifyHeader("customer_id")` → `"Customer id"`
- `prettifyHeader("v2_orders")` → `"V2 orders"`
- `prettifyHeader("Already Title")` → `"Already Title"` (idempotent)
- Snapshot test on `CreateForm` post-success renders: assert no `_a4fxyz`-shaped substring leaks into rendered HTML.

## Acceptance criteria

- [ ] `displayName()` + `prettifyHeader()` shipped with full test coverage.
- [ ] `DatabaseSummary.displayName` and `AskCreateResult.displayName` round-trip API → SDK → React.
- [ ] No `_[a-f0-9]{6}` substring appears in any user-facing rendered string across CreateForm, ChatPanel, LeftRail. (Add a Playwright/Vitest assertion if a UI-test harness exists; otherwise note in PR description and verify manually.)
- [ ] SK-HDC-001 and SK-WEB-005 *Consequence* lines added.
- [ ] §8 quality gates green: `bun run typecheck && bun run lint && bun run test`.
- [ ] Bundle budget (GLOBAL-013): `prettifyHeader` is < 200 bytes minified; `displayName` is < 200 bytes. No new deps.

## Out of scope

- Server-side editable display names. Today's helper is a pure projection.
- Localization of `prettifyHeader` (English-only word splitting). Comment the function to flag i18n as a future concern.
- Renaming the existing `slug` field. It stays — only `displayName` is added.
