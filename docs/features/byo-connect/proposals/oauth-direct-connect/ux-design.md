# UX design — OAuth-first `/app/connect`

Redesign of `apps/web/src/pages/app/connect.astro` + `ConnectForm.tsx`. The
authored-schema create flow (`/app/new`) is untouched. Anchored to **P6** (world-class
journeys) and the existing **SK-WEB-019** trust posture (auth-guarded, secrets never
persisted client-side).

## Design principle

Today the connect page opens on *"Paste a read connection string."* — a wall of
credential handling before any value. The inversion: lead with **provider buttons that
approve on the provider's side** (zero secret typed into nlqdb), and demote paste to a
clearly-labelled fallback for self-hosted / unsupported providers.

## Page layout (primary path)

```
┌────────────────────────────────────────────────────────────┐
│  Question your database.                                     │
│  Connect it in one click — approve access on your provider,  │
│  we read your schema, you ask in English.                    │
│                                                              │
│   ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│   │  ◆ Connect    │  │  ⬡ Connect      │  │  ✦ Connect      │  │   ← provider buttons
│   │    Neon       │  │    Supabase     │  │  ClickHouse ▾   │  │     (primary CTA row)
│   └──────────────┘  └────────────────┘  └────────────────┘  │
│                                                              │
│   Read-only. You approve on your provider. We never see a    │
│   password you didn't hand us.                               │
│                                                              │
│   ▸ Advanced: paste a connection string (self-hosted / other)│   ← collapsed <details>
└────────────────────────────────────────────────────────────┘
```

- **Provider buttons** are the primary action. Buttons for OAuth-live providers
  (Neon; then Supabase) start the redirect flow. **ClickHouse Cloud has no OAuth** — its
  button opens the paste panel pre-set to `engine=clickhouse` with a one-line
  "create a read-only key" hint (honest: it is the paste path, not a lie of a button).
- **Paste-URL** moves into a collapsed `<details>` ("Advanced / self-hosted"). It is the
  *entire current ConnectForm*, unchanged in behavior (`type="password"`, never
  persisted). Deep link `?engine=` and the LeftRail chips still open it.
- Provider buttons whose OAuth app is not yet configured on this deployment render
  **disabled with a "paste for now" affordance**, never a dead button (honest empty state).

## The full P6 journey (Neon happy path)

1. **Entry** — signed-in user lands on `/app/connect` (auth guard unchanged; anon →
   `/auth/sign-in?return_to=/app/connect`). One primary decision: which provider.
2. **One primary action** — click **Connect Neon**. Browser navigates to
   `GET /v1/db/connect/oauth/neon/start`, which 302s to Neon's consent screen. No form,
   no secret typed.
3. **Approve on the provider** — the user sees *Neon's* consent screen ("nlqdb wants
   read access to your projects"), the trust handoff happens on Neon's domain. They pick
   a project if prompted and approve.
4. **Redirect back + resume intent** — Neon 302s to
   `GET /v1/db/connect/oauth/neon/callback?code=…&state=…`. The Worker exchanges the
   code, provisions a read-only role, fetches the pooled DSN, and runs the **same
   `connectByoDb` pipeline** (validate → introspect → seal → register). It then 302s to
   `/app/connect?connected=<dbId>`. The user's intent ("connect and question my DB") is
   preserved end-to-end; they never re-enter anything.
5. **Visible, honest progress** — because introspection can take a second or two, the
   callback lands on an interstitial that reports **user-meaningful units** ("Reading
   your schema… 12 tables found"), not a spinner-lie. If the flow is fast it goes
   straight to proof.
6. **Persistent proof of value** — the connected page renders the **schema preview**
   card (same `CREATE TABLE` shape as paste/create), the provider + project name pill,
   and a promoted **"Question it now →"** CTA to `/app?db=<dbId>`. On reload the DB is in
   the user's list (durable, inspectable) — the proof survives refresh.
7. **Clear next step** — one CTA into chat, bound to the new DB. Same wow beat the paste
   path already delivers (SK-WEB-019).
8. **Undo / disconnect** — the DB list exposes **Disconnect**, which `DELETE`s the
   `databases` row *and* (when the sealed OAuth token is stored) calls the provider API
   to **DROP the read-only role nlqdb created** — leaving the user's DB as it was. This
   is the reversible-cleanup P6 requires; if the token isn't stored (MVP), disconnect
   still removes nlqdb's copy and the residual read-only role is documented + shown to
   the user with a copy-paste `DROP ROLE` they can run.

## Non-happy states (each gets the same care as the happy path)

- **Denied on provider** — user clicks "Deny" on Neon's consent screen. Callback gets
  `error=access_denied`; redirect to `/app/connect?error=denied` rendering one sentence
  (**GLOBAL-012**): *"You didn't approve access on Neon — try again, or paste a
  connection string instead."* The paste fallback is right there. No work lost.
- **Approved but no projects** (empty) — user has a Neon account but zero projects.
  *"No databases found in your Neon account — create one on Neon, or paste a connection
  string."* with a link out. Honest empty state, not a blank success.
- **Multiple projects** — if the token grants more than one project, the interstitial
  shows a **project picker** (name + region) before introspecting. One decision, then
  resume. (MVP may default to the single/first project and let the user reconnect for
  another.)
- **Introspection failed** (bad reach / permissions) — the callback already provisioned
  a role; it surfaces the existing `introspection_failed` one-sentence error and offers
  retry. The orphaned role is cleaned up on retry-or-abandon.
- **Partial** — role created but connection_uri fetch failed: fail closed, clean up the
  role, one-sentence error + retry. Never a half-registered DB.
- **Token expired / revoked later** — a query-time re-introspect that 401s marks the DB
  "needs reconnect" in the list with a one-click re-auth (re-runs `/start`), preserving
  the dbId so history and keys survive.
- **State/CSRF mismatch** on callback — reject, redirect to `/app/connect?error=expired`
  ("That connect link expired — start again."). Never trust a callback without a matching
  KV state.
- **OAuth not configured on this deployment** (no `client_id`) — the provider button is
  disabled with a tooltip and the paste fallback is promoted. The `/start` route returns
  the same 503 shape the KEK gate uses.

## What stays identical (do not regress)

- Auth-guarded page; connect is account-only (existing rule; OAuth `/start` requires the
  session).
- The paste field keeps `type="password"`, `autocomplete="off"`, and **never** touches
  `localStorage`/`sessionStorage`/query string (SK-WEB-019 invariants).
- Success still emits the `db.connected` `{ engine }` event (add `{ method: "oauth" | "paste", provider }`)
  so the Door-B funnel and now the OAuth-vs-paste split read in GTM.
- Same schema-preview → "Question it now" wow beat for both paths.

## Accessibility / honesty notes

- Provider buttons are real `<a>`/`<button>` with visible labels, not icon-only.
- The "we never see a password you didn't hand us" line is literally true on the OAuth
  path (we create a role via the provider API; on paste it is the existing sealed-URL
  promise). Copy must not overclaim on the paste path.
- The interstitial's progress is real counts from introspection, never an invented %.
