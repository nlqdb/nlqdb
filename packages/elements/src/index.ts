// Single entry point. Importing this module:
//   - registers `<nlq-data>` on `customElements` (idempotent)
//   - re-exports the class + template registry for programmatic use
//
// Usage modes:
//   1. CDN script tag — `<script src="https://elements.nlqdb.com/v1.js" type="module">`
//   2. Workspace import — `import "@nlqdb/elements"` from any bundler
//
// Both paths land here; both register the same custom element.

import { NlqDataElement } from "./element.ts";

if (typeof customElements !== "undefined" && !customElements.get("nlq-data")) {
  customElements.define("nlq-data", NlqDataElement);
}

export { NlqDataElement } from "./element.ts";
export { type Row, type TemplateName, templates } from "./templates.ts";
