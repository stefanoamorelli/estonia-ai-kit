package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/client"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/config"
)

var getAccountsCmd = &cobra.Command{
	Use:   "get-accounts",
	Short: "List available accounts and portfolios",
	Long:  `Fetches and displays all available accounts and portfolios from your LHV banking session.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("config error: %w", err)
		}

		c := client.New(cfg)

		accounts, err := c.GetAccounts()
		if err != nil {
			return fmt.Errorf("failed to get accounts: %w", err)
		}

		if len(accounts) == 0 {
			fmt.Println("No accounts found")
			return nil
		}

		printAccounts(accounts)
		return nil
	},
}

func printAccounts(accounts []client.Account) {
	header := color.New(color.FgCyan, color.Bold)
	accountName := color.New(color.FgGreen, color.Bold)
	iban := color.New(color.FgYellow)
	cardColor := color.New(color.FgWhite)
	cardNum := color.New(color.FgMagenta, color.Bold)
	dim := color.New(color.FgHiBlack)

	fmt.Println()
	header.Println("╔════════════════════════════════════════════════════════════════╗")
	header.Println("║                         LHV ACCOUNTS                           ║")
	header.Println("╚════════════════════════════════════════════════════════════════╝")
	fmt.Println()

	for i, acc := range accounts {
		if i > 0 {
			fmt.Println()
		}

		accountName.Printf("  ● %s\n", acc.Name)

		if acc.IBAN != "" {
			fmt.Print("    ")
			dim.Print("IBAN: ")
			iban.Println(acc.IBAN)
		}

		fmt.Print("    ")
		dim.Print("Portfolio ID: ")
		fmt.Println(acc.PortfolioID)

		if len(acc.Cards) > 0 {
			fmt.Println()
			dim.Println("    ┌─ Linked Cards:")
			for j, card := range acc.Cards {
				prefix := "├"
				if j == len(acc.Cards)-1 {
					prefix = "└"
				}

				fmt.Print("    ")
				dim.Printf("%s── ", prefix)
				cardColor.Print(card.Name)
				if card.CardLast4 != "" {
					fmt.Print(" ")
					dim.Print("(****")
					cardNum.Print(card.CardLast4)
					dim.Print(")")
				}
				fmt.Println()
			}
		}
	}

	fmt.Println()
	dim.Println("─────────────────────────────────────────────────────────────────")
	fmt.Println()
}

func init() {
	rootCmd.AddCommand(getAccountsCmd)
}
