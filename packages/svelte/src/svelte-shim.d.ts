// Shim lets `tsc --noEmit` resolve .svelte imports — real types come from svelte-check.
declare module "*.svelte" {
  import type { Component } from "svelte";

  const value: Component;
  export default value;
}
