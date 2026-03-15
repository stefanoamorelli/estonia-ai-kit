package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/config"
)

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Clear saved authentication",
	Long:  `Removes saved session from the system keyring.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := config.DeleteFromKeyring(); err != nil {
			return fmt.Errorf("failed to clear session: %w", err)
		}

		green := color.New(color.FgGreen)
		green.Println("\n  ✓ Session cleared from keyring")
		fmt.Println()

		return nil
	},
}

func init() {
	rootCmd.AddCommand(logoutCmd)
}
