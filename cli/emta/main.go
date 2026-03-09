package main

import (
	"fmt"
	"os"

	"github.com/stefanoamorelli/estonia-ai-kit/cli/emta/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
