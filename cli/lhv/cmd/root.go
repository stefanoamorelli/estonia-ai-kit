package cmd

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/spf13/cobra"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/client"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/config"
)

var rootCmd = &cobra.Command{
	Use:   "lhv",
	Short: "CLI for LHV banking operations",
	Long:  `A command-line interface to interact with LHV Bank services.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("config error: %w", err)
		}

		c := client.New(cfg)

		pid, from, to, err := runInteractiveMode(c, cfg)
		if err != nil {
			return err
		}

		params := client.TransactionParams{
			PortfolioID: pid,
			DateStart:   from,
			DateEnd:     to,
		}

		data, err := c.GetTransactions(params)
		if err != nil {
			return fmt.Errorf("failed to get transactions: %w", err)
		}

		transactions, err := parseCSV(string(data))
		if err != nil {
			return fmt.Errorf("failed to parse transactions: %w", err)
		}

		printTransactions(transactions, pid, from, to, limit)
		return runFuzzySearch(transactions)
	},
}

func Execute() {
	if err := godotenv.Load(".env.local"); err != nil {
		fmt.Fprintln(os.Stderr, "Warning: .env.local not found, using environment variables")
	}

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
