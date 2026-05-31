package cmd

import (
	"bytes"
	"strings"
	"testing"
)

// runByollm executes `nlq byollm <args>` against a fresh root with stdin
// wired to `stdin`, returning combined stdout and stderr.
func runByollm(t *testing.T, stdin string, args ...string) (string, string, error) {
	t.Helper()
	root := New()
	var out, errBuf bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&errBuf)
	root.SetIn(strings.NewReader(stdin))
	root.SetArgs(append([]string{"byollm"}, args...))
	err := root.Execute()
	return out.String(), errBuf.String(), err
}

func TestByollmSetRejectsColonProvider(t *testing.T) {
	out, errBuf, err := runByollm(t, "sk-abc\n", "set", "open:ai", "gpt-5.2")
	if err == nil {
		t.Fatal("expected error for colon in provider")
	}
	if !strings.Contains(errBuf, "colon") {
		t.Fatalf("stderr = %q", errBuf)
	}
	if out != "" {
		t.Fatalf("expected no stdout, got %q", out)
	}
}

func TestByollmSetEmptyStdin(t *testing.T) {
	_, errBuf, err := runByollm(t, "  \n", "set", "openai", "gpt-5.2")
	if err == nil {
		t.Fatal("expected error for empty key")
	}
	if !strings.Contains(errBuf, "no key given") {
		t.Fatalf("stderr = %q", errBuf)
	}
}
