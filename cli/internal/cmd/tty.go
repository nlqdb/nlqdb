package cmd

import (
	"os"

	"golang.org/x/term"
)

// isTerminal classifies a file as a TTY for two scoped use-cases:
// (1) the SK-CLI-015 update-check gate (stdout-side), and (2) the
// `nlq run` stdin-source check (so bare `nlq run` on a terminal exits
// with an "empty sql" error instead of blocking on stdin forever).
// Output formatting itself must never branch on this (SK-CLI-004) —
// `--json` is the only switch. Uses x/term so Windows console (which
// lacks os.ModeCharDevice in some shells) is classified correctly.
func isTerminal(f any) bool {
	file, ok := f.(*os.File)
	if !ok {
		return false
	}
	return term.IsTerminal(int(file.Fd()))
}
