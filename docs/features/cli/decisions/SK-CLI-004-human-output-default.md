# SK-CLI-004 — Human output by default; `--json` for scripts; never TTY-detect

- **Decision:** Every CLI command emits human-formatted output by default and machine-parseable JSON only when the user passes `--json`. The CLI does **not** sniff `isatty(stdout)` to switch modes. Errors, success messages, traces, and tables follow the default human format unless `--json` is set.
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** TTY-sniffing is convenient until it isn't — piping `nlq ask` into `tee` silently changes the output format and breaks scripts that worked yesterday. Explicit `--json` is one extra flag that produces stable behaviour under pipes, redirects, CI logs, and `xargs`. Humans see colour and tables; scripts see JSON. The behaviour is the same in both directions.
- **Consequence in code:** The CLI's output layer takes a `format` parameter that defaults to `"human"` and is set to `"json"` by `--json`. Any code path that calls `os.Stdout.IsTerminal()` for output decisions fails review. The trace renderer for `GLOBAL-011` (live trace) emits the same step events in both modes — JSON gets one line per step, human gets the prettified TTY output.
- **Alternatives rejected:**
  - TTY-sniff for default — silent format flips under pipes; user-reported bug surface.
  - JSON by default — better for scripts, terrible for the bare `nlq "..."` interactive path that's the activation moment.
