# SK-APIKEYS-007 — Mint via `POST /v1/keys`; never display, write straight to host config

- **Decision:** All key minting goes through `POST /v1/keys` with `{type, scope, host?, device?}`. For MCP installs, the response is written straight to the host's config file by `nlq mcp install` — the plaintext key is never displayed in the terminal or dashboard. For `sk_live_`, the dashboard shows the plaintext exactly once at creation (copy button); reload destroys it.
- **Core value:** Bullet-proof, Effortless UX, Seamless auth
- **Why:** A key that flashes through a terminal is a key in shell history, in screenshots, in the user's clipboard. Writing it directly to the host config (with permissions tightened) eliminates the human-typing leak path.
- **Consequence in code:** `POST /v1/keys` is the only mint path. `nlq mcp install` writes the response into the host config file before returning. The CLI never echoes the plaintext. Dashboard's create-key view returns the plaintext once; reload destroys it.
- **Alternatives rejected:** CLI prints the key — leaks via shell history / screenshot. Dashboard always shows the plaintext — defeats `SK-APIKEYS-002`. Email the key — email isn't a secure channel.
- **Source:** docs/architecture.md §3.4, §4.1
