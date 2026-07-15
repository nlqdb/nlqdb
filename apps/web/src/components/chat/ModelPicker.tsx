// ModelPicker (SK-PREMIUM-013 / SK-PREMIUM-015) — the "which model am I on /
// pick another" control in the chat header. The pill shows the active model; the
// popover offers the built-in Free chain plus one row per frontier provider
// (Claude / GPT / Gemini / Grok / OpenRouter). Each provider row is collapsed to
// its flagship by default and expands to a searchable model list (type to
// filter) — lean by default, deep on demand. Frontier entries are BYOLLM
// (bring-your-own-key) per GLOBAL-026: selecting one you have no key for opens a
// gentle inline key form (never a wall), and storing it routes every later ask
// through your key. The "subscribe for included credits" door is the
// hosted-premium lane (SK-PREMIUM-009), surfaced as "coming soon" until §6.
//
// The model *strings* never live here: the catalog arrives over the wire from
// `GET /v1/models` (SK-PREMIUM-003), built live from models.dev, so this file
// only renders labels and passes catalog-provided provider/model to `setByollm`.

import type {
  ByollmStatusResponse,
  CatalogModelOption,
  CatalogProvider,
  ModelCatalog,
} from "@nlqdb/sdk";
import { NlqdbApiError } from "@nlqdb/sdk";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getChatClient } from "../../lib/chat-client";
import { resolveProviderRow } from "./model-picker-selection";

// Fired by the free-model nudge (FreeModelNudge, SK-PREMIUM-004) to ask this
// picker to open + scroll into view. The picker owns its open state; the nudge
// only requests it.
export const MODEL_PICKER_OPEN_EVENT = "nlqdb:model-picker:open";
// Fired whenever the BYOLLM status resolves or changes, so the chat panel
// knows whether the user is on the free chain (gates the nudge).
export const BYOLLM_STATUS_EVENT = "nlqdb:byollm-status";

interface ModelPickerProps {
  apiBase: string;
  // The model that answered the most recent reply (from the trace, SK-TRUST-002).
  // Shown inside the popover as the honest "last answer used X" line — distinct
  // from the *configured* selection the pill reflects.
  lastModel?: string | null;
}

// The (provider, model) the user is keying for — set when a model is picked and
// cleared once the key is saved or cancelled.
type KeyTarget = { provider: CatalogProvider; option: CatalogModelOption };

export default function ModelPicker({ apiBase, lastModel }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  // True when the last `GET /v1/models` attempt failed. Surfaced as an inline
  // "Retry" affordance rather than hiding the whole control.
  const [catalogError, setCatalogError] = useState(false);
  const [status, setStatus] = useState<ByollmStatusResponse | null>(null);
  // True when the deployment can't store BYOLLM keys (KEK unset → 503). We still
  // show the picker (Free works) but disable the add-key affordance.
  const [byollmDisabled, setByollmDisabled] = useState(false);
  // Which provider row is expanded (accordion — one open at a time).
  const [openProvider, setOpenProvider] = useState<string | null>(null);
  const [keyTarget, setKeyTarget] = useState<KeyTarget | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // "Count me in" on the hosted-premium teaser. Not persisted: the server dedups
  // repeat clicks per account, so a reload re-showing the button is harmless.
  const [interest, setInterest] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const rootRef = useRef<HTMLDivElement>(null);

  const client = getChatClient(apiBase);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await client.getByollmStatus());
      setByollmDisabled(false);
    } catch (err) {
      // 503 byollm_unavailable = deployment can't seal keys; treat as "Free
      // only". Anything else also falls back to the not-configured empty state.
      if (err instanceof NlqdbApiError && err.code === "byollm_unavailable") {
        setByollmDisabled(true);
      }
      setStatus({ configured: false });
    }
  }, [client]);

  const loadCatalog = useCallback(async () => {
    setCatalogError(false);
    try {
      setCatalog(await client.getModels());
    } catch {
      setCatalogError(true);
    }
  }, [client]);

  useEffect(() => {
    void loadCatalog();
    void refreshStatus();
  }, [loadCatalog, refreshStatus]);

  // Broadcast the resolved BYOLLM status so the chat panel can gate the nudge.
  useEffect(() => {
    if (!status) return;
    window.dispatchEvent(
      new CustomEvent(BYOLLM_STATUS_EVENT, { detail: { configured: status.configured } }),
    );
  }, [status]);

  // Open (and scroll to) the picker when the free-model nudge requests it.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
      if (!catalog) void loadCatalog();
      rootRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    window.addEventListener(MODEL_PICKER_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(MODEL_PICKER_OPEN_EVENT, onOpen);
  }, [catalog, loadCatalog]);

  const closePopover = useCallback(() => {
    setOpen(false);
    setOpenProvider(null);
    setKeyTarget(null);
    setKeyInput("");
    setFormError(null);
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closePopover();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePopover();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closePopover]);

  const credential = status?.configured ? status.credential : null;

  // The active model's label for the pill: match the stored credential against
  // the catalog; fall back to the raw provider·model if it isn't listed.
  const activeLabel = useMemo(() => {
    if (!credential) return "Free";
    for (const p of catalog?.providers ?? []) {
      if (p.provider !== credential.provider) continue;
      const hit = p.models.find((m) => m.model === credential.model);
      if (hit) return hit.label;
    }
    return `${credential.provider} · ${credential.model}`;
  }, [catalog, credential]);

  async function selectFree() {
    if (!credential) {
      closePopover();
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await client.clearByollm();
      await refreshStatus();
      closePopover();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onPickModel(provider: CatalogProvider, option: CatalogModelOption) {
    // Already the active model — nothing to do.
    if (credential?.provider === provider.provider && credential.model === option.model) {
      closePopover();
      return;
    }
    setFormError(null);
    setKeyInput("");
    setKeyTarget({ provider, option });
    setOpenProvider(null);
  }

  async function submitKey() {
    if (!keyTarget) return;
    const key = keyInput.trim();
    if (!key) {
      setFormError("Paste your API key to continue.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await client.setByollm({
        provider: keyTarget.provider.provider,
        model: keyTarget.option.model,
        key,
      });
      await refreshStatus();
      closePopover();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function countMeIn() {
    setInterest("sending");
    try {
      await client.registerPremiumInterest();
      setInterest("sent");
    } catch {
      setInterest("error");
    }
  }

  const providers = catalog?.providers ?? [];

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        type="button"
        className="model-picker__pill"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!catalog) void loadCatalog();
        }}
        title="Choose which model answers your questions"
      >
        <span className="model-picker__pill-label">Model</span>
        <span className="model-picker__pill-value">{activeLabel}</span>
        <span className="model-picker__pill-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="model-picker__panel" role="menu">
          <p className="model-picker__section">Built-in</p>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!credential}
            className="model-picker__option"
            onClick={selectFree}
            disabled={busy}
          >
            <span className="model-picker__option-main">
              <span className="model-picker__option-label">{catalog?.free.label ?? "Free"}</span>
              <span className="model-picker__option-note">
                {catalog?.free.note ?? "Built-in models — no key needed."}
              </span>
            </span>
            {!credential ? <span className="model-picker__active">● Active</span> : null}
          </button>

          <p className="model-picker__section">Frontier models · bring your key</p>
          {!catalog ? (
            <div className="model-picker__catalog-status" aria-live="polite">
              {catalogError ? (
                <>
                  <p className="model-picker__form-note">Couldn't load the model list.</p>
                  <button
                    type="button"
                    className="btn btn--ghost model-picker__retry"
                    onClick={() => void loadCatalog()}
                  >
                    Retry
                  </button>
                </>
              ) : (
                <p className="model-picker__form-note">Loading models…</p>
              )}
            </div>
          ) : (
            <ul className="model-picker__providers">
              {providers.map((p) => (
                <ProviderRow
                  key={p.provider}
                  provider={p}
                  activeModel={credential?.provider === p.provider ? credential.model : null}
                  pendingModel={
                    keyTarget?.provider.provider === p.provider ? keyTarget.option.model : null
                  }
                  expanded={openProvider === p.provider}
                  onToggle={() =>
                    setOpenProvider((cur) => (cur === p.provider ? null : p.provider))
                  }
                  onPick={onPickModel}
                  disabled={busy}
                />
              ))}
            </ul>
          )}

          {keyTarget ? (
            byollmDisabled ? (
              <p className="model-picker__form-note">
                Bring-your-own-key isn't configured on this deployment yet.
              </p>
            ) : (
              <div className="model-picker__form">
                <label className="model-picker__form-label" htmlFor="model-picker-key">
                  {credential?.provider === keyTarget.provider.provider
                    ? `Re-enter your ${keyTarget.provider.keyLabel} key to use ${keyTarget.option.label}`
                    : `Paste your ${keyTarget.provider.keyLabel} key to use ${keyTarget.option.label}`}
                </label>
                <input
                  id="model-picker-key"
                  type="password"
                  className="model-picker__key-input"
                  placeholder={keyTarget.provider.keyPlaceholder}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submitKey();
                    }
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  // biome-ignore lint/a11y/noAutofocus: focus the key field the user just opened
                  autoFocus
                />
                <div className="model-picker__form-actions">
                  <button
                    type="button"
                    className="btn btn--accent model-picker__save"
                    onClick={() => void submitKey()}
                    disabled={submitting}
                  >
                    {submitting ? "Saving…" : "Save & use"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setKeyTarget(null);
                      setKeyInput("");
                      setFormError(null);
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
                <p className="model-picker__form-hint">
                  Dispatched at 0% markup — your key, your bill, never stored in plain text.
                </p>
              </div>
            )
          ) : null}

          {formError ? (
            <p className="model-picker__error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="model-picker__subscribe">
            {interest === "sent" ? (
              <p className="model-picker__subscribe-text">
                You're counted — we'll email you when the paid plan ships.
              </p>
            ) : (
              <>
                <p className="model-picker__subscribe-text">
                  Prefer not to bring a key? A paid plan with included frontier credits is coming
                  soon.
                </p>
                <button
                  type="button"
                  className="btn btn--accent model-picker__countme"
                  onClick={() => void countMeIn()}
                  disabled={interest === "sending"}
                >
                  {interest === "sending" ? "Counting…" : "Count me in"}
                </button>
                {interest === "error" ? (
                  <p className="model-picker__error" role="alert">
                    Couldn't record that — try again.
                  </p>
                ) : null}
              </>
            )}
          </div>
          {lastModel ? <p className="model-picker__last">Last answer used {lastModel}.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

// One provider "row": a brand header that expands into a searchable model list
// (APG combobox pattern — type to filter, arrow keys to move, Enter to pick).
// Collapsed to the flagship by default so five providers don't overwhelm.
function ProviderRow({
  provider,
  activeModel,
  pendingModel,
  expanded,
  onToggle,
  onPick,
  disabled,
}: {
  provider: CatalogProvider;
  activeModel: string | null;
  // The model the user just picked for this provider but hasn't yet activated
  // (its key form is open). Reflected in the sub label + listbox tick so the
  // collapsed row agrees with the "…to use X" key prompt instead of snapping
  // back to the flagship default.
  pendingModel: string | null;
  expanded: boolean;
  onToggle: () => void;
  onPick: (provider: CatalogProvider, option: CatalogModelOption) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // What this row shows (sub label) and whether it's the live model — a pending
  // pick wins so the label follows the click. See resolveProviderRow.
  const { shownModel, shownLabel, isActive } = resolveProviderRow(
    provider,
    activeModel,
    pendingModel,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return provider.models;
    return provider.models.filter(
      (m) => m.label.toLowerCase().includes(q) || m.model.toLowerCase().includes(q),
    );
  }, [provider.models, query]);

  // Focus the search field and reset the filter each time the row opens.
  useEffect(() => {
    if (expanded) {
      setQuery("");
      inputRef.current?.focus();
    }
  }, [expanded]);

  // Enter in the search field picks the top match — the fast path when you've
  // typed enough to narrow the list. Everything else is Tab-to-option +
  // Enter/click on the option's own button (native, fully keyboard-accessible).
  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[0];
      if (opt) onPick(provider, opt);
    }
  }

  return (
    <li className="model-picker__provider">
      <button
        type="button"
        className="model-picker__provider-head"
        aria-expanded={expanded}
        onClick={onToggle}
        disabled={disabled}
      >
        <span className="model-picker__option-main">
          <span className="model-picker__provider-brand">{provider.label}</span>
          <span className="model-picker__option-note">{shownLabel}</span>
        </span>
        {isActive ? (
          <span className="model-picker__active">● Active</span>
        ) : (
          <span className="model-picker__byok-tag">key</span>
        )}
        <span className="model-picker__pill-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {expanded ? (
        <div className="model-picker__combobox">
          <input
            ref={inputRef}
            type="text"
            aria-label={`Search ${provider.label} models`}
            className="model-picker__search"
            placeholder={`Search ${provider.label} models…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <ul className="model-picker__listbox">
            {filtered.length === 0 ? (
              <li className="model-picker__listbox-empty">No matching models</li>
            ) : (
              filtered.map((m) => {
                const selected = m.model === shownModel;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="model-picker__listbox-option"
                      aria-pressed={selected}
                      onClick={() => onPick(provider, m)}
                    >
                      <span className="model-picker__listbox-label">{m.label}</span>
                      {selected ? <span className="model-picker__active">●</span> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof NlqdbApiError) {
    if (err.code === "invalid_byollm_key")
      return err.body?.message ?? "That key looked wrong — check it and try again.";
    if (err.code === "byollm_unavailable")
      return "BYOLLM key storage isn't configured on this deployment.";
    if (err.code === "unauthorized") return "Sign in expired — sign in again to add a key.";
    return err.body?.message ?? "Couldn't save that — try again.";
  }
  return "Couldn't save that — try again.";
}
