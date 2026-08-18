# SK-ERR-002 — The wire discriminant is `code`, and copy is server-rendered

Parent feature: [`error-taxonomy/FEATURE.md`](../FEATURE.md).

- **Decision:** Every non-2xx body is
  `{ error: { code, message, action, retryable, params? } }`, rendered from the
  registry by `apps/api/src/error-envelope.ts`. The field is `code`, not
  `status` — a clean rename across the API, the SDK, the framework wrappers, the
  elements bundle and the Go client, with **no back-compat alias**. The registry
  also owns the HTTP status, so the hand-kept `code → status` switches
  (`errorStatus` / `runErrorStatus` / `rememberErrorStatus`) are deleted.
  User-visible wording therefore deploys with the API, not with the surface.
- **Core value:** Simple, Bullet-proof
- **Why:** `status` collided with the HTTP status at every call site
  (`error.status` vs `res.status`), and the API emitted *two* envelope shapes —
  the object form and a bare `{error:"invalid_json"}` string form from the body
  parsers — so every client carried a normaliser. One shape, one field name.
  Pre-beta, `P5` prefers clean code to compatibility, so aliasing both for a
  release would buy nothing but a second thing to delete.
  Server-owned copy is the point, not a side effect: it is what makes a wording
  fix reach a two-release-old CLI, a raw `fetch` consumer, and every surface at
  once. It also collapses the code→status mapping to one source, which had
  already drifted (`schema_unavailable` was 422 in one mapper and 502 in the
  registry draft).
- **Consequence in code:** `errorEnvelope(error)` accepts params either flat
  beside `code` (how the orchestrators build them) or nested under `params` (how
  the body parsers do), and hands one object to `renderError`. `fail(c, code,
  params)` covers guards; `failUnknown(c, slug)` renders a code that arrived as a
  string and falls back to `internal_error` rather than shipping a bare slug with
  no copy. The Go client reads `retryable` and stops retrying deterministic 5xx —
  previously a rejected BYOLLM key was re-sent three times because the only
  signal was "502".
- **Alternatives rejected:**
  - **Ship `status` and `code` for one release.** Two names for one field, plus
    a deprecation to track, in a product with no external API consumers to
    protect yet.
  - **Keep the string form for parse errors.** It is the shape that gave
    `goal_too_long` a bespoke `maxLength` field only the SDK knew how to read.
  - **Keep the `code → status` switch in `index.ts` for exhaustiveness.** The
    registry's compile-time completeness guard gives the same protection without
    a second list to keep in sync.
