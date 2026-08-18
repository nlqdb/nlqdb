// ModelPicker (SK-PREMIUM-013 / SK-PREMIUM-015) — the "which model am I on /
// pick another" control in the chat header. The pill shows the active model; the
// popover offers the built-in Free chain plus one row per frontier provider
// (Claude / GPT / Gemini / Grok / OpenRouter). Each provider row is collapsed to
// its flagship by default and expands to a searchable model list (type to
// filter) — lean by default, deep on demand. Frontier entries are BYOLLM
// (bring-your-own-key) per GLOBAL-026: selecting one you have no key for opens a
// gentle inline key form (never a wall), and storing it routes every later ask
// through your key. The "subscribe for included credits" door is the
// hosted-premium lane (SK-PREMIUM-009) — a real subscribe CTA when the
// catalog reports `premium.live`, "coming soon" + interest capture otherwise.
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
import type { BillingStatus, BillingUsage } from "../../lib/billing";
import {
  fetchBillingStatus,
  fetchBillingUsage,
  formatPlanEndDate,
  openBillingPortal,
} from "../../lib/billing";
import { getChatClient } from "../../lib/chat-client";
import { resolveModelHealth, resolveProviderRow } from "./model-picker-selection";
import {
  MODEL_PRESET_EVENT,
  readModelPreset,
  type WebModelPreset,
  writeModelPreset,
} from "./model-preset";

// Fired by the free-model nudge (FreeModelNudge, SK-PREMIUM-004) to ask this
// picker to open + scroll into view. The picker owns its open state; the nudge
// only requests it.
export const MODEL_PICKER_OPEN_EVENT = "nlqdb:model-picker:open";
// Fired whenever the BYOLLM status resolves or changes, so the chat panel
// knows whether the user is on the free chain (gates the nudge).
export const BYOLLM_STATUS_EVENT = "nlqdb:byollm-status";

interface ModelPickerProps {
  apiBase: string;
  // The most recent reply's id + the model that answered it (from the trace,
  // SK-TRUST-002). Shown inside the popover as the honest "last answer used X"
  // line — distinct from the *configured* selection the pill reflects. The id
  // lets the picker tell whether that answer predates the current credential
  // (a just-switched key has no answer of its own yet — #948).
  lastAnswer?: { id: string; model: string } | null;
  // The id of the most recent settled reply that FAILED on a model/key-quality
  // code, or null. A BYOLLM lane fails loud with no trace (SK-LLM-016), so this
  // is the only signal that a stored key was just rejected — the picker uses it
  // to warn "your key isn't answering" (same stale-evidence gating as #948).
  lastFailedId?: string | null;
}

// The (provider, model) the user is keying for — set when a model is picked and
// cleared once the key is saved or cancelled.
type KeyTarget = { provider: CatalogProvider; option: CatalogModelOption };

export default function ModelPicker({ apiBase, lastAnswer, lastFailedId }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  // True when the last `GET /v1/models` attempt failed. Surfaced as an inline
  // "Retry" affordance rather than hiding the whole control.
  const [catalogError, setCatalogError] = useState(false);
  const [status, setStatus] = useState<ByollmStatusResponse | null>(null);
  // The caller's own billing plan (SK-PREMIUM-009). Null until the first fetch
  // (or on any failure — progressive enhancement). Drives the subscribe block so
  // a paying customer is never upsold their own plan (Bug B). Fetched on every
  // picker open, not once per page load: the popover re-checks after the
  // checkout→webhook race resolves.
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  // Current-period hosted-premium allowance (SK-PREMIUM-009), shown as
  // "consumed/included credits" on the premium built-in row. Null until fetched
  // (or on failure) — progressive enhancement, like billing.
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  // The web-session model preset (SK-PREMIUM-014). `fast` lets a paid user pin
  // the free chain over their included premium model.
  const [preset, setPreset] = useState<WebModelPreset>(() => readModelPreset());
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
  // The last answer that already existed when the user last switched keys —
  // stamped in `submitKey`. Any answer with a different reply id came in after
  // the switch, so only those count as evidence about the current key. Null
  // until the first switch this session: a page reload trusts the persisted
  // answer for the loaded credential (best-effort; self-heals on the next ask).
  const staleEvidenceIdRef = useRef<string | null>(null);
  // Same idea for the fail-loud path: the last *failure* id that already stood
  // when the current key was set. A failure produced by the key it replaced
  // (or by the free chain before any key) must not warn against the new key —
  // `staleEvidenceIdRef` can't gate this because it holds an *answer* id, and a
  // failure reply carries a different id (#948).
  const staleFailedIdRef = useRef<string | null>(null);

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

  // `fetchBillingStatus` never throws (returns null on any failure), so a billing
  // outage just leaves the free-user door in place.
  const refreshBilling = useCallback(async () => {
    setBilling(await fetchBillingStatus(apiBase));
  }, [apiBase]);

  // `fetchBillingUsage` never throws (returns null on failure), so a usage
  // outage just hides the credits line rather than breaking the picker.
  const refreshUsage = useCallback(async () => {
    setUsage(await fetchBillingUsage(apiBase));
  }, [apiBase]);

  // Re-check billing + usage each time the popover opens — self-heals the
  // "activating" state (SK-PREMIUM-009 webhook race) and refreshes the credits
  // count after a query spends one.
  useEffect(() => {
    if (open) {
      void refreshBilling();
      void refreshUsage();
    }
  }, [open, refreshBilling, refreshUsage]);

  // Keep the local preset in sync if another instance changes it.
  useEffect(() => {
    function onPreset(e: Event) {
      const d = (e as CustomEvent<{ preset: WebModelPreset }>).detail;
      if (d?.preset) setPreset(d.preset);
    }
    window.addEventListener(MODEL_PRESET_EVENT, onPreset);
    return () => window.removeEventListener(MODEL_PRESET_EVENT, onPreset);
  }, []);

  const onManageBilling = useCallback(() => {
    void openBillingPortal(apiBase).then((outcome) => {
      if (outcome !== "ok") setFormError("Couldn't open billing — try again.");
    });
  }, [apiBase]);

  useEffect(() => {
    void loadCatalog();
    void refreshStatus();
    // Fetch billing on mount too (not only on popover open) so the pill and the
    // free-chain broadcast reflect a paid plan's auto-routed premium model
    // before the user ever opens the picker (SK-PREMIUM-020 / SK-PREMIUM-013).
    void refreshBilling();
    void refreshUsage();
  }, [loadCatalog, refreshStatus, refreshBilling, refreshUsage]);

  const credential = status?.configured ? status.credential : null;

  // A paid, active plan on a live-premium deployment is ENTITLED to the
  // hosted-premium model (SK-PREMIUM-009). Entitlement is independent of whether
  // a BYOLLM key is also stored, so the premium built-in row stays listed even
  // when a frontier key is active (#5 — it used to vanish, then reappear and
  // steal the selection when the user picked Free).
  const isPaidActive =
    (billing?.plan === "hobby" || billing?.plan === "pro") && billing?.status === "active";
  const premiumEntitled = isPaidActive && (catalog?.premium?.live ?? false);
  const premiumLiveModel = catalog?.premium?.models.find((m) => m.status === "live") ?? null;
  const planLabel = billing?.plan === "pro" ? "Pro" : "Hobby";
  // The only way a paying customer can choose "Free": `fast` pins the free chain
  // over the premium entitlement (SK-PREMIUM-014). They have no API key to hang
  // a per-key default on (SK-PREMIUM-019), so it's a per-browser preference.
  const freePinned = preset === "fast";
  // The built-in lane live right now. A stored BYOLLM key wins (a frontier
  // provider row is active, neither built-in is); else `fast` pins Free; else a
  // paid user is on premium; else Free. `premiumActive` (broadcast to the chat
  // panel) is exactly "on the premium lane" so the free-model nudge fires again
  // when a paid user has pinned Free.
  const premiumBuiltinActive = premiumEntitled && !credential && !freePinned;
  const freeBuiltinActive = !credential && !premiumBuiltinActive;

  // Broadcast the resolved BYOLLM status so the chat panel can gate the nudge.
  // `premiumActive` rides along so a paid user (auto-routed to the premium
  // model, not the free chain) never sees the "the free model sucks" nudge — the
  // bug where a paying customer got the free-chain nudge on a premium failure.
  useEffect(() => {
    if (!status) return;
    window.dispatchEvent(
      new CustomEvent(BYOLLM_STATUS_EVENT, {
        detail: { configured: status.configured, premiumActive: premiumBuiltinActive },
      }),
    );
  }, [status, premiumBuiltinActive]);

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

  // The active model's label for the pill: the hosted-premium model on a paid
  // plan, else match the stored BYOLLM credential against the catalog; fall
  // back to the raw provider·model if it isn't listed.
  const activeLabel = useMemo(() => {
    if (!credential)
      return premiumBuiltinActive ? (premiumLiveModel?.label ?? "Included model") : "Free";
    for (const p of catalog?.providers ?? []) {
      if (p.provider !== credential.provider) continue;
      const hit = p.models.find((m) => m.model === credential.model);
      if (hit) return hit.label;
    }
    return `${credential.provider} · ${credential.model}`;
  }, [catalog, credential, premiumBuiltinActive, premiumLiveModel]);

  const lastModel = lastAnswer?.model ?? null;
  // Is the configured key actually answering? When it isn't (e.g. the account
  // BYOLLM lane silently degraded to the free chain, #941), the pill must not
  // keep claiming the frontier model — surface the truth from the last answer's
  // trace model (SK-TRUST-002). Only meaningful once a key is configured, and
  // only for an answer that ran *after* the current key was selected — a
  // just-switched key inherits no verdict from the model it replaced (#948).
  const lastModelUnderCurrentCredential =
    lastAnswer != null && lastAnswer.id !== staleEvidenceIdRef.current;
  const health = resolveModelHealth(
    credential?.model ?? null,
    lastModel,
    lastModelUnderCurrentCredential,
  );
  // A BYOLLM key that hard-failed the last ask (SK-LLM-016 fail-loud, no trace
  // to reconcile). Only counts a failure produced *after* the current key was
  // selected — same stale-evidence gating as the trace-based degrade (#948).
  const keyFailed =
    credential != null && lastFailedId != null && lastFailedId !== staleFailedIdRef.current;
  // Either signal — a silent free-chain degrade (trace mismatch) or a hard
  // failure — means the pill must not keep claiming a healthy key.
  const showKeyWarning = health.degraded || keyFailed;

  // Switch to a built-in lane. `nextPreset` records the preset the chat sends on
  // later asks: `fast` pins the free chain (the paid user's only route to Free,
  // SK-PREMIUM-014); `auto` lets the server route (premium for a paid user).
  // Clearing any stored BYOLLM key is part of choosing a built-in lane, so the
  // pill and the effective lane can never disagree.
  async function selectBuiltin(nextPreset: WebModelPreset) {
    writeModelPreset(nextPreset);
    setPreset(nextPreset);
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

  // Free is `fast` only for a paid user (pins free over their premium
  // entitlement); a free user has nothing to pin, so it's plain `auto` — that
  // way a later upgrade isn't silently stuck on the free chain.
  const selectFree = () => selectBuiltin(premiumEntitled ? "fast" : "auto");
  const selectPremium = () => selectBuiltin("auto");

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
      // A `fast` pin would override the key the user just chose (SK-PREMIUM-014),
      // so choosing a frontier model clears it back to `auto`.
      writeModelPreset("auto");
      setPreset("auto");
      // The key just changed. Whatever answer stands now was produced by the
      // *previous* model, so it can't tell us whether this new key answers —
      // remember it, and only a later reply (a new id) proves the new key.
      staleEvidenceIdRef.current = lastAnswer?.id ?? null;
      staleFailedIdRef.current = lastFailedId ?? null;
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
        className={`model-picker__pill${showKeyWarning ? " model-picker__pill--degraded" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!catalog) void loadCatalog();
        }}
        title={
          health.degraded
            ? `Your ${activeLabel} key isn't answering — the last answer ran on ${health.ranOn} (free chain). Check your key.`
            : keyFailed
              ? `Your ${activeLabel} key returned an error on the last question — check that it's valid.`
              : "Choose which model answers your questions"
        }
      >
        <span className="model-picker__pill-label">Model</span>
        <span className="model-picker__pill-value">{activeLabel}</span>
        {showKeyWarning ? (
          <span className="model-picker__pill-warn" aria-hidden="true" title="Key not active">
            ⚠
          </span>
        ) : null}
        <span className="model-picker__pill-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="model-picker__panel" role="menu">
          <p className="model-picker__section">Built-in</p>
          {premiumEntitled ? (
            // Paid plan → the hosted-premium model is an included lane
            // (SK-PREMIUM-009). Always listed (even with a BYOLLM key active, #5);
            // active only when it's the live lane. Clicking pins `auto` and drops
            // any stored key so queries route here.
            <button
              type="button"
              role="menuitemradio"
              aria-checked={premiumBuiltinActive}
              className="model-picker__option"
              onClick={() => void selectPremium()}
              disabled={busy}
            >
              <span className="model-picker__option-main">
                <span className="model-picker__option-label">
                  {premiumLiveModel?.label ?? "Included model"}
                </span>
                <span className="model-picker__option-note model-picker__option-note--wrap">
                  Included with your {planLabel} plan — no key needed.
                </span>
                {usage ? (
                  <span className="model-picker__credits">
                    {usage.consumed} / {usage.included} credits used this month
                  </span>
                ) : null}
              </span>
              {premiumBuiltinActive ? <span className="model-picker__active">● Active</span> : null}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={freeBuiltinActive}
            className="model-picker__option"
            onClick={() => void selectFree()}
            disabled={busy}
          >
            <span className="model-picker__option-main">
              <span className="model-picker__option-label">{catalog?.free.label ?? "Free"}</span>
              <span className="model-picker__option-note">
                {premiumEntitled
                  ? "Built-in models — skips your premium credits."
                  : (catalog?.free.note ?? "Built-in models — no key needed.")}
              </span>
            </span>
            {freeBuiltinActive ? <span className="model-picker__active">● Active</span> : null}
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

          <SubscribeBlock
            billing={billing}
            premiumLive={catalog?.premium?.live ?? false}
            allowance={catalog?.premium?.allowance}
            interest={interest}
            onCountMeIn={() => void countMeIn()}
            onManageBilling={onManageBilling}
          />
          {health.degraded ? (
            <p className="model-picker__degraded" role="alert">
              Your {activeLabel} key isn't answering — the last answer ran on{" "}
              <strong>{health.ranOn}</strong> (free chain). Check that the key is valid, or the
              deployment may not have a frontier lane configured.
            </p>
          ) : keyFailed ? (
            <p className="model-picker__degraded" role="alert">
              Your {activeLabel} key returned an error on the last question. Bring-your-own-key
              models aren't retried on the free chain — check the key is valid and has quota, or
              switch to a built-in model above.
            </p>
          ) : lastModel ? (
            <p className="model-picker__last">Last answer used {lastModel}.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// The bottom "prefer not to bring a key?" door (SK-PREMIUM-009 / SK-PREMIUM-013).
// Four honest states keyed off the caller's own billing plan so a paying
// customer is never upsold their own plan (Bug B). Pure/presentational — all
// data arrives as props — so it renders (and tests) without effects.
export function SubscribeBlock({
  billing,
  premiumLive,
  allowance,
  interest,
  onCountMeIn,
  onManageBilling,
}: {
  billing: BillingStatus | null;
  premiumLive: boolean;
  // `catalog.premium.allowance` — { hobby: 200, pro: 600 }, keyed by plan.
  allowance: Record<string, number> | undefined;
  interest: "idle" | "sending" | "sent" | "error";
  onCountMeIn: () => void;
  onManageBilling: () => void;
}) {
  const plan = billing?.plan;
  const isPaidPlan = plan === "hobby" || plan === "pro";

  // State 1 — active paid plan. Mirror the server's `status === "active"`
  // eligibility. No upsell: show what they already bought + a Manage-billing
  // door (not "See paid plans").
  if (isPaidPlan && billing?.status === "active") {
    const planLabel = plan === "pro" ? "Pro" : "Hobby";
    const included = allowance?.[plan];
    const cancelsOn = billing.cancelAtPeriodEnd
      ? formatPlanEndDate(billing.currentPeriodEnd)
      : null;
    return (
      <div className="model-picker__subscribe">
        <p className="model-picker__subscribe-text">
          Your {planLabel} plan includes{included != null ? ` ${included}` : ""} frontier
          requests/mo — queries route to Claude Sonnet 4.6 automatically.
        </p>
        {cancelsOn ? <p className="model-picker__subscribe-text">Cancels on {cancelsOn}.</p> : null}
        <button
          type="button"
          className="btn btn--ghost model-picker__countme"
          onClick={onManageBilling}
        >
          Manage billing
        </button>
      </div>
    );
  }

  // State 2 — payment taken, plan not yet active (the checkout→webhook race,
  // `status === "incomplete"`). Honest activating copy, no CTA; re-fetched on
  // each open so it self-heals into State 1.
  if (billing?.status === "incomplete") {
    return (
      <div className="model-picker__subscribe">
        <p className="model-picker__subscribe-text">Payment received — your plan is activating.</p>
      </div>
    );
  }

  // State 2b — payment failed on a paid plan (`past_due`/`unpaid`). Premium is
  // paused server-side (eligibility is `status === "active"`) until the charge
  // clears, so don't upsell their own plan — point them at billing to fix the
  // card, matching billing.astro's dunning banner (GLOBAL-023 honesty).
  if (isPaidPlan && (billing?.status === "past_due" || billing?.status === "unpaid")) {
    const planLabel = plan === "pro" ? "Pro" : "Hobby";
    return (
      <div className="model-picker__subscribe">
        <p className="model-picker__subscribe-text">
          Your {planLabel} plan's last payment failed — premium is paused until it's settled.
        </p>
        <button
          type="button"
          className="btn btn--ghost model-picker__countme"
          onClick={onManageBilling}
        >
          Update payment method
        </button>
      </div>
    );
  }

  // State 3 — free user. Unchanged behavior: live → real subscribe CTA;
  // dark → interest capture only (never a buyable state that can't be bought,
  // GLOBAL-023).
  return (
    <div className="model-picker__subscribe">
      {premiumLive ? (
        <>
          <p className="model-picker__subscribe-text">
            Prefer not to bring a key? A paid plan includes frontier-model credits.
          </p>
          <a className="btn btn--accent model-picker__countme" href="/pricing/">
            See paid plans
          </a>
        </>
      ) : interest === "sent" ? (
        <p className="model-picker__subscribe-text">
          You're counted — we'll email you when the paid plan ships.
        </p>
      ) : (
        <>
          <p className="model-picker__subscribe-text">
            Prefer not to bring a key? A paid plan with included frontier credits is coming soon.
          </p>
          <button
            type="button"
            className="btn btn--accent model-picker__countme"
            onClick={onCountMeIn}
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
