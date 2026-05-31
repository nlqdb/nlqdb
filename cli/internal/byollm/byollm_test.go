package byollm

import "testing"

func TestParseValidLowercasesProvider(t *testing.T) {
	cred, err := Parse(" OpenAI ", " gpt-5.2 ", " sk-abc ")
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if cred.Provider != "openai" || cred.Model != "gpt-5.2" || cred.Key != "sk-abc" {
		t.Fatalf("unexpected credential: %+v", cred)
	}
	if cred.Header() != "openai:gpt-5.2:sk-abc" {
		t.Fatalf("header = %q", cred.Header())
	}
}

func TestParseRejectsEmptyParts(t *testing.T) {
	for _, tc := range []struct{ p, m, k string }{
		{"", "m", "k"},
		{"p", "", "k"},
		{"p", "m", ""},
		{"  ", "m", "k"},
	} {
		if _, err := Parse(tc.p, tc.m, tc.k); err == nil {
			t.Fatalf("expected error for %+v", tc)
		}
	}
}

func TestParseRejectsColonInProviderOrModel(t *testing.T) {
	if _, err := Parse("open:ai", "m", "k"); err == nil {
		t.Fatal("expected colon-in-provider error")
	}
	if _, err := Parse("openai", "gpt:5", "k"); err == nil {
		t.Fatal("expected colon-in-model error")
	}
}

func TestParseAllowsColonInKey(t *testing.T) {
	cred, err := Parse("openai", "gpt-5.2", "sk:with:colons")
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if cred.Key != "sk:with:colons" {
		t.Fatalf("key = %q", cred.Key)
	}
}

func TestParseRejectsControlChars(t *testing.T) {
	if _, err := Parse("openai", "gpt-5.2", "sk-\r\nX-Smuggled: 1"); err == nil {
		t.Fatal("expected control-char error")
	}
}

func TestFromStoredRoundTrips(t *testing.T) {
	cred, ok := FromStored("openai:gpt-5.2:sk:with:colons")
	if !ok {
		t.Fatal("expected ok")
	}
	if cred.Provider != "openai" || cred.Model != "gpt-5.2" || cred.Key != "sk:with:colons" {
		t.Fatalf("unexpected credential: %+v", cred)
	}
}

func TestFromStoredRejectsMalformed(t *testing.T) {
	for _, v := range []string{"", "openai", "openai:gpt-5.2", "openai:gpt-5.2:"} {
		if _, ok := FromStored(v); ok {
			t.Fatalf("expected malformed for %q", v)
		}
	}
}

func TestRedactedHidesKey(t *testing.T) {
	cred := Credential{Provider: "openai", Model: "gpt-5.2", Key: "sk-secret1234"}
	got := cred.Redacted()
	if want := "openai · gpt-5.2 · key …1234"; got != want {
		t.Fatalf("Redacted() = %q, want %q", got, want)
	}
	if got := (Credential{Key: "ab"}).Redacted(); got == "" || got[len(got)-4:] != "****" {
		t.Fatalf("short key not masked: %q", got)
	}
}
