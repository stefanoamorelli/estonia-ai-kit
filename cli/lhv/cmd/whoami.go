package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/stefanoamorelli/lhv-cli/internal/client"
	"github.com/stefanoamorelli/lhv-cli/internal/config"
)

var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Show current authenticated user",
	Long:  `Displays information about the currently authenticated LHV user.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg := config.LoadOptional()

		if !cfg.IsValid() {
			red := color.New(color.FgRed)
			red.Println("\n  ✗ Not authenticated")
			fmt.Println()
			dim := color.New(color.FgHiBlack)
			dim.Println("  Run 'lhv auth' to authenticate with Smart-ID")
			fmt.Println()
			return nil
		}

		c := client.New(cfg)
		userInfo, err := c.CheckSession()
		if err != nil {
			red := color.New(color.FgRed)
			red.Println("\n  ✗ Session expired or invalid")
			fmt.Println()
			dim := color.New(color.FgHiBlack)
			dim.Println("  Run 'lhv auth' to re-authenticate with Smart-ID")
			fmt.Println()
			return nil
		}

		green := color.New(color.FgGreen, color.Bold)
		dim := color.New(color.FgHiBlack)
		cyan := color.New(color.FgCyan)

		fmt.Println()
		green.Printf("  ✓ Logged in as ")
		cyan.Println(userInfo.Name)
		fmt.Println()
		if cfg.UserName != "" {
			typeLabel := "Personal"
			if cfg.UserType == "LEGAL" {
				typeLabel = "Business"
			}
			dim.Printf("  Person:     %s (%s)\n", cfg.UserName, typeLabel)
		}
		dim.Printf("  ID Code:    %s\n", userInfo.Code)
		dim.Printf("  User ID:    %d\n", userInfo.UserID)
		dim.Printf("  User Type:  %s\n", userInfo.UserType)
		dim.Printf("  Login Type: %s\n", userInfo.LoginType)
		fmt.Println()

		return nil
	},
}

func init() {
	rootCmd.AddCommand(whoamiCmd)
}
