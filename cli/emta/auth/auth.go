package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	qrterminal "github.com/mdp/qrterminal/v3"
	"golang.org/x/net/publicsuffix"
)

const (
	baseURL  = "https://maasikas.emta.ee"
	taraBase = "https://tara.ria.ee"

	pollInterval = 1 * time.Second
	pollTimeout  = 2 * time.Minute
)

// Session holds the authenticated state after a successful login.
type Session struct {
	AccessToken   string
	SessionID     string
	ApplicationID string
	Role          string
	PrincipalID   int
	Client        *http.Client
}

type accessTokenResp struct {
	AccessToken   string `json:"accessToken"`
	ApplicationID string `json:"applicationId"`
	SessionID     string `json:"sessionId"`
	Role          string `json:"role"`
}

type pollResponse struct {
	Status     string `json:"status"`
	DeviceLink string `json:"deviceLink"`
	Error      string `json:"error"`
	Message    string `json:"message"`
}

// RenderQR prints a QR code for the given URL to the terminal using
// github.com/mdp/qrterminal. It is exported so callers can pass it directly
// as the renderQR callback to Login, or use their own implementation.
func RenderQR(link string) error {
	if link == "" {
		return nil
	}
	// Move cursor up enough lines to overwrite a previous QR code.
	// A typical QR code in the terminal is around 30 rows; printing the
	// escape sequence when there is nothing to overwrite is harmless.
	fmt.Fprint(os.Stdout, "\033[2J\033[H") // clear screen, move cursor home
	fmt.Println("Scan the QR code below with your Smart-ID app:")
	fmt.Println()
	qrterminal.GenerateWithConfig(link, qrterminal.Config{
		Level:          qrterminal.L,
		Writer:         os.Stdout,
		HalfBlocks:     true,
		BlackChar:      qrterminal.BLACK_BLACK,
		WhiteChar:      qrterminal.WHITE_WHITE,
		WhiteBlackChar: qrterminal.WHITE_BLACK,
		BlackWhiteChar: qrterminal.BLACK_WHITE,
		QuietZone:      2,
	})
	fmt.Println() // blank line after QR
	return nil
}

// newAuthClient builds an *http.Client with a persistent cookie jar that
// follows redirects (the default behaviour). The jar is critical because
// the OIDC redirect chain deposits session cookies that later requests need.
func newAuthClient() (*http.Client, error) {
	jar, err := cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})
	if err != nil {
		return nil, fmt.Errorf("creating cookie jar: %w", err)
	}
	return &http.Client{
		Jar:     jar,
		Timeout: 30 * time.Second,
		// The OIDC redirect chain (TARA -> EMTA) can exceed Go's default
		// limit of 10 redirects, so we allow up to 20.
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 20 {
				return fmt.Errorf("stopped after %d redirects", len(via))
			}
			return nil
		},
	}, nil
}

// Login performs Smart-ID QR code authentication and returns an authenticated
// session. renderQR is called each time the poll returns a new deviceLink URL
// so the caller can display the QR code to the user.
func Login(renderQR func(deviceLink string) error) (*Session, error) {
	client, err := newAuthClient()
	if err != nil {
		return nil, err
	}

	// ------------------------------------------------------------------
	// Step 1: Hit the taxes page; the server redirects through OIDC to
	// the TARA login page at tara.ria.ee.
	// ------------------------------------------------------------------
	fmt.Println("Initiating login flow...")
	resp, err := client.Get(baseURL + "/customer-portal/client/taxes")
	if err != nil {
		return nil, fmt.Errorf("initiating login: %w", err)
	}
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("reading login page: %w", err)
	}

	finalURL := resp.Request.URL.String()

	// The redirect chain lands on the EMTA login page at /v1/login?authst=...
	// We need to POST the Smart-ID provider form (with the authst token) to
	// get redirected to TARA.
	if strings.Contains(finalURL, "maasikas.emta.ee/v1/login") {
		// Extract the authst hidden field from the Smart-ID form
		authstRe := regexp.MustCompile(`action="provider=tara\.smartid"[^>]*>[\s\S]*?name="authst"\s+value="([^"]+)"`)
		authst := ""
		if m := authstRe.FindSubmatch(body); m != nil {
			authst = string(m[1])
		}

		smartIDURL := baseURL + "/v1/provider=tara.smartid"

		fmt.Println("Redirecting to Smart-ID via TARA...")
		resp, err = client.PostForm(smartIDURL, url.Values{
			"authst": {authst},
		})
		if err != nil {
			return nil, fmt.Errorf("posting to Smart-ID provider: %w", err)
		}
		body, err = io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("reading TARA redirect page: %w", err)
		}
		finalURL = resp.Request.URL.String()
	}

	if !strings.Contains(finalURL, "tara.ria.ee") {
		return nil, fmt.Errorf("unexpected redirect target: %s", finalURL)
	}

	// ------------------------------------------------------------------
	// Step 2: Extract the CSRF token from the TARA login page.
	// The token lives in a <meta> tag: <meta name="_csrf" content="..."/>
	// ------------------------------------------------------------------
	csrf, err := extractCSRF(body)
	if err != nil {
		return nil, err
	}

	// ------------------------------------------------------------------
	// Step 3: POST to /auth/sid/qr-code/init to start the Smart-ID
	// QR code flow.
	// ------------------------------------------------------------------
	fmt.Println("Starting Smart-ID QR code authentication...")
	initResp, err := client.PostForm(taraBase+"/auth/sid/qr-code/init", url.Values{
		"_csrf": {csrf},
	})
	if err != nil {
		return nil, fmt.Errorf("initiating Smart-ID QR: %w", err)
	}
	initBody, err := io.ReadAll(initResp.Body)
	initResp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("reading QR init response: %w", err)
	}

	// The init response page may contain an updated CSRF token.
	if updatedCSRF, err := extractCSRF(initBody); err == nil {
		csrf = updatedCSRF
	}

	// ------------------------------------------------------------------
	// Step 4: Poll /auth/sid/qr-code/poll until status is COMPLETED.
	// Each poll response contains a deviceLink URL (with a rotating
	// authCode) that must be shown as a QR code.
	// ------------------------------------------------------------------
	fmt.Println("Waiting for Smart-ID confirmation...")

	deadline := time.Now().Add(pollTimeout)
	lastDeviceLink := ""

	for time.Now().Before(deadline) {
		poll, err := doPoll(client)
		if err != nil {
			return nil, err
		}

		if poll.Error != "" {
			return nil, fmt.Errorf("Smart-ID error: %s - %s", poll.Error, poll.Message)
		}

		switch poll.Status {
		case "PENDING":
			if poll.DeviceLink != "" && poll.DeviceLink != lastDeviceLink {
				lastDeviceLink = poll.DeviceLink
				if err := renderQR(poll.DeviceLink); err != nil {
					return nil, fmt.Errorf("rendering QR code: %w", err)
				}
			}
			time.Sleep(pollInterval)
			continue

		case "COMPLETED":
			fmt.Println("\nAuthentication successful!")
			// fall through to accept

		default:
			return nil, fmt.Errorf("unexpected poll status: %q", poll.Status)
		}

		// If we reach here, status is COMPLETED.
		break
	}

	if time.Now().After(deadline) {
		return nil, fmt.Errorf("authentication timed out after %s", pollTimeout)
	}

	// ------------------------------------------------------------------
	// Step 5: POST /auth/accept with the CSRF token. This triggers the
	// OIDC redirect chain:
	//   /auth/accept -> /oidc/authorize -> /auth/consent ->
	//   /oidc/authorize -> maasikas.emta.ee/v1/provider=tara.smartid?code=...&state=...
	//   -> /customer-portal/client?state=...&code=... -> ...
	// The http.Client follows all redirects, collecting cookies.
	// ------------------------------------------------------------------
	fmt.Println("Completing authentication...")
	acceptResp, err := client.PostForm(taraBase+"/auth/accept", url.Values{
		"_csrf": {csrf},
	})
	if err != nil {
		return nil, fmt.Errorf("accepting auth: %w", err)
	}
	io.ReadAll(acceptResp.Body)
	acceptResp.Body.Close()

	// ------------------------------------------------------------------
	// Step 6: Fetch the access token from the customer portal.
	// ------------------------------------------------------------------
	return getAccessToken(client)
}

// doPoll sends a single GET to /auth/sid/qr-code/poll and returns the
// parsed JSON response.
func doPoll(client *http.Client) (*pollResponse, error) {
	req, err := http.NewRequest("GET", taraBase+"/auth/sid/qr-code/poll", nil)
	if err != nil {
		return nil, fmt.Errorf("creating poll request: %w", err)
	}
	req.Header.Set("Accept", "application/json;charset=UTF-8")
	req.Header.Set("Referer", taraBase+"/auth/sid/qr-code/init")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("polling Smart-ID: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading poll response: %w", err)
	}

	var poll pollResponse
	if err := json.Unmarshal(data, &poll); err != nil {
		return nil, fmt.Errorf("parsing poll response: %w (body: %s)", err, string(data))
	}
	return &poll, nil
}

// extractCSRF finds the _csrf token in HTML content. It looks for the
// pattern used by TARA: <meta name="_csrf" content="..."/>
func extractCSRF(html []byte) (string, error) {
	// Try <meta name="_csrf" content="..."/>
	re := regexp.MustCompile(`name="_csrf"\s+content="([^"]+)"`)
	if m := re.FindSubmatch(html); m != nil {
		return string(m[1]), nil
	}
	// Fallback: <input ... name="_csrf" value="..."/>
	re = regexp.MustCompile(`name="_csrf"\s+value="([^"]+)"`)
	if m := re.FindSubmatch(html); m != nil {
		return string(m[1]), nil
	}
	return "", fmt.Errorf("could not find CSRF token on login page")
}

func getAccessToken(client *http.Client) (*Session, error) {
	tokenURL := baseURL + "/customer-portal/client/access-token?returnUrl=" +
		url.QueryEscape(baseURL+"/customer-portal/client/taxes")

	req, err := http.NewRequest("GET", tokenURL, nil)
	if err != nil {
		return nil, fmt.Errorf("creating token request: %w", err)
	}
	req.Header.Set("Accept", "application/json, text/plain, */*")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("getting access token: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading access token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("access token request failed (%d): %s", resp.StatusCode, string(data))
	}

	var tokenResp accessTokenResp
	if err := json.Unmarshal(data, &tokenResp); err != nil {
		return nil, fmt.Errorf("parsing access token: %w", err)
	}

	return &Session{
		AccessToken:   tokenResp.AccessToken,
		SessionID:     tokenResp.SessionID,
		ApplicationID: tokenResp.ApplicationID,
		Role:          tokenResp.Role,
		Client:        client,
	}, nil
}

// LoginWithToken creates a session from a pre-existing access token
// (useful for development and debugging). It sets up a proper http.Client
// with a cookie jar so that subsequent API calls work correctly.
func LoginWithToken(accessToken, sessionID string) *Session {
	jar, _ := cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})
	return &Session{
		AccessToken:   accessToken,
		SessionID:     sessionID,
		ApplicationID: "customer-portal-client",
		Role:          "client",
		Client: &http.Client{
			Jar:     jar,
			Timeout: 30 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 20 {
					return fmt.Errorf("stopped after %d redirects", len(via))
				}
				return nil
			},
		},
	}
}
