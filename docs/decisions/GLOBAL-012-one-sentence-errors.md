# GLOBAL-012 — Errors are one sentence with the next action

- **Decision:** Every user-facing error message is one sentence and
  contains an actionable next step. No stack traces in the surface.
  No "an error occurred." No multi-paragraph debug dumps.
- **Core value:** Effortless UX, Honest latency, Simple
- **Why:** Error messages are a UI surface. Long error messages train
  users not to read them; vague ones train users not to trust them.
  One sentence with a next action is read, understood, and acted on.
- **Consequence in code:** Every `throw` / `error()` call in user-
  facing paths returns a `code` (machine-readable) + `message` (one
  sentence) + `action` (what to do). Surfaces render `message` and
  optionally a CTA derived from `action`. Stack traces go to OTel
  spans, not to the user.
- **Alternatives rejected:**
  - Surface the underlying exception — leaks internals, scares users.
  - Generic "something went wrong" — prevents the user from helping
    themselves.
