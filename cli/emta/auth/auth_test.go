package auth

import (
	"net/http"
	"net/url"
	"testing"
)

func TestPrepareRedirectRequestSetsReferer(t *testing.T) {
	req := mustRequest(t, "GET", "https://maasikas.emta.ee/v1/login?authst=abc")
	via := []*http.Request{
		mustRequest(t, "GET", "https://maasikas.emta.ee/customer-portal/client/taxes"),
		mustRequest(t, "GET", "https://maasikas.emta.ee/v1/authorize?state=xyz"),
	}

	prepareRedirectRequest(req, via)

	if got := req.Header.Get("Referer"); got != "https://maasikas.emta.ee/v1/authorize?state=xyz" {
		t.Fatalf("expected referer from previous hop, got %q", got)
	}
	if got := req.Header.Get("Accept"); got == "" {
		t.Fatal("expected browser-like Accept header to be set")
	}
	if got := req.Header.Get("Sec-Fetch-Mode"); got != "navigate" {
		t.Fatalf("expected navigate fetch mode, got %q", got)
	}
}

func TestExtractProviderFormSupportsGovSSO(t *testing.T) {
	html := []byte(`
		<form method="POST" action="provider=govsso.client">
			<input type="hidden" name="authst" value="abc123"/>
			<button type="submit">Sign in</button>
		</form>
	`)

	action, authst, err := extractProviderForm(html)
	if err != nil {
		t.Fatalf("extractProviderForm returned error: %v", err)
	}
	if action != "provider=govsso.client" {
		t.Fatalf("expected govsso action, got %q", action)
	}
	if authst != "abc123" {
		t.Fatalf("expected authst, got %q", authst)
	}
}

func TestExtractProviderFormSupportsLegacySmartID(t *testing.T) {
	html := []byte(`
		<form method="POST" action="provider=tara.smartid">
			<input type="hidden" name="authst" value="legacy456"/>
			<button type="submit">Sign in</button>
		</form>
	`)

	action, authst, err := extractProviderForm(html)
	if err != nil {
		t.Fatalf("extractProviderForm returned error: %v", err)
	}
	if action != "provider=tara.smartid" {
		t.Fatalf("expected legacy action, got %q", action)
	}
	if authst != "legacy456" {
		t.Fatalf("expected authst, got %q", authst)
	}
}

func TestExtractProviderFormFailsLoudlyWhenMissing(t *testing.T) {
	html := []byte(`<html><body><h1>Sign-in failed</h1></body></html>`)

	_, _, err := extractProviderForm(html)
	if err == nil {
		t.Fatal("expected error when provider form is missing")
	}
}

func mustRequest(t *testing.T, method, rawURL string) *http.Request {
	t.Helper()

	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("parse URL: %v", err)
	}

	return &http.Request{
		Method: method,
		URL:    parsed,
		Header: make(http.Header),
	}
}
