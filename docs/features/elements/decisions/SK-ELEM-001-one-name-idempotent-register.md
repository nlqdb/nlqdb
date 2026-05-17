# SK-ELEM-001 — One element name per type, idempotent registration

- **Decision:** The package registers two custom elements: `<nlq-data>` (reads) and `<nlq-action>` (writes). The first script-tag or workspace import calls `customElements.define("nlq-data", NlqDataElement)` and `customElements.define("nlq-action", NlqActionElement)`; subsequent imports are a no-op (idempotent registration). No other elements ship under this package.
- **Core value:** Simple, Effortless UX, Goal-first
- **Why:** The pitch is "drop one HTML tag, get a backend" — keeping the surface to a tight pair (read + write) preserves the one-mental-model promise. Idempotent registration means a page that imports the package twice (e.g. via two unrelated bundles or a CDN tag plus a workspace import) doesn't throw `NotSupportedError: this name has already been used`.
- **Consequence in code:** `packages/elements/src/index.ts` is the only place `customElements.define` is called. New element types require a new package slot under `packages/elements/` *or* an explicit decision in `docs/decisions.md` to expand the surface (per `GLOBAL-017`-style discipline). CI tests assert that double-import is a no-op.
- **Alternatives rejected:**
  - Auto-define a family of related elements per import — more cognitive load for the embedder; if they only want `<nlq-data>` they shouldn't have `<nlq-action>` registered.
  - Defer registration to a function call (`registerElements()`) — adds boilerplate to the marketing pitch ("drop one tag" becomes "drop one tag and call this thing").
