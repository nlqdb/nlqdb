package cmd

import (
	"strings"
	"testing"
)

// All verbs registered on the root must be either help/completion/
// version (Cobra-managed) or in the bare-form rewriter's `known` set
// (cli/cmd/nlq/main.go). This test enumerates them for the rewriter
// test to pin against — the value lives in this package so the import
// graph stays one-way (main → cmd).
func TestRegisteredVerbs(t *testing.T) {
	root := New()
	verbs := []string{}
	for _, c := range root.Commands() {
		// Cobra-registered help/completion are auto-added by the
		// library and are not part of the rewriter's responsibility.
		if c.Hidden {
			continue
		}
		verbs = append(verbs, strings.Fields(c.Use)[0])
	}
	for _, want := range []string{"ask", "new", "db", "query", "use", "whoami", "logout", "login", "mcp", "update"} {
		found := false
		for _, v := range verbs {
			if v == want {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected verb %q on root, got %v", want, verbs)
		}
	}
}
