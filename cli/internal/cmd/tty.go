package cmd

import (
	"os"

	"golang.org/x/term"
)

// Scoped to update-check gating (`SK-CLI-015`) and the `nlq run` stdin-source check; output formatting must never branch on TTY (`SK-CLI-004`).
func isTerminal(f any) bool {
	file, ok := f.(*os.File)
	if !ok {
		return false
	}
	return term.IsTerminal(int(file.Fd()))
}
