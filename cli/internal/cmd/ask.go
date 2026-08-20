package cmd

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/output"
	"github.com/nlqdb/nlqdb/cli/internal/state"
)

func registerAsk(root *cobra.Command, g *globalFlags) {
	var (
		db         string
		engine     string
		model      string
		confirm    bool
		forceQuery bool
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
				goal:       joinArgs(args),
				dbID:       db,
				engine:     engine,
				model:      model,
				confirm:    confirm,
				forceQuery: forceQuery,
			})
		},
	}
	cmd.Flags().StringVar(&db, "db", "", "pin the call to this database id (errors if missing)")
	cmd.Flags().StringVar(&engine, "engine", "", "engine override on the create branch (postgres|clickhouse)")
	cmd.Flags().StringVar(&model, "model", "", "model preset (auto|fast|best); best needs a BYOLLM key (`nlq byollm set`) or a paid plan")
	cmd.Flags().BoolVar(&confirm, "confirm", false, "approve a destructive plan returned by an earlier call")
	cmd.Flags().BoolVar(&forceQuery, "force-query", false, "resolve a create/query clarify by querying the pinned --db (skips the classifier)")
	root.AddCommand(cmd)
}

type askParams struct {
	goal       string
	dbID       string
	engine     string
	model      string
	confirm    bool
	forceQuery bool
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
		Goal:       p.goal,
		Engine:     p.engine,
		Model:      p.model,
		Confirm:    p.confirm,
		ForceQuery: p.forceQuery,
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

// renderAPIError prints a failed call. SK-ERR-001 — the API already renders one
// sentence + the next action from the shared error registry, so the default is to
// print those. What stays here is the sparse set of codes where the CLI's next
// action is a *command*, not a click: no server-side copy can tell a terminal
// user to run `nlq byollm set`.
//
// This replaced a parallel copy table (including a full duplicate of the SQL
// allowlist reject reasons) that had already drifted from the web's and MCP's.
func renderAPIError(cmd *cobra.Command, err error) error {
	var apiErr *api.APIError
	if !errors.As(err, &apiErr) {
		printErr(cmd, "%v", err)
		return err
	}
	switch apiErr.Code {
	case "clarify_required":
		renderClarify(cmd, apiErr)
	case "ambiguous_db":
		printErr(cmd, "the goal matches multiple databases — re-run with `--db=<id>` to pin one.")
	case "db_not_found":
		printErr(cmd, "database not found — try `nlq db list` to see what's available.")
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
		printWireError(cmd, apiErr)
	}
	return err
}

// printWireError prints the server's message + action, lower-cased to match the
// CLI's voice. Falls back to the code when an older deployment sends no copy.
func printWireError(cmd *cobra.Command, apiErr *api.APIError) {
	if apiErr.Message == "" {
		printErr(cmd, "%s", apiErr.Error())
		return
	}
	line := lowerFirst(apiErr.Message)
	if apiErr.Action != "" {
		line += " " + apiErr.Action
	}
	printErr(cmd, "%s", line)
}

func lowerFirst(s string) string {
	first, _, _ := strings.Cut(s, " ")
	r := []rune(first)
	if len(r) == 0 || !unicode.IsUpper(r[0]) {
		return s
	}
	// Leave the first word alone when it carries a capital past position 0 —
	// a proper noun ("OpenRouter"), an identifier, or an all-caps SQL verb the
	// message names on purpose ("DELETE").
	for _, c := range r[1:] {
		if unicode.IsUpper(c) {
			return s
		}
	}
	out := []rune(s)
	out[0] = unicode.ToLower(out[0])
	return string(out)
}

// renderClarify prints a 409 clarify_required. SK-ASK-026's
// `destructive_ambiguous` shape carries re-sendable options — print the
// reason then a numbered, re-runnable list (the CLI equivalent of the web
// chips / MCP choices). The SK-ASK-014 create-vs-query shape has no
// options, so fall back to the pinned-DB hint.
func renderClarify(cmd *cobra.Command, apiErr *api.APIError) {
	if len(apiErr.Options) == 0 {
		printErr(cmd, "the goal looks like a creation request but a DB is pinned — re-run without `--db` to create, or add `--force-query` to query the pinned DB instead.")
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

// renderAuthRequired prints the sign-in wall. The server's action says "sign in",
// which a terminal user can't click — so the CLI names the credential to set.
// `params.cap` distinguishes the two anonymous budgets (SK-ANON-010/012).
func renderAuthRequired(cmd *cobra.Command, apiErr *api.APIError) {
	switch apiErr.Cap() {
	case "anon_device_cap":
		printErr(cmd, "anonymous device cap hit — sign in to keep building (set NLQDB_API_KEY or run `nlq login` once device-flow ships).")
	case "anon_global_cap":
		printErr(cmd, "anonymous global quota hit — sign in to keep going (set NLQDB_API_KEY or run `nlq login` once device-flow ships).")
	default:
		printErr(cmd, "auth required — set `NLQDB_API_KEY` or run `nlq login` (device-flow ships in the next slice).")
	}
}

func joinArgs(args []string) string {
	return strings.Join(args, " ")
}
