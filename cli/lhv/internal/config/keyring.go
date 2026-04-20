package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/zalando/go-keyring"
)

const (
	serviceName        = "lhv-cli"
	sessionKey         = "session"
	sessionStoreTimout = 5 * time.Second
)

var (
	keyringSetFunc      = keyring.Set
	keyringGetFunc      = keyring.Get
	keyringDeleteFunc   = keyring.Delete
	sessionFilePathFunc = defaultSessionFilePath
)

type SessionData struct {
	JSESSIONID string `json:"jsessionid"`
	AccountID  string `json:"accountId"`
	Route      string `json:"route"`
	SIDAuth    string `json:"sidAuth"`
	ClientID   string `json:"clientId"`
	UserID     int64  `json:"userId,omitempty"`
	UserName   string `json:"userName,omitempty"`
	UserType   string `json:"userType,omitempty"`
}

func SaveToKeyring(cookies map[string]string, accountID string, userID int64, userName string, userType string) error {
	session := SessionData{
		UserID:   userID,
		UserName: userName,
		UserType: userType,
	}

	if v, ok := cookies["JSESSIONID"]; ok {
		session.JSESSIONID = v
	}
	if v, ok := cookies["SID_AUTH_DATA"]; ok {
		session.SIDAuth = v
	}
	if v, ok := cookies["CLIENT_ID"]; ok {
		session.ClientID = v
	}
	if v, ok := cookies["ROUTE"]; ok {
		session.Route = v
	}
	if accountID != "" {
		session.AccountID = accountID
	} else if v, ok := cookies["CURRENT_ACCOUNT_ID"]; ok {
		session.AccountID = v
	}

	data, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("failed to marshal session: %w", err)
	}

	if err := runWithTimeout(func() error {
		return keyringSetFunc(serviceName, sessionKey, string(data))
	}, sessionStoreTimout); err == nil {
		return nil
	}

	return writeSessionFile(data)
}

func LoadFromKeyring() (*Config, error) {
	data, err := loadSessionData()
	if err != nil {
		return nil, fmt.Errorf("no session found - run 'lhv auth' to authenticate")
	}

	var session SessionData
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, fmt.Errorf("failed to parse session data: %w", err)
	}

	return &Config{
		JSESSIONID: session.JSESSIONID,
		AccountID:  session.AccountID,
		Route:      session.Route,
		SIDAuth:    session.SIDAuth,
		ClientID:   session.ClientID,
		UserID:     session.UserID,
		UserName:   session.UserName,
		UserType:   session.UserType,
	}, nil
}

func DeleteFromKeyring() error {
	err := keyringDeleteFunc(serviceName, sessionKey)
	if err != nil && err != keyring.ErrNotFound {
		return fmt.Errorf("failed to delete from keyring: %w", err)
	}
	if path, pathErr := sessionFilePathFunc(); pathErr == nil {
		_ = os.Remove(path)
	}
	return nil
}

func UpdateAccountInKeyring(accountID string, userID int64, userName string, userType string) error {
	data, err := loadSessionData()
	if err != nil {
		return fmt.Errorf("no session found - run 'lhv auth' to authenticate")
	}

	var session SessionData
	if err := json.Unmarshal(data, &session); err != nil {
		return fmt.Errorf("failed to parse session data: %w", err)
	}

	session.AccountID = accountID
	if userID != 0 {
		session.UserID = userID
		session.UserName = userName
		session.UserType = userType
	}

	updated, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("failed to marshal session: %w", err)
	}

	if err := runWithTimeout(func() error {
		return keyringSetFunc(serviceName, sessionKey, string(updated))
	}, sessionStoreTimout); err == nil {
		return nil
	}

	return writeSessionFile(updated)
}

func HasKeyringSession() bool {
	_, err := loadSessionData()
	return err == nil
}

func loadSessionData() ([]byte, error) {
	data, err := runWithTimeoutValue(func() (string, error) {
		return keyringGetFunc(serviceName, sessionKey)
	}, sessionStoreTimout)
	if err == nil {
		return []byte(data), nil
	}

	return os.ReadFile(mustSessionFilePath())
}

func writeSessionFile(data []byte) error {
	path := mustSessionFilePath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("failed to create session dir: %w", err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("failed to write session file: %w", err)
	}
	return nil
}

func mustSessionFilePath() string {
	path, err := sessionFilePathFunc()
	if err != nil {
		return filepath.Join(".config", "lhv-cli", "session.json")
	}
	return path
}

func defaultSessionFilePath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "lhv-cli", "session.json"), nil
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
