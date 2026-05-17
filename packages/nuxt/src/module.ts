import { fileURLToPath } from "node:url";
import {
  addComponent,
  addImports,
  addPluginTemplate,
  createResolver,
  defineNuxtModule,
} from "@nuxt/kit";

export type NlqdbModuleOptions = {
  /** Public CDN URL for the elements bundle. */
  elementsUrl?: string;
  /** Override the default API base URL (self-host, preview deploys). */
  apiBaseUrl?: string;
  /** Default `pk_live_*` publishable key exposed to the client. */
  publishableKey?: string;
};

export default defineNuxtModule<NlqdbModuleOptions>({
  meta: {
    name: "@nlqdb/nuxt",
    configKey: "nlqdb",
    compatibility: { nuxt: ">=3.13.0" },
  },
  defaults: {
    elementsUrl: "https://elements.nlqdb.com/v1.js",
  },
  setup(options, nuxt) {
    const resolver = createResolver(fileURLToPath(new URL("./runtime/", import.meta.url)));

    nuxt.options.runtimeConfig.public["nlqdb"] = {
      elementsUrl: options.elementsUrl,
      apiBaseUrl: options.apiBaseUrl,
      publishableKey: options.publishableKey,
      ...(nuxt.options.runtimeConfig.public["nlqdb"] as Record<string, unknown> | undefined),
    };

    addComponent({
      name: "NlqData",
      filePath: "@nlqdb/vue",
      export: "NlqData",
    });
    addComponent({
      name: "NlqAction",
      filePath: "@nlqdb/vue",
      export: "NlqAction",
    });

    addImports({
      name: "useNlq",
      from: resolver.resolve("composables"),
    });

    // Client-only — server-side `isCustomElement` is unreliable in Nuxt SSR (nuxt#17263).
    addPluginTemplate({
      filename: "nlqdb.client.mjs",
      getContents: () => `
import { defineNuxtPlugin, useHead, useRuntimeConfig } from '#imports';

export default defineNuxtPlugin({
  name: 'nlqdb',
  enforce: 'pre',
  setup(nuxtApp) {
    const cfg = useRuntimeConfig().public.nlqdb || {};
    const prev = nuxtApp.vueApp.config.compilerOptions.isCustomElement;
    nuxtApp.vueApp.config.compilerOptions.isCustomElement = (tag) =>
      tag === 'nlq-data' || tag === 'nlq-action' || (prev?.(tag) ?? false);
    useHead({
      script: [
        { src: cfg.elementsUrl || 'https://elements.nlqdb.com/v1.js', type: 'module' },
      ],
    });
  },
});
`,
      mode: "client",
    });
  },
});
