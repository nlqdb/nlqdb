# SK-AUTH-020 — Cookie cache fails open on KV outage

- **Decision:** When the KV revocation-set check (`SK-AUTH-007`) cannot
  reach KV, session validation **fails open**: a request bearing a valid,
  unexpired signed session cookie is trusted **up to the cookie's own
  expiry**, skipping the revocation check for the duration of the KV
  outage. Revocation resumes the moment KV is reachable again.
- **Core value:** Seamless auth (tokens refresh silently — never surface
  a 401), Effortless UX
- **Why:** KV is the revocation oracle, not the authentication oracle —
  the cookie signature already proves identity. A KV blip is rare and
  brief, and failing closed would log out **every** active user (and
  break silent refresh, `GLOBAL-009`) for an outage that has nothing to
  do with their session. Availability of an already-authenticated session
  is the higher value here; the founder chose maximal availability over
  the tighter revocation window.
- **Consequence in code:** The session middleware treats a KV
  read error on the revocation lookup as "not revoked" and proceeds on
  the cookie's validity. **Honest trade-off:** during a KV outage a
  *revoked* session stays valid until the session cookie itself expires —
  the revocation window is the full cookie lifetime, not the short
  cookie-cache TTL. This is acceptable because (a) revocation is a rare
  event intersecting an even rarer KV outage, and (b) high-stakes
  mutations have their own guards (key mint is `SK-APIKEYS-002`
  copy-once; billing is Stripe-side). If a future audit needs a tighter
  bound, revisit with a fail-closed-within-TTL variant. A KV-unreachable
  fail-open emits one `warn` log per `guidelines.md §5`.
- **Alternatives rejected:**
  - **Always fail-closed** — a KV blip logs everyone out and breaks
    `GLOBAL-009` silent refresh; trades broad availability for a rare
    revocation edge.
  - **Fail-open only within the short cookie-cache TTL, then closed** —
    bounds the revocation window tighter, but still forces re-auth mid
    outage once caches expire; rejected in favour of maximal availability.
