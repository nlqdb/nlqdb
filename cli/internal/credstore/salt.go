package credstore

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/nlqdb/nlqdb/cli/internal/paths"
)

const saltSize = 32

// readOrCreateSalt returns the 32-byte per-user salt mixed into the
// machine fingerprint. First read creates the file at mode 0600 so a
// world-readable machine-id can't be turned into the AES-GCM key by
// any other local user.
func readOrCreateSalt() ([]byte, error) {
	dir, err := paths.ConfigDir()
	if err != nil {
		return nil, err
	}
	p := filepath.Join(dir, ".salt")
	data, err := os.ReadFile(p) //nolint:gosec // computed XDG path
	switch {
	case err == nil:
		if len(data) >= saltSize {
			return data[:saltSize], nil
		}
		// File exists but short — overwrite rather than risk a weak salt.
	case errors.Is(err, fs.ErrNotExist):
	default:
		return nil, fmt.Errorf("read salt: %w", err)
	}

	salt := make([]byte, saltSize)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("mint salt: %w", err)
	}
	if err := os.WriteFile(p, salt, 0o600); err != nil {
		return nil, fmt.Errorf("write salt: %w", err)
	}
	return salt, nil
}
