# SK-CLI-016 — `nlq byollm set|status|clear` stores the BYOLLM key in the keychain; `nlq ask` rides it signed-in only

Parent feature: [`cli/FEATURE.md`](../FEATURE.md). Surface-parity sibling of
[`SK-SDK-010`](../../sdk/decisions/SK-SDK-010-byollm-client-option.md) (the
TS SDK `byollm` option). Builds on
[`SK-LLM-021`](../../llm-router/decisions/SK-LLM-021-byollm-header-wiring.md)
(the `/v1/ask` wire header). Key-handling parent:
[`SK-PREMIUM-008`](../../premium-tier/decisions/SK-PREMIUM-008-byollm.md).
Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** The CLI gains a `byollm` verb group: `nlq byollm set
  <provider> <model>` stores a credential, `nlq byollm status` shows it
  with the key redacted, `nlq byollm clear` removes it. The key is stored
  as the joined `<provider>:<model>:<key>` value in the credential store
  (keychain, AES-GCM fallback — `SK-CLI-009`), **never** `config.toml`
  (`SK-CLI-010` keeps secrets out of the dotfiles-safe file). When a
  credential is stored, `nlq ask` attaches `x-nlq-byollm-key`
  (`SK-LLM-021`) so the ask dispatches through the user's own provider key
  at 0% markup (`GLOBAL-026`); `nlq run` (raw SQL, no LLM) and every other
  call never carry it — the header is set only on the ask client. The lane
  is signed-in only on the server (`byollm_requires_session`,
  `SK-PREMIUM-008` point 8): the CLI pre-empts the `env_key` (`sk_live_`)
  and `anonymous` identity kinds with a one-sentence message (`GLOBAL-012`)
  instead of a guaranteed-400 round-trip, mirroring the SDK's
  `withCredentials` guard. The key is read from `--key`, else stdin (piped
  verbatim, an interactive TTY prompts without echo) so the secret stays
  off `argv` — process lists and shell history both expose positional
  args. One stored credential, no per-call flag (`GLOBAL-017`): the key is
  a persistent secret, not a routing hint, exactly as `SK-SDK-010` ruled
  for the SDK.
- **Core value:** Free, Effortless UX, Bullet-proof
- **Why:** `SK-LLM-021` + `SK-SDK-010` shipped BYOLLM on the HTTP surface
  and the TS SDK, leaving the CLI unable to set the header — the explicit
  `GLOBAL-003` gap tracked in `premium-tier/FEATURE.md`. The CLI is a Go
  consumer of the same contract (`GLOBAL-001`), so the right shape is a
  stored credential mirroring the SDK's client-level option, with the
  colon-join/validation in one tested helper (`internal/byollm`) so the
  escaping hazard is solved once across surfaces (`GLOBAL-002`). Storing a
  raw provider key in the keychain (not `config.toml`) and attaching it to
  the ask client only minimises the secret's blast radius.
- **Consequence in code:** New `cli/internal/byollm/` package (`Parse`,
  `FromStored`, `Credential.Header`/`Redacted`) holds the wire shape and is
  unit-tested for provider lower-casing, empty/colon/control-char
  rejection, and the colon-in-key round-trip. `cli/internal/cmd/byollm.go`
  wires the three subcommands; `credstore.SlotByollm` is the new slot;
  `doAsk` loads the credential, gates it to `auth.KindSignedIn`, and calls
  `client.WithByollm(...)`. `renderAPIError` maps
  `byollm_requires_session` / `invalid_byollm_key` / `byollm_unavailable`
  to next-action messages as defense in depth. `byollm` joins the
  bare-form `known` map so `nlq byollm …` isn't rewritten to `nlq ask`.
- **Alternatives rejected:**
  - Per-call `--byollm <provider>:<model>:<key>` flag — leaks the key into
    shell history / process lists on every call and duplicates the routing
    knob; `SK-SDK-010` already rejected the per-call shape for the SDK.
  - Store the key in `config.toml` — violates `SK-CLI-010` (that file is
    dotfiles-safe and must never hold a secret).
  - Let the server reject `env_key`/`anonymous` callers — wastes a
    round-trip and a vaguer error; the SDK fails loud at construction, so
    the CLI fails loud locally for parity.
  - Attach the header to every CLI call via a persistent root flag — ships a
    raw provider key to `run`/`keys`/`databases`, which have no LLM call.
- **Source:** canonical here · `SK-SDK-010` (SDK sibling) · `SK-LLM-021`
  (wire header) · `SK-PREMIUM-008` (BYOLLM key handling, signed-in gate) ·
  `GLOBAL-026` (LLM strategy).
