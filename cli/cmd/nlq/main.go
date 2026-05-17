// Command nlq is the static Go binary entrypoint (SK-CLI-001). It does
// two things: rewrite bare `nlq "<goal>"` to `nlq ask <goal>` per
// SK-CLI-012, then run the Cobra root.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/nlqdb/nlqdb/cli/internal/cmd"
)

// known must stay in lockstep with the registered Cobra verbs —
// `TestRegisteredVerbs` in internal/cmd catches divergence.
var known = map[string]struct{}{
	"ask":        {},
	"run":        {},
	"new":        {},
	"db":         {},
	"keys":       {},
	"query":      {},
	"use":        {},
	"whoami":     {},
	"logout":     {},
	"login":      {},
	"mcp":        {},
	"update":     {},
	"help":       {},
	"completion": {},
	"version":    {},
}

func main() {
	rewriteBareForm(&os.Args)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	root := cmd.New()
	root.SetContext(ctx)
	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
}

func rewriteBareForm(args *[]string) {
	a := *args
	if len(a) < 2 {
		return
	}
	first := a[1]
	if first == "" || strings.HasPrefix(first, "-") {
		return
	}
	if _, ok := known[first]; ok {
		return
	}
	*args = append([]string{a[0], "ask"}, a[1:]...)
}
