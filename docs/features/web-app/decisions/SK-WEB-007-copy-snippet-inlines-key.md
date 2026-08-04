# SK-WEB-007 — "Copy snippet" inlines the user's `pk_live_` so the key is never a separate errand

- **Decision:** Every chat-generated `<nlq-data>` snippet has the user's
  `pk_live_<dbId>` already inlined when copied. Anonymous users get a
  temporary `pk_live_` that rotates to a permanent one on sign-in. The user
  never has to open the dashboard, find the keys page, click "Reveal", and
  paste.
- **Core value:** Effortless UX, Goal-first, Seamless auth
- **Why:** Getting an API key is the kind of side errand that breaks the
  goal-first flow. The user wanted an embed; making them collect a key first
  interrupts the moment. Inlining the key in the chat-copy action keeps the
  user inside one window. For anonymous users, rotating the key on sign-in is
  the seamless adoption path (`GLOBAL-007`).
- **Consequence in code:** Chat panel's "Copy snippet" CTA pre-fills
  `api-key="pk_live_…"` server-side from the user's (or anonymous device's)
  per-DB key. The temporary anonymous key is rotated to a permanent one on
  sign-in via the same endpoint that adopts the anonymous DB. Tested
  end-to-end in `docs/features/elements/FEATURE.md`. The marketing-page
  create-result surfaces the *shape* of the same snippet but defers key
  inlining to the chat — see `SK-WEB-010`.
- **Alternatives rejected:**
  - Show the key in the chat as text + ask the user to copy it — extra step,
    easy to lose, leaks into chat history.
  - Require sign-in before "Copy snippet" works — breaks the no-login-wall
    promise.
