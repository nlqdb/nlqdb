# CLI-only

No frontend at all. Three commands ship a working data tool — no sign-in needed (anonymous mode is the default).

```bash
nlq new "an orders tracker — customer, drink, total"
nlq "add an order: alice, latte, 5.50, just now"
nlq "how many orders today, by drink"
```

See [`walkthrough.sh`](./walkthrough.sh) for the same flow with annotated expected output.

> **`nlq login` is not shipped yet** — device-flow sign-in (and the adopt-anonymous flow below) lands with the next CLI slice; today the command prints a deferral hint. Until then, anonymous mode is the default, or mint an `sk_live_*` key in the dashboard and export `NLQDB_API_KEY`.

## Install

> **Phase 2 — channels not yet live.** Install paths are decided ([`SK-CLI-002`](../../docs/features/cli/decisions/SK-CLI-002-distribution-channels.md)) and ship with the Phase 2 CLI surface ([`docs/phase-plan.md`](../../docs/phase-plan.md)). Until then build from source — see *Build from source today* below.

Once Phase 2 ships, three install paths will resolve to the same Go binary pinned per release:

```bash
# curl-pipe-sh — installs to ~/.local/bin/nlq
curl -fsSL https://nlqdb.com/install | sh

# Homebrew (macOS / Linux)
brew install nlqdb/tap/nlq

# npm shim — downloads the right Go binary on postinstall
npm i -g @nlqdb/cli
```

### Build from source today

```bash
git clone https://github.com/nlqdb/nlqdb
cd nlqdb/cli && go build -o ~/.local/bin/nlq ./cmd/nlq
```

Track [#cli](https://github.com/nlqdb/nlqdb/issues?q=label%3Acli) for the install-endpoints rollout.

## Default path — no sign-in until you want it

```bash
$ nlq new "an orders tracker"
✓ Ready. Try: nlq "add an order: alice, latte, $5.50, just now"
ℹ Saved as anonymous. Run `nlq login` within 72h to keep it.

$ nlq "add an order: alice, latte, $5.50, just now"
✓ Added. orders-tracker-a4f now has 1 row.
```

That's it. The DB exists. There is no `nlq db create` step the user had to know about.

## Adopt the anonymous DB

```bash
$ nlq login
→ Opening browser to approve this device… (fallback code: ABCD-1234)
✓ Signed in as maya@example.com. Adopted 1 anonymous DB: orders-tracker-a4f.
```

The browser lands on a single "Approve this device?" screen with the code already pre-filled in the URL — one click, no typing. The refresh token is written to the OS keychain (macOS Keychain, libsecret, or Credential Manager). Every subsequent call silently refreshes the access token as needed.

## Day-2 ops

```bash
$ nlq "how many orders today, by drink"
latte    ████████████  12
flat-white ██████      6
mocha    ██            2

$ nlq "today's orders" --json > today.json
```

## When to use the CLI

- Quick analysis on a CSV or live DB without writing a query.
- Cron jobs that ingest events (no client code required, just `nlq …`).
- Pipelines: `nlq "orders this week" --json | jq …`.
- CI: `NLQDB_API_KEY=sk_live_… nlq "regression rows since last release"`.

## Power-user paths

```bash
nlq db create finance --engine postgres              # explicit create
nlq use finance                                      # set the active database
nlq run "SELECT * FROM orders" --json > orders.json  # raw SQL out — no LLM
```

docs/features/cli/FEATURE.md covers all of them.
