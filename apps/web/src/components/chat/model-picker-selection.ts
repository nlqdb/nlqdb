// Pure selection-resolution for the ModelPicker provider rows (SK-PREMIUM-013 /
// SK-PREMIUM-015). Kept out of the component so the "which model does this row
// show, and is it the live one" logic is unit-testable — the row's sub label
// silently regressing (it did: it used to ignore the just-picked model) is the
// exact class of bug a test locks down.

export type SelectableModel = { label: string; model: string };

export type ProviderRowInput = {
  // Flagship / default model id — shown when nothing else is selected.
  defaultModel: string;
  // Brand label, the last-resort sub-label fallback.
  label: string;
  models: SelectableModel[];
};

export type ProviderRowSelection = {
  // The model id the collapsed row represents.
  shownModel: string;
  // Its display label (the sub label under the brand).
  shownLabel: string;
  // Whether the row is the account's live model — "● Active" vs the "key" tag.
  isActive: boolean;
};

// Resolve what a provider row shows. Precedence: a pending pick (the model the
// user just chose, its key form open) wins so the sub label follows the click;
// else the active model if this provider is live; else the flagship default. A
// pending pick is never "active" — it isn't live until its key saves, so the
// row shows the "key" tag, not "● Active".
export function resolveProviderRow(
  provider: ProviderRowInput,
  activeModel: string | null,
  pendingModel: string | null,
): ProviderRowSelection {
  const shownModel = pendingModel ?? activeModel ?? provider.defaultModel;
  const shownLabel =
    provider.models.find((m) => m.model === shownModel)?.label ??
    provider.models[0]?.label ??
    provider.label;
  const isActive = pendingModel === null && activeModel !== null;
  return { shownModel, shownLabel, isActive };
}
