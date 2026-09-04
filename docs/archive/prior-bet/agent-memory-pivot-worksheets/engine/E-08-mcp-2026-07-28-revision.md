# E-08 — MCP 2026-07-28 revision migration (SDK v2 + stateless Workers path)

**Status:** ⬜ not started — **audited 2026-07-29, deliberately not shipped**
**Sequence:** Engine 8 of 8 · **Risk:** high · **Runs:** multi (~4, staged) · **Prereqs:** none technically; **gated on the trigger below** · **Gate:** founder-gated at step 3 (hosted transport = the live connector URL)

## Goal

Serve MCP revision **2026-07-28** on both `SK-MCP-001` transports, and take
the statelessness dividend on the Workers path: the hosted server stops
needing a Durable Object per OAuth grant, which is simpler *and* cheaper
under `GLOBAL-013`.

nlqdb's wedge is agent memory delivered over MCP. Being a current-revision
server is positioning, not hygiene — but only once it can be done without
betting the live connector on a same-week major.

## The audit (2026-07-29) — why this is a worksheet and not a PR

The revision is **final** (RC locked 2026-05-21, published 2026-07-28). The
blocker is not the spec, it is the SDK topology.

| Surface | What 2026-07-28 changes | Compliant today? | Blocker to upgrading |
|---|---|---|---|
| npm stdio (`packages/mcp`) | stateless core; `server/discover` MUST; no `initialize` | ✅ via fallback — clients probe `server/discover`, fall back to `initialize` | v1 SDK **will never** serve it; v2 = new package names + Node ≥ 20 + Zod 4 |
| hosted streamable-HTTP (`apps/mcp`) | sessions + `Mcp-Session-Id` removed; `Mcp-Method`/`Mcp-Name` headers; no SSE resumability | ✅ via fallback | stateless path is `createMcpHandler`, which **requires** `@modelcontextprotocol/server` v2 |
| `McpAgent` DO (`SK-MCP-014`) | statelessness removes the per-grant session the DO models | ✅ works | `McpAgent` is **deprecated + feature-frozen** in `agents` 0.20.x; the 1 s revocation cache has no home in a stateless handler |
| OAuth provider layer (`SK-MCP-011`) | **DCR (RFC 7591) deprecated** in favour of Client ID Metadata Documents; RFC 9207 `iss` validation; `application_type` required at DCR | ✅ — DCR stays valid for back-compat **and** the Claude directory still accepts it | `@cloudflare/workers-oauth-provider` 0.6.0 → 0.8.2 unreviewed for CIMD |
| e2e + walkers | `initialize` is gone in the new revision | ✅ — they drive a v1 client against a v1 server | must gain `server/discover` coverage **as part of** the migration, not before |
| registry listing (`com.nlqdb/nlqdb` v0.1.1) | — | ✅ no revision field in the registry manifest | none |

**Deprecated primitives: nlqdb uses none.** Roots, Sampling, Logging,
`ping`, SSE resumability — all absent from `packages/mcp/src` and
`apps/mcp/src`, verified and now **guarded** by
`packages/mcp/test/protocol-revision.test.ts`. This is the single biggest
reason the migration stays cheap, and the reason that guard exists: adopting
any of them now would add work to a jump toward a primitive already
scheduled for removal.

### The coupling that makes this multi-run

The four upgrades are **one** change, not four:

```
stateless Workers path  →  requires createMcpHandler
createMcpHandler        →  requires @modelcontextprotocol/server v2
v2                      →  Node >= 20 + Zod ^4.2.0 + new package names
McpAgent replacement    →  SK-MCP-014's revocation cache needs a new home
```

Costs that land together: `packages/mcp` declares `engines.node >= 18` (v2
needs 20 — a published-contract change for `npx -y @nlqdb/mcp`); the
workspace is on Zod `^3.25.76` in four packages; `agents` jumps 0.12.4 →
0.20.1; `.tool()`/`registerTool` and schema types change shape.

### The trigger (what must be true before step 1 opens)

Pull this worksheet when **either**:

1. **A real client needs it** — a host nlqdb cares about (Claude, Cursor)
   stops working, or the Connectors-Directory review asks for the revision.
   *As of 2026-07-29 it does not: the portal accepts streamable HTTP or SSE,
   and accepts DCR, CIMD, or a static client ID.* **Or**
2. **The stack has settled** — `@modelcontextprotocol/server` has ≥ 1 patch
   past 2.0.0 with no open `agents`-integration regressions, and Cloudflare
   documents `createMcpHandler` + `workers-oauth-provider` together with a
   worked OAuth example.

Neither holds today. `@modelcontextprotocol/server@2.0.0` went `latest` on
**2026-07-27T23:55Z** — hours before the spec published. Upgrading the live
connector URL onto a hours-old major, across a deprecated `McpAgent`, to
serve a revision no client yet requires, is the expensive kind of fast.

## Scorecard number it moves

`Engine:` MCP revision served, `2025-11-25` → `2026-07-28`.
`Performance:` hosted MCP p50 (one less DO hop per grant) and Workers cost
under `GLOBAL-013` — the stateless path removes a DO from the hot path.

## Read first

- `docs/features/mcp-server/FEATURE.md` — `SK-MCP-001` (two transports),
  `SK-MCP-011` (DCR), `SK-MCP-014` (DO revalidation cache), and
  **`SK-MCP-015`** (the stay-on-v1 call this worksheet exists to reverse)
- `docs/decisions/GLOBAL-013-*.md` — bundle + free-tier budget
- `docs/features/stranger-test/FEATURE.md` — `SK-STRG-005`/`SK-STRG-009`,
  the two FLOW-005 walkers that must stay green
- `apps/mcp/src/{index,mcp-agent}.ts` · `packages/mcp/src/server.ts`
- Sources: [spec changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
  · [SDK betas](https://blog.modelcontextprotocol.io/posts/sdk-betas-2026-07-28/)
  · [CF agents v0.20.0](https://developers.cloudflare.com/changelog/post/2026-07-27-agents-sdk-v0.20.0-mcp-sdk-v2/)
  · [createMcpHandler API](https://developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api/)

## Steps

Staged so each run ends green and every stage is independently revertable.
**Do not collapse stages** — stage 3 touches the live connector.

1. **Run 1 — decouple the blockers (no protocol change).** Land the two
   prerequisites that are safe on their own and shrink stage 2 to a
   mechanical diff:
   - Zod 4 readiness for `packages/mcp` only. Zod 3.25 already ships v4 at
     the `zod/v4` subpath, so the tool shapes can move without a workspace
     major. Keep `apps/api`/`packages/db` on v3.
   - Raise `packages/mcp` `engines.node` to `>= 20` **and** say so in the
     README. Node 18 is EOL; this is the only user-visible break in the
     whole migration, so it ships alone, early, and loudly.
   - Acceptance: `bun run test` + both walkers green, protocol pin
     untouched.

2. **Run 2 — stdio transport onto v2.** `packages/mcp` swaps
   `@modelcontextprotocol/sdk` → `@modelcontextprotocol/server` +
   `@modelcontextprotocol/core`. Start from the codemod
   (`npx @modelcontextprotocol/codemod@beta v1-to-v2 .`), then hand-finish.
   - `server/discover` comes from the SDK — assert it, don't implement it.
   - Update the pin in `protocol-revision.test.ts` to `2026-07-28` and flip
     the two negative assertions to positive.
   - **`npx -y @nlqdb/mcp` and `claude mcp add …` strings must not change.**
     R-04 and five agent artifacts pin them; a change here is a
     stop-and-worksheet, not an edit.
   - Acceptance: `flow-005-stdio-walk.sh` green against the real binary;
     tool catalog byte-identical (`SK-MCP-002`).

3. **Run 3 — hosted transport onto stateless (founder-gated).**
   `apps/mcp` replaces the `McpAgent` subclass with `createMcpHandler`,
   `agents` → 0.20.x, `workers-oauth-provider` → 0.8.x.
   - **The `SK-MCP-014` question this stage must answer:** a stateless
     handler has no DO to hold `lastRevalidatedAt`/`revoked`. Options —
     (a) revalidate per request and rely on the API's own cache, (b) move
     the 1 s window into KV, (c) keep a DO *only* for revocation state.
     Whichever wins **amends `SK-MCP-014`** (`P1`: raise it, don't
     rationalise). Revocation must still propagate ≤ 1 s.
   - Re-verify `isOriginAllowed` still runs before the handler, and that
     `Mcp-Method`/`Mcp-Name` don't bypass it.
   - `GLOBAL-013`: `wrangler deploy --dry-run` must stay inside budget —
     record the before/after bundle size in the PR.
   - Acceptance: `flow-005-walk.sh` green; a real host connects end to end.

4. **Run 4 — take the dividends the revision pays.** Now-cheap wins that
   only exist post-migration:
   - `ttlMs` + `cacheScope` on `tools/list`. `createListDatabasesCache`'s
     5 s server-side TTL becomes a *client-side* hint — strictly fewer
     round-trips.
   - OTel `_meta` trace propagation (`traceparent`/`tracestate`/`baggage`)
     — the revision standardises what `GLOBAL-014` already wants, so host
     spans join nlqdb traces.
   - Evaluate MRTR (`resultType: "input_required"`) as the spec-native form
     of `SK-TRUST-001`'s `requires_confirm` + re-call-with-`confirm:true`.
     nlqdb hand-rolled this; MRTR is the standard shape. **Evaluate, don't
     assume** — a tool-result convention may still beat it for hosts that
     render diffs poorly (the open `confirm_required` audit).

## Done when

**Audit phase (done 2026-07-29):**
- [x] Compatibility matrix recorded, per surface, with the blocker named.
- [x] Verified nlqdb uses no deprecated primitive, and **guarded** it
      (`packages/mcp/test/protocol-revision.test.ts`).
- [x] Served revision pinned in a test so the bump can't happen silently.
- [x] Trigger written down so a cold `/daily` run can tell "not yet" from
      "now" without redoing the research.

**Migration phase (gated on the trigger):**
- [ ] Run 1 — Zod 4 subpath + `engines.node >= 20`, walkers green.
- [ ] Run 2 — stdio serves 2026-07-28; `server/discover` asserted in the
      stdio walker; install strings unchanged.
- [ ] Run 3 — hosted serves 2026-07-28 statelessly; no DO on the hot path;
      revocation ≤ 1 s with `SK-MCP-014` amended to match; bundle within
      `GLOBAL-013`.
- [ ] Run 4 — `ttlMs`/`cacheScope` served; `_meta` trace context joined;
      MRTR decision recorded either way.
- [ ] `SK-MCP-015` superseded (it exists to be reversed) and the
      Connectors-Directory payload's spec-version line reconciled by the
      founder queue.

## Rollback

Stages 1–2 are npm-level and revert by reverting the commit. Stage 3 is the
risky one: keep the previous Worker version deployable (`wrangler rollback`)
and, if `createMcpHandler` misbehaves under OAuth, Cloudflare ships
`createLegacyMcpHandler` as a documented bridge back to the `McpAgent`
shape — that is the escape hatch, not a rewrite.

## Artifact

"nlqdb speaks MCP 2026-07-28, statelessly" → a `distribution-queue.md`
entry once stage 3 lands (a current-revision memory server on a serverless
path is a real differentiator against the DIY stack). Nothing to publish
before then — **do not** claim the revision while serving 2025-11-25.
