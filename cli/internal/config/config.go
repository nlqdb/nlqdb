// Package config reads ~/.config/nlqdb/config.toml — stable user
// preferences only (SK-CLI-010). Secrets and mutating state are
// elsewhere so a shared config never leaks credentials.
package config

import (
	"errors"
	"fmt"
	"io/fs"
	"os"

	"github.com/BurntSushi/toml"
	"github.com/nlqdb/nlqdb/cli/internal/paths"
)

type Config struct {
	APIBaseURL string `toml:"api_base_url"`
	Color      string `toml:"color"`
	NoUpdate   bool   `toml:"no_update_check"`
}

// Defaults are the GLOBAL-020 "no config in the first 60 s" values.
func Defaults() Config {
	return Config{
		APIBaseURL: "https://app.nlqdb.com",
		Color:      "auto",
		NoUpdate:   false,
	}
}

// Load returns defaults on a missing file; a malformed file is a hard
// error so users see the parse problem instead of silent defaults.
func Load() (Config, error) {
	cfg := Defaults()
	p, err := paths.ConfigTOML()
	if err != nil {
		return cfg, err
	}
	data, err := os.ReadFile(p) //nolint:gosec // computed XDG path
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return cfg, nil
		}
		return cfg, fmt.Errorf("read config.toml: %w", err)
	}
	if _, err := toml.Decode(string(data), &cfg); err != nil {
		return cfg, fmt.Errorf("parse config.toml: %w", err)
	}
	return cfg, nil
}
