package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/fatih/color"
	"github.com/ktr0731/go-fuzzyfinder"
	"github.com/spf13/cobra"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/client"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/lhv/internal/config"
)

var (
	switchUserID      int64
	switchAccountID   int64
	switchInteractive bool
	switchList        bool
)

var switchAccountCmd = &cobra.Command{
	Use:   "switch-account",
	Short: "Switch to a different person or account",
	Long:  `Switch between available persons (personal/business) and their accounts.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("config error: %w", err)
		}

		dim := color.New(color.FgHiBlack)
		c := client.New(cfg)

		if _, err := c.CheckSession(); err != nil {
			return fmt.Errorf("session expired - run 'lhv auth' to re-authenticate")
		}

		users, err := c.GetUsers()
		if err != nil {
			return fmt.Errorf("failed to get users: %w", err)
		}

		if len(users) == 0 {
			return fmt.Errorf("no persons found")
		}

		if switchList {
			type userOutput struct {
				UserID   int64  `json:"userId"`
				Name     string `json:"name"`
				UserType string `json:"userType"`
				Current  bool   `json:"current"`
			}
			var out []userOutput
			for _, u := range users {
				out = append(out, userOutput{
					UserID:   u.UserID,
					Name:     u.Name,
					UserType: u.UserType,
					Current:  u.UserID == cfg.UserID,
				})
			}
			data, err := json.MarshalIndent(out, "", "  ")
			if err != nil {
				return fmt.Errorf("failed to marshal users: %w", err)
			}
			fmt.Println(string(data))
			return nil
		}

		fmt.Println()
		if cfg.UserName != "" {
			dim.Printf("  Current: %s (%s)\n", cfg.UserName, cfg.UserType)
		}

		var selectedUser client.UserEntry
		if switchUserID != 0 {
			found := false
			for _, u := range users {
				if u.UserID == switchUserID {
					selectedUser = u
					found = true
					break
				}
			}
			if !found {
				return fmt.Errorf("user ID %d not found among available persons", switchUserID)
			}
		} else if len(users) == 1 {
			selectedUser = users[0]
			dim.Printf("  Only one person available: %s\n", selectedUser.Name)
		} else if switchInteractive {
			dim.Println("  Select a person/role...")
			fmt.Println()

			idx, err := fuzzyfinder.Find(
				users,
				func(i int) string {
					u := users[i]
					typeLabel := "Personal"
					if u.UserType == "LEGAL" {
						typeLabel = "Business"
					}
					current := ""
					if u.UserID == cfg.UserID {
						current = " ✓"
					}
					return fmt.Sprintf("%s  (%s)%s", u.Name, typeLabel, current)
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
			return fmt.Errorf("multiple persons available - use --user-id <id>, --list to see them, or -i for interactive selection")
		}

		dim.Println("  Switching person...")
		if _, err := c.SwitchUser(selectedUser.UserID); err != nil {
			return fmt.Errorf("failed to switch user: %w", err)
		}

		accounts, err := c.GetAccountInfos()
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
		if switchAccountID != 0 {
			found := false
			for _, acc := range activeAccounts {
				if acc.AccountID == switchAccountID {
					selectedAccount = acc
					found = true
					break
				}
			}
			if !found {
				return fmt.Errorf("account ID %d not found among active accounts", switchAccountID)
			}
		} else if len(activeAccounts) == 1 {
			selectedAccount = activeAccounts[0]
		} else if switchInteractive {
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
			return fmt.Errorf("multiple accounts available - use --account-id <id> or -i for interactive selection")
		}

		accountID := fmt.Sprintf("%d", selectedAccount.AccountID)
		if err := config.UpdateAccountInKeyring(accountID, selectedUser.UserID, selectedUser.Name, selectedUser.UserType); err != nil {
			return fmt.Errorf("failed to update session: %w", err)
		}

		green := color.New(color.FgGreen, color.Bold)
		fmt.Println()
		green.Println("  ✓ Switched successfully!")
		fmt.Println()
		dim.Printf("  Person:  %s (%s)\n", selectedUser.Name, selectedUser.UserType)
		dim.Printf("  Account: %s (%s)\n", selectedAccount.Name, selectedAccount.IBAN)
		fmt.Println()

		return nil
	},
}

func init() {
	switchAccountCmd.Flags().Int64Var(&switchUserID, "user-id", 0, "User/person ID to select (skips interactive picker)")
	switchAccountCmd.Flags().Int64Var(&switchAccountID, "account-id", 0, "Account ID to select (skips interactive picker)")
	switchAccountCmd.Flags().BoolVarP(&switchInteractive, "interactive", "i", false, "Interactive mode with fuzzy finder")
	switchAccountCmd.Flags().BoolVar(&switchList, "list", false, "List available persons as JSON")
	rootCmd.AddCommand(switchAccountCmd)
}
