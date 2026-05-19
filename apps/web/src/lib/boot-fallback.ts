// Canonical filter for the `is:inline` boot-script in `Base.astro` (SK-WEB-001); the hand-copy there mirrors `EXTENSION_PREFIXES` exactly — the sync test pins it.

export interface BootErrorLike {
  filename?: string | null;
}

// Mirrors Sentry Relay's `browser_extensions.rs` denylist (`^chrome(-extension)?://`, `^moz-extension://`, `^safari(-web)?-extension://`, `webkit-masked-url`) — extension content scripts + Chromium browser-chrome internals.
export const EXTENSION_PREFIXES: readonly string[] = [
  "chrome://",
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
  "safari-extension://",
  "webkit-masked-url://",
];

export function isExternalNoise(event: BootErrorLike | null | undefined, message: string): boolean {
  // Cross-origin throws get anonymised to this exact string with no usable stack.
  if (message === "Script error.") return true;
  const filename = event?.filename ? String(event.filename) : "";
  if (!filename) return false;
  return EXTENSION_PREFIXES.some((p) => filename.startsWith(p));
}
