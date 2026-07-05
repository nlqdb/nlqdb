#!/usr/bin/env bash
# nlqdb — minimal CLI walkthrough. Three commands, no frontend at all.
#
# Maps to DESIGN §14.3 — every block is what the user types.
# Lines starting with `#` are output you'll see; not part of the input.

set -euo pipefail

# 1. No sign-in needed — anonymous mode is the default (SK-CLI-005).
#    Device-flow `nlq login` ships in the next CLI slice; until then,
#    export NLQDB_API_KEY=sk_live_… (minted in the dashboard) to keep
#    your data past the 72 h anonymous window.

# 2. Create the DB. The natural-language description IS the schema spec —
#    nlqdb infers `customer`, `drink`, `total` from the prose.
nlq new "an orders tracker — customer, drink, total"
# ✓ Ready. orders-tracker-a4f provisioned.

# 3. Insert a row. Same `nlq` command — no `nlq insert`, no `nlq query`.
#    Writes are auto-detected and routed appropriately.
nlq "add an order: alice, latte, 5.50, just now"
# ✓ Added. orders-tracker-a4f now has 1 row.

# 4. Read. Free-form English; the result renders as a chart in the
#    terminal (sparkline / bar) when the shape fits.
nlq "how many orders today, by drink"
# latte      ████████████  12
# flat-white ██████         6
# mocha      ██             2
