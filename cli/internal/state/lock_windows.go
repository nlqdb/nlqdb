//go:build windows

package state

import (
	"os"

	"golang.org/x/sys/windows"
)

func acquireLock(f *os.File) error {
	return windows.LockFileEx(
		windows.Handle(f.Fd()),
		windows.LOCKFILE_EXCLUSIVE_LOCK,
		0, 1, 0,
		&windows.Overlapped{},
	)
}

func releaseLock(f *os.File) error {
	return windows.UnlockFileEx(
		windows.Handle(f.Fd()),
		0, 1, 0,
		&windows.Overlapped{},
	)
}
