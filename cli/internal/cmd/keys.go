package cmd

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/output"
)

// registerKeys wires `nlq keys list` and `nlq keys revoke` (SK-APIKEYS-010 /
// SK-APIKEYS-011). The deferred `nlq keys rotate` will land alongside
// SK-APIKEYS-005's 60-day grace + webhook in a separate slice.
func registerKeys(root *cobra.Command, g *globalFlags) {
	cmd := &cobra.Command{
		Use:   "keys",
		Short: "Manage API keys (list, revoke)",
	}
	cmd.AddCommand(keysListCmd(g))
	cmd.AddCommand(keysRevokeCmd(g))
	root.AddCommand(cmd)
}

// resolveForKeysMgmt returns the caller's identity for session-only key-
// management endpoints. `Resolve(false)` is deliberate — anon callers
// can't reach `/v1/keys` (it's `requireSession` on the server) and we'd
// rather print a clear "not signed in" message than silently mint an
// anon token only to 401 on the wire.
func resolveForKeysMgmt(cmd *cobra.Command) (auth.Identity, error) {
	id, err := auth.Resolve(false)
	if err != nil {
		printErr(cmd, "not signed in — manage your API keys at app.nlqdb.com/app/keys (nlq login ships soon).")
		return id, err
	}
	return id, nil
}

func keysListCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List API keys visible to the current credential",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolveForKeysMgmt(cmd)
			if err != nil {
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
			defer cancel()
			rows, err := api.New(g.apiURL, id).ListKeys(ctx)
			if err != nil {
				return renderAPIError(cmd, err)
			}
			return output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g)).WriteKeys(rows)
		},
	}
}

func keysRevokeCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "revoke <id>",
		Short: "Revoke an API key by id (irreversible in this slice)",
		Long: `Revoke a single API key by its id. The id is the UUID column
shown by ` + "`nlq keys list`" + `. Revocation is hard — once a key is
revoked, mint a fresh one to recover. MCP-host sessions holding the
revoked key disconnect within ~1 second.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			keyID := args[0]
			id, err := resolveForKeysMgmt(cmd)
			if err != nil {
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
			defer cancel()
			out, err := api.New(g.apiURL, id).RevokeKey(ctx, keyID)
			if err != nil {
				var apiErr *api.APIError
				if errors.As(err, &apiErr) && apiErr.Status == "key_not_found" {
					printErr(cmd, "key not found — run `nlq keys list` to see ids you own.")
					return err
				}
				return renderAPIError(cmd, err)
			}
			format := formatFor(g)
			w := output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), format)
			if format == output.FormatJSON {
				return w.JSON(out)
			}
			if out.AlreadyRevoked {
				fmt.Fprintf(cmd.OutOrStdout(), "✓ Key %s was already revoked.\n", keyID)
			} else {
				fmt.Fprintf(cmd.OutOrStdout(), "✓ Revoked key %s — it stops working within about a second.\n", keyID)
			}
			return nil
		},
	}
}
