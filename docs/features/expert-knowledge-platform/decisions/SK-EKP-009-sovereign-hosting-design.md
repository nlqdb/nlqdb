# SK-EKP-009 — Sovereign hosting, 1-click: v1 is own-machine via the WS-11 container, cloud-account targets are v2, and a sovereign DB leaves the marketplace broker

The EK-07 design record — the `P2` research pass the worksheet mandates
"before any build," resolved from the documented values per
[`GLOBAL-033`](../../../decisions/GLOBAL-033-resolution-defaults.md). It
turns the [`SK-EKP-001`](../FEATURE.md) roadmap line ("1-click sovereign
hosting") from a marketing claim into a scoped, buildable journey. It mints
no fee, changes no trust copy (that upgrade is EK-07 box 3, gated on a real
expert walk per `P6`), and does not touch the `SK-PIVOT-016` gate
(`SK-EKP-005`). The build (EK-07 boxes 2–3) stays deferred behind its hard
prereq: the `WS-11` (archived)
self-host image (`ghcr.io/nlqdb/api`) must ship and run first.

## Research pass (P2, 2026-08-09)

The 2026 landscape splits cleanly into two mechanisms, and they carry very
different support burdens:

- **Own-machine / on-prem** — a container the expert runs (`docker run` /
  compose) against a Postgres they own. This is exactly the
  [`SK-PIVOT-005`](../../agent-memory-pivot/decisions/SK-PIVOT-005-fsl-self-host.md)
  FSL rail (`WS-11`), productized for a non-technical user. One artifact,
  one support surface, `$0`, and the strongest sovereignty claim ("it lives
  on your machine").
- **Deploy-into-your-own-cloud-account** — a `CloudFormation` "Launch
  Stack" / DigitalOcean-1-click style button that provisions the container
  **inside the expert's own AWS/DO account**. This is the only mechanism
  that is both "their own account" *and* one click, but **each provider is a
  distinct integration + support surface**. The indie PaaS "deploy buttons"
  (Railway/Render/Fly) do **not** qualify: they deploy into an account on
  *that PaaS* (a third party, not sovereign), and self-serve BYOC into the
  user's own cloud is Enterprise-gated (Railway) or absent (Render) as of
  2026-08 — Northflank is the credible self-serve BYOC platform but targets
  the operator, not a non-technical expert clicking once.

Knowledge DBs are **small** (structured rows, not analytics volume), so DB
portability is not the hard part: a full `pg_dump` → restore into the
sovereign Postgres completes in seconds-to-a-minute and is the Bullet-proof
default. Logical replication (zero-downtime streaming) is real but
overkill for a knowledge-DB cutover.

Sources: DigitalOcean "migrate managed → self-managed Postgres" docs;
Crunchy Data "Postgres migrations using logical replication"; Northflank /
Upsun 2026 Railway-alternatives (BYOC availability) comparisons.

## Decision

1. **v1 sovereign target = own-machine (on-prem) via the `WS-11`
   container.** Resolved from the `Simple` / `Free` / `Bullet-proof` values
   (`GLOBAL-033`): ship the mechanism with the fewest support surfaces and
   the strongest claim first. Own-machine depends only on the rail nlqdb has
   already committed to build (`WS-11`), needs no per-provider integration,
   and is the honest "possession" upgrade `SK-EKP-001` promises.
2. **Cloud-account targets (AWS/DO Launch-Stack style) are v2 — added one
   provider at a time, behind the same journey contract, and only after a
   first expert has completed the on-prem walk.** Each provider is a
   separate support-burden bet; adding them speculatively before there is
   one sovereign expert is the exact over-investment the EK INDEX defers
   EK-07 to avoid. This is resolved conservatively from the values, not
   escalated — no new `🔒` bullet.
3. **The DB-move mechanism is `pg_dump` → restore** into the sovereign
   Postgres, version-matched. Logical replication is **parked-with-trigger**
   (adopt only if a knowledge DB ever exceeds the dump-in-under-a-minute
   threshold — not expected for interview-authored rows).
4. **A sovereign knowledge DB is out of the marketplace broker's scope
   (v1).** [`SK-EKP-008`](SK-EKP-008-grant-primitive-design.md) mints grants
   on **platform-provisioned hosted DBs only** (BYO grantability
   deny-by-default). A DB that has moved to the expert's machine is, by that
   same rule, **not brokerable** — so in v1 an expert either **sells
   brokered query-access** to their platform-hosted DB (EK-05/EK-06) **or
   takes possession** and serves their own agents directly. Selling
   marketplace access *into* a sovereign DB (the broker reaching into the
   expert's own infra) is a **future decision, deny-by-default**, matching
   `SK-EKP-008`'s BYO-grantability parking. The engine runs where the data
   lives (`SK-EKP-001`); a grant cannot terminate at an endpoint the
   platform does not operate.
5. **The build is a `SK-PIVOT-021` journey**, hard-gated on `WS-11`: entry →
   one primary action ("Move to my machine") → unavoidable machine/provider
   consent → honest progress in rows moved + verify → durable proof (their
   DB answers *their* golden queries from *their* machine) → reversible
   (move back / tear down). No new schema, endpoint, or per-pack surface.

## Core value

Free, Open source, Bullet-proof, Simple, Goal-first.

## Why

`SK-EKP-001` found the one unoccupied lane is a *truthful* sovereignty path;
the whole market ceiling is contractual pledges. Making the roadmap real
without over-scoping means: build on the rail already committed (`WS-11`),
carry the strongest claim (own-machine) first, and refuse to pretend the
marketplace can keep brokering a DB it no longer hosts. Point 4 is the
load-bearing, non-obvious output — without it, a later agent could build a
"sell grants on sovereign DBs" path that `SK-EKP-008`'s v1 scope silently
forbids, shipping a trust-breaking capability the design never sanctioned.

## Consequence in code & docs

- No code this run (research/design box only). When EK-07 boxes 2–3 build:
  a reviewer rejects a cloud-provider target landing before the on-prem walk
  has a real expert completion; rejects any path that mints or keeps a grant
  against a sovereign (non-platform-provisioned) DB; and rejects a move flow
  that is not a `SK-PIVOT-021` contract journey (loses state, fakes progress,
  or has no reversible teardown).
- The trust-copy upgrade from "not allowed" to "possession" stays EK-07
  box 3, gated on a real expert completing the walk in production shape
  (`P6`) — this record does not change any claim.

## Alternatives rejected

- **Ship cloud-account deploy in v1** — multiplies support surfaces per
  provider before a single sovereign expert exists; front-runs the very
  deferral the INDEX imposes on EK-07.
- **Indie-PaaS deploy buttons as the sovereign path** — deploys into a
  third-party PaaS account, not the expert's own cloud; weaker than the
  possession claim and still a third-party trust dependency.
- **Keep brokering a moved DB** — the platform would have to reach into the
  expert's infra to enforce grants/RLS/metering it no longer controls,
  breaking `SK-EKP-008`'s fail-closed guarantees and the honesty floor.
- **Logical replication as the default move** — zero-downtime machinery for
  a small DB that dumps in under a minute; complexity with no v1 payoff.
