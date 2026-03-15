package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/fatih/color"
	"github.com/ktr0731/go-fuzzyfinder"
	"github.com/spf13/cobra"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/client"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/config"
)

const (
	signingPollInterval = 2 * time.Second
	signingTimeout      = 120 * time.Second
)

var (
	payFromAccount string
	payToAccount   string
	payToName      string
	payAmount      string
	payDescription string
	payReference   string
	payDocumentNo  string
	payDate        string
	payCurrency    string
	payConfirm     bool
)

var payCmd = &cobra.Command{
	Use:   "pay",
	Short: "Create a SEPA payment",
	Long:  `Creates a SEPA payment draft in your LHV account.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("config error: %w", err)
		}

		c := client.New(cfg)
		dim := color.New(color.FgHiBlack)
		reader := bufio.NewReader(os.Stdin)

		fromAccount := payFromAccount
		if fromAccount == "" {
			accounts, err := c.GetAccounts()
			if err != nil {
				return fmt.Errorf("failed to get accounts: %w", err)
			}

			var accountsWithIBAN []client.Account
			for _, acc := range accounts {
				if acc.IBAN != "" {
					accountsWithIBAN = append(accountsWithIBAN, acc)
				}
			}

			if len(accountsWithIBAN) == 0 {
				return fmt.Errorf("no accounts with IBAN found")
			}

			dim.Println("\n  Select source account...")

			idx, err := fuzzyfinder.Find(
				accountsWithIBAN,
				func(i int) string {
					acc := accountsWithIBAN[i]
					return fmt.Sprintf("%s  •  %s", acc.Name, acc.IBAN)
				},
				fuzzyfinder.WithPreviewWindow(func(i, w, h int) string {
					if i < 0 || i >= len(accountsWithIBAN) {
						return ""
					}
					acc := accountsWithIBAN[i]
					return fmt.Sprintf("Account: %s\nIBAN: %s", acc.Name, acc.IBAN)
				}),
			)
			if err != nil {
				if err == fuzzyfinder.ErrAbort {
					return fmt.Errorf("cancelled")
				}
				return err
			}

			fromAccount = accountsWithIBAN[idx].IBAN
		}

		toAccount := payToAccount
		if toAccount == "" {
			fmt.Println()
			dim.Print("  Recipient IBAN: ")
			toAccount, _ = reader.ReadString('\n')
			toAccount = strings.TrimSpace(toAccount)
			if toAccount == "" {
				return fmt.Errorf("recipient IBAN is required")
			}
		}

		toName := payToName
		if toName == "" {
			dim.Print("  Recipient name: ")
			toName, _ = reader.ReadString('\n')
			toName = strings.TrimSpace(toName)
			if toName == "" {
				return fmt.Errorf("recipient name is required")
			}
		}

		amount := payAmount
		if amount == "" {
			dim.Print("  Amount (EUR):   ")
			amount, _ = reader.ReadString('\n')
			amount = strings.TrimSpace(amount)
			if amount == "" {
				return fmt.Errorf("amount is required")
			}
		}

		description := payDescription
		if description == "" && !cmd.Flags().Changed("description") {
			dim.Print("  Description:    ")
			description, _ = reader.ReadString('\n')
			description = strings.TrimSpace(description)
		}

		reference := payReference
		if reference == "" && !cmd.Flags().Changed("reference") {
			dim.Print("  Reference:      ")
			reference, _ = reader.ReadString('\n')
			reference = strings.TrimSpace(reference)
		}

		valueDate := payDate
		if valueDate == "" {
			valueDate = time.Now().Format("2006-01-02")
		}

		currency := payCurrency
		if currency == "" {
			currency = "EUR"
		}

		printPaymentSummary(fromAccount, toAccount, toName, amount, currency, description, reference, valueDate)

		if !payConfirm {
			fmt.Println()
			dim.Print("  Confirm payment? [y/N]: ")
			confirm, _ := reader.ReadString('\n')
			confirm = strings.TrimSpace(strings.ToLower(confirm))
			if confirm != "y" && confirm != "yes" {
				yellow := color.New(color.FgYellow)
				yellow.Println("\n  Payment cancelled")
				return nil
			}
		}

		params := client.PaymentParams{
			DebtorAccountNo:   fromAccount,
			CreditorName:      toName,
			CreditorAccountNo: toAccount,
			Amount:            amount,
			Currency:          currency,
			Description:       description,
			Reference:         reference,
			DocumentNo:        payDocumentNo,
			ValueDate:         valueDate,
		}

		resp, err := c.CreatePayment(params)
		if err != nil {
			return fmt.Errorf("failed to create payment: %w", err)
		}

		if resp.OrderKey == "" {
			return fmt.Errorf("no order key received from payment creation")
		}

		dim.Println("\n  Initiating Smart-ID signing...")

		signingResp, err := c.InitiateSigning(resp.OrderKey)
		if err != nil {
			return fmt.Errorf("failed to initiate signing: %w", err)
		}

		printVerificationCode(signingResp.Challenge)

		status, err := pollSigningStatus(c, resp.OrderKey, signingResp.SigningSessionId)
		if err != nil {
			return fmt.Errorf("signing failed: %w", err)
		}

		fmt.Println()
		if status == "OK" || status == "COMPLETED" {
			dim.Println("  Signing complete, executing payment...")

			execResp, err := c.ExecutePayment(resp.OrderKey)
			if err != nil {
				return fmt.Errorf("failed to execute payment: %w", err)
			}

			green := color.New(color.FgGreen, color.Bold)
			green.Println("  ✓ Payment executed successfully!")
			fmt.Println()
			dim.Printf("  Reference: %d\n", execResp.Reference)
			dim.Printf("  Status: %s\n", execResp.IsoStatus)
			if len(execResp.Messages) > 0 {
				dim.Printf("  %s\n", execResp.Messages[0])
			}
		} else {
			yellow := color.New(color.FgYellow)
			yellow.Printf("  Payment status: %s\n", status)
		}
		fmt.Println()

		return nil
	},
}

func printVerificationCode(code string) {
	cyan := color.New(color.FgCyan, color.Bold)
	white := color.New(color.FgWhite, color.Bold)

	fmt.Println()
	cyan.Println("  ╔═══════════════════════════════════════╗")
	cyan.Println("  ║         SMART-ID VERIFICATION         ║")
	cyan.Println("  ╠═══════════════════════════════════════╣")
	cyan.Print("  ║              ")
	white.Printf("Code: %s", code)
	cyan.Println("              ║")
	cyan.Println("  ╚═══════════════════════════════════════╝")
	fmt.Println()
	fmt.Println("  Confirm this code on your smartphone...")
	fmt.Println()
}

func pollSigningStatus(c *client.Client, orderKey string, signingSessionId string) (string, error) {
	dim := color.New(color.FgHiBlack)
	timeout := time.After(signingTimeout)
	ticker := time.NewTicker(signingPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			return "", fmt.Errorf("signing timed out after %v", signingTimeout)
		case <-ticker.C:
			status, err := c.CheckSigningStatus(orderKey, signingSessionId)
			if err != nil {
				return "", err
			}

			switch status.Status {
			case "RUNNING":
				dim.Print(".")
				continue
			case "OK", "COMPLETED":
				return status.Status, nil
			default:
				return status.Status, fmt.Errorf("signing ended with status: %s", status.Status)
			}
		}
	}
}

func printPaymentSummary(from, to, name, amount, currency, description, reference, date string) {
	header := color.New(color.FgCyan, color.Bold)
	dim := color.New(color.FgHiBlack)
	green := color.New(color.FgGreen, color.Bold)
	yellow := color.New(color.FgYellow)

	fmt.Println()
	header.Println("╔════════════════════════════════════════════════════════════════╗")
	header.Println("║                        PAYMENT SUMMARY                         ║")
	header.Println("╚════════════════════════════════════════════════════════════════╝")
	fmt.Println()

	dim.Print("  From:        ")
	fmt.Println(from)

	dim.Print("  To:          ")
	yellow.Println(to)

	dim.Print("  Recipient:   ")
	fmt.Println(name)

	dim.Print("  Amount:      ")
	green.Printf("%s %s\n", amount, currency)

	if description != "" {
		dim.Print("  Description: ")
		fmt.Println(description)
	}

	if reference != "" {
		dim.Print("  Reference:   ")
		fmt.Println(reference)
	}

	dim.Print("  Date:        ")
	fmt.Println(date)

	fmt.Println()
	dim.Println("─────────────────────────────────────────────────────────────────")
}

func init() {
	payCmd.Flags().StringVar(&payFromAccount, "from", "", "Source account IBAN (interactive if not specified)")
	payCmd.Flags().StringVar(&payToAccount, "to", "", "Recipient IBAN (required)")
	payCmd.Flags().StringVar(&payToName, "name", "", "Recipient name (required)")
	payCmd.Flags().StringVar(&payAmount, "amount", "", "Amount to pay (required)")
	payCmd.Flags().StringVar(&payDescription, "description", "", "Payment description")
	payCmd.Flags().StringVar(&payReference, "reference", "", "Creditor reference number")
	payCmd.Flags().StringVar(&payDocumentNo, "document", "", "Document/invoice number")
	payCmd.Flags().StringVar(&payDate, "date", "", "Value date (YYYY-MM-DD, defaults to today)")
	payCmd.Flags().StringVar(&payCurrency, "currency", "EUR", "Currency")
	payCmd.Flags().BoolVar(&payConfirm, "confirm", false, "Confirm and execute the payment")

	rootCmd.AddCommand(payCmd)
}
