// See packages/svelte/src/svelte-shim.d.ts.
declare module "*.svelte" {
  import type { Component } from "svelte";

  const value: Component;
  export default value;
}
