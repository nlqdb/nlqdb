# Proposal: OAuth / direct-integration connect

> **Status: PROPOSAL — PENDING P1 SIGN-OFF.** This is research + design only. No
> shipping code changes, and none of the SK decisions below are active until the
> founder signs off per CLAUDE.md **P1**.

Makes BYO connect an OAuth / provider **"Connect"** button (approve on the
provider side, no credential copy-paste, read-only role) the primary path, and
demotes paste-a-URL to an "Advanced / self-hosted" fallback.

## Relationship to existing decisions

- **Partially supersedes `SK-WEB-019`** — paste is demoted from the primary
  `/app/connect` action to a collapsed fallback. SK-WEB-019's auth-guard,
  `type="password"`, and never-persist-client-side invariants are **retained**
  and continue to govern the paste fallback.
- **Extends `SK-DBCONN-001`** — adds an OAuth front-end that resolves a provider
  grant to a connection URL and reuses the **same** `connectByoDb` pipeline
  (validate → introspect → seal → register); it does not replace the connect
  verb.
- **Depends on `SK-DBCONN-002`** (PR #982 — BYO Postgres on postgres.js over
  Workers `connect()` sockets). That transport is what makes the first provider
  (Supabase) reachable; merge #982 before any code from this proposal. The draft
  decision here is therefore numbered **SK-DBCONN-003**.

No new GLOBAL is required (composes GLOBAL-003/012/013/017/031/035).

## Leverage verdict (design-for-leverage)

```
Leverage: invest — one generic OAuth engine + declarative ProviderDescriptor (rung 3)
N+1: a new provider = one descriptor file (endpoints + listProjects + resolve) +
     a button entry + two Worker secrets; PKCE/state, token exchange, sealing,
     disconnect, and error mapping are engine-owned and unskippable
Category: "provider OAuth connect" — instances shipped: 0; designed: 2 (Supabase,
     Neon); research-matrix candidates with genuine OAuth: 5
```

## Documents

- [`research.md`](research.md) — per-provider OAuth / management-API feasibility
  (Neon, Supabase, ClickHouse Cloud) + wider provider matrix; web-verified with
  source URLs.
- [`ux-design.md`](ux-design.md) — redesigned `/app/connect` (provider buttons
  primary, paste collapsed) with the full P6 journey and every denied / empty /
  partial / expired state.
- [`architecture.md`](architecture.md) — OAuth resolves to a connection URL and
  reuses the existing pipeline (GLOBAL-017); sealed token storage (GLOBAL-031);
  callback routes; GLOBAL-003 surface parity as a reasoned N/A.
- [`implementation-plan.md`](implementation-plan.md) — phased, agent-buildable
  work separated from founder-gated blockers. **Supabase first** (self-serve, no
  business gate); Neon builds in parallel behind its partner-OAuth blocker.
- [`sk-decision-draft.md`](sk-decision-draft.md) — **DRAFT** `SK-DBCONN-003` +
  `SK-WEB-030` and the exact downstream edits. This is a draft, **not** an active
  SK decision until signed off.
