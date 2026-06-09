# @nlqdb/astro

Astro 6 integration for [`<nlq-data>`](../elements) + [`<nlq-action>`](../elements). Injects the elements CDN bundle on every page and ships typed `<NlqData />` and `<NlqAction />` Astro components.

## Install

```sh
bun add @nlqdb/astro @nlqdb/elements
```

```ts
// astro.config.mjs
import { defineConfig } from "astro/config";
import nlqdb from "@nlqdb/astro";

export default defineConfig({
  integrations: [nlqdb()],
});
```

## Usage

```astro
---
import { NlqData } from "@nlqdb/astro/NlqData.astro";
const apiKey = import.meta.env.PUBLIC_NLQDB_KEY;
---

<NlqData
  goal="today's revenue by drink"
  api-key={apiKey}
  template="table"
  refresh="60s"
/>
```

Writes use [`NlqAction.astro`](./src/NlqAction.astro):

```astro
---
import { NlqAction } from "@nlqdb/astro/NlqAction.astro";
---
<form id="order-form">
  <input name="customer" />
  <NlqAction goal="log this order" form="order-form" api-key={apiKey}>Submit</NlqAction>
</form>
```

Or use the bare tags — Astro is custom-element-friendly out of the box:

```astro
<nlq-data goal="…" api-key="pk_live_…" template="table"></nlq-data>
<nlq-action goal="…" api-key="pk_live_…" form="order-form">Submit</nlq-action>
```

## Self-host / preview deploys

```ts
// astro.config.mjs
integrations: [nlqdb({ src: "/local/v1.js" })],
```

The integration runs once per page (via `astro:config:setup` → `injectScript('page', ...)`). The injected snippet only appends the `<script type="module">` if the element hasn't already been defined, so repeated navigation in client-side routers doesn't re-inject.
