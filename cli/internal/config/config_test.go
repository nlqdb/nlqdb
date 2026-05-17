package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadMissingReturnsDefaults(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)

	got, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	want := Defaults()
	if got != want {
		t.Fatalf("want defaults %+v, got %+v", want, got)
	}
}

func TestLoadMergesWithDefaults(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)

	cfgDir := filepath.Join(dir, "nlqdb")
	if err := os.MkdirAll(cfgDir, 0o700); err != nil {
		t.Fatal(err)
	}
	body := []byte("api_base_url = \"https://stage.nlqdb.com\"\nno_update_check = true\n")
	if err := os.WriteFile(filepath.Join(cfgDir, "config.toml"), body, 0o600); err != nil {
		t.Fatal(err)
	}

	got, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got.APIBaseURL != "https://stage.nlqdb.com" {
		t.Fatalf("APIBaseURL = %q", got.APIBaseURL)
	}
	if !got.NoUpdate {
		t.Fatalf("NoUpdate = %v", got.NoUpdate)
	}
	if got.Color != Defaults().Color {
		t.Fatalf("Color = %q (want default)", got.Color)
	}
}

func TestLoadMalformedReturnsError(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)

	cfgDir := filepath.Join(dir, "nlqdb")
	if err := os.MkdirAll(cfgDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cfgDir, "config.toml"), []byte("api_base_url = "), 0o600); err != nil {
		t.Fatal(err)
	}

	if _, err := Load(); err == nil {
		t.Fatalf("expected parse error on malformed TOML")
	}
}
