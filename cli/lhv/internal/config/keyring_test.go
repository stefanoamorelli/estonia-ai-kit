package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestSaveToKeyringFallsBackToFile(t *testing.T) {
	tmpDir := t.TempDir()
	oldSet := keyringSetFunc
	oldPath := sessionFilePathFunc
	keyringSetFunc = func(service, user, password string) error {
		return errors.New("keyring unavailable")
	}
	sessionFilePathFunc = func() (string, error) {
		return filepath.Join(tmpDir, "session.json"), nil
	}
	t.Cleanup(func() {
		keyringSetFunc = oldSet
		sessionFilePathFunc = oldPath
	})

	err := SaveToKeyring(map[string]string{
		"JSESSIONID":    "js",
		"SID_AUTH_DATA": "sid",
		"CLIENT_ID":     "client",
		"ROUTE":         "route",
	}, "acc", 7, "Example User", "LEGAL")
	if err != nil {
		t.Fatalf("SaveToKeyring returned error: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(tmpDir, "session.json"))
	if err != nil {
		t.Fatalf("expected fallback file: %v", err)
	}

	var session SessionData
	if err := json.Unmarshal(data, &session); err != nil {
		t.Fatalf("unmarshal fallback session: %v", err)
	}
	if session.AccountID != "acc" || session.UserID != 7 {
		t.Fatalf("unexpected fallback session: %+v", session)
	}
}

func TestLoadFromKeyringFallsBackToFile(t *testing.T) {
	tmpDir := t.TempDir()
	oldGet := keyringGetFunc
	oldPath := sessionFilePathFunc
	keyringGetFunc = func(service, user string) (string, error) {
		return "", errors.New("keyring unavailable")
	}
	sessionFilePathFunc = func() (string, error) {
		return filepath.Join(tmpDir, "session.json"), nil
	}
	t.Cleanup(func() {
		keyringGetFunc = oldGet
		sessionFilePathFunc = oldPath
	})

	data, err := json.Marshal(SessionData{
		JSESSIONID: "js",
		AccountID:  "acc",
		Route:      "route",
		SIDAuth:    "sid",
		ClientID:   "client",
		UserID:     7,
		UserName:   "Example User",
		UserType:   "LEGAL",
	})
	if err != nil {
		t.Fatalf("marshal session: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "session.json"), data, 0o600); err != nil {
		t.Fatalf("write session: %v", err)
	}

	cfg, err := LoadFromKeyring()
	if err != nil {
		t.Fatalf("LoadFromKeyring returned error: %v", err)
	}
	if cfg.AccountID != "acc" || cfg.UserID != 7 {
		t.Fatalf("unexpected config: %+v", cfg)
	}
}
