package main

import (
	"reflect"
	"testing"

	"github.com/nlqdb/nlqdb/cli/internal/cmd"
)

func TestKnownVerbsMatchRegistered(t *testing.T) {
	// The cmd package owns the verb list; main's `known` map mirrors
	// it. Drift either way (verb registered but unknown to rewriter,
	// or known to rewriter but unregistered) is a bug.
	registered := cmd.RegisteredVerbs()
	registered = append(registered, "version") // cobra exposes via --version flag
	for _, v := range registered {
		if _, ok := known[v]; !ok {
			t.Errorf("registered verb %q missing from main.known map", v)
		}
	}
	for v := range known {
		found := false
		for _, r := range registered {
			if r == v {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("main.known has %q but no cobra command registers it", v)
		}
	}
}

func TestRewriteBareForm(t *testing.T) {
	cases := []struct {
		name string
		in   []string
		want []string
	}{
		{
			name: "bare goal becomes ask goal",
			in:   []string{"nlq", "how many orders today"},
			want: []string{"nlq", "ask", "how many orders today"},
		},
		{
			name: "known verb is untouched",
			in:   []string{"nlq", "db", "list"},
			want: []string{"nlq", "db", "list"},
		},
		{
			name: "flag is untouched",
			in:   []string{"nlq", "--version"},
			want: []string{"nlq", "--version"},
		},
		{
			name: "help is untouched",
			in:   []string{"nlq", "help", "ask"},
			want: []string{"nlq", "help", "ask"},
		},
		{
			name: "no args is untouched",
			in:   []string{"nlq"},
			want: []string{"nlq"},
		},
		{
			name: "ask verb is untouched",
			in:   []string{"nlq", "ask", "hello"},
			want: []string{"nlq", "ask", "hello"},
		},
		{
			name: "multi-word bare becomes ask + multi-arg",
			in:   []string{"nlq", "give me the top 5 customers"},
			want: []string{"nlq", "ask", "give me the top 5 customers"},
		},
	}
	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			args := append([]string{}, c.in...)
			rewriteBareForm(&args)
			if !reflect.DeepEqual(args, c.want) {
				t.Fatalf("rewriteBareForm:\n got: %v\nwant: %v", args, c.want)
			}
		})
	}
}
