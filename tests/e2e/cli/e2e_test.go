// Package e2e drives the `nlq` binary through testscript-style txtar
// fixtures. The build-once-per-process pattern (in TestMain) plus a
// per-script httptest.Server (in TestE2E.Setup) is the standard idiom
// for Go CLI e2e tests — same shape used by GitHub CLI's acceptance
// suite and Hugo's site tests.
//
// Layout:
//
//   - Each `.txtar` under scripts/ is one persona-step assertion.
//   - Scripts run hermetically by default — the `MOCK_API` env points
//     at an in-process mock server with canned responses.
//   - Setting `NLQDB_E2E_LIVE=1` + `NLQDB_API_URL=https://…` swaps the
//     mock for a real staging URL (journey mode, SK-E2E-003).
package e2e

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/rogpeppe/go-internal/testscript"
)

// binDir is the tempdir that holds the freshly-built `nlq` binary.
// Populated once in TestMain and prepended to $PATH per-script so the
// txtar scripts invoke `nlq` without a path.
var binDir string

func TestMain(m *testing.M) {
	tmp, err := os.MkdirTemp("", "nlq-e2e-bin-*")
	if err != nil {
		fmt.Fprintf(os.Stderr, "mkdir tempdir: %v\n", err)
		os.Exit(2)
	}
	defer os.RemoveAll(tmp)

	bin := filepath.Join(tmp, "nlq")
	if runtime.GOOS == "windows" {
		bin += ".exe"
	}
	// Build the binary out of the cli/ module without leaving its
	// directory — `-C` keeps GOPATH semantics clean.
	out, err := exec.Command("go", "-C", "../../../cli", "build", "-o", bin, "./cmd/nlq").CombinedOutput()
	if err != nil {
		fmt.Fprintf(os.Stderr, "build nlq: %v\n%s", err, out)
		os.Exit(2)
	}
	binDir = tmp
	os.Exit(m.Run())
}

func TestE2E(t *testing.T) {
	testscript.Run(t, testscript.Params{
		Dir: "scripts",
		// `[live]` gates assertions on whether we're hitting a real
		// staging URL vs the in-process mock. Used by journey-style
		// scripts that exercise the LLM-backed `ask` pipeline; those
		// assertions skip in hermetic mode (default `go test`).
		Condition: func(cond string) (bool, error) {
			if cond == "live" {
				return envHasLive(), nil
			}
			return false, fmt.Errorf("unknown condition: %s", cond)
		},
		Setup: func(env *testscript.Env) error {
			// One mock-API server per script — isolated state, no
			// cross-script leakage. env.Defer fires at script-end.
			srv := httptest.NewServer(mockHandler())
			env.Defer(srv.Close)

			// Order matters: testscript wipes most env vars by default,
			// so we put the binary on PATH ourselves.
			pathSep := string(os.PathListSeparator)
			env.Setenv("PATH", binDir+pathSep+env.Getenv("PATH"))
			env.Setenv("MOCK_API", srv.URL)

			// Hermetic-mode defaults. Live-mode (NLQDB_E2E_LIVE=1)
			// scripts override these explicitly via `env NLQDB_API_URL=…`.
			env.Setenv("NLQDB_API_KEY", "sk_live_test_e2e_fixture")

			// Update check would phone home — turn it off uniformly.
			// `--no-update-check` is also passed in scripts as belt+braces.
			env.Setenv("NLQDB_DISABLE_UPDATE_CHECK", "1")
			return nil
		},
	})
}

// mockHandler returns canned, deterministic responses for the API
// shapes the e2e scripts touch. Keep it minimal — the goal is to
// verify CLI behaviour against a known wire shape, not to re-implement
// the API. Anything outside this allow-list returns 404 so a missing
// endpoint surfaces clearly in the failing script.
func mockHandler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/v1/databases", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"databases": []map[string]any{
					{
						"id":          "db_e2e_p1",
						"slug":        "mealplan",
						"displayName": "Mealplan",
						"engine":      "postgres",
						"createdAt":   1700000000,
					},
				},
			})
		default:
			http.Error(w, `{"status":"method_not_allowed"}`, http.StatusMethodNotAllowed)
		}
	})

	// /v1/keys list — auth-gated (session-only in prod, but the mock
	// accepts the test key + returns an empty list so the CLI's "no
	// keys yet" friendly message path is exercised.
	mux.HandleFunc("/v1/keys", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{}})
	})

	// Catch-all so a typo in a script surfaces in the test log rather
	// than silently 200-ing.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(os.Stderr, "mockHandler: unhandled %s %s\n", r.Method, r.URL.Path)
		http.Error(w, `{"status":"not_found","message":"mock has no canned response for this path"}`, http.StatusNotFound)
	})

	return mux
}

// envHasLive reports whether the script is running in journey mode
// against a real staging URL. Scripts use the `[live]` testscript
// condition (registered in TestE2E's Params) to skip hermetic-only
// assertions. Usage in a script:
//
//	[live] exec nlq --api-url=$NLQDB_API_URL ask "how many users"
func envHasLive() bool {
	return strings.TrimSpace(os.Getenv("NLQDB_E2E_LIVE")) == "1"
}
