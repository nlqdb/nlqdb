package cmd

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/state"
)

// registerAttach wires the CLI door of the autonomous DBA (GLOBAL-043 items
// 5–6): `nlq attach` a Postgres or a D1, list its `proposals`, then `apply` or
// `reject` one. Each verb is one call on the API the SDK already wraps.
func registerAttach(root *cobra.Command, g *globalFlags) {
	root.AddCommand(attachCmd(g), proposalsCmd(g), applyCmd(g), rejectCmd(g))
}

func attachCmd(g *globalFlags) *cobra.Command {
	var name, accountID, databaseID string
	cmd := &cobra.Command{
		Use:   "attach [connection-string]",
		Short: "Attach your Postgres or D1 and get the DBA's first proposals",
		Long: `Attach reads the catalog of the Postgres or Cloudflare D1 you already have
and returns the DBA's first proposals, each with the statement that undoes
it. Nothing runs on your database until you ` + "`nlq apply <id>`" + `.

The connection string is a credential. Omit it to paste it at a no-echo
prompt or pipe it on stdin, so it never lands in your shell history:

  echo "$DATABASE_URL" | nlq attach

A D1 attaches with its database id, its account id and a Cloudflare API
token with D1 Read (D1 Edit to apply). The account id and token default to
wrangler's CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN; without the
token in env, paste it at the prompt or pipe it on stdin:

  nlq attach --database-id <uuid> --account-id <id>

Credentials are sent to the API and discarded; never printed back or saved locally.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			req, err := attachRequest(cmd, args, strings.TrimSpace(databaseID), strings.TrimSpace(accountID))
			if err != nil {
				return err
			}
			req.Name = name
			id, err := auth.Resolve(true)
			if err != nil {
				printErr(cmd, "auth: %v", err)
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 120*time.Second)
			defer cancel()
			resp, err := api.New(g.apiURL, id).Connect(ctx, req)
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
	cmd.Flags().StringVar(&databaseID, "database-id", "", "attach a Cloudflare D1: its database id")
	cmd.Flags().StringVar(&accountID, "account-id", "", "the D1's Cloudflare account id (default $CLOUDFLARE_ACCOUNT_ID)")
	return cmd
}

// attachRequest builds the connect body: a D1 when --database-id is given,
// else a Postgres. A D1 token is never a flag or an arg, so it stays out of
// argv and shell history.
func attachRequest(cmd *cobra.Command, args []string, databaseID, accountID string) (api.ConnectRequest, error) {
	if databaseID == "" {
		if accountID != "" {
			printErr(cmd, "--account-id needs --database-id: name the D1 to attach.")
			return api.ConnectRequest{}, errors.New("missing database id")
		}
		given := ""
		if len(args) == 1 {
			given = args[0]
		}
		connURL, err := readConnectionURL(cmd, given)
		if err != nil {
			return api.ConnectRequest{}, err
		}
		if connURL == "" {
			printErr(cmd, "no connection string given — pass it, pipe it on stdin, or run interactively.")
			return api.ConnectRequest{}, errors.New("empty connection string")
		}
		return api.ConnectRequest{Engine: "postgres", ConnectionURL: connURL}, nil
	}
	if len(args) == 1 {
		printErr(cmd, "a D1 takes no connection string — drop it, or drop --database-id to attach a Postgres.")
		return api.ConnectRequest{}, errors.New("connection string with --database-id")
	}
	if accountID == "" {
		accountID = strings.TrimSpace(os.Getenv("CLOUDFLARE_ACCOUNT_ID"))
	}
	if accountID == "" {
		printErr(cmd, "no account id — pass --account-id or set CLOUDFLARE_ACCOUNT_ID (dash.cloudflare.com → Workers & Pages, right sidebar).")
		return api.ConnectRequest{}, errors.New("missing account id")
	}
	token, err := readSecret(cmd, strings.TrimSpace(os.Getenv("CLOUDFLARE_API_TOKEN")), "Cloudflare API token")
	if err != nil {
		return api.ConnectRequest{}, err
	}
	if token == "" {
		printErr(cmd, "no API token — set CLOUDFLARE_API_TOKEN, pipe it on stdin, or run interactively.")
		return api.ConnectRequest{}, errors.New("empty token")
	}
	return api.ConnectRequest{Engine: "d1", AccountID: accountID, DatabaseID: databaseID, Token: token}, nil
}
