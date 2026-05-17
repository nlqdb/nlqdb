package cmd

import (
	"slices"
	"testing"
)

func TestExpectedVerbsAreRegistered(t *testing.T) {
	have := RegisteredVerbs()
	for _, want := range []string{
		"ask", "new", "db", "keys", "query", "use", "whoami", "logout", "login", "mcp", "update",
	} {
		if !slices.Contains(have, want) {
			t.Errorf("expected verb %q on root, got %v", want, have)
		}
	}
}
