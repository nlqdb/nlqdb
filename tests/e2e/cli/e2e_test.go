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
		Condition: func(cond string) (bool, error) {
			if cond == "live" {
				return envHasLive(), nil
			}
			return false, fmt.Errorf("unknown condition: %s", cond)
		},
		Setup: func(env *testscript.Env) error {
			srv := httptest.NewServer(mockHandler())
			env.Defer(srv.Close)

			pathSep := string(os.PathListSeparator)
			env.Setenv("PATH", binDir+pathSep+env.Getenv("PATH"))
			env.Setenv("MOCK_API", srv.URL)
			env.Setenv("NLQDB_API_KEY", "sk_live_test_e2e_fixture")
			env.Setenv("NLQDB_DISABLE_UPDATE_CHECK", "1")
			return nil
		},
	})
}

// mockHandler returns canned responses for the API shapes the scripts
// touch; anything outside the allow-list 404s so a missing endpoint
// surfaces in the failing script.
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

	mux.HandleFunc("/v1/keys", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{}})
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(os.Stderr, "mockHandler: unhandled %s %s\n", r.Method, r.URL.Path)
		http.Error(w, `{"status":"not_found","message":"mock has no canned response for this path"}`, http.StatusNotFound)
	})

	return mux
}

func envHasLive() bool {
	return strings.TrimSpace(os.Getenv("NLQDB_E2E_LIVE")) == "1"
}
