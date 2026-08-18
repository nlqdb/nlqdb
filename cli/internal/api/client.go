// Package api is the only place CLI code talks HTTP. The wire shape
// mirrors @nlqdb/sdk; the CLI is a Go consumer of the same contract
// (GLOBAL-001).
package api

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	mathrand "math/rand/v2"
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
	// SK-CLI-016 — when non-empty, the `<provider>:<model>:<key>` BYOLLM
	// header value. Only `doAsk` sets it (via `WithByollm`); a raw
	// provider key must never ride `run`/`keys`/`databases` calls, so it
	// is scoped by being attached to the ask-only client.
	Byollm string
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

// WithByollm sets the `x-nlq-byollm-key` header for this client's calls
// (SK-CLI-016). Call it only on the ask client — the value is a raw
// provider key and has no business on any other endpoint.
func (c *Client) WithByollm(header string) *Client {
	c.Byollm = header
	return c
}

// APIError carries the API's typed `code` discriminant plus the server-rendered
// copy that goes with it (SK-ERR-001): `Message` is one sentence naming what
// happened, `Action` is the single next step, and `Retryable` is derived from the
// code's recoverability so this client never has to guess.
// HTTPStatus == 0 signals transport-level failure (DNS, timeout, abort).
type APIError struct {
	HTTPStatus int
	Code       string
	Action     string
	Message    string
	// Retryable comes from the server. False means replaying the request
	// replays the failure — a deterministic constraint violation, a rejected
	// key — so `do`'s retry loop must not burn attempts on it.
	Retryable bool
	// retryableSet distinguishes "the server said false" from "no envelope",
	// so a pre-SK-ERR-001 response still falls back to HTTP-status heuristics.
	retryableSet bool
	Path         string
	Raw          json.RawMessage
	// Params carries the code's declared cause fields (bounded enums, slugs) —
	// e.g. `cap` on auth_required, `reason` on sql_rejected.
	Params map[string]json.RawMessage
	// SK-ASK-026 — populated on a `clarify_required` envelope. `Reason` is
	// the one-sentence prompt; `Clarification` distinguishes the SK-ASK-014
	// create-vs-query shape from the SK-ASK-026 destructive one; `Options`
	// carries the re-sendable interpretations for the destructive shape.
	Reason        string
	Clarification string
	Options       []ClarifyOption
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("%s: %s (%d)", e.Code, e.Message, e.HTTPStatus)
	}
	return fmt.Sprintf("%s (%d)", e.Code, e.HTTPStatus)
}

// Cap reports which anonymous budget an `auth_required` names
// (`anon_device_cap` / `anon_global_cap`), or "" when neither.
func (e *APIError) Cap() string { return e.param("cap") }

// param returns a string field from the envelope's `params`, or "".
func (e *APIError) param(name string) string {
	raw, ok := e.Params[name]
	if !ok {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return ""
	}
	return s
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
		// crypto/rand.Text returns a base32 string with ≥128 bits of
		// entropy (Go 1.24+) — purpose-built for header tokens.
		idemKey = rand.Text()
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
		return &APIError{Code: "request_build_error", Message: err.Error(), Path: path}
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
	if c.Byollm != "" {
		req.Header.Set("x-nlq-byollm-key", c.Byollm)
	}

	res, err := c.HTTP.Do(req)
	if err != nil {
		return &APIError{Code: "network_error", Message: err.Error(), Path: path}
	}
	defer func() { _ = res.Body.Close() }()

	data, err := io.ReadAll(res.Body)
	if err != nil {
		return &APIError{HTTPStatus: res.StatusCode, Code: "network_error", Message: err.Error(), Path: path}
	}

	if res.StatusCode >= 200 && res.StatusCode < 300 {
		if out == nil || len(data) == 0 {
			return nil
		}
		if err := json.Unmarshal(data, out); err != nil {
			return &APIError{
				HTTPStatus: res.StatusCode,
				Code:       "non_json_response",
				Message:    fmt.Sprintf("decode 2xx body: %v", err),
				Path:       path,
				Raw:        data,
			}
		}
		return nil
	}

	return extractError(res.StatusCode, path, data)
}

// extractError handles the two envelope shapes the API emits — the SK-ERR-001
// object form (`{error: {code, message, action, retryable, params}}`) and the
// legacy string form (`{error: "invalid_json"}`) — so callers can switch on
// `err.Code` and print `err.Message` / `err.Action` without parsing strings.
func extractError(status int, path string, data []byte) *APIError {
	out := &APIError{HTTPStatus: status, Path: path, Raw: data}

	if len(data) == 0 {
		out.Code = "unknown_error"
		return out
	}

	var generic struct {
		Error json.RawMessage `json:"error"`
	}
	if err := json.Unmarshal(data, &generic); err != nil {
		out.Code = "non_json_response"
		out.Message = fmt.Sprintf("body: %s", trimRaw(data))
		return out
	}

	var asString string
	if err := json.Unmarshal(generic.Error, &asString); err == nil && asString != "" {
		out.Code = asString
		return out
	}

	var asObject struct {
		Code      string                     `json:"code"`
		Action    string                     `json:"action"`
		Message   string                     `json:"message"`
		Retryable *bool                      `json:"retryable"`
		Params    map[string]json.RawMessage `json:"params"`
		// Pre-envelope fields some endpoints still send at the top level.
		Reason        string          `json:"reason"`
		Clarification string          `json:"clarification"`
		Options       []ClarifyOption `json:"options"`
	}
	if err := json.Unmarshal(generic.Error, &asObject); err == nil && asObject.Code != "" {
		out.Code = asObject.Code
		out.Action = asObject.Action
		out.Message = asObject.Message
		out.Params = asObject.Params
		if asObject.Retryable != nil {
			out.Retryable = *asObject.Retryable
			out.retryableSet = true
		}
		out.Reason = firstNonEmpty(asObject.Reason, out.param("reason"))
		out.Clarification = firstNonEmpty(asObject.Clarification, out.param("clarification"))
		out.Options = asObject.Options
		if len(out.Options) == 0 {
			if raw, ok := out.Params["options"]; ok {
				_ = json.Unmarshal(raw, &out.Options)
			}
		}
		if out.Message == "" && out.Reason != "" {
			out.Message = out.Reason
		}
		return out
	}

	out.Code = "unknown_error"
	out.Message = trimRaw(data)
	return out
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func recoverable(e *APIError) bool {
	if e == nil {
		return false
	}
	if e.Code == "network_error" {
		return true
	}
	if e.HTTPStatus == 0 {
		return false
	}
	// SK-ERR-001 — the server already classified this. A 502 `llm_failed` from a
	// rejected BYOLLM key and a 502 from a provider blip look identical by HTTP
	// status; only `retryable` tells them apart, and retrying the former burns
	// three round-trips to reprint the same error.
	if e.retryableSet {
		return e.Retryable
	}
	return e.HTTPStatus >= 500 && e.HTTPStatus < 600
}

// jitteredBackoff returns base × 2^(attempt-1) plus equal-jitter
// randomisation (±50 %). Uses math/rand/v2 — jitter is a timing
// spread, not a security boundary, so crypto/rand would be both
// slower (OS entropy syscalls) and over-spec.
func jitteredBackoff(attempt int) time.Duration {
	const base = 200 * time.Millisecond
	expo := base * (1 << (attempt - 1))
	half := expo / 2
	return half + time.Duration(mathrand.Int64N(int64(half))) //nolint:gosec // G404: jitter, not a security boundary
}

func trimRaw(b []byte) string {
	const cap = 200
	if len(b) <= cap {
		return string(b)
	}
	return string(b[:cap]) + "…"
}
