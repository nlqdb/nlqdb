package cmd

import "strings"

// RegisteredVerbs returns the verb names this package wires onto the
// root command. The bare-form rewriter (`cmd/nlq/main.go`) compares
// its `known` set against this list so a new verb can't escape the
// rewriter's allow-list silently. Exported (not test-only) so the
// `main` package can import it for its cross-check.
func RegisteredVerbs() []string {
	root := New()
	verbs := []string{}
	for _, c := range root.Commands() {
		if c.Hidden {
			continue
		}
		verbs = append(verbs, strings.Fields(c.Use)[0])
	}
	// Cobra auto-registers `help` and `completion`; the bare-form
	// rewriter treats both as known.
	verbs = append(verbs, "help", "completion")
	return verbs
}
