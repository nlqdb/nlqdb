# SK-WEB-030 — OAuth-first `/app/connect`: "Connect Supabase" button leads; paste stays the fallback

- **Status:** Supersedes **SK-WEB-019** *in part*, **staged**. The "lead with a
  paste field" structure is replaced by the provider-button row; the paste form's
  *collapse* into a `<details>` waits until ≥ 2 providers are OAuth-live (Stage 2).
  SK-WEB-019's auth-guard, `type="password"`, and never-persist-client-side
  invariants are **retained** and govern the paste form unchanged in both stages.
- **Decision:** `/app/connect` renders a provider **Connect** button row above the
  paste `ConnectForm`. Stage 1 (one live provider — Supabase): the button leads and
  the paste form stays **fully visible** beneath it. "Connect Supabase" is a plain
  top-level navigation to `GET /v1/db/connect/oauth/supabase/start` (no secret typed
  into nlqdb). The callback returns to `/app/connect` with a one-key status the
  island reads on mount and then strips from the URL: `?connected=<dbId>` (connected
  card + "Question it now →"), `?error=<code>` (one-sentence action-first message,
  `GLOBAL-012`), or `?pick=<pickId>` (multi-project **picker** — lists the account's
  projects and POSTs the chosen ref; it never auto-selects, since the account may
  hold a production DB). Honest pre-redirect copy names the write scope the consent
  screen shows and that nlqdb only ever runs read-only queries (`SK-DBCONN-003` uses
  `read_only:true`, creating no role).
- **Core value:** Effortless UX, Goal-first, Seamless auth, Bullet-proof
- **Why:** Pasting a live DSN is the highest-friction, highest-trust-cost first
  step; a "Connect" button that approves on the provider side removes both the
  copy-paste and the "am I handing my prod password to a stranger" hesitation. It
  reaches the same schema-preview → "Question it now" wow beat with fewer decisions
  and no secret typed (`P6`). Demoting (not deleting) paste keeps self-hosted /
  no-OAuth providers first-class.
- **Consequence in code:** `ConnectForm.tsx` gains a `ProviderRow`, a
  `ConnectedCard`, and a `ProjectPicker`, plus mount-time parsing of the callback
  params; `lib/connect.ts` gains `listPickProjects` / `selectPickProject` /
  `oauthConnectErrorMessage`; `connect.astro` gains the provider + picker CSS. The
  paste `ConnectForm` behavior is unchanged (SK-WEB-019 invariants intact). Backend:
  `SK-DBCONN-003`. Reviewers reject: a paste field that regresses the SK-WEB-019
  secrecy invariants; an OAuth success that skips the schema-preview / connected
  proof beat; a picker that silently defaults to the first project; collapsing paste
  while fewer than two providers are OAuth-live.
- **Alternatives rejected:**
  - **Remove paste entirely.** Strands self-hosted / no-OAuth providers (ClickHouse
    Cloud, RDS, …). The fallback must stay.
  - **A separate `/app/connect/oauth` page.** Two connect surfaces; one page with a
    primary path + fallback is the `GLOBAL-017` shape.
  - **Keep paste primary, OAuth as a small link.** Under-delivers the "one click,
    approve on your side" promise that is the whole point.
- **Source:** canonical here · supersedes-in-part `SK-WEB-019` · backend
  `SK-DBCONN-003`.
