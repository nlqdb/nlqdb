// Minimal shim so `tsc --noEmit` resolves the .svelte module without
// running the Svelte compiler. The actual component types are
// covered by the Svelte language tools at consumer build time.
declare module "*.svelte" {
  import type { Component } from "svelte";

  const value: Component;
  export default value;
}
