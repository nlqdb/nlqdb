# CLI-only

No frontend at all. Four commands ship a working data tool.

```bash
nlq login                                              # one click, browser, done
nlq new "an orders tracker — customer, drink, total"
nlq "add an order: alice, latte, 5.50, just now"
nlq "how many orders today, by drink"
```

See [`walkthrough.sh`](./walkthrough.sh) for the same flow with annotated expected output.

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

$ nlq "export today's orders as csv > today.csv"
✓ Wrote 20 rows to today.csv
```

## When to use the CLI

- Quick analysis on a CSV or live DB without writing a query.
- Cron jobs that ingest events (no client code required, just `nlq …`).
- Pipelines: `nlq "orders this week" --csv | duckdb …`.
- CI: `NLQDB_API_KEY=sk_live_… nlq "regression rows since last release"`.

## Power-user paths

```bash
nlq db create finance --engine postgres --region us-east  # explicit form
nlq connection finance                                     # raw Postgres URL
nlq export finance --csv > finance.csv
```

docs/features/cli/FEATURE.md covers all of them.
