# Proposal: OAuth / direct-integration connect

> **Status: SIGNED OFF by founder 2026-08-12** (P1 satisfied), with four recorded
> calls: **(1)** paste demotion is **staged** — paste stays visible alongside the
> provider buttons until ≥ 2 providers are OAuth-live, then collapses to the
> "Advanced" fallback; **(2)** the Supabase `database:write` scope is accepted,
> paired with honest consent copy ("we create a read-only role, then only ever
> read"); **(3)** the provider OAuth token is stored sealed (lifecycle-only), as
> drafted; **(4)** the build is **queued behind the current scorecard focus**
> (agent-memory dogfood gate) — decisions land now, code starts when the focus
> clears. The SK decisions move to their canonical homes (per
> `sk-decision-draft.md` §"Exact edits") in the first build PR **after PR #982
> merges**, to avoid colliding with #982's FEATURE.md rewrite.

Makes BYO connect an OAuth / provider **"Connect"** button (approve on the
provider side, no credential copy-paste, read-only role) the primary path, and
demotes paste-a-URL to an "Advanced / self-hosted" fallback (staged: paste stays
expanded until ≥ 2 providers are OAuth-live — see status note above).

## Relationship to existing decisions

- **Partially supersedes `SK-WEB-019`** (staged) — provider buttons take the primary
  `/app/connect` slot; paste collapses only once ≥ 2 providers are live. SK-WEB-019's auth-guard,
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
