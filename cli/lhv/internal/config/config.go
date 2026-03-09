package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type Config struct {
	SessionID  string
	JSESSIONID string
	Route      string
	AccountID  string
	SIDAuth    string
	ClientID   string
	UserID     int64
	UserName   string
	UserType   string
}

func Load() (*Config, error) {
	if cfg, err := LoadFromKeyring(); err == nil && cfg.IsValid() {
		return cfg, nil
	}

	cfg := &Config{
		SessionID:  os.Getenv("LHV_SESSION_ID"),
		JSESSIONID: os.Getenv("LHV_JSESSIONID"),
		Route:      os.Getenv("LHV_ROUTE"),
		AccountID:  os.Getenv("LHV_ACCOUNT_ID"),
		SIDAuth:    os.Getenv("LHV_SID_AUTH"),
		ClientID:   os.Getenv("LHV_CLIENT_ID"),
	}

	if cfg.JSESSIONID == "" || cfg.AccountID == "" {
		return nil, fmt.Errorf("not authenticated - run 'lhv auth' to authenticate")
	}

	return cfg, nil
}

func (c *Config) BuildCookieHeader() string {
	cookies := fmt.Sprintf("LHV_LOGIN_TYPE_EE=SID; JSESSIONID=%s; CURRENT_ACCOUNT_ID=%s; LANGUAGE=en", c.JSESSIONID, c.AccountID)

	if c.Route != "" {
		cookies += fmt.Sprintf("; ROUTE=%s", c.Route)
	}
	if c.SIDAuth != "" {
		cookies += fmt.Sprintf("; SID_AUTH_DATA=%s", c.SIDAuth)
	}
	if c.ClientID != "" {
		cookies += fmt.Sprintf("; CLIENT_ID=%s", c.ClientID)
	}

	return cookies
}

func LoadOptional() *Config {
	return &Config{
		SessionID:  os.Getenv("LHV_SESSION_ID"),
		JSESSIONID: os.Getenv("LHV_JSESSIONID"),
		Route:      os.Getenv("LHV_ROUTE"),
		AccountID:  os.Getenv("LHV_ACCOUNT_ID"),
		SIDAuth:    os.Getenv("LHV_SID_AUTH"),
		ClientID:   os.Getenv("LHV_CLIENT_ID"),
	}
}

func (c *Config) IsValid() bool {
	return c.JSESSIONID != "" && c.AccountID != ""
}

func Save(cookies map[string]string, accountID string) error {
	envFile := ".env.local"
	existing := make(map[string]string)

	if file, err := os.Open(envFile); err == nil {
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				existing[parts[0]] = parts[1]
			}
		}
		file.Close()
	}

	if jsessionid, ok := cookies["JSESSIONID"]; ok {
		existing["LHV_JSESSIONID"] = jsessionid
	}
	if sidAuth, ok := cookies["SID_AUTH_DATA"]; ok {
		existing["LHV_SID_AUTH"] = sidAuth
	}
	if clientID, ok := cookies["CLIENT_ID"]; ok {
		existing["LHV_CLIENT_ID"] = clientID
	}
	if route, ok := cookies["ROUTE"]; ok {
		existing["LHV_ROUTE"] = route
	}
	if accountID != "" {
		existing["LHV_ACCOUNT_ID"] = accountID
	} else if accID, ok := cookies["CURRENT_ACCOUNT_ID"]; ok {
		existing["LHV_ACCOUNT_ID"] = accID
	}

	file, err := os.Create(envFile)
	if err != nil {
		return fmt.Errorf("failed to create %s: %w", envFile, err)
	}
	defer file.Close()

	orderedKeys := []string{"LHV_JSESSIONID", "LHV_ACCOUNT_ID", "LHV_ROUTE", "LHV_SID_AUTH", "LHV_CLIENT_ID"}
	for _, key := range orderedKeys {
		if val, ok := existing[key]; ok {
			fmt.Fprintf(file, "%s=%s\n", key, val)
		}
	}

	for key, val := range existing {
		found := false
		for _, k := range orderedKeys {
			if k == key {
				found = true
				break
			}
		}
		if !found {
			fmt.Fprintf(file, "%s=%s\n", key, val)
		}
	}

	return nil
}
