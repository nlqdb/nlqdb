// Separate module so testscript stays out of cli/ — reached only by .github/workflows/e2e-cli.yml.
module github.com/nlqdb/nlqdb/tests/e2e/cli

go 1.24.0

require github.com/rogpeppe/go-internal v1.14.1

require (
	golang.org/x/sys v0.26.0 // indirect
	golang.org/x/tools v0.26.0 // indirect
)
