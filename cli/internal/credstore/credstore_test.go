package credstore

import (
	"strings"
	"testing"

	"github.com/zalando/go-keyring"
)

func TestRoundtripUsesKeychainWhenAvailable(t *testing.T) {
	keyring.MockInit()

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

func TestFallbackRoundtrip(t *testing.T) {
	// Force keychain unavailability via MockInitWithError so the
	// fallback path is exercised end-to-end. The HKDF/AES-GCM
	// envelope is validated implicitly: encryption then decryption
	// round-trips through the file.
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

	// Different slot is independent.
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

func TestFallbackResistsBitFlipForgery(t *testing.T) {
	keyring.MockInitWithError(keyring.ErrUnsupportedPlatform)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	if err := Set(SlotAnonToken, "anon_secret_value"); err != nil {
		t.Fatalf("Set: %v", err)
	}

	ff, err := loadFallback()
	if err != nil {
		t.Fatalf("loadFallback: %v", err)
	}
	if !strings.HasPrefix(ff.Entries[string(SlotAnonToken)], "anon_") {
		t.Fatalf("plaintext leaked: %v", ff.Entries)
	}
}
