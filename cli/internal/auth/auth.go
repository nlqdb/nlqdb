// Package auth resolves the bearer for HTTP calls in precedence order:
// NLQDB_API_KEY env var (SK-CLI-008), keychain refresh token
// (SK-CLI-006, post-login), then anonymous device token (SK-CLI-005).
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/nlqdb/nlqdb/cli/internal/credstore"
)

const envAPIKey = "NLQDB_API_KEY" //nolint:gosec // env var name, not a secret

type Kind int

const (
	KindEnvKey Kind = iota
	KindAnonymous
	KindSignedIn
)

func (k Kind) String() string {
	switch k {
	case KindEnvKey:
		return "env_key"
	case KindAnonymous:
		return "anonymous"
	case KindSignedIn:
		return "signed_in"
	default:
		return "unknown"
	}
}

type Identity struct {
	Kind  Kind
	Token string
}

// Resolve returns the identity to use. `ensureAnon=false` lets verbs
// like `nlq logout` and `nlq whoami` skip the mint step so they don't
// silently create state on a no-identity machine.
func Resolve(ensureAnon bool) (Identity, error) {
	if v := strings.TrimSpace(os.Getenv(envAPIKey)); v != "" {
		return Identity{Kind: KindEnvKey, Token: v}, nil
	}

	if v, err := credstore.Get(credstore.SlotRefreshToken); err == nil && v != "" {
		return Identity{Kind: KindSignedIn, Token: v}, nil
	}

	if v, err := credstore.Get(credstore.SlotAnonToken); err == nil && v != "" {
		return Identity{Kind: KindAnonymous, Token: v}, nil
	}

	if !ensureAnon {
		return Identity{}, ErrNoIdentity
	}

	tok, err := mintAnon()
	if err != nil {
		return Identity{}, err
	}
	if err := credstore.Set(credstore.SlotAnonToken, tok); err != nil {
		return Identity{}, fmt.Errorf("persist anon token: %w", err)
	}
	return Identity{Kind: KindAnonymous, Token: tok}, nil
}

var ErrNoIdentity = errors.New("auth: no identity (env var unset, not signed in, no anon token)")

// Clear removes the anonymous and refresh-token slots. An env-key is
// left untouched because env-only auth is intentionally stateless.
func Clear() error {
	if err := credstore.Delete(credstore.SlotAnonToken); err != nil {
		return err
	}
	return credstore.Delete(credstore.SlotRefreshToken)
}

func mintAnon() (string, error) {
	// The `anon_` prefix is what apps/api/src/principal.ts matches on.
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("mint anon: %w", err)
	}
	return "anon_" + hex.EncodeToString(buf), nil
}

// Redacted keeps the prefix up to the last underscore that isn't in
// the last-four-chars suffix, so `sk_live_abc1234` displays as
// `sk_live_…1234` rather than `sk_…1234`.
func Redacted(token string) string {
	if token == "" {
		return "(none)"
	}
	if len(token) <= 8 {
		return "***"
	}
	prefixZone := token[:len(token)-4]
	prefix := token[:4]
	if idx := strings.LastIndexByte(prefixZone, '_'); idx >= 0 {
		prefix = token[:idx+1]
	}
	return fmt.Sprintf("%s…%s", prefix, token[len(token)-4:])
}
