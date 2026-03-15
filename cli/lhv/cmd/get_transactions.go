package cmd

import (
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/fatih/color"
	"github.com/ktr0731/go-fuzzyfinder"
	"github.com/spf13/cobra"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/client"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/config"
)

var (
	portfolioID string
	dateStart   string
	dateEnd     string
	rawOutput   bool
	limit       int
	interactive bool
	search      bool
)

type Transaction struct {
	Date        string
	Description string
	Amount      float64
	IsCredit    bool
	Sender      string
	Currency    string
	RawRecord   []string
}

var getTransactionsCmd = &cobra.Command{
	Use:   "get-transactions",
	Short: "Fetch account transactions",
	Long:  `Fetches transactions from your LHV account for the specified date range.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("config error: %w", err)
		}

		c := client.New(cfg)

		pid := portfolioID
		from := dateStart
		to := dateEnd

		isInteractive := interactive || (portfolioID == "" && !cmd.Flags().Changed("from") && !cmd.Flags().Changed("to"))

		if isInteractive {
			selectedPid, selectedFrom, selectedTo, err := runInteractiveMode(c, cfg)
			if err != nil {
				return err
			}
			pid = selectedPid
			from = selectedFrom
			to = selectedTo
		}

		if pid == "" {
			pid = cfg.AccountID
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

		if rawOutput {
			fmt.Print(string(data))
			return nil
		}

		transactions, err := parseCSV(string(data))
		if err != nil {
			return fmt.Errorf("failed to parse transactions: %w", err)
		}

		printTransactions(transactions, pid, from, to, limit)

		if search || isInteractive {
			return runFuzzySearch(transactions)
		}

		return nil
	},
}

type periodOption struct {
	Label string
	Value string
	From  func() string
	To    func() string
}

func runInteractiveMode(c *client.Client, cfg *config.Config) (string, string, string, error) {
	dim := color.New(color.FgHiBlack)

	accounts, err := c.GetAccounts()
	if err != nil {
		return "", "", "", fmt.Errorf("failed to get accounts: %w", err)
	}

	dim.Println("\n  Select an account...")

	accIdx, err := fuzzyfinder.Find(
		accounts,
		func(i int) string {
			acc := accounts[i]
			if acc.IBAN != "" {
				return fmt.Sprintf("%s  •  %s", acc.Name, acc.IBAN)
			}
			return acc.Name
		},
		fuzzyfinder.WithPreviewWindow(func(i, w, h int) string {
			if i < 0 || i >= len(accounts) {
				return ""
			}
			acc := accounts[i]
			preview := fmt.Sprintf("Account: %s\nIBAN: %s\nPortfolio ID: %s",
				acc.Name, acc.IBAN, acc.PortfolioID)
			if len(acc.Cards) > 0 {
				preview += "\n\nLinked Cards:"
				for _, card := range acc.Cards {
					preview += fmt.Sprintf("\n  • %s", card.Name)
				}
			}
			return preview
		}),
	)
	if err != nil {
		if err == fuzzyfinder.ErrAbort {
			return "", "", "", fmt.Errorf("cancelled")
		}
		return "", "", "", err
	}

	selectedAccount := accounts[accIdx]

	now := time.Now()
	firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	periods := []periodOption{
		{"This month", "this_month",
			func() string { return firstOfMonth.Format("02.01.2006") },
			func() string { return now.Format("02.01.2006") }},
		{"Last month", "last_month",
			func() string { return firstOfMonth.AddDate(0, -1, 0).Format("02.01.2006") },
			func() string { return firstOfMonth.AddDate(0, 0, -1).Format("02.01.2006") }},
		{"Last 3 months", "last_3_months",
			func() string { return now.AddDate(0, -3, 0).Format("02.01.2006") },
			func() string { return now.Format("02.01.2006") }},
		{"Last 6 months", "last_6_months",
			func() string { return now.AddDate(0, -6, 0).Format("02.01.2006") },
			func() string { return now.Format("02.01.2006") }},
		{"This year", "this_year",
			func() string { return time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()).Format("02.01.2006") },
			func() string { return now.Format("02.01.2006") }},
		{"Last year", "last_year",
			func() string { return time.Date(now.Year()-1, 1, 1, 0, 0, 0, 0, now.Location()).Format("02.01.2006") },
			func() string { return time.Date(now.Year()-1, 12, 31, 0, 0, 0, 0, now.Location()).Format("02.01.2006") }},
	}

	dim.Println("\n  Select a period...")

	periodIdx, err := fuzzyfinder.Find(
		periods,
		func(i int) string {
			return periods[i].Label
		},
		fuzzyfinder.WithPreviewWindow(func(i, w, h int) string {
			if i < 0 || i >= len(periods) {
				return ""
			}
			p := periods[i]
			return fmt.Sprintf("From: %s\nTo:   %s", p.From(), p.To())
		}),
	)
	if err != nil {
		if err == fuzzyfinder.ErrAbort {
			return "", "", "", fmt.Errorf("cancelled")
		}
		return "", "", "", err
	}

	selectedPeriod := periods[periodIdx]

	return selectedAccount.PortfolioID, selectedPeriod.From(), selectedPeriod.To(), nil
}

func runFuzzySearch(transactions []Transaction) error {
	if len(transactions) == 0 {
		fmt.Println("No transactions to search")
		return nil
	}

	idx, err := fuzzyfinder.FindMulti(
		transactions,
		func(i int) string {
			tx := transactions[i]
			sign := "-"
			if tx.IsCredit {
				sign = "+"
			}
			return fmt.Sprintf("%s  %s%.2f  %s  %s",
				tx.Date, sign, absFloat(tx.Amount), tx.Sender, tx.Description)
		},
		fuzzyfinder.WithPreviewWindow(func(i, w, h int) string {
			if i < 0 || i >= len(transactions) {
				return ""
			}
			tx := transactions[i]
			return fmt.Sprintf(
				"Date: %s\nSender/Receiver: %s\nDescription: %s\nAmount: %.2f %s\nType: %s",
				tx.Date,
				tx.Sender,
				tx.Description,
				tx.Amount,
				tx.Currency,
				map[bool]string{true: "Credit", false: "Debit"}[tx.IsCredit],
			)
		}),
	)

	if err != nil {
		if err == fuzzyfinder.ErrAbort {
			return nil
		}
		return err
	}

	green := color.New(color.FgGreen, color.Bold)
	red := color.New(color.FgRed)
	dim := color.New(color.FgHiBlack)
	yellow := color.New(color.FgYellow)

	fmt.Println()
	fmt.Printf("Selected %d transaction(s):\n\n", len(idx))

	for _, i := range idx {
		tx := transactions[i]
		yellow.Printf("  %s  ", tx.Date)
		fmt.Printf("%-25s  ", tx.Sender)
		dim.Printf("%-40s  ", truncate(tx.Description, 40))
		if tx.IsCredit {
			green.Printf("+%.2f", tx.Amount)
		} else {
			red.Printf("%.2f", tx.Amount)
		}
		fmt.Printf(" %s\n", tx.Currency)
	}
	fmt.Println()

	return nil
}

func absFloat(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}

func parseCSV(data string) ([]Transaction, error) {
	data = strings.TrimPrefix(data, "\ufeff")

	reader := csv.NewReader(strings.NewReader(data))
	reader.LazyQuotes = true
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	if len(records) < 2 {
		return nil, nil
	}

	var transactions []Transaction
	for i, record := range records[1:] {
		if len(record) < 14 {
			continue
		}

		amount, _ := strconv.ParseFloat(strings.ReplaceAll(record[8], ",", "."), 64)
		isCredit := record[7] == "C"

		if !isCredit && amount > 0 {
			amount = -amount
		}

		tx := Transaction{
			Date:        formatDate(record[2]),
			Sender:      truncate(record[4], 25),
			Description: truncate(record[11], 40),
			Amount:      amount,
			IsCredit:    isCredit,
			Currency:    record[13],
			RawRecord:   record,
		}

		transactions = append(transactions, tx)

		if i >= 999 {
			break
		}
	}

	return transactions, nil
}

func formatDate(dateStr string) string {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return dateStr
	}
	return t.Format("02 Jan 2006")
}

func truncate(s string, maxLen int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.TrimSpace(s)
	if len(s) > maxLen {
		return s[:maxLen-1] + "…"
	}
	return s
}

func printTransactions(transactions []Transaction, portfolioID, from, to string, limit int) {
	header := color.New(color.FgCyan, color.Bold)
	dim := color.New(color.FgHiBlack)
	green := color.New(color.FgGreen, color.Bold)
	red := color.New(color.FgRed)
	yellow := color.New(color.FgYellow)
	white := color.New(color.FgWhite)

	fmt.Println()
	header.Println("╔════════════════════════════════════════════════════════════════════════════════════════╗")
	header.Println("║                                    TRANSACTIONS                                        ║")
	header.Println("╚════════════════════════════════════════════════════════════════════════════════════════╝")

	fmt.Print("  ")
	dim.Print("Portfolio: ")
	fmt.Print(portfolioID)
	dim.Print("  │  Period: ")
	fmt.Printf("%s → %s\n", from, to)
	fmt.Println()

	if len(transactions) == 0 {
		dim.Println("  No transactions found for this period.")
		fmt.Println()
		return
	}

	var totalIn, totalOut float64
	for _, tx := range transactions {
		if tx.IsCredit {
			totalIn += tx.Amount
		} else {
			totalOut += tx.Amount
		}
	}

	dim.Printf("  %-12s  %-25s  %-40s  %12s\n", "DATE", "SENDER/RECEIVER", "DESCRIPTION", "AMOUNT")
	dim.Println("  ────────────  ─────────────────────────  ────────────────────────────────────────  ────────────")

	displayCount := len(transactions)
	if limit > 0 && limit < displayCount {
		displayCount = limit
	}

	for i := 0; i < displayCount; i++ {
		tx := transactions[i]

		white.Printf("  %-12s  ", tx.Date)
		yellow.Printf("%-25s  ", tx.Sender)
		dim.Printf("%-40s  ", tx.Description)

		amountStr := fmt.Sprintf("%12.2f", tx.Amount)
		if tx.IsCredit {
			green.Printf("%s", amountStr)
		} else {
			red.Printf("%s", amountStr)
		}
		fmt.Println()
	}

	if limit > 0 && len(transactions) > limit {
		fmt.Println()
		dim.Printf("  ... and %d more transactions (use --limit 0 to show all, or --search to fuzzy find)\n", len(transactions)-limit)
	}

	fmt.Println()
	dim.Println("  ════════════════════════════════════════════════════════════════════════════════════════════")
	fmt.Println()

	dim.Print("  Total In:   ")
	green.Printf("%+12.2f EUR\n", totalIn)

	dim.Print("  Total Out:  ")
	red.Printf("%12.2f EUR\n", totalOut)

	dim.Print("  Net:        ")
	net := totalIn + totalOut
	if net >= 0 {
		green.Printf("%+12.2f EUR\n", net)
	} else {
		red.Printf("%12.2f EUR\n", net)
	}

	fmt.Println()
	dim.Printf("  %d transactions\n", len(transactions))

	fmt.Println()
	dim.Println("──────────────────────────────────────────────────────────────────────────────────────────────")
	fmt.Println()
}

func init() {
	now := time.Now()
	firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	getTransactionsCmd.Flags().StringVarP(&portfolioID, "portfolio", "p", "", "Portfolio ID (defaults to LHV_ACCOUNT_ID)")
	getTransactionsCmd.Flags().StringVarP(&dateStart, "from", "f", firstOfMonth.Format("02.01.2006"), "Start date (DD.MM.YYYY)")
	getTransactionsCmd.Flags().StringVarP(&dateEnd, "to", "t", now.Format("02.01.2006"), "End date (DD.MM.YYYY)")
	getTransactionsCmd.Flags().BoolVar(&rawOutput, "raw", false, "Output raw CSV data")
	getTransactionsCmd.Flags().IntVarP(&limit, "limit", "l", 20, "Limit transactions shown (0 for all)")
	getTransactionsCmd.Flags().BoolVarP(&interactive, "interactive", "i", false, "Interactive mode")
	getTransactionsCmd.Flags().BoolVarP(&search, "search", "s", false, "Fuzzy search transactions")

	rootCmd.AddCommand(getTransactionsCmd)
}
