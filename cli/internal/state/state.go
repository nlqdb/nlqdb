// Package state owns ~/.config/nlqdb/state.json — the only place
// mutating non-secret CLI state lives (SK-CLI-013).
package state

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/nlqdb/nlqdb/cli/internal/paths"
)

type UpdateCheck struct {
	CheckedAt       int64  `json:"checked_at"`
	LastSeenVersion string `json:"last_seen_version,omitempty"`
}

type State struct {
	ActiveDB    string      `json:"active_db,omitempty"`
	LastUsedAt  int64       `json:"last_used_at,omitempty"`
	UpdateCheck UpdateCheck `json:"update_check,omitzero"`
}

// Load returns an empty State on a missing file — corruption recovery
// is the user's path per SK-CLI-013 ("delete it, next `nlq new` rewrites").
func Load() (State, error) {
	p, err := paths.StateJSON()
	if err != nil {
		return State{}, err
	}
	data, err := os.ReadFile(p) //nolint:gosec // computed XDG path
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return State{}, nil
		}
		return State{}, fmt.Errorf("read state: %w", err)
	}
	var s State
	if err := json.Unmarshal(data, &s); err != nil {
		return State{}, fmt.Errorf("parse state.json: %w", err)
	}
	return s, nil
}

// Save writes state.json atomically (temp file + rename) so concurrent
// `nlq` invocations never observe a torn write.
func Save(s State) error {
	p, err := paths.StateJSON()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("encode state: %w", err)
	}
	dir := filepath.Dir(p)
	tmp, err := os.CreateTemp(dir, ".state-*.json")
	if err != nil {
		return fmt.Errorf("create tmp state: %w", err)
	}
	tmpName := tmp.Name()
	defer func() { _ = os.Remove(tmpName) }()
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("write tmp state: %w", err)
	}
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("chmod tmp state: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close tmp state: %w", err)
	}
	if err := os.Rename(tmpName, p); err != nil {
		return fmt.Errorf("rename tmp state: %w", err)
	}
	return nil
}

func Update(mutate func(*State)) error {
	s, err := Load()
	if err != nil {
		return err
	}
	mutate(&s)
	return Save(s)
}
