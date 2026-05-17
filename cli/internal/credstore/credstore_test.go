package credstore

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/zalando/go-keyring"

	"github.com/nlqdb/nlqdb/cli/internal/paths"
)

func TestRoundtripUsesKeychainWhenAvailable(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	if err := Set(SlotAnonToken, "anon_abc123"); err != nil {
		t.Fatalf("Set: %v", err)
	}
	got, err := Get(SlotAnonToken)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "anon_abc123" {
		t.Fatalf("got %q", got)
	}

	if err := Delete(SlotAnonToken); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := Get(SlotAnonToken); err == nil {
		t.Fatalf("expected ErrNotFound after Delete")
	}
}

func TestFallbackRoundtripWhenKeychainUnavailable(t *testing.T) {
	keyring.MockInitWithError(keyring.ErrUnsupportedPlatform)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	if err := Set(SlotAnonToken, "anon_xyz"); err != nil {
		t.Fatalf("Set fallback: %v", err)
	}
	got, err := Get(SlotAnonToken)
	if err != nil {
		t.Fatalf("Get fallback: %v", err)
	}
	if got != "anon_xyz" {
		t.Fatalf("got %q", got)
	}

	if _, err := Get(SlotRefreshToken); err == nil {
		t.Fatalf("expected refresh slot empty")
	}

	if err := Delete(SlotAnonToken); err != nil {
		t.Fatalf("Delete fallback: %v", err)
	}
	if _, err := Get(SlotAnonToken); err == nil {
		t.Fatalf("expected ErrNotFound after Delete fallback")
	}
}

func TestFallbackOnDiskIsCiphertext(t *testing.T) {
	keyring.MockInitWithError(keyring.ErrUnsupportedPlatform)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	if err := Set(SlotAnonToken, "anon_secret_value"); err != nil {
		t.Fatalf("Set: %v", err)
	}

	p, err := paths.CredentialsEnc()
	if err != nil {
		t.Fatalf("path: %v", err)
	}
	raw, err := os.ReadFile(p) //nolint:gosec // test path under t.TempDir
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(raw) == "" {
		t.Fatalf("credentials.enc unexpectedly empty")
	}
	if isPlainJSON(raw) {
		t.Fatalf("credentials.enc looks like plaintext JSON — encryption is off")
	}
}

func TestFallbackAuthFailsOnTamper(t *testing.T) {
	keyring.MockInitWithError(keyring.ErrUnsupportedPlatform)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	if err := Set(SlotAnonToken, "anon_secret_value"); err != nil {
		t.Fatalf("Set: %v", err)
	}
	p, err := paths.CredentialsEnc()
	if err != nil {
		t.Fatalf("path: %v", err)
	}
	raw, err := os.ReadFile(p) //nolint:gosec // test path under t.TempDir
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	// Flip the last byte of the GCM tag — Open must fail authentication.
	raw[len(raw)-1] ^= 0xFF
	if err := os.WriteFile(p, raw, 0o600); err != nil { //nolint:gosec // test path under t.TempDir
		t.Fatalf("write tamper: %v", err)
	}
	if _, err := Get(SlotAnonToken); err == nil {
		t.Fatalf("expected AES-GCM authentication failure after tamper")
	}
}

func TestSaltIsPersistentAcrossInvocations(t *testing.T) {
	keyring.MockInitWithError(keyring.ErrUnsupportedPlatform)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	if err := Set(SlotAnonToken, "anon_first"); err != nil {
		t.Fatalf("Set 1: %v", err)
	}
	dir, err := paths.ConfigDir()
	if err != nil {
		t.Fatalf("config dir: %v", err)
	}
	saltPath := filepath.Join(dir, ".salt")
	info, err := os.Stat(saltPath)
	if err != nil {
		t.Fatalf("stat salt: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Fatalf("salt file mode %o, want 0600 (SK-CLI-009 — local non-owner reads break the threat model)", perm)
	}
	salt1, err := os.ReadFile(saltPath) //nolint:gosec // test path under t.TempDir
	if err != nil {
		t.Fatalf("read salt: %v", err)
	}
	if len(salt1) < 32 {
		t.Fatalf("salt too short: %d", len(salt1))
	}

	// A subsequent Set must reuse the same salt so decryption keeps working.
	if err := Set(SlotRefreshToken, "ref_value"); err != nil {
		t.Fatalf("Set 2: %v", err)
	}
	salt2, err := os.ReadFile(filepath.Join(dir, ".salt")) //nolint:gosec // test path under t.TempDir
	if err != nil {
		t.Fatalf("read salt 2: %v", err)
	}
	if string(salt1) != string(salt2) {
		t.Fatalf("salt rotated unexpectedly")
	}

	got, err := Get(SlotAnonToken)
	if err != nil || got != "anon_first" {
		t.Fatalf("salt reuse broke decryption: %v / %q", err, got)
	}
}

func isPlainJSON(b []byte) bool {
	var v any
	return json.Unmarshal(b, &v) == nil
}
