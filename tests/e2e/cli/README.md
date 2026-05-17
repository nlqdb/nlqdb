# CLI e2e tests

Persona journeys for the `nlq` Go binary. See [`SK-E2E-002`](../../../docs/features/e2e-coverage/FEATURE.md#sk-e2e-002--per-surface-native-runner-opencheck-is-the-web-runner-only) for why this surface uses `testscript`.

## Layout

```
tests/e2e/cli/
├── go.mod                   # separate module — does not pollute `go test ./...` from cli/
├── e2e_test.go              # driver: builds nlq once, exposes it on $PATH for txtar scripts
├── scripts/                 # one file per assertion; testscript reads them all
│   ├── bare_form_rewrite.txtar       # universal
│   ├── p1_db_list.txtar              # P1 — Solo Builder
│   ├── p2_mcp_detect.txtar           # P2 — Agent Builder
│   ├── p4_json_envelope.txtar        # P4 — Backend Engineer
│   └── p6_help_pipeline_safe.txtar   # P6 — Analytics Engineer
└── README.md
```

## Run locally

```bash
cd tests/e2e/cli
go test ./...                              # hermetic — uses an in-test mock API server
NLQDB_E2E_LIVE=1 NLQDB_API_URL=https://<staging> \
NLQDB_API_KEY=sk_live_… go test ./...     # journey mode against a live staging URL
```

`go test` builds the `nlq` binary from `../../../cli/cmd/nlq` into a tempdir, prepends that tempdir to `$PATH`, then runs each `.txtar` script against an in-process `httptest.Server` whose URL is exported as `$MOCK_API`.

## Trigger via GitHub Actions

```bash
gh workflow run e2e.yml -f surface=cli
gh workflow run e2e.yml -f surface=all    # CLI + every other surface, one shared staging
```

The `cli` surface runs the `_e2e-cli.yml` reusable workflow.

## When to add a script

Per [`SK-E2E-001`](../../../docs/features/e2e-coverage/FEATURE.md#sk-e2e-001--persona-driven-journey-suites-are-the-organising-principle), a new persona journey gets a new `pN_<step>.txtar`. Add the row to the persona's surface matrix in `tests/personas/PN-<name>/README.md` in the same PR.

Reference: [`testscript` docs](https://pkg.go.dev/github.com/rogpeppe/go-internal/testscript) — `exec`, `stdout`, `stderr`, `env`, `cmp` are the built-ins you'll reach for.
