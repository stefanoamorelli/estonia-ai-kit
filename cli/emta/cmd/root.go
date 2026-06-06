package cmd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/stefanoamorelli/estonia-ai-kit/cli/emta/api"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/emta/auth"

	"github.com/fatih/color"
	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/spf13/cobra"
	"github.com/zalando/go-keyring"
)

var rootCmd = &cobra.Command{
	Use:   "emta-cli",
	Short: "CLI for Estonian Tax and Customs Board (EMTA) e-services",
}

func Execute() error {
	return rootCmd.Execute()
}

// Session persistence

type savedCookie struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Domain string `json:"domain"`
	Path   string `json:"path"`
}

type sessionFile struct {
	AccessToken   string        `json:"accessToken"`
	SessionID     string        `json:"sessionId"`
	ApplicationID string        `json:"applicationId"`
	Role          string        `json:"role"`
	PrincipalID   int           `json:"principalId,omitempty"`
	Cookies       []savedCookie `json:"cookies,omitempty"`
}

const (
	keyringService        = "emta-cli"
	keyringUser           = "session"
	sessionStoreTimeout   = 5 * time.Second
	kmdSetupWarmupTimeout = 10 * time.Second
	tsdSetupWarmupTimeout = 5 * time.Second
)

var (
	keyringSetFunc      = keyring.Set
	keyringGetFunc      = keyring.Get
	keyringDeleteFunc   = keyring.Delete
	sessionFilePathFunc = defaultSessionFilePath
)

func saveSession(s *auth.Session) error {
	sf := sessionFile{
		AccessToken:   s.AccessToken,
		SessionID:     s.SessionID,
		ApplicationID: s.ApplicationID,
		Role:          s.Role,
		PrincipalID:   s.PrincipalID,
	}

	// Save cookies from the authenticated client's jar.
	// We query multiple paths because Go's cookiejar only returns cookies
	// matching the requested URL.
	if s.Client != nil && s.Client.Jar != nil {
		seen := make(map[string]bool)
		for _, path := range []string{
			"https://maasikas.emta.ee/",
			"https://maasikas.emta.ee/v1/",
			"https://maasikas.emta.ee/customer-kmd2/",
			"https://maasikas.emta.ee/tsd2/",
			"https://maasikas.emta.ee/wfm/",
			"https://maasikas.emta.ee/wfm-api/",
			"https://maasikas.emta.ee/customer-portal/",
			"https://tara.ria.ee/",
			"https://govsso.ria.ee/",
		} {
			u, _ := url.Parse(path)
			for _, c := range s.Client.Jar.Cookies(u) {
				key := u.Host + "|" + c.Path + "|" + c.Name + "=" + c.Value
				if seen[key] {
					continue
				}
				seen[key] = true
				path := c.Path
				if path == "" {
					path = u.Path
					if path == "" {
						path = "/"
					}
				}
				sf.Cookies = append(sf.Cookies, savedCookie{
					Name:   c.Name,
					Value:  c.Value,
					Domain: u.Host,
					Path:   path,
				})
			}
		}
	}

	data, err := json.Marshal(sf)
	if err != nil {
		return err
	}
	if err := runWithTimeout(func() error {
		return keyringSetFunc(keyringService, keyringUser, string(data))
	}, sessionStoreTimeout); err == nil {
		return nil
	}

	return writeSessionFile(data)
}

func loadSession() (*auth.Session, error) {
	data, err := loadSessionData()
	if err != nil {
		return nil, fmt.Errorf("not logged in. Run 'emta-cli login' first")
	}
	var sf sessionFile
	if err := json.Unmarshal(data, &sf); err != nil {
		return nil, fmt.Errorf("corrupt session data: %w", err)
	}
	session := auth.LoginWithToken(sf.AccessToken, sf.SessionID)
	session.PrincipalID = sf.PrincipalID
	migrateLegacyCookiePaths(&sf)

	// Restore cookies into the jar, preserving original paths so app-specific
	// session cookies (customer-portal, customer-kmd2, wfm, etc.) do not
	// overwrite each other.
	if len(sf.Cookies) > 0 && session.Client.Jar != nil {
		type cookieTarget struct {
			domain string
			path   string
		}
		byTarget := make(map[cookieTarget][]*http.Cookie)
		for _, sc := range sf.Cookies {
			path := sc.Path
			if path == "" {
				path = "/"
			}
			target := cookieTarget{domain: sc.Domain, path: path}
			byTarget[target] = append(byTarget[target], &http.Cookie{
				Name:  sc.Name,
				Value: sc.Value,
				Path:  path,
			})
		}
		for target, cookies := range byTarget {
			u, _ := url.Parse("https://" + target.domain + target.path)
			session.Client.Jar.SetCookies(u, cookies)
		}
	}

	return session, nil
}

func migrateLegacyCookiePaths(sf *sessionFile) {
	jSessionByDomain := make(map[string]int)
	for i := range sf.Cookies {
		c := &sf.Cookies[i]
		if c.Path != "" {
			continue
		}
		switch c.Name {
		case "customer-kmd2_JSESSIONID", "_WL_AUTHCOOKIE_customer-kmd2_JSESSIONID":
			c.Path = "/customer-kmd2/"
		case "AUTH-STATE", "AUTH-REQUEST", "LOGOUT-STATE", "AUTH-SESSION-CLIENT":
			c.Path = "/v1/"
		case "MTASSO-TAG-gjxldu", "cf_clearance", "__cf_bm":
			c.Path = "/"
		case "JSESSIONID":
			jSessionByDomain[c.Domain]++
			switch jSessionByDomain[c.Domain] {
			case 1:
				c.Path = "/"
			case 2:
				c.Path = "/v1/"
			case 3:
				c.Path = "/wfm/"
			case 4:
				c.Path = "/customer-portal/"
			default:
				c.Path = "/"
			}
		default:
			c.Path = "/"
		}
	}
}

func deleteSession() {
	_ = keyringDeleteFunc(keyringService, keyringUser)
	if path, err := sessionFilePathFunc(); err == nil {
		_ = os.Remove(path)
	}
}

func runWithTimeout(fn func() error, timeout time.Duration) error {
	done := make(chan error, 1)

	go func() {
		done <- fn()
	}()

	select {
	case err := <-done:
		return err
	case <-time.After(timeout):
		return fmt.Errorf("timed out after %s", timeout)
	}
}

func loadSessionData() ([]byte, error) {
	data, err := runWithTimeoutValue(func() (string, error) {
		return keyringGetFunc(keyringService, keyringUser)
	}, sessionStoreTimeout)
	if err == nil {
		return []byte(data), nil
	}

	return os.ReadFile(mustSessionFilePath())
}

func writeSessionFile(data []byte) error {
	path := mustSessionFilePath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("creating session dir: %w", err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("writing session file: %w", err)
	}
	return nil
}

func mustSessionFilePath() string {
	path, err := sessionFilePathFunc()
	if err != nil {
		return filepath.Join(".config", "emta-cli", "session.json")
	}
	return path
}

func defaultSessionFilePath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "emta-cli", "session.json"), nil
}

func runWithTimeoutValue[T any](fn func() (T, error), timeout time.Duration) (T, error) {
	type result struct {
		value T
		err   error
	}

	done := make(chan result, 1)

	go func() {
		value, err := fn()
		done <- result{value: value, err: err}
	}()

	select {
	case res := <-done:
		return res.value, res.err
	case <-time.After(timeout):
		var zero T
		return zero, fmt.Errorf("timed out after %s", timeout)
	}
}

func newTable() table.Writer {
	t := table.NewWriter()
	t.SetOutputMirror(os.Stdout)
	t.SetStyle(table.StyleLight)
	return t
}

// promptPrincipal asks the user to select a principal from the list.
func promptPrincipal(session *auth.Session) error {
	client := api.NewClient(session)
	principals, err := client.FetchPrincipals()
	if err != nil {
		return err
	}

	if len(principals) == 0 {
		return fmt.Errorf("no principals available for this account")
	}

	if len(principals) == 1 {
		session.PrincipalID = principals[0].ID
		fmt.Printf("Selected: %s (%s)\n", principals[0].Name, principals[0].Code)
		return nil
	}

	bold := color.New(color.Bold)
	bold.Println("\nSelect a represented person:")
	fmt.Println()

	for i, p := range principals {
		typeLabel := "Person"
		if p.Type == "LEGAL" {
			typeLabel = "Company"
		}
		fmt.Printf("  %d) %s (%s) [%s]\n", i+1, p.Name, p.Code, typeLabel)
	}

	fmt.Println()
	fmt.Print("Enter number: ")

	scanner := bufio.NewScanner(os.Stdin)
	if !scanner.Scan() {
		return fmt.Errorf("no input received")
	}

	choice, err := strconv.Atoi(scanner.Text())
	if err != nil || choice < 1 || choice > len(principals) {
		return fmt.Errorf("invalid choice: %s", scanner.Text())
	}

	selected := principals[choice-1]
	session.PrincipalID = selected.ID
	fmt.Printf("Selected: %s\n", selected.Name)
	return nil
}

func init() {
	// login command
	rootCmd.AddCommand(&cobra.Command{
		Use:   "login",
		Short: "Authenticate via Smart-ID QR code",
		RunE: func(cmd *cobra.Command, args []string) error {
			session, err := auth.Login(auth.RenderQR)
			if err != nil {
				return fmt.Errorf("login failed: %w", err)
			}

			// Interactive principal selection
			if err := promptPrincipal(session); err != nil {
				return fmt.Errorf("selecting principal: %w", err)
			}

			// Establish TSD session cookies while we have a live auth session
			client := api.NewClient(session)
			if err := runWithTimeout(client.SetupKMDSession, kmdSetupWarmupTimeout); err != nil {
				fmt.Printf("Warning: could not pre-establish KMD session: %v\n", err)
			}
			if err := runWithTimeout(client.SetupTSDSession, tsdSetupWarmupTimeout); err != nil {
				fmt.Printf("Warning: could not pre-establish TSD session: %v\n", err)
			}

			if err := saveSession(session); err != nil {
				return fmt.Errorf("saving session: %w", err)
			}

			green := color.New(color.FgGreen, color.Bold)
			green.Println("Logged in successfully!")
			fmt.Println("Session stored.")
			return nil
		},
	})

	// logout command
	rootCmd.AddCommand(&cobra.Command{
		Use:   "logout",
		Short: "Delete saved session from OS keychain",
		RunE: func(cmd *cobra.Command, args []string) error {
			deleteSession()
			fmt.Println("Session removed.")
			return nil
		},
	})

	// tsd parent command
	tsdCmd := &cobra.Command{
		Use:   "tsd",
		Short: "Income and social tax return (TSD) operations",
	}

	// tsd list
	var listYear string
	tsdListCmd := &cobra.Command{
		Use:   "list",
		Short: "List TSD declarations",
		RunE: func(cmd *cobra.Command, args []string) error {
			session, err := loadSession()
			if err != nil {
				return err
			}
			client := api.NewClient(session)

			if listYear == "" {
				listYear = strconv.Itoa(time.Now().Year())
			}

			result, err := client.GetTSDList(listYear)
			if err != nil {
				return fmt.Errorf("fetching TSD list: %w", err)
			}

			if len(result.Declarations) == 0 {
				fmt.Printf("No TSD declarations found for %s\n", listYear)
				return nil
			}

			bold := color.New(color.Bold)
			if result.Person != "" {
				bold.Printf("%s\n", result.Person)
			}
			bold.Printf("TSD Declarations for %s\n\n", listYear)

			t := newTable()
			t.AppendHeader(table.Row{"ID", "Reg.No", "Period", "Submitted", "Status", "Method", "Modified By"})

			for _, d := range result.Declarations {
				period := fmt.Sprintf("%s/%s", d.Year, d.Month)
				t.AppendRow(table.Row{
					d.DeclarationID,
					d.RegNo,
					period,
					d.SubmissionDate,
					d.Status,
					d.Method,
					d.ModifiedBy,
				})
			}

			t.Render()
			return nil
		},
	}
	tsdListCmd.Flags().StringVar(&listYear, "year", "", "Year to list (defaults to current year)")

	// tsd show
	tsdShowCmd := &cobra.Command{
		Use:   "show <declaration-id>",
		Short: "Show TSD summary (tax breakdown codes 110-119)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			session, err := loadSession()
			if err != nil {
				return err
			}
			client := api.NewClient(session)

			declarationID := args[0]
			summary, err := client.GetTSDSummary(declarationID)
			if err != nil {
				return fmt.Errorf("fetching TSD summary: %w", err)
			}

			bold := color.New(color.Bold)
			cyan := color.New(color.FgCyan, color.Bold)

			cyan.Println("Income and social tax return (TSD)")
			fmt.Println()
			if summary.Person != "" {
				bold.Printf("Person: %s\n", summary.Person)
			}
			fmt.Printf("%s | %s | Status: %s | Currency: %s\n",
				summary.Form, summary.Period, summary.Status, summary.Currency)
			fmt.Println()

			t := newTable()
			t.AppendHeader(table.Row{"", "Code", "Amount (EUR)"})

			for _, line := range summary.Lines {
				t.AppendRow(table.Row{line.Label, line.Code, line.Amount})
			}

			t.Render()
			return nil
		},
	}

	tsdCmd.AddCommand(tsdListCmd, tsdShowCmd)
	rootCmd.AddCommand(tsdCmd)
}
