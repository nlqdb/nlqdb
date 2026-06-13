package cmd

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/output"
	"github.com/nlqdb/nlqdb/cli/internal/state"
)

// registerRun wires `nlq run` — the SK-CLI-003 raw-SQL verb (wire contract: SK-SDK-009).
func registerRun(root *cobra.Command, g *globalFlags) {
	var db string
	cmd := &cobra.Command{
		Use:   "run [--db <id>] <sql>",
		Short: "Run raw SQL against a database (escape hatch — no LLM)",
		Long: `Run executes raw SQL via POST /v1/run. The same SQL allow-list as
` + "`nlq ask`" + ` applies (SELECT / INSERT / UPDATE / DELETE / WITH /
EXPLAIN / SHOW). DDL is rejected — use ` + "`nlq new`" + ` to provision
schema.

DB resolution mirrors ` + "`nlq ask`" + `:
  • --db pins to the given id and errors if it's missing.
  • Without --db the active database from ~/.config/nlqdb/state.json is
    used. ` + "`nlq use <db>`" + ` switches it.
  • Pipe SQL on stdin to skip the positional argument:
      cat schema.sql | nlq run --db finance

Pass --json for machine-readable output.`,
		Args: cobra.ArbitraryArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			sqlText, err := readSQL(cmd, args)
			if err != nil {
				return err
			}
			if strings.TrimSpace(sqlText) == "" {
				printErr(cmd, "no SQL given — pass it as an arg or pipe via stdin.")
				return errors.New("empty sql")
			}
			dbID := db
			if dbID == "" {
				st, _ := state.Load()
				dbID = st.ActiveDB
			}
			if dbID == "" {
				printErr(cmd, "no active database — pass `--db <id>` or run `nlq use <id>` first.")
				return errors.New("no active db")
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 120*time.Second)
			defer cancel()
			return doRun(ctx, cmd, g, dbID, sqlText)
		},
	}
	cmd.Flags().StringVar(&db, "db", "", "database id to run against (default: active DB)")
	root.AddCommand(cmd)
}

func doRun(ctx context.Context, cmd *cobra.Command, g *globalFlags, dbID, sql string) error {
	id, err := auth.Resolve(true)
	if err != nil {
		printErr(cmd, "auth: %v", err)
		return err
	}
	client := api.New(g.apiURL, id).WithInviteCode(g.inviteCode)
	resp, err := client.Run(ctx, api.RunRequest{DB: dbID, SQL: sql})
	if err != nil {
		return renderRunError(cmd, err)
	}
	if err := state.Update(func(s *state.State) {
		s.LastUsedAt = time.Now().Unix()
	}); err != nil {
		fmt.Fprintf(cmd.ErrOrStderr(), "⚠ state: %v\n", err)
	}
	return output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g)).WriteRun(resp)
}

// renderRunError adds the `/v1/run`-specific surfaces on top of the shared `renderAPIError` mapper.
func renderRunError(cmd *cobra.Command, err error) error {
	var apiErr *api.APIError
	if !errors.As(err, &apiErr) {
		printErr(cmd, "%v", err)
		return err
	}
	switch apiErr.Status {
	case "sql_rejected":
		reason := apiErr.Message
		if reason == "" {
			reason = "validator rejected the SQL"
		}
		printErr(cmd, "SQL rejected (%s) — only SELECT/INSERT/UPDATE/DELETE/WITH/EXPLAIN/SHOW pass; DDL goes through `nlq new`.", reason)
		return err
	case "forbidden":
		printErr(cmd, "this key is read-only — mint an `sk_live_…` key to run writes.")
		return err
	case "sql_required":
		printErr(cmd, "no SQL given — pass it as an arg or pipe via stdin.")
		return err
	case "sql_too_long":
		printErr(cmd, "SQL exceeds the server cap — split into smaller statements.")
		return err
	case "db_required":
		printErr(cmd, "no database id — pass `--db <id>` or `nlq use <id>` first.")
		return err
	}
	return renderAPIError(cmd, err)
}

// readSQL prefers positional args; falls back to stdin only when it's piped (bare TTY would hang otherwise).
func readSQL(cmd *cobra.Command, args []string) (string, error) {
	if len(args) > 0 {
		return joinArgs(args), nil
	}
	if isTerminal(os.Stdin) {
		return "", nil
	}
	b, err := io.ReadAll(cmd.InOrStdin())
	if err != nil {
		return "", fmt.Errorf("read stdin: %w", err)
	}
	return string(b), nil
}
