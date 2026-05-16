# SK-CLI-001 — Single static Go binary; 3-char name `nlq`; no PATH collision

- **Decision:** The CLI is a single static Go binary named `nlq`. The npm scope `@nlqdb/*` is owned and the binary name `nlq` and npm name `nlqdb` are both reserved so we can ship under either without forcing a fork. Performance budget (measured on the bootstrap PR, Go 1.24 + cobra + go-keyring): **raw binary < 10 MB, gzipped < 4 MB, cold start < 30 ms.**
- **Core value:** Effortless UX, Fast, Goal-first
- **Why:** A 3-char name is what gets typed twenty times a day. Static Go means zero runtime deps — copy the binary, run it. The original 8 MB target was set without measurement; the bootstrap slice measured 8.0 MB on darwin/arm64, 8.7 MB on linux/amd64 and windows/amd64 (gzipped 3.2–3.5 MB) — startup is 5 ms (35× under the 30 ms goal). For comparison, `gh` CLI is 13.6 MB. The realistic floor for our dependency surface (cobra → text/template, go-keyring → godbus on Linux, net/http + crypto for HTTPS) is ~8.5 MB; the 10 MB cap gives 15% headroom for new verbs without forcing a CLI-library swap. PATH-collision-free is the boring win — every user already has `nlq` available without aliasing.
- **Consequence in code:** The binary entrypoint lives in `cli/cmd/nlq/main.go`. CI enforces the budget by building Linux/macOS/Windows artifacts and failing on `raw > 10 MB` or `gzip > 4 MB`. No system-wide config that requires sudo to install. `go.mod` lives at the `cli/` root.
- **Alternatives rejected:**
  - Node CLI — start-up cost (~150 ms even for "Hello world") blows the cold first-byte budget.
  - Rust CLI — comparable performance to Go but slower compile-edit cycle and steeper hire bar at our team size.
  - Python — `pip install` is heavier than `curl | sh`; cross-platform packaging is harder.
  - Hold the original 8 MB raw cap by dropping cobra for stdlib `flag` — the help-and-discoverability cost is paid by every developer who runs `nlq --help`; trading a measurable UX regression for a 700 KB on-disk saving fails the core-value test.
  - UPX compression — shrinks to ~4 MB on disk but adds 50–200 ms cold-start (breaks the 30 ms budget) and trips AV false-positives on Windows.
