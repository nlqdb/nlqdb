// Package credstore is the only place CLI credentials are read or
// written. Keychain (via zalando/go-keyring) is the primary path per
// SK-CLI-009; on any keychain failure we fall back to a machine-keyed
// AES-GCM file at ~/.config/nlqdb/credentials.enc. Plaintext is never
// an option.
package credstore

import (
	"errors"
	"fmt"
	"os"
	"sync"

	"github.com/zalando/go-keyring"
)

// ServiceName is the keychain entry namespace; must stay stable so a
// CLI upgrade reads the same secrets without re-login.
const ServiceName = "nlqdb-cli"

type Slot string

const (
	SlotAnonToken    Slot = "anon_token"
	SlotRefreshToken Slot = "refresh_token"
	// SlotByollm holds the `<provider>:<model>:<key>` BYOLLM value
	// (SK-CLI-016). A user's own LLM key is a secret, so it rides the
	// keychain like the session tokens — never config.toml.
	SlotByollm Slot = "byollm_key"
)

var (
	ErrNotFound = errors.New("credstore: not found")

	// keyringWarnOnce keeps the fallback-mode warning from spamming
	// stderr when one invocation writes several slots.
	keyringWarnOnce sync.Once
)

// Get returns the secret bound to `slot`, or `ErrNotFound`. On any
// keychain backend error we still consult the fallback so a user who
// fell back once (headless run) can read those secrets afterwards.
func Get(slot Slot) (string, error) {
	if v, err := keyring.Get(ServiceName, string(slot)); err == nil {
		return v, nil
	}

	ff, ferr := loadFallback()
	if ferr != nil {
		return "", ferr
	}
	v, ok := ff.Entries[string(slot)]
	if !ok {
		return "", ErrNotFound
	}
	return v, nil
}

// Set writes `value` under `slot`. ErrSetDataTooBig is the only
// keychain failure that surfaces — the fallback can't help with a
// value the keychain refused on size, and silently storing in a less
// audited place would be a security regression.
func Set(slot Slot, value string) error {
	switch err := keyring.Set(ServiceName, string(slot), value); {
	case err == nil:
		return nil
	case errors.Is(err, keyring.ErrSetDataTooBig):
		return fmt.Errorf("credstore: keychain rejected oversized value: %w", err)
	}

	ff, err := loadFallback()
	if err != nil {
		return err
	}
	ff.Entries[string(slot)] = value
	if err := saveFallback(ff); err != nil {
		return err
	}
	keyringWarnOnce.Do(func() {
		fmt.Fprintln(os.Stderr,
			"⚠ nlq: keychain unavailable — storing credentials in ~/.config/nlqdb/credentials.enc (AES-GCM, machine-keyed).")
	})
	return nil
}

// Delete removes the slot from both stores so `nlq logout` is total
// even when an earlier invocation wrote to the fallback.
func Delete(slot Slot) error {
	kerr := keyring.Delete(ServiceName, string(slot))
	if kerr != nil && !errors.Is(kerr, keyring.ErrNotFound) && !errors.Is(kerr, keyring.ErrUnsupportedPlatform) {
		return fmt.Errorf("credstore: keychain delete: %w", kerr)
	}

	ff, err := loadFallback()
	if err != nil {
		return err
	}
	delete(ff.Entries, string(slot))
	return saveFallback(ff)
}
