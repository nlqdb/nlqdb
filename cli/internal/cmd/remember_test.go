package cmd

import "testing"

func TestBuildRememberFact(t *testing.T) {
	req, err := buildRememberRequest("db1", "user likes dark mode", &rememberFlags{
		kind: "fact", subType: "preference", tags: []string{"ui", "prefs"}, ttl: "7d",
	})
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if req.Kind != "fact" {
		t.Errorf("kind = %q", req.Kind)
	}
	if req.Payload["content"] != "user likes dark mode" {
		t.Errorf("content = %v", req.Payload["content"])
	}
	if req.Payload["kind"] != "preference" {
		t.Errorf("category = %v", req.Payload["kind"])
	}
	if req.TTLSeconds != 7*24*60*60 {
		t.Errorf("ttlSeconds = %d", req.TTLSeconds)
	}
}

func TestBuildRememberEpisodeRequiresRole(t *testing.T) {
	if _, err := buildRememberRequest("db1", "hello", &rememberFlags{kind: "episode"}); err == nil {
		t.Fatal("expected error when --role missing")
	}
	req, err := buildRememberRequest("db1", "hello", &rememberFlags{kind: "episode", role: "user"})
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if req.Payload["role"] != "user" || req.Payload["content"] != "hello" {
		t.Errorf("payload = %v", req.Payload)
	}
}

func TestBuildRememberEntityRequiresType(t *testing.T) {
	if _, err := buildRememberRequest("db1", "Alice", &rememberFlags{kind: "entity"}); err == nil {
		t.Fatal("expected error when --type missing")
	}
	req, err := buildRememberRequest("db1", "Alice", &rememberFlags{kind: "entity", subType: "person"})
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if req.Payload["kind"] != "person" || req.Payload["canonical_name"] != "Alice" {
		t.Errorf("payload = %v", req.Payload)
	}
}

func TestBuildRememberUnknownKind(t *testing.T) {
	if _, err := buildRememberRequest("db1", "x", &rememberFlags{kind: "blob"}); err == nil {
		t.Fatal("expected error for unknown kind")
	}
}

func TestParseTTL(t *testing.T) {
	cases := []struct {
		in   string
		want int
		ok   bool
	}{
		{"7d", 7 * 86400, true},
		{"24h", 86400, true},
		{"30m", 1800, true},
		{"0d", 0, false},
		{"", 0, false},
		{"abc", 0, false},
	}
	for _, tc := range cases {
		got, err := parseTTL(tc.in)
		if tc.ok && (err != nil || got != tc.want) {
			t.Errorf("parseTTL(%q) = %d, %v; want %d", tc.in, got, err, tc.want)
		}
		if !tc.ok && err == nil {
			t.Errorf("parseTTL(%q) expected error", tc.in)
		}
	}
}
