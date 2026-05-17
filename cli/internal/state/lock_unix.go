//go:build unix

package state

import (
	"os"

	"golang.org/x/sys/unix"
)

func acquireLock(f *os.File) error {
	return unix.Flock(int(f.Fd()), unix.LOCK_EX)
}

func releaseLock(f *os.File) error {
	return unix.Flock(int(f.Fd()), unix.LOCK_UN)
}
