# @nlqdb/astro

Astro 5 integration for [`<nlq-data>`](../elements). Injects the elements CDN bundle on every page and ships a typed `<NlqData />` Astro component.

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

Or use the bare tag — Astro is custom-element-friendly out of the box:

```astro
<nlq-data goal="…" api-key="pk_live_…" template="table"></nlq-data>
```

## Self-host / preview deploys

```ts
// astro.config.mjs
integrations: [nlqdb({ src: "/local/v1.js" })],
```

The integration runs once per page (via `astro:config:setup` → `injectScript('page', ...)`). The injected snippet only appends the `<script type="module">` if the element hasn't already been defined, so repeated navigation in client-side routers doesn't re-inject.
