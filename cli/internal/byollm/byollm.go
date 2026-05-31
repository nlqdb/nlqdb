// Package byollm parses and validates a bring-your-own-LLM provider key
// into the `x-nlq-byollm-key` wire value, mirroring the TS SDK's single
// tested helper (SK-SDK-010) so the colon-join hazard lives in one place
// across surfaces (GLOBAL-002). The key is dispatched at 0% markup per
// GLOBAL-026; the lane is signed-in only (SK-LLM-021), enforced by the
// server — this package only owns the wire shape.
package byollm

import (
	"fmt"
	"strings"
)

// HeaderName is the wire header the API consumes (SK-LLM-021). Lower-case
// to match the canonical name in apps/api and the TS SDK.
const HeaderName = "x-nlq-byollm-key"

// Credential is a validated BYOLLM provider key. Provider is lower-cased;
// Model is the raw upstream id (BYOLLM is the escape hatch where the user
// owns the model choice, unlike the hosted `model` preset).
type Credential struct {
	Provider string
	Model    string
	Key      string
}

// Header returns the `<provider>:<model>:<key>` value. Safe because Parse
// guarantees Provider and Model are colon-free; only Key may contain a
// colon, and it is the unsplit remainder the server takes verbatim.
func (c Credential) Header() string {
	return c.Provider + ":" + c.Model + ":" + c.Key
}

// Redacted renders the credential for `nlq byollm status` without leaking
// the key — provider/model in clear, key as `…<last 4>`.
func (c Credential) Redacted() string {
	return fmt.Sprintf("%s · %s · key %s", c.Provider, c.Model, maskKey(c.Key))
}

// Parse validates and normalises the three parts, mirroring the SDK's
// buildByollmHeader: provider lower-cased, all parts non-empty,
// provider/model colon-free (the key may contain `:` as the unsplit
// remainder), and no part may hold a control char (CR/LF would smuggle a
// second header). Fails loud with a one-sentence message (GLOBAL-012).
func Parse(provider, model, key string) (Credential, error) {
	p := strings.ToLower(strings.TrimSpace(provider))
	m := strings.TrimSpace(model)
	k := strings.TrimSpace(key)
	if p == "" || m == "" || k == "" {
		return Credential{}, fmt.Errorf("provider, model, and key must all be non-empty")
	}
	if strings.ContainsRune(p, ':') || strings.ContainsRune(m, ':') {
		return Credential{}, fmt.Errorf("provider and model must not contain a colon")
	}
	for _, r := range p + m + k {
		if r < 0x20 || r == 0x7f {
			return Credential{}, fmt.Errorf("provider, model, and key must not contain control characters")
		}
	}
	return Credential{Provider: p, Model: m, Key: k}, nil
}

// FromStored reconstructs a Credential from the joined header value kept
// in the credential store. Splits on the first two colons only so a key
// containing a colon survives intact. Returns false when the stored value
// is missing or malformed (so callers treat a corrupt slot as "unset"
// rather than dispatching a guaranteed-400 header).
func FromStored(value string) (Credential, bool) {
	first := strings.IndexByte(value, ':')
	if first < 0 {
		return Credential{}, false
	}
	second := strings.IndexByte(value[first+1:], ':')
	if second < 0 {
		return Credential{}, false
	}
	second += first + 1
	cred, err := Parse(value[:first], value[first+1:second], value[second+1:])
	if err != nil {
		return Credential{}, false
	}
	return cred, true
}

func maskKey(key string) string {
	if len(key) <= 4 {
		return "****"
	}
	return "…" + key[len(key)-4:]
}
