package cmd

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/zalando/go-keyring"
)

// TestLogoutJSONUsesCamelCaseKeys guards the GLOBAL-002 parity fix: the
// `--json` envelope must use the same camelCase convention as every other
// command, not snake_case.
func TestLogoutJSONUsesCamelCaseKeys(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("NLQDB_API_KEY", "")

	root := New()
	var out, errBuf bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&errBuf)
	root.SetArgs([]string{"logout", "--json"})
	if err := root.Execute(); err != nil {
		t.Fatalf("logout: %v (stderr=%q)", err, errBuf.String())
	}

	var got map[string]any
	if err := json.Unmarshal(out.Bytes(), &got); err != nil {
		t.Fatalf("stdout is not JSON: %v\n%s", err, out.String())
	}
	for _, k := range []string{"cleared", "configDir", "envApiKeyPresent"} {
		if _, ok := got[k]; !ok {
			t.Errorf("missing camelCase key %q in %v", k, got)
		}
	}
	for _, k := range []string{"config_dir", "env_api_key_present"} {
		if _, ok := got[k]; ok {
			t.Errorf("snake_case key %q should be gone", k)
		}
	}
}
