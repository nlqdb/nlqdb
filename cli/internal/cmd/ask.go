package cmd

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/output"
	"github.com/nlqdb/nlqdb/cli/internal/state"
)

func registerAsk(root *cobra.Command, g *globalFlags) {
	var (
		db      string
		engine  string
		model   string
		confirm bool
	)
	cmd := &cobra.Command{
		Use:   "ask <goal>",
		Short: "Ask a question in plain English",
		Long: `Ask runs the /v1/ask pipeline. With --db it pins to a specific
database (and fails if the DB doesn't exist); without --db it resolves
the active DB from ~/.config/nlqdb/state.json, creating a new one
from the goal if there is none (SK-CLI-012).

Pass --json for machine-readable output.`,
		Args: cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, cancel := context.WithTimeout(cmd.Context(), 120*time.Second)
			defer cancel()
			return doAsk(ctx, cmd, g, askParams{
				goal:    joinArgs(args),
				dbID:    db,
				engine:  engine,
				model:   model,
				confirm: confirm,
			})
		},
	}
	cmd.Flags().StringVar(&db, "db", "", "pin the call to this database id (errors if missing)")
	cmd.Flags().StringVar(&engine, "engine", "", "engine override on the create branch (postgres|clickhouse)")
	cmd.Flags().StringVar(&model, "model", "", "model preset (auto|fast|best); best needs a BYOLLM key (`nlq byollm set`) or a paid plan")
	cmd.Flags().BoolVar(&confirm, "confirm", false, "approve a destructive plan returned by an earlier call")
	root.AddCommand(cmd)
}

type askParams struct {
	goal    string
	dbID    string
	engine  string
	model   string
	confirm bool
	// alwaysCreate bypasses active-DB resolution; `nlq new` sets it.
	alwaysCreate bool
}

func doAsk(ctx context.Context, cmd *cobra.Command, g *globalFlags, p askParams) error {
	id, err := auth.Resolve(true)
	if err != nil {
		printErr(cmd, "auth: %v", err)
		return err
	}
	client := api.New(g.apiURL, id)

	// SK-CLI-016 — attach a stored BYOLLM key so the ask dispatches
	// through the user's own provider at 0% markup (GLOBAL-026). The
	// server accepts the lane on a signed-in session only
	// (`byollm_requires_session`), so pre-empt the other identity kinds
	// here with a precise message instead of a guaranteed-400 round-trip.
	if cred, ok := loadByollm(); ok {
		if id.Kind != auth.KindSignedIn {
			printErr(cmd, "byollm: %s", byollmNeedsSession)
			return errors.New("byollm requires signed-in session")
		}
		client = client.WithByollm(cred.Header())
	}

	req := api.AskRequest{
		Goal:    p.goal,
		Engine:  p.engine,
		Model:   p.model,
		Confirm: p.confirm,
	}

	switch {
	case p.alwaysCreate:
	case p.dbID != "":
		req.DBID = p.dbID
	default:
		st, _ := state.Load()
		if st.ActiveDB != "" {
			req.DBID = st.ActiveDB
		}
	}

	resp, err := client.Ask(ctx, req)
	if err != nil {
		return renderAPIError(cmd, err)
	}

	// SK-CLI-012: persist the freshly-minted DB so the next bare call
	// lands on it. Failure logs to stderr (read-only fs etc.) so the
	// user sees why future calls might re-create instead of reusing.
	switch {
	case resp.Kind == "create" && resp.DB != "":
		if err := state.Update(func(s *state.State) {
			s.ActiveDB = resp.DB
			s.LastUsedAt = time.Now().Unix()
		}); err != nil {
			fmt.Fprintf(cmd.ErrOrStderr(), "⚠ state: %v\n", err)
		}
	case resp.Status == "ok" && req.DBID != "":
		if err := state.Update(func(s *state.State) {
			s.LastUsedAt = time.Now().Unix()
		}); err != nil {
			fmt.Fprintf(cmd.ErrOrStderr(), "⚠ state: %v\n", err)
		}
	}

	w := output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g))
	return w.WriteAsk(resp)
}

func formatFor(g *globalFlags) output.Format {
	if g.json {
		return output.FormatJSON
	}
	return output.FormatHuman
}

func renderAPIError(cmd *cobra.Command, err error) error {
	var apiErr *api.APIError
	if !errors.As(err, &apiErr) {
		printErr(cmd, "%v", err)
		return err
	}
	switch apiErr.Status {
	case "ambiguous_db":
		printErr(cmd, "the goal matches multiple databases — re-run with `--db=<id>` to pin one.")
	case "clarify_required":
		renderClarify(cmd, apiErr)
	case "sql_rejected":
		printErr(cmd, "%s", sqlRejectedMessage(apiErr.Reason))
	case "write_no_rows":
		// SK-TRUST-006 — a write that affects nothing is never reported as an
		// empty result set.
		printErr(cmd, "%s", writeNoRowsMessage(apiErr))
	case "write_constraint":
		// SK-ASK-029 — the engine refused the write; deterministic, not transient.
		printErr(cmd, "%s", writeConstraintMessage(apiErr))
	case "db_not_found":
		printErr(cmd, "database not found — try `nlq db list` to see what's available.")
	case "rate_limited":
		printErr(cmd, "rate-limited — wait a moment, then retry.")
	case "byollm_requires_session":
		printErr(cmd, "%s", byollmNeedsSession)
	case "invalid_byollm_key":
		printErr(cmd, "stored BYOLLM key was rejected — re-set it with `nlq byollm set`, or `nlq byollm clear` to use the built-in models.")
	case "byollm_unavailable":
		printErr(cmd, "BYOLLM isn't configured on this deployment — run `nlq byollm clear` to use the built-in models.")
	case "invalid_model":
		printErr(cmd, "--model must be auto, fast, or best.")
	case "model_unavailable":
		printErr(cmd, "--model=best needs a frontier model — add your own key with `nlq byollm set`, or drop the flag to use the built-in models.")
	case "auth_required", "unauthorized":
		renderAuthRequired(cmd, apiErr)
	default:
		printErr(cmd, "%s", apiErr.Error())
	}
	return err
}

// renderClarify prints a 409 clarify_required. SK-ASK-026's
// `destructive_ambiguous` shape carries re-sendable options — print the
// reason then a numbered, re-runnable list (the CLI equivalent of the web
// chips / MCP choices). The SK-ASK-014 create-vs-query shape has no
// options, so fall back to the pinned-DB hint.
func renderClarify(cmd *cobra.Command, apiErr *api.APIError) {
	if len(apiErr.Options) == 0 {
		printErr(cmd, "the goal looks like a creation request but a DB is pinned — re-run without `--db` to create, or rephrase.")
		return
	}
	reason := apiErr.Reason
	if reason == "" {
		reason = "Did you mean one of these?"
	}
	printErr(cmd, "%s", reason)
	for i, opt := range apiErr.Options {
		flag := ""
		if opt.ForceNoPin {
			// This option routes to the create path — drop the pin.
			flag = " (run without --db)"
		}
		fmt.Fprintf(cmd.ErrOrStderr(), "  %d. %s\n     nlq ask %q%s\n", i+1, opt.Label, opt.Goal, flag)
	}
}

// writeNoRowsMessage renders a 409 write_no_rows (SK-TRUST-006): a write that
// matched no rows, either proven by the pre-flight count (so it was never
// offered for approval) or reported by the engine after an approved write.
func writeNoRowsMessage(apiErr *api.APIError) string {
	target := ""
	if apiErr.Table != "" {
		target = " in " + apiErr.Table
	}
	if apiErr.Phase == "commit" {
		return fmt.Sprintf("nothing was changed%s — that ran but matched no rows; say which row to write.", target)
	}
	return fmt.Sprintf("nothing to write%s — no rows matched; say which row you mean.", target)
}

// writeConstraintMessage renders a 409 write_constraint (SK-ASK-029): the
// engine refused the values. Identifiers only — the API never sends the
// offending values.
func writeConstraintMessage(apiErr *api.APIError) string {
	field := apiErr.Column
	if field != "" && apiErr.Table != "" {
		field = apiErr.Table + "." + apiErr.Column
	}
	switch apiErr.Kind {
	case "foreign_key":
		if field == "" {
			field = "that link"
		}
		return fmt.Sprintf("nothing was written — %s has to point at a row that already exists; name an existing one.", field)
	case "not_null":
		if field == "" {
			field = "a required field"
		}
		return fmt.Sprintf("nothing was written — %s can't be empty; include it in the goal.", field)
	case "unique":
		if field == "" {
			field = "that value"
		}
		return fmt.Sprintf("nothing was written — %s already exists; use a different one.", field)
	default:
		if field == "" {
			return "nothing was written — the database rejected those values; try different ones."
		}
		return fmt.Sprintf("nothing was written — the database rejected those values for %s; try different ones.", field)
	}
}

// sqlRejectedMessage turns the API's specific allowlist reject reason
// (SK-ASK-026, `body.reason`) into honest, actionable copy. The
// destructive-ambiguous family normally arrives as `clarify_required` with
// options; this covers the remaining reject reasons.
func sqlRejectedMessage(reason string) string {
	switch reason {
	case "drop_statement":
		return "dropping tables isn't supported from `ask` — start a new database instead."
	case "truncate_statement":
		return "emptying a whole table isn't a one-shot `ask` — delete rows with a filter."
	case "delete_without_where":
		return "that would delete every row — add a filter, or say which rows to remove."
	case "update_without_where":
		return "that would update every row — add a filter (e.g. \"… where status = 'open'\")."
	case "grant_or_revoke":
		return "changing database permissions isn't supported from `ask`."
	case "alter_statement":
		return "changing a table's structure isn't supported from `ask`."
	case "disallowed_verb":
		return "that kind of statement isn't allowed here — ask in plain English."
	case "disallowed_function":
		return "that query uses a function that isn't allowed here."
	case "multi_statement":
		return "ask one thing at a time — that came through as multiple statements."
	case "parse_failed", "empty":
		return "couldn't turn that into a valid query — try rephrasing."
	case "preview_unavailable":
		// SK-TRUST-006 — the write wasn't run: its effect couldn't be
		// computed, and an unpreviewable write never commits.
		return "couldn't preview that change, so it wasn't run — try rephrasing."
	default:
		return "that query was rejected — try rephrasing."
	}
}

func renderAuthRequired(cmd *cobra.Command, apiErr *api.APIError) {
	switch apiErr.Code {
	case "anon_device_cap":
		printErr(cmd, "anonymous device cap hit — sign in to keep building (set NLQDB_API_KEY or run `nlq login` once device-flow ships).")
	case "anon_global_cap":
		printErr(cmd, "anonymous global quota hit — sign in to keep going (set NLQDB_API_KEY or run `nlq login` once device-flow ships).")
	default:
		if apiErr.Action != "" {
			printErr(cmd, "auth required — %s", apiErr.Action)
			return
		}
		printErr(cmd, "auth required — set `NLQDB_API_KEY` or run `nlq login` (device-flow ships in the next slice).")
	}
}

func joinArgs(args []string) string {
	return strings.Join(args, " ")
}
