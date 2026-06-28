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
	"golang.org/x/term"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/output"
	"github.com/nlqdb/nlqdb/cli/internal/state"
)

func registerDB(root *cobra.Command, g *globalFlags) {
	cmd := &cobra.Command{
		Use:   "db",
		Short: "Database management (list, create, connect)",
	}
	cmd.AddCommand(dbListCmd(g))
	cmd.AddCommand(dbCreateCmd(g))
	cmd.AddCommand(dbConnectCmd(g))
	root.AddCommand(cmd)
}

func dbListCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List databases visible to the current credential",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := auth.Resolve(true)
			if err != nil {
				printErr(cmd, "auth: %v", err)
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
			defer cancel()
			rows, err := api.New(g.apiURL, id).ListDatabases(ctx)
			if err != nil {
				return renderAPIError(cmd, err)
			}
			return output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g)).WriteDatabases(rows)
		},
	}
}

func dbCreateCmd(g *globalFlags) *cobra.Command {
	var engine string
	cmd := &cobra.Command{
		Use:   "create [name]",
		Short: "Create a database explicitly (power-user verb)",
		Long: `Create a database from an optional name and engine. Most users
should prefer ` + "`nlq new \"<goal>\"`" + ` so the schema is inferred from
the goal — this verb is the GLOBAL-015 escape hatch.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// Wrap a bare name as a real goal sentence so the LLM
			// schema-inference doesn't try to invent a schema for the
			// bare token (e.g. `nlq db create finance` → "create a
			// database named finance" rather than asking the LLM what
			// "finance" implies).
			goal := "create a new database"
			if len(args) == 1 && args[0] != "" {
				goal = fmt.Sprintf("create a database named %s", args[0])
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 120*time.Second)
			defer cancel()
			return doAsk(ctx, cmd, g, askParams{
				goal:         goal,
				engine:       engine,
				alwaysCreate: true,
			})
		},
	}
	cmd.Flags().StringVar(&engine, "engine", "", "engine override (postgres|clickhouse)")
	return cmd
}

// dbConnectCmd wires `nlq db connect` (SK-CLI-019) — the CLI half of the
// GLOBAL-003 surface-parity gap for POST /v1/db/connect. The connection URL
// is a credential: it's read without echo, sent to the API, and discarded.
// It is never printed back, never written to config.toml or state.json.
func dbConnectCmd(g *globalFlags) *cobra.Command {
	var (
		engine string
		name   string
		url    string
	)
	cmd := &cobra.Command{
		Use:   "connect",
		Short: "Register an existing engine by its connection URL",
		Long: `Connect registers an existing ClickHouse or Postgres database with
nlqdb via POST /v1/db/connect, so ` + "`nlq ask`" + ` can query it.

The connection URL is a credential. Provide it via --url, pipe it on
stdin, or let the interactive prompt read it without echo — prefer the
latter two so the URL never lands in your shell history:

  echo "$DATABASE_URL" | nlq db connect --engine postgres

The URL is sent to the API and discarded; it is never printed back and
never written to config.toml or state.json.`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			engine = strings.ToLower(strings.TrimSpace(engine))
			if engine != "clickhouse" && engine != "postgres" {
				printErr(cmd, "--engine must be clickhouse or postgres.")
				return errors.New("invalid engine")
			}
			connURL, err := readConnectionURL(cmd, url)
			if err != nil {
				return err
			}
			if connURL == "" {
				printErr(cmd, "no connection URL given — pass --url, pipe it on stdin, or run interactively.")
				return errors.New("empty connection url")
			}
			id, err := auth.Resolve(true)
			if err != nil {
				printErr(cmd, "auth: %v", err)
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 120*time.Second)
			defer cancel()
			resp, err := api.New(g.apiURL, id).Connect(ctx, api.ConnectRequest{
				Engine:        engine,
				ConnectionURL: connURL,
				Name:          strings.TrimSpace(name),
			})
			if err != nil {
				return renderAPIError(cmd, err)
			}
			// Persist the registered DB as active so the next bare call
			// lands on it; the URL is never part of state (SK-CLI-019).
			if err := state.Update(func(s *state.State) {
				s.ActiveDB = resp.DBID
				s.LastUsedAt = time.Now().Unix()
			}); err != nil {
				fmt.Fprintf(cmd.ErrOrStderr(), "⚠ state: %v\n", err)
			}
			return writeConnect(cmd, g, resp)
		},
	}
	cmd.Flags().StringVar(&engine, "engine", "clickhouse", "engine of the database to connect (clickhouse|postgres)")
	cmd.Flags().StringVar(&name, "name", "", "optional display name for the connected database")
	cmd.Flags().StringVar(&url, "url", "", "connection URL (omit to read from stdin / prompt — keeps it out of shell history)")
	return cmd
}

// readConnectionURL resolves the URL credential: --url wins; else stdin
// (piped is read verbatim, an interactive TTY prompts without echo). Mirrors
// readByollmKey — keeping the secret off argv is the secure default, since
// process lists and shell history both expose positional args and flags.
func readConnectionURL(cmd *cobra.Command, flagURL string) (string, error) {
	if flagURL != "" {
		return flagURL, nil
	}
	in, ok := cmd.InOrStdin().(*os.File)
	if ok && term.IsTerminal(int(in.Fd())) {
		fmt.Fprint(cmd.ErrOrStderr(), "Paste your connection URL: ")
		b, err := term.ReadPassword(int(in.Fd()))
		fmt.Fprintln(cmd.ErrOrStderr())
		if err != nil {
			return "", fmt.Errorf("read connection url: %w", err)
		}
		return strings.TrimSpace(string(b)), nil
	}
	b, err := io.ReadAll(cmd.InOrStdin())
	if err != nil {
		return "", fmt.Errorf("read connection url from stdin: %w", err)
	}
	return strings.TrimSpace(string(b)), nil
}

func writeConnect(cmd *cobra.Command, g *globalFlags, resp *api.ConnectResponse) error {
	w := output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g))
	if w.Format == output.FormatJSON {
		return w.JSON(resp)
	}
	out := cmd.OutOrStdout()
	fmt.Fprintf(out, "✓ Connected %s (%s)", resp.DBID, resp.Engine)
	if resp.Name != "" {
		fmt.Fprintf(out, " — %s", resp.Name)
	}
	fmt.Fprintln(out, ".")
	if resp.SchemaPreview != "" {
		fmt.Fprintf(out, "  schema: %s\n", resp.SchemaPreview)
	}
	if resp.PKLive != nil && *resp.PKLive != "" {
		fmt.Fprintf(out, "  pkLive: %s\n", *resp.PKLive)
	}
	fmt.Fprintf(out, "Next: nlq ask --db %s \"<question>\"\n", resp.DBID)
	return nil
}
