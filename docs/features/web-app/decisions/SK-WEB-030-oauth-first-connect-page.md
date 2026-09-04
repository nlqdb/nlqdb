# SK-WEB-030 — OAuth-first `/app/connect`: engine-scoped, one CTA at a time

- **Status:** Replaces **SK-WEB-019** *in part*. The connect surface is
  **engine-scoped with exactly one CTA visible at a time**, gated by the engine
  select and a Supabase-OAuth checkbox. This replaces the earlier
  "provider-Connect-button-row above an always-visible paste form" layout (two
  competing CTAs), which read as confusing. SK-WEB-019's auth-guard,
  `type="password"`, and never-persist-client-side invariants are **retained** and
  govern the paste form unchanged.
- **Decision:** `/app/connect` renders one `ConnectForm` whose body follows the
  engine select. **Postgres** shows a **"Connect with Supabase OAuth" checkbox**,
  **on by default** (OAuth is the supported Supabase transport, `SK-DBCONN-003`):
  checked ⇒ the paste fields are hidden and the sole CTA is **"Connect Supabase →"**
  (a plain top-level navigation to `GET /v1/db/connect/oauth/supabase/start`, no
  secret typed into nlqdb); unchecked ⇒ the paste form returns for a raw Postgres
  DSN. **ClickHouse** has no OAuth, so no checkbox — paste-only. The callback
  returns to `/app/connect` with a one-key status the island reads on mount and then
  strips from the URL: `?connected=<dbId>` (connected card + "Question it now →"),
  `?error=<code>` (one-sentence action-first message, `GLOBAL-012`; codes include
  `empty_schema` for a connected project whose `public` schema has no tables), or
  `?pick=<pickId>` (multi-project **picker** — lists the account's projects and
  POSTs the chosen ref; it never auto-selects, since the account may hold a
  production DB). Honest pre-redirect copy names the write scope the consent screen
  shows and that nlqdb only ever runs read-only queries (`SK-DBCONN-003` uses
  `read_only:true`, creating no role).
- **Core value:** Effortless UX, Goal-first, Seamless auth, Bullet-proof
- **Why:** Pasting a live DSN is the highest-friction, highest-trust-cost first
  step; a "Connect" button that approves on the provider side removes both the
  copy-paste and the "am I handing my prod password to a stranger" hesitation. It
  reaches the same schema-preview → "Question it now" wow beat with fewer decisions
  and no secret typed (`P6`). Demoting (not deleting) paste keeps self-hosted /
  no-OAuth providers first-class.
- **Consequence in code:** `ConnectForm.tsx` gates its body on
  `engine === "postgres" && useSupabaseOauth` (checkbox on) — the single Supabase
  CTA — else the paste form; it also holds `ConnectedCard` + `ProjectPicker` and
  mount-time parsing of the callback params. `lib/connect.ts` carries
  `listPickProjects` / `selectPickProject` / `oauthConnectErrorMessage` (incl. the
  `empty_schema` message); `connect.astro` carries the checkbox + picker CSS.
  Backend: `SK-DBCONN-003` — `connectSupabaseMgmt` returns `422` when the introspected
  `public` schema is empty, and the callback maps it to `?error=empty_schema`.
  Reviewers reject: more than one CTA visible at once; a paste field that regresses
  the SK-WEB-019 secrecy invariants; an OAuth success that skips the schema-preview /
  connected proof beat; a picker that silently defaults to the first project.
- **Alternatives rejected:**
  - **Remove paste entirely.** Strands self-hosted / no-OAuth providers (ClickHouse
    Cloud, RDS, …). The fallback must stay.
  - **A separate `/app/connect/oauth` page.** Two connect surfaces; one page with a
    primary path + fallback is the `GLOBAL-017` shape.
  - **Keep paste primary, OAuth as a small link.** Under-delivers the "one click,
    approve on your side" promise that is the whole point.
- **Source:** canonical here · replaces-in-part `SK-WEB-019` · backend
  `SK-DBCONN-003`.
