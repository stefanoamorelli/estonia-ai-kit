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
	authPollInterval = 2 * time.Second
	authTimeout      = 120 * time.Second
)

var (
	authNickname    string
	authIDCode      string
	authUserID      int64
	authAccountID   int64
	authInteractive bool
)

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authenticate with LHV Bank using Smart-ID",
	Long:  `Initiates Smart-ID authentication and saves session to system keyring.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		dim := color.New(color.FgHiBlack)
		reader := bufio.NewReader(os.Stdin)

		nickname := authNickname
		idCode := authIDCode

		fmt.Println()
		if idCode == "" {
			if !authInteractive {
				return fmt.Errorf("ID code is required (use --id or --interactive)")
			}
			dim.Print("  Estonian ID code: ")
			idCode, _ = reader.ReadString('\n')
			idCode = strings.TrimSpace(idCode)
			if idCode == "" {
				return fmt.Errorf("ID code is required")
			}
		}

		if nickname == "" && authInteractive {
			dim.Print("  Smart-ID nickname (optional): ")
			nickname, _ = reader.ReadString('\n')
			nickname = strings.TrimSpace(nickname)
		}

		authClient := client.NewAuthClient()

		dim.Println("\n  Initiating Smart-ID authentication...")

		authResp, err := authClient.InitiateSmartIDAuth(nickname, idCode)
		if err != nil {
			return fmt.Errorf("failed to initiate auth: %w", err)
		}

		if authResp.Status != "IN_PROGRESS" {
			return fmt.Errorf("unexpected auth status: %s", authResp.Status)
		}

		printAuthVerificationCode(authResp.VerificationCode)

		status, err := pollAuthStatus(authClient)
		if err != nil {
			return fmt.Errorf("authentication failed: %w", err)
		}

		fmt.Println()
		if status == "OK" || status == "COMPLETED" || status == "AUTHENTICATED" {
			dim.Println("  Authentication successful, fetching user info...")

			userInfo, err := authClient.GetUserInfo()
			if err != nil {
				return fmt.Errorf("failed to get user info: %w", err)
			}

			users, err := authClient.GetUsers()
			if err != nil {
				return fmt.Errorf("failed to get users: %w", err)
			}

			var selectedUser client.UserEntry
			if authUserID != 0 {
				found := false
				for _, u := range users {
					if u.UserID == authUserID {
						selectedUser = u
						found = true
						break
					}
				}
				if !found {
					return fmt.Errorf("user ID %d not found among available persons", authUserID)
				}
			} else if len(users) == 1 {
				selectedUser = users[0]
			} else if authInteractive {
				dim.Println("\n  Select a person/role...")

				idx, err := fuzzyfinder.Find(
					users,
					func(i int) string {
						u := users[i]
						typeLabel := "Personal"
						if u.UserType == "LEGAL" {
							typeLabel = "Business"
						}
						return fmt.Sprintf("%s  (%s)", u.Name, typeLabel)
					},
					fuzzyfinder.WithPreviewWindow(func(i, w, h int) string {
						if i < 0 || i >= len(users) {
							return ""
						}
						u := users[i]
						return fmt.Sprintf("Name: %s\nType: %s\nUser ID: %d", u.Name, u.UserType, u.UserID)
					}),
				)
				if err != nil {
					if err == fuzzyfinder.ErrAbort {
						return fmt.Errorf("cancelled")
					}
					return err
				}
				selectedUser = users[idx]
			} else {
				return fmt.Errorf("multiple persons available - use --user-id <id> or --interactive")
			}

			if len(users) > 1 {
				dim.Println("  Switching to selected person...")
				if _, err := authClient.SwitchUser(selectedUser.UserID); err != nil {
					return fmt.Errorf("failed to switch user: %w", err)
				}
			}

			accounts, err := authClient.GetAccounts()
			if err != nil {
				return fmt.Errorf("failed to get accounts: %w", err)
			}

			var activeAccounts []client.AccountInfo
			for _, acc := range accounts {
				if acc.Status == "ACTIVE" && acc.Type == "CURRENT" {
					activeAccounts = append(activeAccounts, acc)
				}
			}
			if len(activeAccounts) == 0 {
				for _, acc := range accounts {
					if acc.Status == "ACTIVE" {
						activeAccounts = append(activeAccounts, acc)
					}
				}
			}
			if len(activeAccounts) == 0 {
				activeAccounts = accounts
			}

			var selectedAccount client.AccountInfo
			if authAccountID != 0 {
				found := false
				for _, acc := range activeAccounts {
					if acc.AccountID == authAccountID {
						selectedAccount = acc
						found = true
						break
					}
				}
				if !found {
					return fmt.Errorf("account ID %d not found among active accounts", authAccountID)
				}
			} else if len(activeAccounts) == 1 {
				selectedAccount = activeAccounts[0]
			} else if authInteractive {
				dim.Println("\n  Select an account...")

				idx, err := fuzzyfinder.Find(
					activeAccounts,
					func(i int) string {
						acc := activeAccounts[i]
						label := acc.Name
						if acc.IBAN != "" {
							label += "  •  " + acc.IBAN
						}
						return label
					},
					fuzzyfinder.WithPreviewWindow(func(i, w, h int) string {
						if i < 0 || i >= len(activeAccounts) {
							return ""
						}
						acc := activeAccounts[i]
						return fmt.Sprintf("Name: %s\nIBAN: %s\nType: %s\nStatus: %s",
							acc.Name, acc.IBAN, acc.Type, acc.Status)
					}),
				)
				if err != nil {
					if err == fuzzyfinder.ErrAbort {
						return fmt.Errorf("cancelled")
					}
					return err
				}
				selectedAccount = activeAccounts[idx]
			} else {
				return fmt.Errorf("multiple accounts available - use --account-id <id> or --interactive")
			}

			accountID := fmt.Sprintf("%d", selectedAccount.AccountID)

			cookies := authClient.GetSessionCookies()

			if err := config.SaveToKeyring(cookies, accountID, selectedUser.UserID, selectedUser.Name, selectedUser.UserType); err != nil {
				return fmt.Errorf("failed to save session: %w", err)
			}

			green := color.New(color.FgGreen, color.Bold)
			green.Println("  ✓ Authenticated successfully!")
			fmt.Println()
			dim.Printf("  User: %s\n", userInfo.Name)
			dim.Printf("  ID: %s\n", userInfo.Code)
			if len(users) > 1 {
				dim.Printf("  Person: %s (%s)\n", selectedUser.Name, selectedUser.UserType)
			}
			dim.Printf("  Account: %s (%s)\n", selectedAccount.Name, selectedAccount.IBAN)
			dim.Printf("  Session saved to system keyring\n")
		} else {
			yellow := color.New(color.FgYellow)
			yellow.Printf("  Authentication status: %s\n", status)
		}
		fmt.Println()

		return nil
	},
}

func printAuthVerificationCode(code string) {
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

func pollAuthStatus(c *client.AuthClient) (string, error) {
	dim := color.New(color.FgHiBlack)
	timeout := time.After(authTimeout)
	ticker := time.NewTicker(authPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			return "", fmt.Errorf("authentication timed out after %v", authTimeout)
		case <-ticker.C:
			status, err := c.CheckAuthStatus()
			if err != nil {
				return "", err
			}

			switch status.Status {
			case "IN_PROGRESS":
				dim.Print(".")
				continue
			case "OK", "COMPLETED", "AUTHENTICATED":
				return status.Status, nil
			default:
				return status.Status, fmt.Errorf("authentication ended with status: %s", status.Status)
			}
		}
	}
}

func init() {
	authCmd.Flags().StringVarP(&authIDCode, "id", "i", "", "Estonian ID code (isikukood)")
	authCmd.Flags().StringVarP(&authNickname, "nickname", "n", "", "Smart-ID nickname (optional)")
	authCmd.Flags().Int64Var(&authUserID, "user-id", 0, "User/person ID to select (skips interactive picker)")
	authCmd.Flags().Int64Var(&authAccountID, "account-id", 0, "Account ID to select (skips interactive picker)")
	authCmd.Flags().BoolVar(&authInteractive, "interactive", false, "Interactive mode with fuzzy finder prompts")
	rootCmd.AddCommand(authCmd)
}
