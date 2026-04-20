package cmd

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stefanoamorelli/estonia-ai-kit/cli/emta/auth"
)

func TestRunWithTimeoutReturnsFunctionError(t *testing.T) {
	want := errors.New("boom")

	err := runWithTimeout(func() error {
		return want
	}, 50*time.Millisecond)

	if !errors.Is(err, want) {
		t.Fatalf("expected %v, got %v", want, err)
	}
}

func TestRunWithTimeoutTimesOut(t *testing.T) {
	start := time.Now()

	err := runWithTimeout(func() error {
		time.Sleep(50 * time.Millisecond)
		return nil
	}, 10*time.Millisecond)

	if err == nil {
		t.Fatal("expected timeout error")
	}
	if !strings.Contains(err.Error(), "timed out after") {
		t.Fatalf("expected timeout message, got %v", err)
	}
	if elapsed := time.Since(start); elapsed > 40*time.Millisecond {
		t.Fatalf("timeout took too long: %s", elapsed)
	}
}

func TestSaveSessionFallsBackToFileWhenKeyringFails(t *testing.T) {
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

	if err := saveSession(testSession(t)); err != nil {
		t.Fatalf("saveSession returned error: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(tmpDir, "session.json"))
	if err != nil {
		t.Fatalf("expected session file: %v", err)
	}

	var stored sessionFile
	if err := json.Unmarshal(data, &stored); err != nil {
		t.Fatalf("unmarshal session file: %v", err)
	}
	if stored.AccessToken != "token" {
		t.Fatalf("expected token in session file, got %q", stored.AccessToken)
	}
}

func TestLoadSessionFallsBackToFileWhenKeyringFails(t *testing.T) {
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

	data, err := json.Marshal(sessionFile{
		AccessToken:   "token",
		SessionID:     "session",
		ApplicationID: "app",
		Role:          "role",
		PrincipalID:   7,
	})
	if err != nil {
		t.Fatalf("marshal session file: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "session.json"), data, 0o600); err != nil {
		t.Fatalf("write session file: %v", err)
	}

	session, err := loadSession()
	if err != nil {
		t.Fatalf("loadSession returned error: %v", err)
	}
	if session.AccessToken != "token" {
		t.Fatalf("expected token from file, got %q", session.AccessToken)
	}
	if session.PrincipalID != 7 {
		t.Fatalf("expected principal 7, got %d", session.PrincipalID)
	}
}

func testSession(t *testing.T) *auth.Session {
	t.Helper()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("create jar: %v", err)
	}
	u, err := url.Parse("https://maasikas.emta.ee/")
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	jar.SetCookies(u, []*http.Cookie{{
		Name:  "test",
		Value: "cookie",
		Path:  "/",
	}})

	return &auth.Session{
		AccessToken:   "token",
		SessionID:     "session",
		ApplicationID: "app",
		Role:          "role",
		PrincipalID:   7,
		Client:        &http.Client{Jar: jar},
	}
}
