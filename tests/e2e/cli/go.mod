// CLI e2e tests live in their own Go module so the cli/ package stays
// free of testscript as a runtime dependency. `go test ./...` from the
// repo root never enters this directory; it is reached only by the
// `_e2e-cli.yml` reusable workflow (dispatched via `e2e.yml`) and
// developers running tests manually per `tests/e2e/cli/README.md`.
module github.com/nlqdb/nlqdb/tests/e2e/cli

go 1.24.0

require github.com/rogpeppe/go-internal v1.14.1

require (
	golang.org/x/sys v0.26.0 // indirect
	golang.org/x/tools v0.26.0 // indirect
)
