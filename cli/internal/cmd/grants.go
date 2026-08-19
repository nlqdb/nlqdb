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

// registerGrants wires `nlq grants list` and `nlq grants revoke` — the CLI
// half of the EK-06 cross-tenant read-grant control plane (SK-EKP-008),
// mirroring `nlq keys`. There is no `mint` verb by design: grants are minted
// by the marketplace selling flow (the SK-EKP-003 private surface), not from
// an operator's terminal — the CLI covers the two verbs an owner runs to
// audit and revoke. Session-only, like the key verbs: a grant is a
// control-plane action that must never ride a bearer.
func registerGrants(root *cobra.Command, g *globalFlags) {
	cmd := &cobra.Command{
		Use:   "grants",
		Short: "Manage cross-tenant read grants (list, revoke)",
	}
	cmd.AddCommand(grantsListCmd(g))
	cmd.AddCommand(grantsRevokeCmd(g))
	root.AddCommand(cmd)
}

// resolveForGrantsMgmt returns the caller's identity for the session-only
// grant endpoints. `Resolve(false)` is deliberate — anon callers can't reach
// `/v1/grants` (it's `requireSession` on the server) and a clear "not signed
// in" beats minting an anon token only to 401 on the wire (mirrors
// resolveForKeysMgmt).
func resolveForGrantsMgmt(cmd *cobra.Command) (auth.Identity, error) {
	id, err := auth.Resolve(false)
	if err != nil {
		printErr(cmd, "not signed in — manage your grants at app.nlqdb.com/app (nlq login ships soon).")
		return id, err
	}
	return id, nil
}

func grantsListCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List cross-tenant grants you sold or hold",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := resolveForGrantsMgmt(cmd)
			if err != nil {
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
			defer cancel()
			rows, err := api.New(g.apiURL, id).ListGrants(ctx)
			if err != nil {
				return renderAPIError(cmd, err)
			}
			return output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g)).WriteGrants(rows)
		},
	}
}

func grantsRevokeCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "revoke <id>",
		Short: "Revoke a grant by id (fails closed within ~30s)",
		Long: `Revoke a single grant by its id — the UUID shown by ` + "`nlq grants list`" + `.
Only the grant's owner can revoke it. Revocation fails closed within the
SK-EKP-008 bound (~30s, including in-flight queries); the buyer loses read
access to your knowledge DB. Idempotent — re-revoking an already-revoked
grant is a no-op, not an error.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			grantID := args[0]
			id, err := resolveForGrantsMgmt(cmd)
			if err != nil {
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
			defer cancel()
			out, err := api.New(g.apiURL, id).RevokeGrant(ctx, grantID)
			if err != nil {
				var apiErr *api.APIError
				if errors.As(err, &apiErr) && apiErr.Code == "grant_not_found" {
					printErr(cmd, "grant not found — run `nlq grants list` to see ids you own.")
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
				fmt.Fprintf(cmd.OutOrStdout(), "✓ Grant %s was already revoked.\n", grantID)
			} else {
				fmt.Fprintf(cmd.OutOrStdout(), "✓ Revoked grant %s — the buyer loses access within about 30 seconds.\n", grantID)
			}
			return nil
		},
	}
}
