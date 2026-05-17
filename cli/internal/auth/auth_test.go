package auth

import (
	"errors"
	"strings"
	"testing"

	"github.com/zalando/go-keyring"
)

func TestResolveEnvKeyWinsOverKeychain(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("NLQDB_API_KEY", "sk_live_envkey")

	// Even if the keychain has an anon token, env takes precedence
	// (SK-CLI-008 — CI/Docker/air-gapped escape hatch).
	if err := keyring.Set("nlqdb-cli", "anon_token", "anon_xxxx"); err != nil {
		t.Fatal(err)
	}

	id, err := Resolve(false)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if id.Kind != KindEnvKey {
		t.Fatalf("Kind = %v", id.Kind)
	}
	if id.Token != "sk_live_envkey" {
		t.Fatalf("Token = %q", id.Token)
	}
}

func TestResolveMintsAnonWhenAllowed(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("NLQDB_API_KEY", "")

	id, err := Resolve(true)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if id.Kind != KindAnonymous {
		t.Fatalf("Kind = %v", id.Kind)
	}
	if !strings.HasPrefix(id.Token, "anon_") {
		t.Fatalf("Token = %q", id.Token)
	}

	// Second call returns the same token (keychain persists across
	// invocations — the anon DB stays bound to the device).
	id2, err := Resolve(true)
	if err != nil {
		t.Fatalf("Resolve 2: %v", err)
	}
	if id2.Token != id.Token {
		t.Fatalf("mint should be sticky: %q vs %q", id2.Token, id.Token)
	}
}

func TestResolveDoesNotMintWhenForbidden(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("NLQDB_API_KEY", "")

	_, err := Resolve(false)
	if !errors.Is(err, ErrNoIdentity) {
		t.Fatalf("expected ErrNoIdentity, got %v", err)
	}
}

func TestClearRemovesAnonAndRefresh(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("NLQDB_API_KEY", "")

	if _, err := Resolve(true); err != nil {
		t.Fatalf("Resolve mint: %v", err)
	}
	if err := Clear(); err != nil {
		t.Fatalf("Clear: %v", err)
	}
	if _, err := Resolve(false); !errors.Is(err, ErrNoIdentity) {
		t.Fatalf("expected ErrNoIdentity after Clear, got %v", err)
	}
}

func TestRedactedHandlesPrefixedTokens(t *testing.T) {
	for _, tc := range []struct {
		in, want string
	}{
		{"", "(none)"},
		{"short", "***"},
		{"anon_1234567890abcdef", "anon_…cdef"},
		{"sk_live_abcdef1234", "sk_live_…1234"},
		{"plain1234567890", "plai…7890"},
	} {
		if got := Redacted(tc.in); got != tc.want {
			t.Errorf("Redacted(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
