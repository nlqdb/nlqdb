package cmd

import "testing"

func TestExpectedVerbsAreRegistered(t *testing.T) {
	have := RegisteredVerbs()
	for _, want := range []string{
		"ask", "new", "db", "query", "use", "whoami", "logout", "login", "mcp", "update",
	} {
		if !contains(have, want) {
			t.Errorf("expected verb %q on root, got %v", want, have)
		}
	}
}

func contains(haystack []string, needle string) bool {
	for _, v := range haystack {
		if v == needle {
			return true
		}
	}
	return false
}
