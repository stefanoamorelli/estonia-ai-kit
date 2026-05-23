package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/stefanoamorelli/lhv-cli/internal/client"
	"github.com/stefanoamorelli/lhv-cli/internal/config"
)

var balanceCmd = &cobra.Command{
	Use:   "balance",
	Short: "Show account balances and free funds",
	Long:  `Fetches the summary statement from LHV and displays balances, interest, reserved amounts, and free funds per account.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("config error: %w", err)
		}

		c := client.New(cfg)

		summary, err := c.GetBalances()
		if err != nil {
			return fmt.Errorf("failed to get balances: %w", err)
		}

		if len(summary.Accounts) == 0 {
			fmt.Println("No balance data found")
			return nil
		}

		printBalances(summary)
		return nil
	},
}

func printBalances(s *client.BalanceSummary) {
	header := color.New(color.FgCyan, color.Bold)
	name := color.New(color.FgGreen, color.Bold)
	iban := color.New(color.FgYellow)
	dim := color.New(color.FgHiBlack)
	pos := color.New(color.FgGreen, color.Bold)
	neg := color.New(color.FgRed, color.Bold)
	totalLbl := color.New(color.FgCyan, color.Bold)

	colorAmount := func(v string) *color.Color {
		for _, c := range v {
			if c == '-' {
				return neg
			}
			if c >= '0' && c <= '9' {
				return pos
			}
		}
		return pos
	}

	fmt.Println()
	header.Println("╔════════════════════════════════════════════════════════════════╗")
	header.Println("║                         LHV BALANCES                           ║")
	header.Println("╚════════════════════════════════════════════════════════════════╝")
	fmt.Println()

	for i, b := range s.Accounts {
		if i > 0 {
			fmt.Println()
		}

		name.Printf("  ● %s\n", b.Name)
		if b.IBAN != "" {
			fmt.Print("    ")
			dim.Print("IBAN:       ")
			iban.Println(b.IBAN)
		}
		fmt.Print("    ")
		dim.Print("Currency:   ")
		fmt.Println(b.Currency)

		fmt.Print("    ")
		dim.Print("Balance:    ")
		colorAmount(b.Balance).Printf("%s %s\n", b.Balance, b.Currency)

		if b.Interest != "" && b.Interest != "0.00" {
			fmt.Print("    ")
			dim.Print("Interest:   ")
			colorAmount(b.Interest).Printf("%s %s\n", b.Interest, b.Currency)
		}

		if b.Reserved != "" && b.Reserved != "0.00" {
			fmt.Print("    ")
			dim.Print("Reserved:   ")
			fmt.Printf("%s %s\n", b.Reserved, b.Currency)
		}

		fmt.Print("    ")
		dim.Print("Free funds: ")
		colorAmount(b.FreeFunds).Printf("%s %s\n", b.FreeFunds, b.Currency)
	}

	fmt.Println()
	dim.Println("─────────────────────────────────────────────────────────────────")
	if s.TotalBalance != "" {
		fmt.Print("  ")
		totalLbl.Print("Total balance:   ")
		colorAmount(s.TotalBalance).Println(s.TotalBalance)
	}
	if s.TotalAvailable != "" {
		fmt.Print("  ")
		totalLbl.Print("Total available: ")
		colorAmount(s.TotalAvailable).Println(s.TotalAvailable)
	}
	fmt.Println()
}

func init() {
	rootCmd.AddCommand(balanceCmd)
}
