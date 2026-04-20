package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/stefanoamorelli/estonia-ai-kit/cli/emta/auth"
)

const baseURL = "https://maasikas.emta.ee"

type Client struct {
	session     *auth.Session
	initialized bool
}

type portalAccessTokenResponse struct {
	AccessToken   string `json:"accessToken"`
	ApplicationID string `json:"applicationId"`
	SessionID     string `json:"sessionId"`
	Role          string `json:"role"`
}

func NewClient(session *auth.Session) *Client {
	return &Client{session: session}
}

type Principal struct {
	ID      int    `json:"principalPersonId"`
	Code    string `json:"principalPersonCode"`
	Name    string `json:"principalPersonName"`
	Type    string `json:"principalPersonType"`
	Country string `json:"principalPersonCountry"`
}

// ensureSession establishes a TSD session using saved cookies.
// If TSD redirects to WFM for principal selection, it selects the
// configured principal and follows the validate redirect.
func (c *Client) ensureSession() error {
	if c.initialized {
		return nil
	}

	year := strconv.Itoa(time.Now().Year())
	tsdURL := baseURL + "/tsd2/client/declarations/" + year

	// Try going directly to TSD. If we have valid cookies from a recent
	// login, this will either succeed or redirect to WFM for principal selection.
	var wfmRedirect bool
	var redirectURI string
	origRedirect := c.session.Client.CheckRedirect
	c.session.Client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		reqURL := req.URL.String()
		if strings.Contains(reqURL, "wfm/client/principal") {
			wfmRedirect = true
			if ru := req.URL.Query().Get("redirect_uri"); ru != "" {
				redirectURI = ru
			}
			return http.ErrUseLastResponse
		}
		if strings.Contains(reqURL, "v1/login") {
			return http.ErrUseLastResponse
		}
		if len(via) >= 20 {
			return fmt.Errorf("stopped after %d redirects", len(via))
		}
		return nil
	}

	resp, err := c.session.Client.Get(tsdURL)
	c.session.Client.CheckRedirect = origRedirect

	if err != nil {
		return fmt.Errorf("accessing TSD: %w", err)
	}
	io.ReadAll(resp.Body)
	resp.Body.Close()

	finalURL := resp.Request.URL.String()

	if strings.Contains(finalURL, "/v1/login") {
		return fmt.Errorf("session expired. Please run 'emta-cli login' again")
	}

	// Direct access worked
	if !wfmRedirect && strings.Contains(finalURL, "/tsd2/") {
		c.initialized = true
		return nil
	}

	// Need to go through WFM principal selection
	if !wfmRedirect {
		return fmt.Errorf("unexpected redirect to: %s", finalURL)
	}

	fmt.Println("Setting up TSD session...")

	// Select principal using Bearer token
	if err := c.setPrincipalWithToken(c.session.PrincipalID); err != nil {
		// 409 might mean we need to try a different approach
		fmt.Printf("Warning: principal selection returned: %v\n", err)
	}

	// Follow the WFM validate redirect to establish TSD session
	if redirectURI != "" {
		validateURL := baseURL + "/wfm-api/redirect/client/v2/validate?redirect_uri=" + url.QueryEscape(redirectURI)
		resp, err := c.session.Client.Get(validateURL)
		if err != nil {
			return fmt.Errorf("validating redirect: %w", err)
		}
		io.ReadAll(resp.Body)
		resp.Body.Close()
	}

	c.initialized = true
	return nil
}

func (c *Client) setPrincipalWithToken(principalID int) error {
	body, _ := json.Marshal(map[string]int{"principalPersonId": principalID})
	req, err := http.NewRequest("PUT", baseURL+"/wfm-api/client/v1/principal", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating set-principal request: %w", err)
	}
	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/plain, */*")

	resp, err := c.session.Client.Do(req)
	if err != nil {
		return fmt.Errorf("setting principal: %w", err)
	}
	io.ReadAll(resp.Body)
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("setting principal failed: status %d", resp.StatusCode)
	}
	return nil
}

// SetupTSDSession navigates the full WFM → TSD flow during login,
// establishing all necessary session cookies. Should be called after
// principal selection, while we still have a live auth session.
func (c *Client) SetupTSDSession() error {
	return c.ensureSession()
}

// SetupKMDSession establishes cookies for the KMD application.
func (c *Client) SetupKMDSession() error {
	return c.ensureKMDSession()
}

// FetchPrincipals lists available principals using the customer portal's
// access token. This can be called right after login, before TSD session setup.
func (c *Client) FetchPrincipals() ([]Principal, error) {
	if err := c.refreshPortalSession(); err != nil {
		return nil, err
	}
	req, err := http.NewRequest("GET", baseURL+"/wfm-api/client/v1/principals", nil)
	if err != nil {
		return nil, fmt.Errorf("creating principals request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.session.AccessToken)
	req.Header.Set("X-Application-Id", c.session.ApplicationID)
	req.Header.Set("X-Session-Id", c.session.SessionID)
	req.Header.Set("X-Role", c.session.Role)
	req.Header.Set("Accept", "application/json, text/plain, */*")

	resp, err := c.session.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("listing principals: %w", err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)

	var principals []Principal
	if err := json.Unmarshal(data, &principals); err != nil {
		return nil, fmt.Errorf("parsing principals: %w", err)
	}
	return principals, nil
}

func (c *Client) refreshPortalSession() error {
	tokenURL := baseURL + "/customer-portal/client/access-token?returnUrl=" +
		url.QueryEscape(baseURL+"/customer-portal/client")

	req, err := http.NewRequest("GET", tokenURL, nil)
	if err != nil {
		return fmt.Errorf("creating portal token request: %w", err)
	}
	req.Header.Set("Accept", "application/json, text/plain, */*")

	resp, err := c.session.Client.Do(req)
	if err != nil {
		return fmt.Errorf("refreshing portal session: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading portal token response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("portal session refresh failed (%d): %s", resp.StatusCode, string(data))
	}

	var tokenResp portalAccessTokenResponse
	if err := json.Unmarshal(data, &tokenResp); err != nil {
		return fmt.Errorf("parsing portal token response: %w", err)
	}
	if tokenResp.AccessToken == "" {
		return fmt.Errorf("portal session refresh returned empty access token")
	}

	c.session.AccessToken = tokenResp.AccessToken
	if tokenResp.ApplicationID != "" {
		c.session.ApplicationID = tokenResp.ApplicationID
	}
	if tokenResp.SessionID != "" {
		c.session.SessionID = tokenResp.SessionID
	}
	if tokenResp.Role != "" {
		c.session.Role = tokenResp.Role
	}
	return nil
}

func (c *Client) setAuthHeaders(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+c.session.AccessToken)
	req.Header.Set("X-Application-Id", c.session.ApplicationID)
	req.Header.Set("X-Session-Id", c.session.SessionID)
	req.Header.Set("X-Role", c.session.Role)
}

func (c *Client) doGet(rawURL string) ([]byte, error) {
	if err := c.ensureSession(); err != nil {
		return nil, err
	}
	req, err := http.NewRequest("GET", rawURL, nil)
	if err != nil {
		return nil, err
	}
	c.setAuthHeaders(req)
	resp, err := c.session.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	// If the response is very short or looks like a login/error page, report it
	if len(body) < 200 || resp.StatusCode != 200 {
		return nil, fmt.Errorf("unexpected response (status %d, %d bytes): %s", resp.StatusCode, len(body), string(body[:min(200, len(body))]))
	}
	return body, nil
}

// TSD types

type TSDDeclaration struct {
	RegNo          string
	Form           string
	SubmissionDate string
	Year           string
	Month          string
	Status         string
	Method         string
	ModifiedBy     string
	DeclarationID  string // extracted from the show link
	ShowURL        string
}

type TSDSummaryLine struct {
	Label  string
	Code   string
	Amount string
}

type TSDSummary struct {
	Form     string // "FORM TSD"
	Period   string // "2026/1"
	Status   string // "Submitted"
	Currency string // "EUR"
	Person   string // company/person name
	Lines    []TSDSummaryLine
}

type TSDListResult struct {
	Person       string // company/person name from the page header
	Declarations []TSDDeclaration
}

// GetTSDList fetches the list of TSD declarations for a given year.
// It scrapes the HTML page at /tsd2/client/declarations/{year}
func (c *Client) GetTSDList(year string) (*TSDListResult, error) {
	body, err := c.doGet(baseURL + "/tsd2/client/declarations/" + year)
	if err != nil {
		return nil, fmt.Errorf("fetching TSD list: %w", err)
	}
	return parseTSDList(string(body))
}

func parseTSDList(html string) (*TSDListResult, error) {
	result := &TSDListResult{}

	// Extract person/company name from header
	personRe := regexp.MustCompile(`Person represented</span>\s*<div>\s*<span>([^<]+)</span>`)
	if m := personRe.FindStringSubmatch(html); m != nil {
		result.Person = strings.TrimSpace(m[1])
	}

	// Find the table body
	tbodyStart := strings.Index(html, "<tbody>")
	tbodyEnd := strings.Index(html, "</tbody>")
	if tbodyStart == -1 || tbodyEnd == -1 {
		return result, nil // empty list
	}
	tbody := html[tbodyStart:tbodyEnd]

	// Split by <tr> to get rows
	rows := strings.Split(tbody, "<tr>")

	for _, row := range rows {
		if !strings.Contains(row, "<td>") {
			continue
		}

		decl := TSDDeclaration{}

		// Extract all <div> contents from <td> elements
		divRe := regexp.MustCompile(`<div[^>]*>\s*(.*?)\s*</div>`)
		divMatches := divRe.FindAllStringSubmatch(row, -1)

		if len(divMatches) >= 8 {
			decl.RegNo = strings.TrimSpace(divMatches[0][1])
			decl.Form = strings.TrimSpace(divMatches[1][1])
			decl.SubmissionDate = strings.TrimSpace(divMatches[2][1])
			decl.Year = strings.TrimSpace(divMatches[3][1])
			decl.Month = strings.TrimSpace(divMatches[4][1])
			// divMatches[5] is Bankr.exists (empty)
			decl.Status = strings.TrimSpace(divMatches[6][1])
			decl.Method = strings.TrimSpace(divMatches[7][1])
			if len(divMatches) >= 9 {
				decl.ModifiedBy = strings.TrimSpace(divMatches[8][1])
			}
		}

		// Extract declaration ID from the show link
		showRe := regexp.MustCompile(`href="/tsd2/client/declaration/(\d+)/summary/show/"`)
		if m := showRe.FindStringSubmatch(row); m != nil {
			decl.DeclarationID = m[1]
			decl.ShowURL = "/tsd2/client/declaration/" + m[1] + "/summary/show/"
		}

		if decl.RegNo != "" {
			result.Declarations = append(result.Declarations, decl)
		}
	}

	return result, nil
}

// GetTSDSummary fetches the TSD summary form (codes 110-119) for a given declaration.
func (c *Client) GetTSDSummary(declarationID string) (*TSDSummary, error) {
	body, err := c.doGet(baseURL + "/tsd2/client/declaration/" + declarationID + "/summary/show/")
	if err != nil {
		return nil, fmt.Errorf("fetching TSD summary: %w", err)
	}
	return parseTSDSummary(string(body))
}

func parseTSDSummary(html string) (*TSDSummary, error) {
	summary := &TSDSummary{}

	summary.Form = "FORM TSD"

	// Extract year and month from <span id="declarationYear">2026</span>
	yearRe := regexp.MustCompile(`id="declarationYear"[^>]*>(\d+)<`)
	monthRe := regexp.MustCompile(`id="declarationMonth"[^>]*>(\d+)<`)
	year, month := "", ""
	if m := yearRe.FindStringSubmatch(html); m != nil {
		year = m[1]
	}
	if m := monthRe.FindStringSubmatch(html); m != nil {
		month = m[1]
	}
	if year != "" {
		summary.Period = fmt.Sprintf("%s/%s", year, month)
	}

	// Extract status from <span id="declarationStatus"...>Submitted</span>
	statusRe := regexp.MustCompile(`id="declarationStatus"[^>]*>([^<]+)<`)
	if m := statusRe.FindStringSubmatch(html); m != nil {
		summary.Status = strings.TrimSpace(m[1])
	}

	// Extract currency
	currRe := regexp.MustCompile(`Currency:</span>\s*<span>(\w+)<`)
	if m := currRe.FindStringSubmatch(html); m != nil {
		summary.Currency = m[1]
	}

	// Extract person name from header (spans multiple lines)
	personRe := regexp.MustCompile(`(?s)Person represented</span>\s*<div>\s*<span>([^<]+)</span>`)
	if m := personRe.FindStringSubmatch(html); m != nil {
		summary.Person = strings.TrimSpace(m[1])
	}

	// Extract summary lines
	codeRe := regexp.MustCompile(`<td class="type"><b>(\d+)</b></td>\s*<td class="right">\s*([\d,]+)\s*</td>`)
	codeMatches := codeRe.FindAllStringSubmatchIndex(html, -1)

	for _, idx := range codeMatches {
		code := html[idx[2]:idx[3]]
		amount := strings.TrimSpace(html[idx[4]:idx[5]])

		// Look backwards from this match to find the label
		start := idx[0] - 500
		if start < 0 {
			start = 0
		}
		preceding := html[start:idx[0]]
		label := ""

		strongRe := regexp.MustCompile(`<strong>([^<]+)</strong>`)
		if m := strongRe.FindAllStringSubmatch(preceding, -1); len(m) > 0 {
			label = strings.TrimSpace(m[len(m)-1][1])
		}

		if label == "" {
			spanRe := regexp.MustCompile(`<span>([^<]+)</span>`)
			if m := spanRe.FindAllStringSubmatch(preceding, -1); len(m) > 0 {
				label = strings.TrimSpace(m[len(m)-1][1])
			}
		}

		summary.Lines = append(summary.Lines, TSDSummaryLine{
			Label:  label,
			Code:   code,
			Amount: amount,
		})
	}

	return summary, nil
}
