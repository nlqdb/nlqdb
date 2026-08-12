DRAFT — pending P1 sign-off; not an active decision.

# Draft SK decisions — OAuth-first connect (for founder P1 sign-off)

> **P1 flag — read first.** This changes a *documented* customer-facing UX
> (**SK-WEB-019** leads with "Paste a read connection string") and extends the
> connect verb defined in **SK-DBCONN-001**. Per CLAUDE.md **P1** ("never contradict a
> documented decision silently") this **requires the founder to sign off** before any
> code lands. It **partially supersedes SK-WEB-019** (paste is demoted from primary to
> fallback; the auth-guard + secrets-never-persisted invariants are *retained*),
> **extends SK-DBCONN-001** (adds an OAuth front-end that resolves to a connection URL
> and reuses the same pipeline — it does not replace it), and **depends on
> SK-DBCONN-002** (postgres.js over Workers sockets, PR #982 — the transport that makes
> the first provider, Supabase, reachable). The ID below is **SK-DBCONN-003** because
> SK-DBCONN-002 is taken by that transport decision.

Two decisions in two canonical homes (P3): the backend/pipeline decision in
`byo-connect`, the page-UX decision in `web-app`. Draft bodies below in the mandatory
five-field format (`docs/feature-conventions.md` §4).

---

## Draft 1 — canonical home: `docs/features/byo-connect/FEATURE.md`

### SK-DBCONN-003 — OAuth provider resolution as a front-end to the one connect pipeline; declarative provider descriptors; sealed lifecycle token; paste stays the fallback

- **Decision:** A provider OAuth grant (**Supabase first; Neon ships when its partner
  OAuth client lands; no third provider committed**) is turned into a plaintext
  connection URL by that provider's **`ProviderDescriptor`** — one declarative module
  (`authorizeUrl`/`tokenUrl`/`scopes`/env-key names/`listProjects`/`resolve`) consumed
  by a single generic OAuth engine — and is then fed into the **existing `connectByoDb`
  orchestrator unchanged** (validate → introspect → seal → register). The engine owns
  the two handshake helper routes — `GET /v1/db/connect/oauth/:provider/{start,callback}`
  (RFC 9700: PKCE `S256` + one-time TTL'd `state` in KV + exact-match `redirect_uri`;
  `requirePrincipal` on `start`, connect stays account-only) — never a second connect
  *data* verb. Adding provider N+1 is one descriptor file + a button entry + two Worker
  secrets. The durable query credential remains the sealed
  `databases.connection_blob` (a pasted URL and an OAuth-resolved URL are identical once
  registered); the OAuth token is sealed separately (shared envelope, AAD
  `dboauth:<dbId>`) in a new additive `db_oauth_grants` table used **only** for clean
  disconnect (DROP the read-only role nlqdb created) and re-auth. Paste remains the
  fallback path on the same verb.
- **Core value:** Effortless UX, Bullet-proof, Goal-first, Simple
- **Why:** The product's connect promise is "question your DB" with the least trust
  handed over; approving on the provider's side (no credential typed into nlqdb, a
  dedicated read-only role) is strictly better than pasting a live DSN. Making OAuth a
  *front-end to the one pipeline* — rather than a parallel connect path — is required by
  **GLOBAL-017** and keeps the sealed-blob storage boundary, egress guard (**GLOBAL-035**),
  and query-time dispatch in exactly one auditable place; a descriptor's only job is to
  produce a URL the pipeline already knows how to handle, and encoding the mechanics
  once in the engine makes the RFC 9700 invariants unskippable per-provider. Keeping the
  DSN (not the token) as the durable artifact means the hot query path needs nothing new
  and the token table is a tiny, additive, lifecycle-only concern. **Supabase is first**
  because with **SK-DBCONN-002** (postgres.js over Workers `connect()` sockets) its
  pooler is reachable and its OAuth app is self-serve — the only provider with no
  business-negotiation gate; Neon (deepest API fit, but partner-gated) builds in
  parallel and ships dark until the founder's partner client lands.
- **Consequence in code:** New `apps/api/src/db-connect/oauth/` — the generic engine +
  `providers/<provider>.ts` descriptors (Supabase impl first) and the two
  `oauth/:provider/*` routes; the callback calls `connectByoDb` in-process (no re-POST).
  New migration `0030_db_oauth_grants.sql` (additive, forward-only). `sealSecret`/`openSecret`
  gain the `dboauth:<dbId>` context (no new crypto — GLOBAL-031). `DELETE /v1/databases/:id`
  opens the token and best-effort DROPs the provider role before deleting. Provider REST
  calls each emit an OTel span (**GLOBAL-014**); no URL or token in any span/log
  (**GLOBAL-012**). Surface parity (**GLOBAL-003**): the paste verb already ships on
  SDK/CLI/MCP and stays; **OAuth is a tracked N/A on SDK/CLI/MCP/elements** (browser-redirect
  flow only — headless surfaces have no consent browser), recorded under Open questions,
  not a TODO. Reviewers reject: an OAuth path that forks introspection/seal/register; a
  callback trusted without a matching KV `state`; a token stored unsealed or under the
  `dbconn:` context; a resolved host that skips `validateByoConnection`.
- **Alternatives rejected:**
  - **Introspect through the provider's management API** (Supabase `database/query`, etc.)
    instead of resolving to a DSN + reusing the pipeline. A second introspection path that
    drifts from the sealed-blob one; violates GLOBAL-017. Resolve-to-URL keeps one pipeline.
  - **A second `/v1/db/connect/oauth` data endpoint.** REST-resource explosion (GLOBAL-017);
    OAuth is a handshake helper to the one verb, like `nlq login`.
  - **Store the OAuth token in `connection_blob`.** Conflates the query credential with the
    lifecycle credential and muddies AAD; a separate `db_oauth_grants` row (absence = "paste,
    nothing to revoke") is cleaner and additive.
  - **Ship Neon first.** Its OAuth client is partner-gated (a business negotiation with no
    deadline) — Neon-first puts a disabled button on the roadmap's critical path. It was the
    right order only while the BYO path was Neon-HTTP-only; SK-DBCONN-002 removed that.
  - **A third-party OAuth client library.** Arctic was deprecated July 2026; Better Auth's
    `genericOAuth` plugin mints sign-in sessions, not resource grants. The flow is ~100
    lines of fetch in the engine, written once per RFC 9700 (P2-verified 2026-08).
- **Source:** canonical here · extends `SK-DBCONN-001` (the pipeline it reuses) · depends
  on `SK-DBCONN-002` (postgres.js Workers transport — reachability) · `SK-DB-013`
  (validate step) · `GLOBAL-031` (seal) · `GLOBAL-035` (egress) · `GLOBAL-017` (one
  pipeline) · [RFC 9700](https://datatracker.ietf.org/doc/rfc9700/) · research.md §0
  (residual TLS-trust constraint).

**Open-questions additions for byo-connect/FEATURE.md:**
- *(e) Private-CA providers under runtime-owned TLS verify* — postgres.js on Workers
  hands cert verification to the runtime's trust store (SK-DBCONN-002), so providers with
  per-cluster private CAs (DigitalOcean, Aiven, RDS, Cloud SQL) are unreachable however
  they authenticate. Revisit if Workers gain custom-CA trust or a provider moves to
  public certs; a one-connection check settles any "TLS?" row in the research matrix.
- *(f) OAuth surface parity N/A* — SDK/CLI/MCP keep paste (`connection_url`); OAuth is a
  browser-redirect flow they cannot run. Tracked N/A per GLOBAL-003, matching the existing
  connect-verb elements N/A. A future `nlq db connect --oauth` via loopback is a separate
  capability, not a parity gap.

---

## Draft 2 — canonical home: `docs/features/web-app/FEATURE.md`

### SK-WEB-030 — OAuth-first `/app/connect`: provider buttons primary, paste collapsed to an "Advanced / self-hosted" fallback

- **Status:** Supersedes **SK-WEB-019** *in part* — the "lead with a paste field" structural
  claim is replaced; SK-WEB-019's auth-guard, `type="password"`, and never-persist-client-side
  invariants are **retained** and apply unchanged to the paste fallback.
- **Decision:** `/app/connect` leads with a row of provider **Connect** buttons (Supabase
  first, then Neon — live providers render before dark ones) that start the OAuth redirect
  (`GET /v1/db/connect/oauth/:provider/start`);
  the paste-a-URL `ConnectForm` moves into a collapsed `<details>` labelled
  *"Advanced / self-hosted"*. ClickHouse Cloud (no OAuth exists) is a button that opens the
  paste panel pre-set to `engine=clickhouse`. A provider whose OAuth client is unconfigured on
  the deployment renders **disabled with the paste fallback promoted** — never a dead button.
  The full P6 journey (approve on provider → interstitial with honest table counts → schema
  preview + "Question it now →" → Disconnect that cleans up) is designed for the happy path
  *and* the denied / empty / multi-project / expired / CSRF-mismatch states.
- **Core value:** Effortless UX, Goal-first, Seamless auth, Bullet-proof
- **Why:** Pasting a live DSN is the highest-friction, highest-trust-cost first step; a
  "Connect" button that approves on the provider side removes both the copy-paste and the
  "am I handing my prod password to a stranger" hesitation, and lets nlqdb take only a
  read-only role. Demoting (not deleting) paste keeps self-hosted and unsupported providers
  first-class. This is the same schema-preview → "Question it now" wow beat SK-WEB-019 already
  earns, reached with fewer decisions and no secret typed (**P6**).
- **Consequence in code:** `connect.astro` renders the provider-button row as primary;
  `ConnectForm.tsx` is unchanged but mounted inside the collapsed `<details>`. The success
  `db.connected` event gains `{ method: "oauth" | "paste", provider }` so the OAuth-vs-paste
  split reads in GTM. Reviewers reject: a dead/enabled provider button when its client is
  unconfigured; a paste field that regresses the SK-WEB-019 secrecy invariants; an OAuth
  success that skips the schema-preview proof beat.
- **Alternatives rejected:**
  - **Remove paste entirely.** Strands self-hosted / unsupported providers and every provider
    without OAuth (ClickHouse Cloud, RDS, …). Fallback must stay.
  - **A separate `/app/connect/oauth` page.** Two connect surfaces; one page with a primary
    path + fallback is the GLOBAL-017 shape.
  - **Keep paste primary, add OAuth as a small link.** Under-delivers the "one click, approve
    on your side" promise that is the whole point.
- **Source:** canonical here · supersedes-in-part `SK-WEB-019` · backend `SK-DBCONN-003`.

---

## Exact edits needed elsewhere (describe only — do NOT make them here)

1. **`docs/features/web-app/decisions/SK-WEB-019-connect-page.md`** — add a `- **Status:**`
   line at the top: *"Superseded in part by SK-WEB-030 — paste demoted from primary to the
   'Advanced / self-hosted' fallback; the auth-guard + `type="password"` + never-persist
   invariants below are retained and now govern the fallback."* Do **not** delete SK-WEB-019
   (its invariants still bind the paste path). Add the `SK-WEB-030` body to
   `web-app/FEATURE.md`'s `## Decisions` index (sharded — it's a decisions/ dir).

2. **`docs/features/byo-connect/FEATURE.md`** —
   - Add `### SK-DBCONN-003` (Draft 1 above) under `## Decisions` (as a `decisions/` shard,
     matching how SK-DBCONN-001/002 are stored after PR #982).
   - Update the `**Status:**` line to note "OAuth-first connect (Supabase first, Neon
     partner-gated) added by SK-DBCONN-003; paste demoted to fallback."
   - Under `## GLOBALs governing this feature`, extend the GLOBAL-031 bullet's feature-local
     note to mention the second sealed context `dboauth:<dbId>`; extend GLOBAL-003's note to
     record the OAuth-surface N/A on SDK/CLI/MCP; extend GLOBAL-017's note to state OAuth is a
     handshake helper to the one connect verb.
   - Add Open questions **(e)** transport and **(f)** surface-parity N/A (bodies above).

3. **Root `CLAUDE.md` §5 path map** — extend the `byo-connect` row's touch-paths to include
   `apps/api/src/db-connect/oauth/**` (engine + provider descriptors); extend the `web-app` row
   is unnecessary (already `apps/web/**`).

4. **`docs/decisions.md`** — **no new GLOBAL** is required (this composes existing
   GLOBAL-003/012/013/017/031/035). Do not add a GLOBAL row.

5. **`docs/runbook.md`** — add the new Worker secrets (`NEON_OAUTH_CLIENT_ID`/`_SECRET`,
   `SUPABASE_OAUTH_CLIENT_ID`/`_SECRET`) and the founder registration steps (B2/B4 in
   implementation-plan.md) to the env/secrets section. `docs/blocked-by-human.md` gets the
   Neon-partner-OAuth-client parked action (B2).

6. **User-facing how-to** (per feature-conventions §5a): the "how to connect via OAuth"
   walkthrough belongs in `apps/docs/` (docs.nlqdb.com), **not** in a FEATURE.md.
