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
				confirm: confirm,
			})
		},
	}
	cmd.Flags().StringVar(&db, "db", "", "pin the call to this database id (errors if missing)")
	cmd.Flags().StringVar(&engine, "engine", "", "engine override on the create branch (postgres|clickhouse)")
	cmd.Flags().BoolVar(&confirm, "confirm", false, "approve a destructive plan returned by an earlier call")
	root.AddCommand(cmd)
}

type askParams struct {
	goal    string
	dbID    string
	engine  string
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
		printErr(cmd, "the goal looks like a creation request but a DB is pinned — re-run without `--db` to create, or rephrase.")
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
	case "auth_required", "unauthorized":
		renderAuthRequired(cmd, apiErr)
	default:
		printErr(cmd, "%s", apiErr.Error())
	}
	return err
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
