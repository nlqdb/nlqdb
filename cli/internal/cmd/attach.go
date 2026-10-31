package cmd

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/state"
)

// registerAttach wires the CLI door of the autonomous DBA (GLOBAL-043 items
// 5–6): `nlq attach` a Postgres, list its `proposals`, then `apply` or
// `reject` one. Each verb is one call on the API the SDK already wraps.
func registerAttach(root *cobra.Command, g *globalFlags) {
	root.AddCommand(attachCmd(g), proposalsCmd(g), applyCmd(g), rejectCmd(g))
}

func attachCmd(g *globalFlags) *cobra.Command {
	var name string
	cmd := &cobra.Command{
		Use:   "attach [connection-string]",
		Short: "Attach your Postgres and get the DBA's first proposals",
		Long: `Attach reads the catalog of the Postgres you already have and returns
the DBA's first proposals, each with the statement that undoes it. Nothing
runs on your database until you ` + "`nlq apply <id>`" + `.

The connection string is a credential. Omit it to paste it at a no-echo
prompt or pipe it on stdin, so it never lands in your shell history:

  echo "$DATABASE_URL" | nlq attach

It is sent to the API and discarded; never printed back or saved locally.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			flagURL := ""
			if len(args) == 1 {
				flagURL = args[0]
			}
			connURL, err := readConnectionURL(cmd, flagURL)
			if err != nil {
				return err
			}
			if connURL == "" {
				printErr(cmd, "no connection string given — pass it, pipe it on stdin, or run interactively.")
				return errors.New("empty connection string")
			}
			id, err := auth.Resolve(true)
			if err != nil {
				printErr(cmd, "auth: %v", err)
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 120*time.Second)
			defer cancel()
			resp, err := api.New(g.apiURL, id).Connect(ctx, api.ConnectRequest{
				Engine:        "postgres",
				ConnectionURL: connURL,
				Name:          name,
			})
			if err != nil {
				return renderAPIError(cmd, err)
			}
			if err := state.Update(func(s *state.State) {
				s.ActiveDB = resp.DBID
				s.LastUsedAt = time.Now().Unix()
			}); err != nil {
				fmt.Fprintf(cmd.ErrOrStderr(), "⚠ state: %v\n", err)
			}
			return writeConnect(cmd, g, resp)
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "optional display name for the attached database")
	return cmd
}
