package cmd

import (
	"context"
	"encoding/json"
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

// registerInsert wires `nlq insert` — the CLI twin of `client.insert()`
// (SK-SCHEMA-012, GLOBAL-003): structured rows land with no model call.
func registerInsert(root *cobra.Command, g *globalFlags) {
	var db string
	var key []string
	cmd := &cobra.Command{
		Use:   "insert [--db <id>] [--key <field>...] <table> [<json>]",
		Short: "Insert JSON rows; an unseen table or field is created (no LLM)",
		Long: `Insert writes rows via POST /v1/insert. Pass one JSON object or an array
of objects — as the second argument or on stdin. Keys map to snake_case
columns (serverId → server_id); a table or field the database hasn't seen
is created in the same transaction, typed from the values. No model call,
no data modelling.

--key makes the write an upsert: a row whose key fields match a stored row
updates the fields it names instead of adding a duplicate, so re-running an
import is safe. Every row must carry every key field; the first keyed write
adds a unique index on them.

DB resolution mirrors ` + "`nlq ask`" + `: --db pins one, else the active DB from
~/.config/nlqdb/state.json (` + "`nlq use <db>`" + ` switches it).

Examples:
  nlq insert votes '{"serverId": 42, "stars": 5}'
  nlq insert servers '[{"name": "fs"}, {"name": "git", "tags": ["vcs"]}]'
  cat servers.json | nlq insert --db registry servers
  nlq insert --key server_id --key user_id votes '{"serverId": 42, "userId": 7, "stars": 4}'

Pass --json for machine-readable output.`,
		Args: cobra.RangeArgs(1, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			table := strings.TrimSpace(args[0])
			raw, err := readSQL(cmd, args[1:])
			if err != nil {
				return err
			}
			rows, err := parseInsertRows(raw)
			if err != nil {
				printErr(cmd, "%v", err)
				return err
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
			return doInsert(ctx, cmd, g, api.InsertRequest{DB: dbID, Table: table, Rows: rows, Key: key})
		},
	}
	cmd.Flags().StringVar(&db, "db", "", "database id to write to (default: active DB)")
	cmd.Flags().StringSliceVar(&key, "key", nil, "upsert on this field (repeat or comma-separate for a composite key)")
	root.AddCommand(cmd)
}

// parseInsertRows accepts one JSON object or an array of objects. UseNumber
// keeps each number's literal digits, so a big integer id reaches the server
// unrounded.
func parseInsertRows(raw string) ([]map[string]any, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, errors.New("no rows given — pass a JSON object or array as an arg or pipe it via stdin")
	}
	dec := json.NewDecoder(strings.NewReader(raw))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil || dec.More() {
		return nil, errors.New("rows must be one JSON object or an array of objects, e.g. '{\"stars\": 5}'")
	}
	switch t := v.(type) {
	case map[string]any:
		return []map[string]any{t}, nil
	case []any:
		rows := make([]map[string]any, 0, len(t))
		for i, item := range t {
			row, ok := item.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("row %d is not a JSON object — each row is one {\"field\": value} object", i+1)
			}
			rows = append(rows, row)
		}
		if len(rows) == 0 {
			return nil, errors.New("no rows given — the array is empty")
		}
		return rows, nil
	}
	return nil, errors.New("rows must be one JSON object or an array of objects, e.g. '{\"stars\": 5}'")
}

func doInsert(ctx context.Context, cmd *cobra.Command, g *globalFlags, req api.InsertRequest) error {
	id, err := auth.Resolve(true)
	if err != nil {
		printErr(cmd, "auth: %v", err)
		return err
	}
	client := api.New(g.apiURL, id)
	resp, err := client.Insert(ctx, req)
	if err != nil {
		return renderAPIError(cmd, err)
	}
	if err := state.Update(func(s *state.State) {
		s.LastUsedAt = time.Now().Unix()
	}); err != nil {
		fmt.Fprintf(cmd.ErrOrStderr(), "⚠ state: %v\n", err)
	}
	return output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g)).WriteInsert(resp)
}
