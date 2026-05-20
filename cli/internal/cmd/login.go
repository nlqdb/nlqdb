package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/credstore"
	"github.com/nlqdb/nlqdb/cli/internal/useragent"
)

func registerLogin(root *cobra.Command, g *globalFlags) {
	var noBrowser bool
	cmd := &cobra.Command{
		Use:   "login",
		Short: "Sign in via OAuth device-code flow (SK-CLI-006)",
		Long: `nlq login runs the OAuth 2.0 Device Authorization Grant per
SK-CLI-006: POST /v1/auth/device returns a code + verification URL; the
CLI opens your browser to verification_uri_complete; once you click
"Approve", POST /v1/auth/device/token returns the sk_live_ key that's
written to your OS keychain (or AES-GCM fallback) per SK-CLI-009.

` + "`--no-browser`" + ` prints the URL + code without trying to open a browser
(useful over SSH / inside a container).`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runLogin(cmd, g, noBrowser)
		},
	}
	cmd.Flags().BoolVar(&noBrowser, "no-browser", false, "skip the browser open; print the URL only")
	root.AddCommand(cmd)
}

type deviceInitResponse struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int    `json:"expires_in"`
	Interval                int    `json:"interval"`
}

type deviceTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
}

type deviceErrorResponse struct {
	Error string `json:"error"`
}

func runLogin(cmd *cobra.Command, g *globalFlags, noBrowser bool) error {
	ctx := cmd.Context()
	baseURL := strings.TrimRight(g.apiURL, "/")
	if baseURL == "" {
		baseURL = "https://app.nlqdb.com"
	}

	init, err := deviceInit(ctx, baseURL)
	if err != nil {
		printErr(cmd, "nlq login: %v", err)
		return err
	}

	out := cmd.OutOrStdout()
	if g.json {
		// JSON mode prints the init payload so scripts can render
		// their own UI; the polling result lands on a second JSON
		// line once approval comes through.
		_ = json.NewEncoder(out).Encode(map[string]any{
			"step":                      "device_init",
			"user_code":                 init.UserCode,
			"verification_uri":          init.VerificationURI,
			"verification_uri_complete": init.VerificationURIComplete,
			"expires_in":                init.ExpiresIn,
		})
	} else {
		fmt.Fprintf(out, "Sign in to the nlq CLI:\n")
		fmt.Fprintf(out, "  %s\n", init.VerificationURIComplete)
		fmt.Fprintf(out, "Confirm this code matches your browser: %s\n", init.UserCode)
	}

	if !noBrowser {
		if err := openBrowser(init.VerificationURIComplete); err != nil && !g.json {
			fmt.Fprintf(out, "(Couldn't open browser automatically — visit the URL above.)\n")
		}
	}

	if !g.json {
		fmt.Fprintln(out, "Waiting for approval…")
	}

	token, err := pollForToken(ctx, baseURL, init)
	if err != nil {
		printErr(cmd, "nlq login: %v", err)
		return err
	}

	if err := credstore.Set(credstore.SlotRefreshToken, token); err != nil {
		printErr(cmd, "nlq login: could not save credential — %v", err)
		return err
	}
	// A prior anon token would shadow the new sign-in via auth.Resolve's
	// precedence; clear it so `nlq whoami` reflects the signed-in state.
	_ = credstore.Delete(credstore.SlotAnonToken)

	if g.json {
		_ = json.NewEncoder(out).Encode(map[string]any{
			"step":          "approved",
			"token_display": auth.Redacted(token),
		})
		return nil
	}
	fmt.Fprintf(out, "✓ Signed in — credential stored (%s).\n", auth.Redacted(token))
	return nil
}

func deviceInit(ctx context.Context, baseURL string) (*deviceInitResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/v1/auth/device", strings.NewReader("{}"))
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("accept", "application/json")
	req.Header.Set("user-agent", useragent.String())

	client := &http.Client{Timeout: 15 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("contact %s: %w", baseURL, err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("device-init HTTP %d", res.StatusCode)
	}
	var out deviceInitResponse
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("device-init decode: %w", err)
	}
	if out.DeviceCode == "" || out.UserCode == "" {
		return nil, errors.New("device-init: empty code in response")
	}
	if out.Interval <= 0 {
		out.Interval = 2
	}
	if out.ExpiresIn <= 0 {
		out.ExpiresIn = 600
	}
	return &out, nil
}

func pollForToken(ctx context.Context, baseURL string, init *deviceInitResponse) (string, error) {
	deadline := time.Now().Add(time.Duration(init.ExpiresIn) * time.Second)
	interval := time.Duration(init.Interval) * time.Second
	client := &http.Client{Timeout: 15 * time.Second}
	body := fmt.Sprintf(`{"device_code":%q}`, init.DeviceCode)

	for {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		if time.Now().After(deadline) {
			return "", errors.New("login window expired — re-run `nlq login`")
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/v1/auth/device/token", strings.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("content-type", "application/json")
		req.Header.Set("accept", "application/json")
		req.Header.Set("user-agent", useragent.String())

		res, err := client.Do(req)
		if err != nil {
			// Network blips during polling are recoverable — fall
			// through to the sleep and retry on the next tick.
			if err := sleepWithCtx(ctx, interval); err != nil {
				return "", err
			}
			continue
		}
		token, retryable, perr := readTokenResponse(res)
		_ = res.Body.Close()
		if perr != nil && !retryable {
			return "", perr
		}
		if token != "" {
			return token, nil
		}
		if err := sleepWithCtx(ctx, interval); err != nil {
			return "", err
		}
	}
}

func readTokenResponse(res *http.Response) (token string, retryable bool, err error) {
	if res.StatusCode == http.StatusOK {
		var out deviceTokenResponse
		if derr := json.NewDecoder(res.Body).Decode(&out); derr != nil {
			return "", false, fmt.Errorf("token decode: %w", derr)
		}
		if out.AccessToken == "" {
			return "", false, errors.New("token response missing access_token")
		}
		return out.AccessToken, false, nil
	}
	var er deviceErrorResponse
	_ = json.NewDecoder(res.Body).Decode(&er)
	switch er.Error {
	case "authorization_pending":
		return "", true, nil
	case "expired_token":
		return "", false, errors.New("login window expired — re-run `nlq login`")
	case "invalid_device_code":
		return "", false, errors.New("invalid device code — re-run `nlq login`")
	default:
		if er.Error != "" {
			return "", false, fmt.Errorf("token error: %s (HTTP %d)", er.Error, res.StatusCode)
		}
		return "", false, fmt.Errorf("token HTTP %d", res.StatusCode)
	}
}

func sleepWithCtx(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}
