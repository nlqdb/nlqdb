package state

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestLoadMissingReturnsEmpty(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)

	s, err := Load()
	if err != nil {
		t.Fatalf("Load on missing file: %v", err)
	}
	if s.ActiveDB != "" || s.LastUsedAt != 0 {
		t.Fatalf("expected empty state, got %+v", s)
	}
}

func TestSaveAndLoadRoundtrip(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)

	want := State{
		ActiveDB:   "db_orders_a1",
		LastUsedAt: 1737000000,
		UpdateCheck: UpdateCheck{
			CheckedAt:       1737000001,
			LastSeenVersion: "0.2.0",
		},
	}
	if err := Save(want); err != nil {
		t.Fatalf("Save: %v", err)
	}

	got, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got != want {
		t.Fatalf("roundtrip mismatch:\n got: %+v\nwant: %+v", got, want)
	}

	// File mode must be 0600 — state.json may carry an active_db that
	// is volatile (per SK-CLI-013) but the directory holds the
	// AES-GCM credentials.enc fallback (SK-CLI-009) so the parent
	// permissions are tight; the file itself follows that posture.
	info, err := os.Stat(filepath.Join(dir, "nlqdb", "state.json"))
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if mode := info.Mode().Perm(); mode != 0o600 {
		t.Fatalf("unexpected mode: %o", mode)
	}
}

func TestUpdateAtomic(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)

	if err := Save(State{ActiveDB: "seed"}); err != nil {
		t.Fatalf("seed save: %v", err)
	}

	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		i := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := Update(func(s *State) {
				s.LastUsedAt += int64(i + 1)
			}); err != nil {
				t.Errorf("Update %d: %v", i, err)
			}
		}()
	}
	wg.Wait()

	got, err := Load()
	if err != nil {
		t.Fatalf("post-update Load: %v", err)
	}
	if got.ActiveDB != "seed" {
		t.Fatalf("ActiveDB clobbered: %q", got.ActiveDB)
	}
	if got.LastUsedAt == 0 {
		t.Fatalf("expected non-zero LastUsedAt after concurrent updates")
	}
}

func TestLoadCorruptIsHardError(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)

	if err := os.MkdirAll(filepath.Join(dir, "nlqdb"), 0o700); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "nlqdb", "state.json"), []byte("{not json"), 0o600); err != nil {
		t.Fatalf("write corrupt: %v", err)
	}

	if _, err := Load(); err == nil {
		t.Fatalf("expected parse error on corrupt state.json")
	}
}
