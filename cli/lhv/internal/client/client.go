package client

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/stefanoamorelli/lhv-cli/internal/config"
)

type Account struct {
	PortfolioID string
	Name        string
	IBAN        string
	CardID      string
	CardLast4   string
	IsCard      bool
	Cards       []Account
}

type UserEntry struct {
	UserID   int64  `json:"userId"`
	Name     string `json:"name"`
	UserType string `json:"userType"`
}

const (
	baseURL   = "https://www.lhv.ee"
	userAgent = "Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0"
)

type Client struct {
	http   *http.Client
	config *config.Config
}

func New(cfg *config.Config) *Client {
	return &Client{
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
		config: cfg,
	}
}

type TransactionParams struct {
	PortfolioID string
	DateStart   string
	DateEnd     string
}

type PaymentParams struct {
	DebtorAccountNo   string `json:"debtorAccountNo"`
	CreditorName      string `json:"creditorName"`
	CreditorAccountNo string `json:"creditorAccountNo"`
	Amount            string `json:"amount"`
	Currency          string `json:"currency"`
	Description       string `json:"description"`
	Reference         string `json:"reference"`
	DocumentNo        string `json:"documentNo"`
	ValueDate         string `json:"valueDate"`
}

type paymentRequest struct {
	Debtor            paymentDebtor   `json:"debtor"`
	Amount            paymentAmount   `json:"amount"`
	DocumentNo        string          `json:"documentNo"`
	ValueDate         string          `json:"valueDate"`
	Description       string          `json:"description"`
	CreditorReference string          `json:"creditorReference"`
	Creditor          paymentCreditor `json:"creditor"`
	UltimateDebtor    paymentUltimate `json:"ultimateDebtor"`
	UltimateCreditor  paymentUltimate `json:"ultimateCreditor"`
	Purpose           *string         `json:"purpose"`
	PurposeCategory   *string         `json:"purposeCategory"`
}

type paymentDebtor struct {
	AccountNo string `json:"accountNo"`
}

type paymentAmount struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

type paymentCreditor struct {
	Name      string  `json:"name"`
	AccountNo string  `json:"accountNo"`
	Address   *string `json:"address"`
	RegionID  *string `json:"regionId"`
	Type      *string `json:"type"`
}

type paymentUltimate struct {
	Name *string `json:"name"`
	Type *string `json:"type"`
}

type PaymentResponse struct {
	OrderKey string `json:"orderKey"`
	ID       string `json:"id"`
	Status   string `json:"status"`
	Message  string `json:"message"`
}

type SigningResponse struct {
	OrderKey              string  `json:"orderKey"`
	SigningSessionId      string  `json:"signingSessionId"`
	Challenge             string  `json:"challenge"`
	Status                string  `json:"status"`
	SmartIdDocumentNumber *string `json:"smartIdDocumentNumber"`
}

func (c *Client) GetTransactions(params TransactionParams) ([]byte, error) {
	endpoint := baseURL + "/portfolio/reports_cur.cfm?newframe=1"

	form := url.Values{}
	form.Set("i_no_filters", "1")
	form.Set("i_del_filters", "")
	form.Set("i_hide_filters", "1")
	form.Set("i_report_type", "csv")
	form.Set("i_bdoc", "")
	form.Set("i_show_report", "1")
	form.Set("i_portfolio_id", params.PortfolioID)
	form.Set("i_card_id", "")
	form.Set("i_sort_order_asc", "0")
	form.Set("i_date_type", "inv")
	form.Set("i_portfolio_card", "")
	form.Set("i_date_start", params.DateStart)
	form.Set("i_date_end", params.DateEnd)
	form.Set("i_currency_id", "")
	form.Set("i_filter_1", "any")
	form.Set("i_filter_val_1", "")

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Accept-Encoding", "gzip, deflate, br")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Origin", baseURL)
	req.Header.Set("Referer", endpoint)
	req.Header.Set("Cookie", c.config.BuildCookieHeader())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var reader io.Reader = resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		gzReader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer gzReader.Close()
		reader = gzReader
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return body, nil
}

func (c *Client) GetAccounts() ([]Account, error) {
	endpoint := baseURL + "/portfolio/reports_cur.cfm?newframe=1&l3=en&vi=0"

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Accept-Encoding", "gzip, deflate, br")
	req.Header.Set("Referer", baseURL+"/ibank/cf/portfolio/reports_cur")
	req.Header.Set("Cookie", c.config.BuildCookieHeader())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var reader io.Reader = resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		gzReader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer gzReader.Close()
		reader = gzReader
	}

	doc, err := goquery.NewDocumentFromReader(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	accountMap := make(map[string]*Account)
	var accounts []Account
	seen := make(map[string]bool)

	doc.Find("input[name='i_portfolio_card']").Each(func(i int, s *goquery.Selection) {
		portfolioID, _ := s.Attr("data-portfolio-id")
		cardID, _ := s.Attr("data-card-id")

		if seen[portfolioID+cardID] {
			return
		}
		seen[portfolioID+cardID] = true

		label := s.Parent()
		labelText := strings.TrimSpace(label.Text())

		isCard := cardID != ""
		cardLast4 := extractLast4Digits(labelText)

		account := Account{
			PortfolioID: portfolioID,
			CardID:      cardID,
			CardLast4:   cardLast4,
			IsCard:      isCard,
		}

		if strings.Contains(labelText, "•") {
			parts := strings.Split(labelText, "•")
			account.Name = strings.TrimSpace(parts[0])
			if len(parts) > 1 {
				account.IBAN = strings.TrimSpace(parts[1])
			}
		} else {
			account.Name = labelText
		}

		if isCard {
			if parent, exists := accountMap[portfolioID]; exists {
				parent.Cards = append(parent.Cards, account)
			}
		} else {
			accountMap[portfolioID] = &account
			accounts = append(accounts, account)
		}
	})

	for i := range accounts {
		if parent, exists := accountMap[accounts[i].PortfolioID]; exists {
			accounts[i].Cards = parent.Cards
		}
		if accounts[i].IBAN == "" {
			iban, err := c.fetchIBANForPortfolio(accounts[i].PortfolioID)
			if err == nil && iban != "" {
				accounts[i].IBAN = iban
			}
		}
	}

	return accounts, nil
}

func extractLast4Digits(text string) string {
	words := strings.Fields(text)
	for _, word := range words {
		if len(word) == 4 {
			isAllDigits := true
			for _, c := range word {
				if c < '0' || c > '9' {
					isAllDigits = false
					break
				}
			}
			if isAllDigits {
				return word
			}
		}
	}
	return ""
}

func (c *Client) fetchIBANForPortfolio(portfolioID string) (string, error) {
	params := TransactionParams{
		PortfolioID: portfolioID,
		DateStart:   "01.01.2020",
		DateEnd:     "01.01.2030",
	}

	data, err := c.GetTransactions(params)
	if err != nil {
		return "", err
	}

	lines := strings.Split(string(data), "\n")
	if len(lines) < 2 {
		return "", fmt.Errorf("no data")
	}

	secondLine := lines[1]
	if strings.HasPrefix(secondLine, "\"EE") {
		parts := strings.Split(secondLine, ",")
		if len(parts) > 0 {
			iban := strings.Trim(parts[0], "\"")
			return iban, nil
		}
	}

	return "", nil
}

func (c *Client) CreatePayment(params PaymentParams) (*PaymentResponse, error) {
	endpoint := baseURL + "/b/payments/sepa/draft"

	req := paymentRequest{
		Debtor: paymentDebtor{
			AccountNo: params.DebtorAccountNo,
		},
		Amount: paymentAmount{
			Amount:   params.Amount,
			Currency: params.Currency,
		},
		DocumentNo:        params.DocumentNo,
		ValueDate:         params.ValueDate,
		Description:       params.Description,
		CreditorReference: params.Reference,
		Creditor: paymentCreditor{
			Name:      params.CreditorName,
			AccountNo: params.CreditorAccountNo,
		},
		UltimateDebtor:   paymentUltimate{},
		UltimateCreditor: paymentUltimate{},
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", endpoint, bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("User-Agent", userAgent)
	httpReq.Header.Set("Accept", "application/json, text/plain, */*")
	httpReq.Header.Set("Accept-Language", "en-US,en;q=0.9")
	httpReq.Header.Set("Accept-Encoding", "gzip, deflate, br, zstd")
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Origin", baseURL)
	httpReq.Header.Set("Connection", "keep-alive")
	httpReq.Header.Set("Referer", baseURL+"/ibank/payments")
	httpReq.Header.Set("lhv-application-language", "EN")
	httpReq.Header.Set("showErrorTasksAsButtons", "true")
	httpReq.Header.Set("Sec-Fetch-Dest", "empty")
	httpReq.Header.Set("Sec-Fetch-Mode", "cors")
	httpReq.Header.Set("Sec-Fetch-Site", "same-origin")
	httpReq.Header.Set("Cookie", c.config.BuildCookieHeader())

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	var reader io.Reader = resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		gzReader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer gzReader.Close()
		reader = gzReader
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var paymentResp PaymentResponse
	if err := json.Unmarshal(body, &paymentResp); err != nil {
		paymentResp.Message = string(body)
	}
	if paymentResp.Message == "" {
		paymentResp.Message = string(body)
	}

	return &paymentResp, nil
}

func (c *Client) InitiateSigning(orderKey string) (*SigningResponse, error) {
	endpoint := fmt.Sprintf("%s/b/sign/%s/sid", baseURL, orderKey)

	req, err := http.NewRequest("POST", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Accept-Encoding", "gzip, deflate, br, zstd")
	req.Header.Set("Origin", baseURL)
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Referer", baseURL+"/ibank/payments")
	req.Header.Set("lhv-application-language", "EN")
	req.Header.Set("Sec-Fetch-Dest", "empty")
	req.Header.Set("Sec-Fetch-Mode", "cors")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	req.Header.Set("Content-Length", "0")
	req.Header.Set("Cookie", c.config.BuildCookieHeader())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	var reader io.Reader = resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		gzReader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer gzReader.Close()
		reader = gzReader
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var signingResp SigningResponse
	if err := json.Unmarshal(body, &signingResp); err != nil {
		return nil, fmt.Errorf("failed to parse signing response: %w", err)
	}

	return &signingResp, nil
}

func (c *Client) CheckSigningStatus(orderKey string, signingSessionId string) (*SigningResponse, error) {
	endpoint := fmt.Sprintf("%s/b/sign/%s/sid", baseURL, orderKey)

	reqBody := fmt.Sprintf(`{"signingSessionId":"%s"}`, signingSessionId)
	req, err := http.NewRequest("POST", endpoint, strings.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Accept-Encoding", "gzip, deflate, br, zstd")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", baseURL)
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Referer", baseURL+"/ibank/payments")
	req.Header.Set("lhv-application-language", "EN")
	req.Header.Set("Sec-Fetch-Dest", "empty")
	req.Header.Set("Sec-Fetch-Mode", "cors")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	req.Header.Set("Cookie", c.config.BuildCookieHeader())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	var reader io.Reader = resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		gzReader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer gzReader.Close()
		reader = gzReader
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var signingResp SigningResponse
	if err := json.Unmarshal(body, &signingResp); err != nil {
		return nil, fmt.Errorf("failed to parse signing response: %w", err)
	}

	return &signingResp, nil
}

type ExecutePaymentResponse struct {
	Reference        int64    `json:"reference"`
	IsoStatus        string   `json:"isoStatus"`
	PdfUrl           string   `json:"pdfUrl"`
	SignedPdfUrl     string   `json:"signedPdfUrl"`
	Messages         []string `json:"messages"`
	PendingPaymentId *int64   `json:"pendingPaymentId"`
}

func (c *Client) ExecutePayment(orderKey string) (*ExecutePaymentResponse, error) {
	endpoint := fmt.Sprintf("%s/b/payments/sepa/%s", baseURL, orderKey)

	req, err := http.NewRequest("POST", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Accept-Encoding", "gzip, deflate, br, zstd")
	req.Header.Set("Origin", baseURL)
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Referer", baseURL+"/ibank/payments")
	req.Header.Set("lhv-application-language", "EN")
	req.Header.Set("Sec-Fetch-Dest", "empty")
	req.Header.Set("Sec-Fetch-Mode", "cors")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	req.Header.Set("Content-Length", "0")
	req.Header.Set("Cookie", c.config.BuildCookieHeader())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	var reader io.Reader = resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		gzReader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer gzReader.Close()
		reader = gzReader
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var execResp ExecutePaymentResponse
	if err := json.Unmarshal(body, &execResp); err != nil {
		return nil, fmt.Errorf("failed to parse execute payment response: %w", err)
	}

	return &execResp, nil
}

type AuthClient struct {
	http    *http.Client
	cookies []*http.Cookie
}

func NewAuthClient() *AuthClient {
	jar, _ := cookiejar.New(nil)
	return &AuthClient{
		http: &http.Client{
			Timeout: 30 * time.Second,
			Jar:     jar,
		},
	}
}

type AuthInitResponse struct {
	Status           string `json:"status"`
	VerificationCode string `json:"verificationCode"`
}

type AuthStatusResponse struct {
	Status string `json:"status"`
	UserID *int64 `json:"userId"`
}

type UserInfo struct {
	UserID             int64    `json:"userId"`
	Name               string   `json:"name"`
	CodeIssuer         string   `json:"codeIssuer"`
	Code               string   `json:"code"`
	UserType           string   `json:"userType"`
	AuthUserID         int64    `json:"authUserId"`
	Language           string   `json:"language"`
	LoginType          string   `json:"loginType"`
	HasClientAgreement bool     `json:"hasClientAgreement"`
	Privileges         []string `json:"privileges"`
}

func (c *AuthClient) InitiateSmartIDAuth(nickname string, idCode string) (*AuthInitResponse, error) {
	endpoint := baseURL + "/auth/ibank/sid?redirectUrl="

	reqBody := fmt.Sprintf(`{"nickname":"%s","code":"%s","restrictionToken":""}`, nickname, idCode)
	req, err := http.NewRequest("POST", endpoint, strings.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", baseURL)
	req.Header.Set("Referer", baseURL+"/ibank/login?goto=")
	req.Header.Set("lhv-application-language", "EN")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	c.cookies = resp.Cookies()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var authResp AuthInitResponse
	if err := json.Unmarshal(body, &authResp); err != nil {
		return nil, fmt.Errorf("failed to parse auth response: %w", err)
	}

	return &authResp, nil
}

func (c *AuthClient) CheckAuthStatus() (*AuthStatusResponse, error) {
	endpoint := baseURL + "/auth/ibank/sid"

	req, err := http.NewRequest("PUT", endpoint, strings.NewReader("{}"))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", baseURL)
	req.Header.Set("Referer", baseURL+"/ibank/login?goto=")
	req.Header.Set("lhv-application-language", "EN")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	for _, cookie := range resp.Cookies() {
		c.cookies = append(c.cookies, cookie)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var statusResp AuthStatusResponse
	if err := json.Unmarshal(body, &statusResp); err != nil {
		return nil, fmt.Errorf("failed to parse status response: %w", err)
	}

	return &statusResp, nil
}

func (c *AuthClient) GetUserInfo() (*UserInfo, error) {
	endpoint := baseURL + "/auth/ibank?reloadPrivileges=false"

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Referer", baseURL+"/ibank/login?goto=")
	req.Header.Set("lhv-application-language", "EN")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	for _, cookie := range resp.Cookies() {
		c.cookies = append(c.cookies, cookie)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("not authenticated")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var userInfo UserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	return &userInfo, nil
}

func (c *AuthClient) GetSessionCookies() map[string]string {
	result := make(map[string]string)
	for _, cookie := range c.cookies {
		switch cookie.Name {
		case "JSESSIONID", "SID_AUTH_DATA", "CLIENT_ID", "ROUTE", "CURRENT_ACCOUNT_ID":
			result[cookie.Name] = cookie.Value
		}
	}
	return result
}

type AccountInfo struct {
	AccountID int64  `json:"accountId"`
	UserID    int64  `json:"userId"`
	Name      string `json:"name"`
	IBAN      string `json:"accountNoIban"`
	Type      string `json:"type"`
	Status    string `json:"status"`
}

func (c *AuthClient) GetAccounts() ([]AccountInfo, error) {
	endpoint := baseURL + "/b/accounts"

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("lhv-application-language", "EN")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var accounts []AccountInfo
	if err := json.Unmarshal(body, &accounts); err != nil {
		return nil, fmt.Errorf("failed to parse accounts: %w", err)
	}

	return accounts, nil
}

func (c *AuthClient) GetUsers() ([]UserEntry, error) {
	endpoint := baseURL + "/auth/ibank/users"

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("lhv-application-language", "EN")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var users []UserEntry
	if err := json.Unmarshal(body, &users); err != nil {
		return nil, fmt.Errorf("failed to parse users: %w", err)
	}

	return users, nil
}

func (c *AuthClient) SwitchUser(userID int64) (*UserInfo, error) {
	endpoint := baseURL + "/auth/ibank/users"

	reqBody := fmt.Sprintf(`{"userId":%d}`, userID)
	req, err := http.NewRequest("PUT", endpoint, strings.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("lhv-application-language", "EN")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	for _, cookie := range resp.Cookies() {
		c.cookies = append(c.cookies, cookie)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var userInfo UserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	return &userInfo, nil
}

func (c *Client) GetUsers() ([]UserEntry, error) {
	endpoint := baseURL + "/auth/ibank/users"

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("lhv-application-language", "EN")
	req.Header.Set("Cookie", c.config.BuildCookieHeader())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var users []UserEntry
	if err := json.Unmarshal(body, &users); err != nil {
		return nil, fmt.Errorf("failed to parse users: %w", err)
	}

	return users, nil
}

func (c *Client) SwitchUser(userID int64) (*UserInfo, error) {
	endpoint := baseURL + "/auth/ibank/users"

	reqBody := fmt.Sprintf(`{"userId":%d}`, userID)
	req, err := http.NewRequest("PUT", endpoint, strings.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("lhv-application-language", "EN")
	req.Header.Set("Cookie", c.config.BuildCookieHeader())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var userInfo UserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	return &userInfo, nil
}

func (c *Client) GetAccountInfos() ([]AccountInfo, error) {
	endpoint := baseURL + "/b/accounts"

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("lhv-application-language", "EN")
	req.Header.Set("Cookie", c.config.BuildCookieHeader())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var accounts []AccountInfo
	if err := json.Unmarshal(body, &accounts); err != nil {
		return nil, fmt.Errorf("failed to parse accounts: %w", err)
	}

	return accounts, nil
}

func (c *Client) CheckSession() (*UserInfo, error) {
	endpoint := baseURL + "/auth/ibank?reloadPrivileges=false"

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("lhv-application-language", "EN")
	req.Header.Set("Cookie", c.config.BuildCookieHeader())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("session expired - please run 'lhv auth' to re-authenticate")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var userInfo UserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	return &userInfo, nil
}
