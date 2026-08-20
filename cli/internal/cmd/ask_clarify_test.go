package cmd

import (
	"bytes"
	"strings"
	"testing"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
)

// SK-ASK-026 — the destructive clarify prints its reason plus a numbered,
// re-runnable option list; the "start fresh" (ForceNoPin) option is flagged
// to run without --db.
func TestRenderClarifyWithOptions(t *testing.T) {
	buf := &bytes.Buffer{}
	cmd := &cobra.Command{}
	cmd.SetErr(buf)
	cmd.SetOut(buf)

	renderClarify(cmd, &api.APIError{
		Code:          "clarify_required",
		Clarification: "destructive_ambiguous",
		Reason:        "Clearing the whole database could mean a few things.",
		Options: []api.ClarifyOption{
			{Label: `Empty the "facts" table`, Goal: "delete every row from the facts table"},
			{Label: "Start fresh with a new, empty database", Goal: "create a new empty database", ForceNoPin: true},
		},
	})

	out := buf.String()
	for _, want := range []string{
		"Clearing the whole database could mean a few things.",
		"1.", `Empty the "facts" table`,
		`nlq ask "delete every row from the facts table"`,
		"2.", "Start fresh with a new, empty database",
		"run without --db",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("clarify output missing %q\n---\n%s", want, out)
		}
	}
}

// The SK-ASK-014 create-vs-query clarify has no options — fall back to the
// pinned-DB hint rather than an empty list.
func TestRenderClarifyNoOptionsFallsBack(t *testing.T) {
	buf := &bytes.Buffer{}
	cmd := &cobra.Command{}
	cmd.SetErr(buf)
	cmd.SetOut(buf)

	renderClarify(cmd, &api.APIError{Code: "clarify_required", Clarification: "create_or_query_pinned"})
	out := buf.String()
	// Both resolutions are offered: drop the pin to create, or --force-query to
	// query the pinned DB (SK-ASK-032 — the CLI equivalent of the web chip).
	for _, want := range []string{"without `--db`", "--force-query"} {
		if !strings.Contains(out, want) {
			t.Errorf("clarify hint missing %q, got %q", want, out)
		}
	}
}

// SK-ERR-001 — the CLI no longer keeps its own copy of the SQL-allowlist reject
// reasons (or of any other code's wording). It prints the server-rendered
// message + action, lower-cased into the CLI's voice. This is the test that the
// hand-written table used to need, now aimed at the pass-through.
func TestPrintWireErrorRendersServerCopy(t *testing.T) {
	buf := &bytes.Buffer{}
	cmd := &cobra.Command{}
	cmd.SetErr(buf)
	cmd.SetOut(buf)

	printWireError(cmd, &api.APIError{
		HTTPStatus: 400,
		Code:       "sql_rejected",
		Message:    "That would delete every row in the table.",
		Action:     "Add a filter naming which rows to remove, then ask again.",
	})

	out := buf.String()
	for _, want := range []string{"that would delete every row", "Add a filter naming"} {
		if !strings.Contains(out, want) {
			t.Errorf("wire error output missing %q\n---\n%s", want, out)
		}
	}
}

// An older deployment that sends no copy must still say something specific
// rather than nothing (GLOBAL-012).
func TestPrintWireErrorFallsBackToCode(t *testing.T) {
	buf := &bytes.Buffer{}
	cmd := &cobra.Command{}
	cmd.SetErr(buf)
	cmd.SetOut(buf)

	printWireError(cmd, &api.APIError{HTTPStatus: 502, Code: "llm_failed"})
	if !strings.Contains(buf.String(), "llm_failed") {
		t.Errorf("expected the code in the fallback, got %q", buf.String())
	}
}

// A proper noun or an all-caps verb the server named on purpose must survive
// the CLI's lower-casing.
func TestLowerFirstKeepsProperNouns(t *testing.T) {
	if got := lowerFirst("OpenRouter rejected the key."); got != "OpenRouter rejected the key." {
		t.Errorf("lowerFirst mangled a proper noun: %q", got)
	}
	if got := lowerFirst("That would delete every row."); got != "that would delete every row." {
		t.Errorf("lowerFirst(%q) = %q", "That would…", got)
	}
}
