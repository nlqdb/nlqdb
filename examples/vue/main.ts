// src/main.ts — Vite + Vue 3.5 entry point.
//
// `configureNlqdb` registers <NlqData> and <NlqAction> globally and
// teaches Vue that the underlying <nlq-data> / <nlq-action> custom
// elements are not Vue components (so it stops warning about them).
// One call, no per-component import needed in templates.

import { createApp } from "vue";
import { configureNlqdb } from "@nlqdb/vue";
import App from "./App.vue";

const app = createApp(App);
configureNlqdb(app);
app.mount("#app");
