package updatecheck

import (
	"strings"
	"testing"
	"time"

	"github.com/nlqdb/nlqdb/cli/internal/state"
)

func TestIsCIEnumerates(t *testing.T) {
	env := func(want string) func(string) string {
		return func(k string) string {
			if k == want {
				return "1"
			}
			return ""
		}
	}
	for _, k := range []string{
		"CI", "GITHUB_ACTIONS", "JENKINS_URL", "BUILDKITE",
		"GITLAB_CI", "CIRCLECI", "TRAVIS", "TEAMCITY_VERSION",
	} {
		if !IsCI(env(k)) {
			t.Errorf("expected IsCI=true when %s is set", k)
		}
	}
	if IsCI(func(string) string { return "" }) {
		t.Errorf("expected IsCI=false with empty env")
	}
}

func TestShouldRunSuppressors(t *testing.T) {
	empty := func(string) string { return "" }
	now := func() time.Time { return time.Unix(2_000_000_000, 0) }

	cases := []struct {
		name string
		st   state.State
		opts Options
		want SkipReason
	}{
		{"env-off", state.State{}, Options{Env: func(k string) string {
			if k == "NLQDB_NO_UPDATE_CHECK" {
				return "1"
			}
			return ""
		}, Now: now}, SkipEnvOff},
		{"json", state.State{}, Options{JSON: true, Env: empty, Now: now}, SkipJSON},
		{"ci", state.State{}, Options{Env: func(k string) string {
			if k == "GITHUB_ACTIONS" {
				return "true"
			}
			return ""
		}, Now: now}, SkipCI},
		{"non-tty", state.State{}, Options{NonTTY: true, Env: empty, Now: now}, SkipNonTTY},
		{
			"recent",
			state.State{UpdateCheck: state.UpdateCheck{CheckedAt: now().Unix() - 3600}},
			Options{Env: empty, Now: now},
			SkipRecent,
		},
		{
			"none",
			state.State{UpdateCheck: state.UpdateCheck{CheckedAt: now().Unix() - 48*3600}},
			Options{Env: empty, Now: now},
			SkipNone,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := ShouldRun(c.st, c.opts); got != c.want {
				t.Errorf("ShouldRun(%s) = %q, want %q", c.name, got, c.want)
			}
		})
	}
}

func TestUpgradeHintForEveryInstallMethod(t *testing.T) {
	cases := map[string]string{
		"homebrew":  "brew upgrade",
		"npm-shim":  "npm i -g",
		"curl-sh":   "nlq update",
		"dev":       "https://nlqdb.com/install",
		"":          "https://nlqdb.com/install",
		"something": "https://nlqdb.com/install",
	}
	for method, snippet := range cases {
		got := upgradeHint("0.9.0", method)
		if !strings.Contains(got, snippet) {
			t.Errorf("upgradeHint(0.9.0, %q) = %q; expected to contain %q", method, got, snippet)
		}
	}
}

func TestIsNewer(t *testing.T) {
	cases := []struct {
		latest, current string
		want            bool
	}{
		{"0.2.0", "0.1.9", true},
		{"0.1.0", "0.1.0", false},
		{"0.1.0", "0.2.0", false},
		{"1.0.0", "0.99.99", true},
		{"v0.2.0", "0.1.0", true},
		{"0.2.0-rc1", "0.1.0", true},
		{"", "0.1.0", false},
		{"0.1.0", "", false},
	}
	for _, c := range cases {
		if got := isNewer(c.latest, c.current); got != c.want {
			t.Errorf("isNewer(%q, %q) = %v, want %v", c.latest, c.current, got, c.want)
		}
	}
}
