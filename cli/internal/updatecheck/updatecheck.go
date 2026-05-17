// Package updatecheck polls latest.json at most once per 24 h and
// prints an install-method-aware stderr hint on a newer release
// (SK-CLI-015).
package updatecheck

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/nlqdb/nlqdb/cli/internal/state"
	"github.com/nlqdb/nlqdb/cli/internal/version"
)

const (
	endpoint = "https://nlqdb.com/install/latest.json"
	period   = 24 * time.Hour
)

type Latest struct {
	Version             string `json:"version"`
	ReleasedAt          string `json:"released_at"`
	URLTemplate         string `json:"url_template,omitempty"`
	MinSupportedVersion string `json:"min_supported_version,omitempty"`
}

// IsCI is the auto-skip enumeration from SK-CLI-015 — any new variable
// lands here so the unit test exercises it.
func IsCI(env func(string) string) bool {
	for _, k := range []string{
		"CI", "GITHUB_ACTIONS", "JENKINS_URL", "BUILDKITE",
		"GITLAB_CI", "CIRCLECI", "TRAVIS", "TEAMCITY_VERSION",
	} {
		if strings.TrimSpace(env(k)) != "" {
			return true
		}
	}
	return false
}

type SkipReason string

const (
	SkipNone   SkipReason = ""
	SkipEnvOff SkipReason = "env_off"
	SkipCI     SkipReason = "ci"
	SkipJSON   SkipReason = "json_output"
	SkipNonTTY SkipReason = "non_tty"
	SkipRecent SkipReason = "recent"
)

type Options struct {
	JSON   bool
	NonTTY bool
	Env    func(string) string
	Now    func() time.Time
}

func defaults(o Options) Options {
	if o.Env == nil {
		o.Env = os.Getenv
	}
	if o.Now == nil {
		o.Now = time.Now
	}
	return o
}

// ShouldRun is pure (no I/O) so every suppressor branch is unit-testable.
func ShouldRun(s state.State, opts Options) SkipReason {
	opts = defaults(opts)
	if v := opts.Env("NLQDB_NO_UPDATE_CHECK"); v != "" && v != "0" && strings.ToLower(v) != "false" {
		return SkipEnvOff
	}
	if opts.JSON {
		return SkipJSON
	}
	if IsCI(opts.Env) {
		return SkipCI
	}
	if opts.NonTTY {
		return SkipNonTTY
	}
	if s.UpdateCheck.CheckedAt > 0 {
		last := time.Unix(s.UpdateCheck.CheckedAt, 0)
		if opts.Now().Sub(last) < period {
			return SkipRecent
		}
	}
	return SkipNone
}

// Run fetches latest.json. Errors are swallowed — the update check
// must never delay or fail the user's actual command.
func Run(ctx context.Context, errw io.Writer, opts Options) {
	opts = defaults(opts)
	st, err := state.Load()
	if err != nil {
		return
	}
	if r := ShouldRun(st, opts); r != SkipNone {
		return
	}

	c, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(c, http.MethodGet, endpoint, nil)
	if err != nil {
		return
	}
	req.Header.Set("Accept", "application/json")
	// Explicit client (not http.DefaultClient) — a transport that
	// ignores ctx during DNS / TLS hand-shake can hang past the
	// caller's deadline; Client.Timeout is the belt to the ctx braces.
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return
	}

	var latest Latest
	if err := json.NewDecoder(resp.Body).Decode(&latest); err != nil {
		return
	}

	now := opts.Now().Unix()
	_ = state.Update(func(s *state.State) {
		s.UpdateCheck.CheckedAt = now
		s.UpdateCheck.LastSeenVersion = latest.Version
	})

	if !isNewer(latest.Version, version.Version) {
		return
	}
	fmt.Fprintln(errw, upgradeHint(latest.Version, version.InstallMethod))
}

func upgradeHint(latest, method string) string {
	switch method {
	case "homebrew":
		return fmt.Sprintf("nlq %s is available — run `brew upgrade nlqdb/tap/nlq`", latest)
	case "npm-shim":
		return fmt.Sprintf("nlq %s is available — run `npm i -g @nlqdb/cli@latest`", latest)
	case "curl-sh":
		return fmt.Sprintf("nlq %s is available — run `nlq update`", latest)
	default:
		return fmt.Sprintf("nlq %s is available — see https://nlqdb.com/install", latest)
	}
}

// isNewer compares dotted semver numerically; pre-release suffixes
// (`-rc`, `-dev`) are stripped before comparison.
func isNewer(latest, current string) bool {
	if latest == "" || current == "" {
		return false
	}
	l := splitSemver(latest)
	c := splitSemver(current)
	for i := range 3 {
		if l[i] > c[i] {
			return true
		}
		if l[i] < c[i] {
			return false
		}
	}
	return false
}

// splitSemver treats a non-numeric component as zero; that's
// conservative — `0.2.foo` compares as `0.2.0`, so an unrecognised
// version is "older" rather than triggering a spurious upgrade hint.
func splitSemver(v string) [3]int {
	v = strings.TrimPrefix(v, "v")
	if idx := strings.IndexAny(v, "-+"); idx >= 0 {
		v = v[:idx]
	}
	parts := strings.SplitN(v, ".", 3)
	limit := min(len(parts), 3)
	var out [3]int
	for i := range limit {
		n, err := strconv.Atoi(parts[i])
		if err != nil {
			n = 0
		}
		out[i] = n
	}
	return out
}
