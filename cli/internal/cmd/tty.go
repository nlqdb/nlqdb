package cmd

import (
	"io"
	"os"
)

// isTerminal is for the SK-CLI-015 update-check gate only — output
// formatting must never branch on it (SK-CLI-004).
func isTerminal(out io.Writer) bool {
	f, ok := out.(*os.File)
	if !ok {
		return false
	}
	info, err := f.Stat()
	if err != nil {
		return false
	}
	return (info.Mode() & os.ModeCharDevice) != 0
}
