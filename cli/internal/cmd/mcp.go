package cmd

import (
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/mcphosts"
)

func registerMCP(root *cobra.Command, g *globalFlags) {
	mcp := &cobra.Command{
		Use:   "mcp",
		Short: "MCP host helpers (detect, install)",
	}
	mcp.AddCommand(mcpDetectCmd(g))
	mcp.AddCommand(mcpInstallCmd(g))
	root.AddCommand(mcp)
}

func mcpDetectCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "detect",
		Short: "List MCP hosts present on this machine",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			hits := mcphosts.DetectInstalled()
			if g.json {
				out := []map[string]any{}
				for _, d := range hits {
					out = append(out, map[string]any{"config_path": d.ConfigPath})
				}
				enc := jsonEncoder(cmd)
				return enc.Encode(map[string]any{"hosts": out})
			}
			if len(hits) == 0 {
				fmt.Fprintln(cmd.OutOrStdout(), "No MCP hosts detected. Install Claude Desktop, Cursor, Zed, Windsurf, VS Code, or Continue, then re-run.")
				return nil
			}
			for _, d := range hits {
				fmt.Fprintf(cmd.OutOrStdout(), "✓ %s\n", d.ConfigPath)
			}
			return nil
		},
	}
}

func mcpInstallCmd(_ *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "install [host]",
		Short: "Wire nlqdb into an MCP host (requires `nlq login`, ships next slice)",
		Long: `mcp install mints a host-scoped sk_mcp_* key via POST /v1/keys and
writes it into the host's config (SK-CLI-011). The key-mint endpoint is
session-only, so this verb requires the device-flow ` + "`nlq login`" + ` shipping in
a follow-up slice. Until then, detection is exposed via ` + "`nlq mcp detect`" + ` so the
auto-detect surface can be validated against real hosts.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			target := strings.TrimSpace(strings.Join(args, " "))
			if target != "" {
				if _, err := mcphosts.Lookup(target); err != nil {
					printErr(cmd, "%v", err)
					return err
				}
			}
			fmt.Fprintln(cmd.ErrOrStderr(),
				"nlq mcp install requires session-authenticated key minting (POST /v1/keys is session-only).")
			fmt.Fprintln(cmd.ErrOrStderr(),
				"Device-flow `nlq login` ships in the next CLI slice; until then use the dashboard at https://nlqdb.com/app to mint sk_mcp_ keys.")
			return errors.New("mcp install not yet implemented")
		},
	}
}
