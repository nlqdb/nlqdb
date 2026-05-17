package cmd

import (
	"io"
	"os"

	"golang.org/x/term"
)

// isTerminal is for the SK-CLI-015 update-check gate only — output
// formatting must never branch on it (SK-CLI-004). Uses x/term so
// Windows console (which lacks os.ModeCharDevice in some shells) is
// classified correctly.
func isTerminal(out io.Writer) bool {
	f, ok := out.(*os.File)
	if !ok {
		return false
	}
	return term.IsTerminal(int(f.Fd()))
}
