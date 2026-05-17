// Package paths is the single source of truth for ~/.config/nlqdb's
// three files (config.toml, state.json, credentials.enc) so the
// readers in `config`, `state`, and `credstore` agree on layout.
// Honours XDG_CONFIG_HOME on all platforms.
package paths

import (
	"fmt"
	"os"
	"path/filepath"
)

const dirName = "nlqdb"

// ConfigDir creates ~/.config/nlqdb on demand at mode 0700 — the
// AES-GCM credentials.enc fallback may live inside.
func ConfigDir() (string, error) {
	base, err := baseConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, dirName)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("create config dir: %w", err)
	}
	return dir, nil
}

func ConfigTOML() (string, error) {
	dir, err := ConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "config.toml"), nil
}

func StateJSON() (string, error) {
	dir, err := ConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "state.json"), nil
}

func CredentialsEnc() (string, error) {
	dir, err := ConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "credentials.enc"), nil
}

func baseConfigDir() (string, error) {
	if v := os.Getenv("XDG_CONFIG_HOME"); v != "" {
		return v, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}
	return filepath.Join(home, ".config"), nil
}
