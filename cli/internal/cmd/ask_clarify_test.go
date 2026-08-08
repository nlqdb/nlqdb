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
		Status:        "clarify_required",
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

	renderClarify(cmd, &api.APIError{Status: "clarify_required", Clarification: "create_or_query_pinned"})
	if !strings.Contains(buf.String(), "without `--db`") {
		t.Errorf("expected create-path hint, got %q", buf.String())
	}
}

func TestSQLRejectedMessage(t *testing.T) {
	cases := map[string]string{
		"delete_without_where": "delete every row",
		"multi_statement":      "one thing at a time",
		"drop_statement":       "start a new database",
		"brand_new_reason":     "that query was rejected",
	}
	for reason, want := range cases {
		if got := sqlRejectedMessage(reason); !strings.Contains(got, want) {
			t.Errorf("sqlRejectedMessage(%q) = %q, want it to contain %q", reason, got, want)
		}
	}
}
