/// <reference types="vitest/config" />
// `getViteConfig` wires Astro's `.astro` transform into Vitest so we can
// render components with the Container API.
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {},
});
