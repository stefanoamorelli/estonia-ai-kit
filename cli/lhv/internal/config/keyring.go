package config

import (
	"encoding/json"
	"fmt"

	"github.com/zalando/go-keyring"
)

const (
	serviceName = "lhv-cli"
	sessionKey  = "session"
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

	if err := keyring.Set(serviceName, sessionKey, string(data)); err != nil {
		return fmt.Errorf("failed to save to keyring: %w", err)
	}

	return nil
}

func LoadFromKeyring() (*Config, error) {
	data, err := keyring.Get(serviceName, sessionKey)
	if err != nil {
		if err == keyring.ErrNotFound {
			return nil, fmt.Errorf("no session found - run 'lhv auth' to authenticate")
		}
		return nil, fmt.Errorf("failed to read from keyring: %w", err)
	}

	var session SessionData
	if err := json.Unmarshal([]byte(data), &session); err != nil {
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
	err := keyring.Delete(serviceName, sessionKey)
	if err != nil && err != keyring.ErrNotFound {
		return fmt.Errorf("failed to delete from keyring: %w", err)
	}
	return nil
}

func UpdateAccountInKeyring(accountID string, userID int64, userName string, userType string) error {
	data, err := keyring.Get(serviceName, sessionKey)
	if err != nil {
		return fmt.Errorf("no session found - run 'lhv auth' to authenticate")
	}

	var session SessionData
	if err := json.Unmarshal([]byte(data), &session); err != nil {
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

	if err := keyring.Set(serviceName, sessionKey, string(updated)); err != nil {
		return fmt.Errorf("failed to save to keyring: %w", err)
	}

	return nil
}

func HasKeyringSession() bool {
	_, err := keyring.Get(serviceName, sessionKey)
	return err == nil
}
