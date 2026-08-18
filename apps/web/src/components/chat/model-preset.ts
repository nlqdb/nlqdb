// The web session's model preset (SK-PREMIUM-014). A signed-in web user has no
// API key to hang SK-PREMIUM-019's per-key `default_model` on, so "use the free
// chain instead of my included premium model" is a per-browser preference sent
// as `model: "fast"` on each ask — `fast` pins the strict-$0 chain even over a
// premium entitlement or a stored BYOLLM key (SK-PREMIUM-014). `"auto"` (the
// default) lets the server route: premium for a paid user, free otherwise.
//
// Persisted in localStorage (same home as the chat's per-DB history) and
// broadcast so the chat panel picks up a change without a reload.

export type WebModelPreset = "auto" | "fast";

const KEY = "nlqdb:model-preset";
export const MODEL_PRESET_EVENT = "nlqdb:model-preset";

export function readModelPreset(): WebModelPreset {
  if (typeof localStorage === "undefined") return "auto";
  try {
    return localStorage.getItem(KEY) === "fast" ? "fast" : "auto";
  } catch {
    return "auto";
  }
}

export function writeModelPreset(preset: WebModelPreset): void {
  if (typeof localStorage !== "undefined") {
    try {
      if (preset === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, preset);
    } catch {
      // storage full/unavailable — degrade silently (the ask defaults to auto).
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MODEL_PRESET_EVENT, { detail: { preset } }));
  }
}
