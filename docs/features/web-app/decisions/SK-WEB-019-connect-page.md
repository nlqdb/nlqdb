# SK-WEB-019 — `/app/connect`: auth-guarded BYO-connect page + `ConnectForm.tsx`

The product-side landing for Door B of the two-door home
([`SK-WEB-018`](./SK-WEB-018-two-door-home.md)); the backend it posts to is
[`SK-DBCONN-001`](../../byo-connect/FEATURE.md) (`POST /v1/db/connect`).

- **Decision:** `apps/web/src/pages/app/connect.astro` is an **auth-guarded**
  page (same `/app` session-probe guard as the rest of the product surface;
  anonymous visitors are redirected to `/auth/sign-in?return_to=/app/connect`).
  It mounts one React island, `ConnectForm.tsx`, wrapped in `<ErrorBoundary>`
  per [`SK-WEB-001`](../FEATURE.md). The form has:
  - an **engine select** defaulting to **ClickHouse** (Postgres also offered);
  - a **connection-URL field of `type="password"`** whose value is **never
    persisted** client-side (no `localStorage`, no URL param, no form
    autofill name that browsers cache) — it exists only in component state for
    the single POST;
  - a submit that `POST`s `{ engine, connection_url, name? }` to
    `/v1/db/connect` with `credentials: "include"` (the page is same-origin
    after the `SK-WEB-009` web/API merge, so the session cookie travels).
  On success the server returns the introspected schema preview + the new
  `dbId`; the form renders the **schema preview** (the same `CREATE TABLE`
  card shape the create flow shows) and a single promoted **"Question it now
  →"** CTA routing to `/app?db=<dbId>` so the user lands in chat already bound
  to the connected DB. On failure it renders the server's one-sentence error
  ([`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md)) inline,
  never echoing the URL back.

- **Core value:** Effortless UX, Goal-first, Bullet-proof, Seamless auth

- **Why:** Door B's promise is "question your own ClickHouse" — the shortest
  honest path is sign-in → paste URL → see your schema → ask. Connecting a
  live credentialed database is a write to the user's account
  (`databases.connection_blob`), so unlike the anonymous `/app/new` create flow
  it **requires a session** — there is no anonymous BYO-connect (a credential
  belongs to an owner, and the sealed blob is AAD-bound to that owner per
  `GLOBAL-031`). A `type="password"` field that is never persisted is the
  minimum-trust handling for a secret the user is about to hand us: it goes
  straight into the POST body and the seal, and the only representation that
  survives anywhere client-side is the redacted pill the server returns. The
  schema-preview-then-"Question it now" beat reuses the create flow's wow
  moment — the user sees their real tables render, then asks in one click — so
  BYO-connect feels identical to the hosted create path rather than a
  second-class config screen.

- **Consequence in code:** `apps/web/src/pages/app/connect.astro` runs the
  shared `/app` auth-guard script before mounting; `ConnectForm.tsx` holds the
  URL only in React state (cleared on unmount), posts with
  `credentials: "include"`, and on `200` renders the schema-preview card list +
  the "Question it now →" link to `/app?db=<dbId>`. The connection URL is never
  written to `localStorage` / `sessionStorage` / the query string and the field
  carries `autocomplete="off"`. The field hint links "Read more" to the
  user-facing security page (`docs.nlqdb.com/security/`) so the secrets-handling
  promise has a destination, not just an inline claim. A `GLOBAL-024` event fires on successful connect
  (`db.connected`, `{ engine }`) so the Door-B funnel reads. PRs that persist
  the connection URL client-side, drop the auth guard, or POST without
  `credentials: "include"` are rejected.

- **Alternatives rejected:**
  - **Allow anonymous BYO-connect (mint a temp key, adopt on sign-in).** The
    blob is owner-AAD-bound (`GLOBAL-031`); there is no anonymous owner to bind
    to, and a credentialed DB is not the kind of throwaway the anon device cap
    (`SK-ANON-012`) is designed for. Sign-in first is the honest boundary.
  - **Persist the URL to `localStorage` so a refresh keeps it.** A live DB
    credential in `localStorage` is an XSS-exfil target for zero UX gain — the
    POST is a single round trip; a refresh just re-pastes.
  - **A plain `type="text"` URL field.** Shoulder-surfing + browser autofill
    caching of a secret; `type="password"` + `autocomplete="off"` is the
    minimum-trust shape.
  - **Skip the schema preview, redirect straight to `/app?db=<dbId>`.** Drops
    the proof beat — the user never sees that the connection *worked* against
    their real tables before they're dropped into chat; the preview is the
    trust signal that the introspection succeeded.
