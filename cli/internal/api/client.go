// Package api is the only place CLI code talks HTTP. The wire shape
// mirrors @nlqdb/sdk; the CLI is a Go consumer of the same contract
// (GLOBAL-001).
package api

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/useragent"
)

// maxAttempts mirrors the TS SDK budget (GLOBAL-022 / SK-SDK-006).
const maxAttempts = 3

type Client struct {
	BaseURL    string
	HTTP       *http.Client
	Identity   auth.Identity
	UserAgent  string
	MaxRetries int
}

func New(baseURL string, identity auth.Identity) *Client {
	return &Client{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		HTTP:       &http.Client{Timeout: 60 * time.Second},
		Identity:   identity,
		UserAgent:  useragent.String(),
		MaxRetries: maxAttempts,
	}
}

// APIError carries the API's typed `status` discriminant plus the
// sub-discriminant `code` (e.g. `auth_required` + `anon_device_cap`).
// HTTPStatus == 0 signals transport-level failure (DNS, timeout, abort).
type APIError struct {
	HTTPStatus int
	Status     string
	Code       string
	Action     string
	Message    string
	Path       string
	Raw        json.RawMessage
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("%s: %s (%d)", e.Status, e.Message, e.HTTPStatus)
	}
	return fmt.Sprintf("%s (%d)", e.Status, e.HTTPStatus)
}

func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	var raw []byte
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode body: %w", err)
		}
		raw = b
	}
	idemKey := ""
	if method != http.MethodGet && method != "" {
		idemKey = randomHex(16)
	}

	attempts := c.MaxRetries
	if attempts <= 0 {
		attempts = maxAttempts
	}

	var lastErr error
	for attempt := 1; attempt <= attempts; attempt++ {
		err := c.send(ctx, method, path, raw, idemKey, out)
		if err == nil {
			return nil
		}
		var apiErr *APIError
		if errors.As(err, &apiErr) {
			if !recoverable(apiErr) {
				return apiErr
			}
		}
		lastErr = err
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if attempt < attempts {
			// Equal-jitter exponential backoff (~200/400/800 ms with
			// ±50% randomisation) per 2026 best-practice retry guidance
			// — pure exponential synchronises retry storms.
			backoff := jitteredBackoff(attempt)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}
	return lastErr
}

func (c *Client) send(ctx context.Context, method, path string, body []byte, idemKey string, out any) error {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, reader)
	if err != nil {
		return &APIError{Status: "request_build_error", Message: err.Error(), Path: path}
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", c.UserAgent)
	if c.Identity.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Identity.Token)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if idemKey != "" {
		req.Header.Set("Idempotency-Key", idemKey)
	}

	res, err := c.HTTP.Do(req)
	if err != nil {
		return &APIError{Status: "network_error", Message: err.Error(), Path: path}
	}
	defer func() { _ = res.Body.Close() }()

	data, err := io.ReadAll(res.Body)
	if err != nil {
		return &APIError{HTTPStatus: res.StatusCode, Status: "network_error", Message: err.Error(), Path: path}
	}

	if res.StatusCode >= 200 && res.StatusCode < 300 {
		if out == nil || len(data) == 0 {
			return nil
		}
		if err := json.Unmarshal(data, out); err != nil {
			return &APIError{
				HTTPStatus: res.StatusCode,
				Status:     "non_json_response",
				Message:    fmt.Sprintf("decode 2xx body: %v", err),
				Path:       path,
				Raw:        data,
			}
		}
		return nil
	}

	return extractError(res.StatusCode, path, data)
}

// extractError handles the two envelope shapes the API emits — the
// object form (`{error: {status, code, action}}`) and the string form
// (`{error: "invalid_json"}`) — so callers can switch on `err.Status`
// without parsing strings.
func extractError(status int, path string, data []byte) *APIError {
	out := &APIError{HTTPStatus: status, Path: path, Raw: data}

	if len(data) == 0 {
		out.Status = "unknown_error"
		return out
	}

	var generic struct {
		Error json.RawMessage `json:"error"`
	}
	if err := json.Unmarshal(data, &generic); err != nil {
		out.Status = "non_json_response"
		out.Message = fmt.Sprintf("body: %s", trimRaw(data))
		return out
	}

	var asString string
	if err := json.Unmarshal(generic.Error, &asString); err == nil && asString != "" {
		out.Status = asString
		return out
	}

	var asObject struct {
		Status  string `json:"status"`
		Code    string `json:"code"`
		Action  string `json:"action"`
		Message string `json:"message"`
		Reason  string `json:"reason"`
	}
	if err := json.Unmarshal(generic.Error, &asObject); err == nil && asObject.Status != "" {
		out.Status = asObject.Status
		out.Code = asObject.Code
		out.Action = asObject.Action
		switch {
		case asObject.Message != "":
			out.Message = asObject.Message
		case asObject.Reason != "":
			out.Message = asObject.Reason
		}
		return out
	}

	out.Status = "unknown_error"
	out.Message = trimRaw(data)
	return out
}

func recoverable(e *APIError) bool {
	if e == nil {
		return false
	}
	if e.HTTPStatus == 0 && e.Status != "network_error" {
		return false
	}
	if e.Status == "network_error" {
		return true
	}
	if e.HTTPStatus >= 500 && e.HTTPStatus < 600 {
		return true
	}
	return false
}

func randomHex(n int) string {
	b := make([]byte, n)
	// crypto/rand failing on Linux/macOS/Windows means the OS is in an
	// unusable state; falling back to a time-based id would silently
	// weaken our retry-dedup contract. Crash loudly instead.
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("nlqdb: crypto/rand unavailable: %v", err))
	}
	return hex.EncodeToString(b)
}

// jitteredBackoff returns base × 2^(attempt-1) plus equal-jitter
// randomisation (±50 %). Bounded so a worst-case 3-attempt run can't
// stall longer than ~1.8 s before hitting the caller's context deadline.
func jitteredBackoff(attempt int) time.Duration {
	const base = 200 * time.Millisecond
	expo := base * (1 << (attempt - 1))
	half := expo / 2
	jitter, err := cryptoRandInt63(int64(half))
	if err != nil {
		return expo
	}
	return half + time.Duration(jitter)
}

func cryptoRandInt63(max int64) (int64, error) {
	if max <= 0 {
		return 0, nil
	}
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return 0, err
	}
	n := int64(b[0])<<56 | int64(b[1])<<48 | int64(b[2])<<40 | int64(b[3])<<32 |
		int64(b[4])<<24 | int64(b[5])<<16 | int64(b[6])<<8 | int64(b[7])
	if n < 0 {
		n = -n
	}
	return n % max, nil
}

func trimRaw(b []byte) string {
	const cap = 200
	if len(b) <= cap {
		return string(b)
	}
	return string(b[:cap]) + "…"
}
