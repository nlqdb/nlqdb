package cmd

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/output"
	"github.com/nlqdb/nlqdb/cli/internal/state"
)

func proposalsCmd(g *globalFlags) *cobra.Command {
	var dbID string
	cmd := &cobra.Command{
		Use:   "proposals",
		Short: "List the DBA's proposals on an attached database",
		Long: `Proposals lists every proposal on the database (the active one unless
--db is given), newest first: open ones to apply or reject, and decided
ones with verify's verdict once their window has passed.`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if dbID == "" {
				st, _ := state.Load()
				dbID = st.ActiveDB
			}
			if dbID == "" {
				printErr(cmd, "no database — pass --db <id>, or `nlq attach` one first.")
				return errors.New("no db")
			}
			id, err := auth.Resolve(true)
			if err != nil {
				printErr(cmd, "auth: %v", err)
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
			defer cancel()
			rows, err := api.New(g.apiURL, id).ListChanges(ctx, dbID)
			if err != nil {
				return renderAPIError(cmd, err)
			}
			proposals := []api.DbaChange{}
			for _, r := range rows {
				if r.Origin == "attach" {
					proposals = append(proposals, r)
				}
			}
			w := output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g))
			if w.Format == output.FormatJSON {
				return w.JSON(map[string]any{"proposals": proposals})
			}
			out := cmd.OutOrStdout()
			if len(proposals) == 0 {
				fmt.Fprintln(out, "No proposals yet — workload proposals follow a day of traffic.")
				return nil
			}
			for _, p := range proposals {
				status := p.Status
				if v := p.Verification; v != nil {
					status += ", verify: " + v.Verdict
					if v.BeforeP95Ms != nil && v.AfterP95Ms != nil {
						status += fmt.Sprintf(" (p95 %s → %s ms)", ms(*v.BeforeP95Ms), ms(*v.AfterP95Ms))
					}
				}
				fmt.Fprintf(out, "#%d  %s  %s\n", p.ID, status, p.DDL)
				if p.Reason != nil {
					fmt.Fprintf(out, "      %s\n", *p.Reason)
				}
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&dbID, "db", "", "database id (defaults to the active one)")
	return cmd
}

// ms prints a p95 in milliseconds: three significant digits, never an
// exponent (%g turns 1234.5 into "1.23e+03").
func ms(v float64) string {
	if v >= 100 {
		return strconv.FormatFloat(v, 'f', 0, 64)
	}
	return strconv.FormatFloat(v, 'g', 3, 64)
}
