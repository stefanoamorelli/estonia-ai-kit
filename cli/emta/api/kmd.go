package api

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type KMDListItem struct {
	DeclarationID string `json:"declaration_id"`
	ViewID        string `json:"view_id,omitempty"`
	UpdateID      string `json:"update_id,omitempty"`
	SubmittedDate string `json:"submitted_date,omitempty"`
	Year          int    `json:"year,omitempty"`
	Month         int    `json:"month,omitempty"`
	Status        string `json:"status,omitempty"`
	DocumentType  string `json:"document_type,omitempty"`
	Submitter     string `json:"submitter,omitempty"`
	HasErrors     bool   `json:"has_errors,omitempty"`
}

type KMDFlags struct {
	NoSales     bool `json:"no_sales,omitempty"`
	NoPurchases bool `json:"no_purchases,omitempty"`
}

type KMDMainFields struct {
	TransactionsWithRate24 string `json:"transactions_with_rate_24,omitempty"`
	TransactionsWithRate20 string `json:"transactions_with_rate_20,omitempty"`
	TransactionsWithRate22 string `json:"transactions_with_rate_22,omitempty"`
	TransactionsWithRate9  string `json:"transactions_with_rate_9,omitempty"`
	TransactionsWithRate5  string `json:"transactions_with_rate_5,omitempty"`
	TransactionsWithRate13 string `json:"transactions_with_rate_13,omitempty"`
	TransactionsZeroVAT    string `json:"transactions_zero_vat,omitempty"`
	EUSupplyInclGoods      string `json:"eu_supply_incl_goods_zero_vat,omitempty"`
	EUSupplyGoods          string `json:"eu_supply_goods_zero_vat,omitempty"`
	ExportZeroVAT          string `json:"export_zero_vat,omitempty"`
	SalePassengersReturn   string `json:"sale_passengers_with_return_vat,omitempty"`
	InputVATTotal          string `json:"input_vat_total,omitempty"`
	ImportVAT              string `json:"import_vat,omitempty"`
	FixedAssetsVAT         string `json:"fixed_assets_vat,omitempty"`
	CarsVAT                string `json:"cars_vat,omitempty"`
	NumberOfCars           string `json:"number_of_cars,omitempty"`
	CarsPartialVAT         string `json:"cars_partial_vat,omitempty"`
	NumberOfCarsPartial    string `json:"number_of_cars_partial,omitempty"`
	EUAcquisitionsTotal    string `json:"eu_acquisitions_goods_total,omitempty"`
	EUAcquisitionsGoods    string `json:"eu_acquisitions_goods,omitempty"`
	OtherGoodsTotal        string `json:"acquisition_other_goods_total,omitempty"`
	ImmovablesAndMetal     string `json:"acquisition_immovables_and_metal,omitempty"`
	ExemptSupply           string `json:"supply_exempt_from_tax,omitempty"`
	SpecialArrangements    string `json:"supply_special_arrangements,omitempty"`
	AdjustmentsPlus        string `json:"adjustments_plus,omitempty"`
	AdjustmentsMinus       string `json:"adjustments_minus,omitempty"`
}

type KMDMainComputed struct {
	VATTotal      string `json:"vat_total,omitempty"`
	VATFromImport string `json:"vat_from_import,omitempty"`
	VATPayable    string `json:"vat_payable,omitempty"`
	OverpaidVAT   string `json:"overpaid_vat,omitempty"`
}

type KMDMainSection struct {
	DeclarationID string          `json:"declaration_id,omitempty"`
	PageURL       string          `json:"page_url,omitempty"`
	Status        string          `json:"status,omitempty"`
	Flags         KMDFlags        `json:"flags,omitempty"`
	Fields        KMDMainFields   `json:"fields"`
	Computed      KMDMainComputed `json:"computed,omitempty"`
	Messages      []string        `json:"messages,omitempty"`
	FormAction    string          `json:"-"`
	SaveButtonID  string          `json:"-"`
}

type KMDSubmitResult struct {
	DeclarationID string   `json:"declaration_id,omitempty"`
	PageURL       string   `json:"page_url,omitempty"`
	Status        string   `json:"status,omitempty"`
	Messages      []string `json:"messages,omitempty"`
}

type KMDMainPatch struct {
	NoSales     *bool   `json:"no_sales,omitempty"`
	NoPurchases *bool   `json:"no_purchases,omitempty"`
	Line1       *string `json:"line_1,omitempty"`
	Line11      *string `json:"line_1_1,omitempty"`
	Line12      *string `json:"line_1_2,omitempty"`
	Line2       *string `json:"line_2,omitempty"`
	Line21      *string `json:"line_2_1,omitempty"`
	Line22      *string `json:"line_2_2,omitempty"`
	Line3       *string `json:"line_3,omitempty"`
	Line31      *string `json:"line_3_1,omitempty"`
	Line311     *string `json:"line_3_1_1,omitempty"`
	Line32      *string `json:"line_3_2,omitempty"`
	Line321     *string `json:"line_3_2_1,omitempty"`
	Line5       *string `json:"line_5,omitempty"`
	Line51      *string `json:"line_5_1,omitempty"`
	Line52      *string `json:"line_5_2,omitempty"`
	Line53      *string `json:"line_5_3,omitempty"`
	Line53Cars  *string `json:"line_5_3_cars,omitempty"`
	Line54      *string `json:"line_5_4,omitempty"`
	Line54Cars  *string `json:"line_5_4_cars,omitempty"`
	Line6       *string `json:"line_6,omitempty"`
	Line61      *string `json:"line_6_1,omitempty"`
	Line7       *string `json:"line_7,omitempty"`
	Line71      *string `json:"line_7_1,omitempty"`
	Line8       *string `json:"line_8,omitempty"`
	Line9       *string `json:"line_9,omitempty"`
	Line10      *string `json:"line_10,omitempty"`
	Line11Adj   *string `json:"line_11,omitempty"`
}

type KMDINFARow struct {
	PartnerCode        string   `json:"partner_code,omitempty"`
	PartnerName        string   `json:"partner_name,omitempty"`
	InvoiceNumber      string   `json:"invoice_number,omitempty"`
	InvoiceDate        string   `json:"invoice_date,omitempty"`
	InvoiceSum         string   `json:"invoice_sum,omitempty"`
	TaxRate            string   `json:"tax_rate,omitempty"`
	SumForRateInPeriod string   `json:"sum_for_rate_in_period,omitempty"`
	CommentCodes       []string `json:"comment_codes,omitempty"`
}

type KMDINFAPatch struct {
	Rows []KMDINFARow `json:"rows,omitempty"`
}

type KMDINFARows struct {
	DeclarationID  string       `json:"declaration_id,omitempty"`
	PageURL        string       `json:"page_url,omitempty"`
	Rows           []KMDINFARow `json:"rows,omitempty"`
	Messages       []string     `json:"messages,omitempty"`
	AddFormAction  string       `json:"-"`
	ListFormAction string       `json:"-"`
}

type KMDINFBRow struct {
	PartnerCode   string   `json:"partner_code,omitempty"`
	PartnerName   string   `json:"partner_name,omitempty"`
	InvoiceNumber string   `json:"invoice_number,omitempty"`
	InvoiceDate   string   `json:"invoice_date,omitempty"`
	InvoiceSumVAT string   `json:"invoice_sum_vat,omitempty"`
	VATInPeriod   string   `json:"vat_in_period,omitempty"`
	CommentCodes  []string `json:"comment_codes,omitempty"`
}

type KMDINFBPatch struct {
	Rows []KMDINFBRow `json:"rows,omitempty"`
}

type KMDINFBRows struct {
	DeclarationID  string       `json:"declaration_id,omitempty"`
	PageURL        string       `json:"page_url,omitempty"`
	Rows           []KMDINFBRow `json:"rows,omitempty"`
	Messages       []string     `json:"messages,omitempty"`
	AddFormAction  string       `json:"-"`
	ListFormAction string       `json:"-"`
}

type kmdPage struct {
	DeclarationID string
	PageURL       string
	HTML          string
}

type kmdSourceURLResponse struct {
	OK   bool   `json:"ok"`
	Data string `json:"data"`
}

type wicketRedirectResponse struct {
	Redirect string `xml:"redirect"`
}

func (c *Client) ListKMDDeclarations() ([]KMDListItem, error) {
	page, err := c.getKMDPage("/customer-kmd2/declarations?1")
	if err != nil {
		return nil, err
	}
	return parseKMDList(page.HTML)
}

func (c *Client) CreateKMDDraft(year, month int) (*KMDMainSection, error) {
	page, err := c.getKMDPage("/customer-kmd2/declarations?1")
	if err != nil {
		return nil, err
	}

	addAction, hiddenName, submitName, submitValue, err := parseNewDraftForm(page.HTML)
	if err != nil {
		return nil, err
	}

	values := url.Values{}
	values.Set(hiddenName, "")
	values.Set(submitName, submitValue)
	nextPage, err := c.postKMDForm(resolveKMDURL(page.PageURL, addAction), values)
	if err != nil {
		return nil, err
	}

	yearValue, monthValue, ajaxURL, err := parseDraftPeriodForm(nextPage.PageURL, nextPage.HTML, year, month)
	if err != nil {
		return nil, err
	}

	ajaxValues := url.Values{}
	ajaxValues.Set("id4_hf_0", "")
	ajaxValues.Set("year", yearValue)
	ajaxValues.Set("month", monthValue)
	ajaxValues.Set("addButton", "1")

	targetPageURL, err := c.postWicketAjax(resolveKMDURL(nextPage.PageURL, ajaxURL), nextPage.PageURL, ajaxValues)
	if err != nil {
		return nil, err
	}

	current, err := c.getKMDPage(targetPageURL)
	if err != nil {
		return nil, err
	}
	section, err := parseKMDMainSection(current.HTML)
	if err != nil {
		return nil, err
	}
	section.PageURL = current.PageURL
	return section, nil
}

func (c *Client) ReadKMDMain(declarationID string) (*KMDMainSection, error) {
	page, err := c.openKMDDeclaration(declarationID)
	if err != nil {
		return nil, err
	}
	section, err := parseKMDMainSection(page.HTML)
	if err != nil {
		fragment, switchErr := c.switchKMDTab(page.PageURL, page.HTML, "KMD põhivorm")
		if switchErr != nil {
			return nil, err
		}
		section, err = parseKMDMainSection(fragment)
		if err != nil {
			return nil, err
		}
	}
	section.DeclarationID = declarationID
	section.PageURL = page.PageURL
	section.Status = parseKMDStatus(page.HTML)
	return section, nil
}

func (c *Client) UpdateKMDMain(declarationID string, patch KMDMainPatch) (*KMDMainSection, error) {
	page, err := c.openKMDDeclaration(declarationID)
	if err != nil {
		return nil, err
	}
	section, err := parseKMDMainSection(page.HTML)
	if err != nil {
		fragment, switchErr := c.switchKMDTab(page.PageURL, page.HTML, "KMD põhivorm")
		if switchErr != nil {
			return nil, err
		}
		section, err = parseKMDMainSection(fragment)
		if err != nil {
			return nil, err
		}
	}

	values := url.Values{}
	values.Set(hiddenFieldName(section.FormAction), "")
	setCheckbox(values, "noSalesData:noSales", section.Flags.NoSales, patch.NoSales)
	setCheckbox(values, "noPurchData:noPurchases", section.Flags.NoPurchases, patch.NoPurchases)
	setString(values, "transactionsWithRate24Data:transactionsWithRate24", section.Fields.TransactionsWithRate24, patch.Line1)
	setString(values, "transactionsWithRate20DataNew:transactionsWithRate20", section.Fields.TransactionsWithRate20, patch.Line11)
	setString(values, "transactionsWithRate22DataNew:transactionsWithRate22", section.Fields.TransactionsWithRate22, patch.Line12)
	setString(values, "transactionsWithRate9", section.Fields.TransactionsWithRate9, patch.Line2)
	setString(values, "transactionsWithRate5Data:transactionsWithRate5", section.Fields.TransactionsWithRate5, patch.Line21)
	setString(values, "transactionsWithRate13Data:transactionsWithRate13", section.Fields.TransactionsWithRate13, patch.Line22)
	setString(values, "transactionsZeroVat", section.Fields.TransactionsZeroVAT, patch.Line3)
	setString(values, "euSupplyInclGoodsZeroVat", section.Fields.EUSupplyInclGoods, patch.Line31)
	setString(values, "euSupplyGoodsZeroVat", section.Fields.EUSupplyGoods, patch.Line311)
	setString(values, "exportZeroVat", section.Fields.ExportZeroVAT, patch.Line32)
	setString(values, "salePassengersWithReturnVat", section.Fields.SalePassengersReturn, patch.Line321)
	setString(values, "inputVatTotal", section.Fields.InputVATTotal, patch.Line5)
	setString(values, "importVat", section.Fields.ImportVAT, patch.Line51)
	setString(values, "fixedAssetsVat", section.Fields.FixedAssetsVAT, patch.Line52)
	setString(values, "carTaxationRows:carsVat", section.Fields.CarsVAT, patch.Line53)
	setString(values, "carTaxationRows:numberOfCars", section.Fields.NumberOfCars, patch.Line53Cars)
	setString(values, "carTaxationRows:carsPartialVat", section.Fields.CarsPartialVAT, patch.Line54)
	setString(values, "carTaxationRows:numberOfCarsPartial", section.Fields.NumberOfCarsPartial, patch.Line54Cars)
	setString(values, "euAcquisitionsGoodsTotal", section.Fields.EUAcquisitionsTotal, patch.Line6)
	setString(values, "euAcquisitionsGoods", section.Fields.EUAcquisitionsGoods, patch.Line61)
	setString(values, "acquisitionOtherGoodsTotal", section.Fields.OtherGoodsTotal, patch.Line7)
	setString(values, "acquisitionImmovablesAndMetal", section.Fields.ImmovablesAndMetal, patch.Line71)
	setString(values, "supplyExemptFromTax", section.Fields.ExemptSupply, patch.Line8)
	setString(values, "supplySpecialArrangements", section.Fields.SpecialArrangements, patch.Line9)
	setString(values, "adjustmentsPlus", section.Fields.AdjustmentsPlus, patch.Line10)
	setString(values, "adjustmentsMinus", section.Fields.AdjustmentsMinus, patch.Line11Adj)
	values.Set("saveButton", "1")

	fragment, err := c.postWicketAjaxWithFragment(resolveKMDURL(page.PageURL, deriveWicketBehaviorURL(section.FormAction, "saveButton")), page.PageURL, values)
	if err != nil {
		return nil, err
	}
	updated, err := parseKMDMainSection(fragment)
	if err != nil {
		return nil, err
	}
	updated.DeclarationID = declarationID
	updated.PageURL = page.PageURL
	updated.Status = parseKMDStatus(page.HTML)
	return updated, nil
}

func (c *Client) SubmitKMD(declarationID string) (*KMDSubmitResult, error) {
	page, err := c.openKMDDeclaration(declarationID)
	if err != nil {
		return nil, err
	}
	section, err := parseKMDMainSection(page.HTML)
	if err != nil {
		return nil, err
	}

	values := url.Values{}
	values.Set(hiddenFieldName(section.FormAction), "")
	if section.Flags.NoSales {
		values.Set("noSalesData:noSales", "on")
	}
	if section.Flags.NoPurchases {
		values.Set("noPurchData:noPurchases", "on")
	}
	values.Set("transactionsWithRate24Data:transactionsWithRate24", section.Fields.TransactionsWithRate24)
	values.Set("transactionsWithRate20DataNew:transactionsWithRate20", section.Fields.TransactionsWithRate20)
	values.Set("transactionsWithRate22DataNew:transactionsWithRate22", section.Fields.TransactionsWithRate22)
	values.Set("transactionsWithRate9", section.Fields.TransactionsWithRate9)
	values.Set("transactionsWithRate5Data:transactionsWithRate5", section.Fields.TransactionsWithRate5)
	values.Set("transactionsWithRate13Data:transactionsWithRate13", section.Fields.TransactionsWithRate13)
	values.Set("transactionsZeroVat", section.Fields.TransactionsZeroVAT)
	values.Set("euSupplyInclGoodsZeroVat", section.Fields.EUSupplyInclGoods)
	values.Set("euSupplyGoodsZeroVat", section.Fields.EUSupplyGoods)
	values.Set("exportZeroVat", section.Fields.ExportZeroVAT)
	values.Set("salePassengersWithReturnVat", section.Fields.SalePassengersReturn)
	values.Set("inputVatTotal", section.Fields.InputVATTotal)
	values.Set("importVat", section.Fields.ImportVAT)
	values.Set("fixedAssetsVat", section.Fields.FixedAssetsVAT)
	values.Set("carTaxationRows:carsVat", section.Fields.CarsVAT)
	values.Set("carTaxationRows:numberOfCars", section.Fields.NumberOfCars)
	values.Set("carTaxationRows:carsPartialVat", section.Fields.CarsPartialVAT)
	values.Set("carTaxationRows:numberOfCarsPartial", section.Fields.NumberOfCarsPartial)
	values.Set("euAcquisitionsGoodsTotal", section.Fields.EUAcquisitionsTotal)
	values.Set("euAcquisitionsGoods", section.Fields.EUAcquisitionsGoods)
	values.Set("acquisitionOtherGoodsTotal", section.Fields.OtherGoodsTotal)
	values.Set("acquisitionImmovablesAndMetal", section.Fields.ImmovablesAndMetal)
	values.Set("supplyExemptFromTax", section.Fields.ExemptSupply)
	values.Set("supplySpecialArrangements", section.Fields.SpecialArrangements)
	values.Set("adjustmentsPlus", section.Fields.AdjustmentsPlus)
	values.Set("adjustmentsMinus", section.Fields.AdjustmentsMinus)
	values.Set("confirmButton", "1")

	pageURL, body, headers, err := c.postWicketAjaxRaw(resolveKMDURL(page.PageURL, deriveWicketBehaviorURL(section.FormAction, "confirmButton")), page.PageURL, values)
	if err != nil {
		return nil, err
	}

	contentType := headers.Get("Content-Type")
	if strings.Contains(contentType, "xml") {
		if redirectURL, redirErr := extractWicketRedirectURL([]byte(body)); redirErr == nil && redirectURL != "" {
			redirectPage, err := c.getKMDPageWithReferer(resolveKMDURL(pageURL, redirectURL), pageURL)
			if err == nil {
				body = redirectPage.HTML
				pageURL = redirectPage.PageURL
			}
		}
		if fragment, fragErr := extractWicketComponentHTML([]byte(body)); fragErr == nil {
			body = fragment
		}
	}
	if strings.Contains(body, "confirmSubmitForm") {
		formAction, hiddenName, submitName, submitValue, err := parseConfirmSubmitForm(body)
		if err != nil {
			return nil, err
		}
		confirmValues := url.Values{}
		confirmValues.Set(hiddenName, "")
		confirmValues.Set(submitName, submitValue)
		nextPageURL, confirmBody, confirmHeaders, err := c.postWicketAjaxRaw(resolveKMDURL(pageURL, deriveWicketBehaviorURL(formAction, submitName)), pageURL, confirmValues)
		if err != nil {
			return nil, err
		}
		pageURL = nextPageURL
		body = confirmBody
		contentType = confirmHeaders.Get("Content-Type")
		if strings.Contains(contentType, "xml") {
			if redirectURL, redirErr := extractWicketRedirectURL([]byte(body)); redirErr == nil && redirectURL != "" {
				redirectPage, err := c.getKMDPageWithReferer(resolveKMDURL(pageURL, redirectURL), pageURL)
				if err == nil {
					body = redirectPage.HTML
					pageURL = redirectPage.PageURL
				}
			}
			if fragment, fragErr := extractWicketComponentHTML([]byte(body)); fragErr == nil {
				body = fragment
			}
		}
	}
	if os.Getenv("EMTA_DEBUG_SUBMIT") == "1" {
		_ = os.WriteFile("/tmp/emta-submit-debug.html", []byte(body), 0o600)
	}

	result := &KMDSubmitResult{
		DeclarationID: declarationID,
		PageURL:       pageURL,
		Status:        parseKMDStatus(body),
		Messages:      extractFeedbackMessagesFromHTML(body),
	}
	if result.Status == "" {
		targetYear, targetMonth := parseStableKMDPeriod(declarationID)
		if items, listErr := c.ListKMDDeclarations(); listErr == nil {
			for _, item := range items {
				if item.Year == targetYear && item.Month == targetMonth {
					result.Status = item.Status
					break
				}
			}
		}
		if result.Status == "" {
			if refreshed, readErr := c.ReadKMDMain(declarationID); readErr == nil {
				result.PageURL = refreshed.PageURL
				result.Status = refreshed.Status
			} else {
				result.Status = parseKMDStatus(page.HTML)
			}
		}
	}
	return result, nil
}

func (c *Client) ReadKMDINFA(declarationID string) (*KMDINFARows, error) {
	page, err := c.openKMDDeclaration(declarationID)
	if err != nil {
		return nil, err
	}
	fragment, err := c.switchKMDTab(page.PageURL, page.HTML, "KMD INF A osa")
	if err != nil {
		if rows, parseErr := parseKMDINFASection(page.HTML); parseErr == nil {
			rows.DeclarationID = declarationID
			rows.PageURL = page.PageURL
			return rows, nil
		}
		return nil, err
	}
	rows, err := parseKMDINFASection(fragment)
	if err != nil {
		return nil, err
	}
	rows.DeclarationID = declarationID
	rows.PageURL = page.PageURL
	return rows, nil
}

func (c *Client) ReadKMDINFB(declarationID string) (*KMDINFBRows, error) {
	page, err := c.openKMDDeclaration(declarationID)
	if err != nil {
		return nil, err
	}
	fragment, err := c.switchKMDTab(page.PageURL, page.HTML, "KMD INF B osa")
	if err != nil {
		if rows, parseErr := parseKMDINFBSection(page.HTML); parseErr == nil {
			rows.DeclarationID = declarationID
			rows.PageURL = page.PageURL
			return rows, nil
		}
		return nil, err
	}
	rows, err := parseKMDINFBSection(fragment)
	if err != nil {
		return nil, err
	}
	rows.DeclarationID = declarationID
	rows.PageURL = page.PageURL
	return rows, nil
}

func (c *Client) UpdateKMDINFA(declarationID string, patch KMDINFAPatch) (*KMDINFARows, error) {
	page, err := c.openKMDDeclaration(declarationID)
	if err != nil {
		return nil, err
	}
	fragment, err := c.switchKMDTab(page.PageURL, page.HTML, "KMD INF A osa")
	if err != nil {
		if _, parseErr := parseKMDINFASection(page.HTML); parseErr == nil {
			fragment = page.HTML
		} else {
			return nil, err
		}
	}
	state, err := parseKMDINFASection(fragment)
	if err != nil {
		return nil, err
	}
	mergedRows, changed, err := mergeINFARows(state.Rows, patch.Rows)
	if err != nil {
		return nil, err
	}
	if !changed {
		state.DeclarationID = declarationID
		state.PageURL = page.PageURL
		return state, nil
	}
	if changed {
		fragment, err = c.clearINFARows(page.PageURL, state.ListFormAction)
		if err != nil {
			return nil, err
		}
		state, err = parseKMDINFASection(fragment)
		if err != nil {
			return nil, err
		}
	}
	for _, row := range mergedRows {
		values := url.Values{}
		values.Set(hiddenFieldName(state.AddFormAction), "")
		values.Set("buyerRegCode", row.PartnerCode)
		values.Set("partnerNameForCustomer", row.PartnerName)
		values.Set("invoiceNumber", row.InvoiceNumber)
		values.Set("invoiceDate", row.InvoiceDate)
		values.Set("invoiceSum", row.InvoiceSum)
		values.Set("taxRate", normalizeINFATaxRate(row.TaxRate))
		values.Set("sumForRateInPeriod", row.SumForRateInPeriod)
		for _, code := range row.CommentCodes {
			values.Add("commentsCheckboxGroup", normalizeINFACommentCode(code))
		}
		values.Set("addItemButton", "1")
		fragment, err = c.postWicketAjaxWithFragment(resolveKMDURL(page.PageURL, deriveWicketBehaviorURL(state.AddFormAction, "addItemButton")), page.PageURL, values)
		if err != nil {
			return nil, err
		}
		state, err = parseKMDINFASection(fragment)
		if err != nil {
			return nil, err
		}
	}
	state.DeclarationID = declarationID
	state.PageURL = page.PageURL
	return state, nil
}

func (c *Client) DeleteKMDINFA(declarationID, partnerCode, invoiceNumber string) (*KMDINFARows, error) {
	page, err := c.openKMDDeclaration(declarationID)
	if err != nil {
		return nil, err
	}
	fragment, err := c.switchKMDTab(page.PageURL, page.HTML, "KMD INF A osa")
	if err != nil {
		if _, parseErr := parseKMDINFASection(page.HTML); parseErr == nil {
			fragment = page.HTML
		} else {
			return nil, err
		}
	}
	state, err := parseKMDINFASection(fragment)
	if err != nil {
		return nil, err
	}
	filtered, changed, err := deleteINFARow(state.Rows, partnerCode, invoiceNumber)
	if err != nil {
		return nil, err
	}
	if !changed {
		state.DeclarationID = declarationID
		state.PageURL = page.PageURL
		return state, nil
	}
	fragment, err = c.clearINFARows(page.PageURL, state.ListFormAction)
	if err != nil {
		return nil, err
	}
	state, err = parseKMDINFASection(fragment)
	if err != nil {
		return nil, err
	}
	for _, row := range filtered {
		values := url.Values{}
		values.Set(hiddenFieldName(state.AddFormAction), "")
		values.Set("buyerRegCode", row.PartnerCode)
		values.Set("partnerNameForCustomer", row.PartnerName)
		values.Set("invoiceNumber", row.InvoiceNumber)
		values.Set("invoiceDate", row.InvoiceDate)
		values.Set("invoiceSum", row.InvoiceSum)
		values.Set("taxRate", normalizeINFATaxRate(row.TaxRate))
		values.Set("sumForRateInPeriod", row.SumForRateInPeriod)
		for _, code := range row.CommentCodes {
			values.Add("commentsCheckboxGroup", normalizeINFACommentCode(code))
		}
		values.Set("addItemButton", "1")
		fragment, err = c.postWicketAjaxWithFragment(resolveKMDURL(page.PageURL, deriveWicketBehaviorURL(state.AddFormAction, "addItemButton")), page.PageURL, values)
		if err != nil {
			return nil, err
		}
		state, err = parseKMDINFASection(fragment)
		if err != nil {
			return nil, err
		}
	}
	state.DeclarationID = declarationID
	state.PageURL = page.PageURL
	return state, nil
}

func (c *Client) UpdateKMDINFB(declarationID string, patch KMDINFBPatch) (*KMDINFBRows, error) {
	page, err := c.openKMDDeclaration(declarationID)
	if err != nil {
		return nil, err
	}
	fragment, err := c.switchKMDTab(page.PageURL, page.HTML, "KMD INF B osa")
	if err != nil {
		if _, parseErr := parseKMDINFBSection(page.HTML); parseErr == nil {
			fragment = page.HTML
		} else {
			return nil, err
		}
	}
	state, err := parseKMDINFBSection(fragment)
	if err != nil {
		return nil, err
	}
	mergedRows, changed, err := mergeINFBRows(state.Rows, patch.Rows)
	if err != nil {
		return nil, err
	}
	if !changed {
		state.DeclarationID = declarationID
		state.PageURL = page.PageURL
		return state, nil
	}
	if changed {
		fragment, err = c.clearINFBRows(page.PageURL, state.ListFormAction)
		if err != nil {
			return nil, err
		}
		state, err = parseKMDINFBSection(fragment)
		if err != nil {
			return nil, err
		}
	}
	for _, row := range mergedRows {
		values := url.Values{}
		values.Set(hiddenFieldName(state.AddFormAction), "")
		values.Set("sellerRegCode", row.PartnerCode)
		values.Set("partnerNameForCustomer", row.PartnerName)
		values.Set("invoiceNumber", row.InvoiceNumber)
		values.Set("invoiceDate", row.InvoiceDate)
		values.Set("invoiceSumVat", row.InvoiceSumVAT)
		values.Set("vatInPeriod", row.VATInPeriod)
		for _, code := range row.CommentCodes {
			values.Add("commentsCheckboxGroup", normalizeINFBCommentCode(code))
		}
		values.Set("addItemButton", "1")
		fragment, err = c.postWicketAjaxWithFragment(resolveKMDURL(page.PageURL, deriveWicketBehaviorURL(state.AddFormAction, "addItemButton")), page.PageURL, values)
		if err != nil {
			return nil, err
		}
		state, err = parseKMDINFBSection(fragment)
		if err != nil {
			return nil, err
		}
	}
	state.DeclarationID = declarationID
	state.PageURL = page.PageURL
	return state, nil
}

func (c *Client) DeleteKMDINFB(declarationID, partnerCode, invoiceNumber string) (*KMDINFBRows, error) {
	page, err := c.openKMDDeclaration(declarationID)
	if err != nil {
		return nil, err
	}
	fragment, err := c.switchKMDTab(page.PageURL, page.HTML, "KMD INF B osa")
	if err != nil {
		if _, parseErr := parseKMDINFBSection(page.HTML); parseErr == nil {
			fragment = page.HTML
		} else {
			return nil, err
		}
	}
	state, err := parseKMDINFBSection(fragment)
	if err != nil {
		return nil, err
	}
	filtered, changed, err := deleteINFBRow(state.Rows, partnerCode, invoiceNumber)
	if err != nil {
		return nil, err
	}
	if !changed {
		state.DeclarationID = declarationID
		state.PageURL = page.PageURL
		return state, nil
	}
	fragment, err = c.clearINFBRows(page.PageURL, state.ListFormAction)
	if err != nil {
		return nil, err
	}
	state, err = parseKMDINFBSection(fragment)
	if err != nil {
		return nil, err
	}
	for _, row := range filtered {
		values := url.Values{}
		values.Set(hiddenFieldName(state.AddFormAction), "")
		values.Set("sellerRegCode", row.PartnerCode)
		values.Set("partnerNameForCustomer", row.PartnerName)
		values.Set("invoiceNumber", row.InvoiceNumber)
		values.Set("invoiceDate", row.InvoiceDate)
		values.Set("invoiceSumVat", row.InvoiceSumVAT)
		values.Set("vatInPeriod", row.VATInPeriod)
		for _, code := range row.CommentCodes {
			values.Add("commentsCheckboxGroup", normalizeINFBCommentCode(code))
		}
		values.Set("addItemButton", "1")
		fragment, err = c.postWicketAjaxWithFragment(resolveKMDURL(page.PageURL, deriveWicketBehaviorURL(state.AddFormAction, "addItemButton")), page.PageURL, values)
		if err != nil {
			return nil, err
		}
		state, err = parseKMDINFBSection(fragment)
		if err != nil {
			return nil, err
		}
	}
	state.DeclarationID = declarationID
	state.PageURL = page.PageURL
	return state, nil
}

func (c *Client) openKMDDeclaration(declarationID string) (*kmdPage, error) {
	// Warm the KMD declarations page first so the same HTTP session carries
	// whatever transient state Wicket/SSO expects before opening the edit/view link.
	basePage, err := c.getKMDPage("/customer-kmd2/declarations?1")
	if err != nil {
		return nil, err
	}
	link, err := resolveKMDDeclarationLink(basePage.HTML, declarationID)
	if err != nil {
		return nil, err
	}
	return c.getKMDPageWithReferer(resolveKMDURL(basePage.PageURL, link), basePage.PageURL)
}

func (c *Client) getKMDPage(ref string) (*kmdPage, error) {
	return c.getKMDPageWithReferer(ref, "")
}

func (c *Client) getKMDPageWithReferer(ref, referer string) (*kmdPage, error) {
	target := resolveKMDURL(baseURL+"/customer-kmd2/declarations?1", ref)
	req, err := http.NewRequest("GET", target, nil)
	if err != nil {
		return nil, err
	}
	setKMDNavigationHeaders(req)
	if referer != "" {
		req.Header.Set("Referer", referer)
	}
	resp, err := c.session.Client.Do(req)
	if err != nil {
		if !strings.Contains(err.Error(), "stopped after 20 redirects") {
			return nil, err
		}
		resp = nil
	}
	var body []byte
	if resp != nil {
		body, err = io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if resp.StatusCode < 400 && strings.Contains(resp.Request.URL.String(), "/customer-kmd2/") {
			return &kmdPage{PageURL: resp.Request.URL.String(), HTML: string(body)}, nil
		}
	}

	if err := c.ensureKMDSession(); err != nil {
		return nil, err
	}

	req, err = http.NewRequest("GET", target, nil)
	if err != nil {
		return nil, err
	}
	setKMDNavigationHeaders(req)
	if referer != "" {
		req.Header.Set("Referer", referer)
	}
	resp, err = c.session.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err = io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("kmd get failed: status %d", resp.StatusCode)
	}
	return &kmdPage{PageURL: resp.Request.URL.String(), HTML: string(body)}, nil
}

func (c *Client) ensureKMDSession() error {
	targetURL := baseURL + "/customer-kmd2/declarations?1"
	if sourceURL, err := c.getKMDSourceURL(); err == nil && sourceURL != "" {
		targetURL = sourceURL
	}

	origRedirect := c.session.Client.CheckRedirect
	c.session.Client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}
	defer func() {
		c.session.Client.CheckRedirect = origRedirect
	}()

	currentURL := targetURL
	referer := ""
	for i := 0; i < 12; i++ {
		req, err := http.NewRequest("GET", currentURL, nil)
		if err != nil {
			return err
		}
		setKMDNavigationHeaders(req)
		if referer != "" {
			req.Header.Set("Referer", referer)
		}
		resp, err := c.session.Client.Do(req)
		if err != nil {
			return fmt.Errorf("opening KMD session: %w", err)
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return err
		}
		finalURL := resp.Request.URL.String()
		if strings.Contains(finalURL, "/customer-kmd2/") && resp.StatusCode < 300 {
			return nil
		}

		location := resp.Header.Get("Location")
		if location == "" {
			if strings.Contains(finalURL, "v1/login") {
				action, authst, err := parseProviderForm(string(body))
				if err != nil {
					return err
				}
				providerURL := resolveKMDURL(finalURL, action)
				postBody := url.Values{"authst": {authst}}
				postReq, err := http.NewRequest("POST", providerURL, strings.NewReader(postBody.Encode()))
				if err != nil {
					return err
				}
				setKMDNavigationHeaders(postReq)
				postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
				postReq.Header.Set("Origin", baseURL)
				postReq.Header.Set("Referer", finalURL)
				postResp, err := c.session.Client.Do(postReq)
				if err != nil {
					return fmt.Errorf("posting KMD provider form: %w", err)
				}
				postResp.Body.Close()
				location = postResp.Header.Get("Location")
				if location == "" {
					finalURL = postResp.Request.URL.String()
					if strings.Contains(finalURL, "/customer-kmd2/") {
						return nil
					}
				}
				referer = providerURL
				currentURL = resolveKMDURL(providerURL, location)
				continue
			}
			if strings.Contains(finalURL, "tara.ria.ee") || strings.Contains(finalURL, "govsso.ria.ee") || strings.Contains(finalURL, "/auth/init") {
				return fmt.Errorf("KMD session requires a fresh login to reuse the government SSO session")
			}
			if resp.StatusCode >= 400 {
				return fmt.Errorf("opening KMD session failed: status %d", resp.StatusCode)
			}
			return nil
		}

		nextURL := resolveKMDURL(currentURL, location)
		if strings.Contains(nextURL, "wfm/client/principal") {
			u, _ := url.Parse(nextURL)
			redirectURI := u.Query().Get("redirect_uri")
			if err := c.setPrincipalWithToken(c.session.PrincipalID); err != nil {
				return fmt.Errorf("setting principal for KMD: %w", err)
			}
			if redirectURI != "" {
				validateURL := baseURL + "/wfm-api/redirect/client/v2/validate?redirect_uri=" + url.QueryEscape(redirectURI)
				validateReq, err := http.NewRequest("GET", validateURL, nil)
				if err != nil {
					return err
				}
				c.setAuthHeaders(validateReq)
				setKMDNavigationHeaders(validateReq)
				validateResp, err := c.session.Client.Do(validateReq)
				if err != nil {
					return fmt.Errorf("validating KMD redirect: %w", err)
				}
				validateResp.Body.Close()
				return nil
			}
		}

		referer = currentURL
		currentURL = nextURL
	}
	return fmt.Errorf("KMD session setup exceeded redirect limit")
}

func (c *Client) getKMDSourceURL() (string, error) {
	if err := c.refreshPortalSession(); err != nil {
		return "", err
	}
	req, err := http.NewRequest("GET", baseURL+"/dashboard-api/client/v1/declarations/sourceUrl?declarationSourceCode=KMD", nil)
	if err != nil {
		return "", err
	}
	c.setAuthHeaders(req)
	req.Header.Set("Accept", "application/json, text/plain, */*")

	resp, err := c.session.Client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("getting KMD source URL failed: status %d", resp.StatusCode)
	}

	var payload kmdSourceURLResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", fmt.Errorf("parsing KMD source URL response: %w", err)
	}
	if !payload.OK || payload.Data == "" {
		return "", fmt.Errorf("KMD source URL missing in response")
	}
	return payload.Data, nil
}

func (c *Client) postKMDForm(target string, values url.Values) (*kmdPage, error) {
	req, err := http.NewRequest("POST", target, strings.NewReader(values.Encode()))
	if err != nil {
		return nil, err
	}
	setKMDNavigationHeaders(req)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.session.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("kmd form post failed: status %d", resp.StatusCode)
	}
	return &kmdPage{PageURL: resp.Request.URL.String(), HTML: string(body)}, nil
}

func (c *Client) postWicketAjax(target, pageURL string, values url.Values) (string, error) {
	req, err := http.NewRequest("POST", target, strings.NewReader(values.Encode()))
	if err != nil {
		return "", err
	}
	setKMDWicketHeaders(req, pageURL)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	resp, err := c.session.Client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	_, err = io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("kmd ajax failed: status %d", resp.StatusCode)
	}
	if location := resp.Header.Get("ajax-location"); location != "" {
		return resolveKMDURL(pageURL, location), nil
	}
	return pageURL, nil
}

func (c *Client) postWicketAjaxWithFragment(target, pageURL string, values url.Values) (string, error) {
	_, body, _, err := c.postWicketAjaxRaw(target, pageURL, values)
	if err != nil {
		return "", err
	}
	fragment, err := extractWicketComponentHTML([]byte(body))
	if err != nil {
		return "", err
	}
	return fragment, nil
}

func (c *Client) postWicketAjaxRaw(target, pageURL string, values url.Values) (string, string, http.Header, error) {
	req, err := http.NewRequest("POST", target, strings.NewReader(values.Encode()))
	if err != nil {
		return "", "", nil, err
	}
	setKMDWicketHeaders(req, pageURL)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	resp, err := c.session.Client.Do(req)
	if err != nil {
		return "", "", nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", nil, err
	}
	if resp.StatusCode >= 400 {
		return "", "", resp.Header, fmt.Errorf("kmd ajax failed: status %d", resp.StatusCode)
	}
	location := pageURL
	if ajaxLocation := resp.Header.Get("ajax-location"); ajaxLocation != "" {
		location = resolveKMDURL(pageURL, ajaxLocation)
	}
	return location, string(body), resp.Header, nil
}

func (c *Client) switchKMDTab(pageURL, html, tabName string) (string, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return "", err
	}
	var href string
	doc.Find("a").EachWithBreak(func(i int, s *goquery.Selection) bool {
		if strings.TrimSpace(s.Text()) == tabName {
			h, _ := s.Attr("href")
			href = h
			return false
		}
		return true
	})
	if href == "" {
		return "", fmt.Errorf("kmd tab %q not found", tabName)
	}
	req, err := http.NewRequest("GET", resolveKMDURL(pageURL, deriveWicketBehaviorURL(href, "")), nil)
	if err != nil {
		return "", err
	}
	setKMDWicketHeaders(req, pageURL)
	resp, err := c.session.Client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return extractWicketComponentHTML(body)
}

func (c *Client) getWicketAjaxFragment(target, pageURL string) (string, error) {
	req, err := http.NewRequest("GET", target, nil)
	if err != nil {
		return "", err
	}
	setKMDWicketHeaders(req, pageURL)
	resp, err := c.session.Client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return extractWicketComponentHTML(body)
}

func (c *Client) clearINFARows(pageURL, listFormAction string) (string, error) {
	target := resolveKMDURL(pageURL, deriveWicketBehaviorURL(listFormAction, "removeAllSaleRows"))
	return c.getWicketAjaxFragment(target, pageURL)
}

func (c *Client) clearINFBRows(pageURL, listFormAction string) (string, error) {
	target := resolveKMDURL(pageURL, deriveWicketBehaviorURL(listFormAction, "removeAllPurchRows"))
	return c.getWicketAjaxFragment(target, pageURL)
}

func parseKMDList(html string) ([]KMDListItem, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, err
	}
	var items []KMDListItem
	doc.Find("tr").Each(func(i int, row *goquery.Selection) {
		cells := row.Find("td")
		if cells.Length() < 9 {
			return
		}
		values := make([]string, 0, cells.Length())
		cells.Each(func(i int, cell *goquery.Selection) {
			values = append(values, strings.TrimSpace(cell.Text()))
		})
		// Expected columns:
		// 0 row number, 1 submitted date, 2 year, 3 month, 4 status,
		// 5 document type, 6 submitter, 7 has errors, 8 view, 9 edit
		if !isInteger(values[0]) || !isInteger(values[2]) || !isInteger(values[3]) {
			return
		}
		item := KMDListItem{
			SubmittedDate: values[1],
			Status:        values[4],
			DocumentType:  values[5],
			Submitter:     values[6],
			HasErrors:     strings.EqualFold(values[7], "Jah"),
		}
		item.Year, _ = strconv.Atoi(values[2])
		item.Month, _ = strconv.Atoi(values[3])
		if view, ok := cells.Eq(8).Find("a").Attr("href"); ok {
			item.ViewID = view
		}
		if cells.Length() > 9 {
			if edit, ok := cells.Eq(9).Find("a").Attr("href"); ok {
				item.UpdateID = edit
			}
		}
		item.DeclarationID = makeKMDStableID(item)
		if item.DeclarationID != "" {
			items = append(items, item)
		}
	})
	return items, nil
}

func parseNewDraftForm(html string) (action, hiddenName, submitName, submitValue string, err error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return "", "", "", "", err
	}
	form := doc.Find(`form[action*="addNewKmdForm"]`).First()
	if form.Length() == 0 {
		return "", "", "", "", fmt.Errorf("add new KMD form not found")
	}
	action, _ = form.Attr("action")
	hiddenName, _ = form.Find(`input[type="hidden"]`).First().Attr("name")
	submit := form.Find(`input[type="submit"]`).First()
	submitName, _ = submit.Attr("name")
	submitValue, _ = submit.Attr("value")
	return action, hiddenName, submitName, submitValue, nil
}

func parseConfirmSubmitForm(html string) (action, hiddenName, submitName, submitValue string, err error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return "", "", "", "", err
	}
	form := doc.Find(`form[action*="confirmSubmitForm"]`).First()
	if form.Length() == 0 {
		return "", "", "", "", fmt.Errorf("confirm submit form not found")
	}
	action, _ = form.Attr("action")
	hiddenName, _ = form.Find(`input[type="hidden"]`).First().Attr("name")
	submit := form.Find(`input[name="saveButton"]`).First()
	submitName, _ = submit.Attr("name")
	submitValue, _ = submit.Attr("value")
	if submitValue == "" {
		submitValue = "1"
	}
	return action, hiddenName, submitName, submitValue, nil
}

func parseDraftPeriodForm(pageURL, html string, year, month int) (yearValue, monthValue, ajaxURL string, err error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return "", "", "", err
	}
	doc.Find("script").EachWithBreak(func(i int, s *goquery.Selection) bool {
		text := s.Text()
		if strings.Contains(text, "addNewKmdForm-addButton") {
			re := regexp.MustCompile(`\./page\?[^"]+addNewKmdForm-addButton`)
			if m := re.FindString(text); m != "" {
				ajaxURL = m
				return false
			}
		}
		return true
	})
	if ajaxURL == "" {
		return "", "", "", fmt.Errorf("draft period ajax URL not found")
	}
	form := doc.Find(`form[action*="addNewKmdForm"]`).First()
	if form.Length() == 0 {
		return "", "", "", fmt.Errorf("draft period form not found")
	}
	yearSelect := form.Find(`select[name="year"]`)
	if yearSelect.Length() == 0 {
		yearSelect = doc.Find(`select[name="year"]`).First()
	}
	monthSelect := form.Find(`select[name="month"]`)
	if monthSelect.Length() == 0 {
		monthSelect = doc.Find(`select[name="month"]`).First()
	}
	yearSelect.Find("option").EachWithBreak(func(i int, opt *goquery.Selection) bool {
		if strings.TrimSpace(opt.Text()) == strconv.Itoa(year) {
			yearValue, _ = opt.Attr("value")
			if yearValue == "" {
				yearValue = strconv.Itoa(i + 1)
			}
			return false
		}
		return true
	})
	monthSelect.Find("option").EachWithBreak(func(i int, opt *goquery.Selection) bool {
		selected, _ := opt.Attr("selected")
		_ = selected
		if i+1 == month {
			monthValue, _ = opt.Attr("value")
			if monthValue == "" {
				monthValue = strconv.Itoa(month)
			}
			return false
		}
		return true
	})
	if yearValue == "" || monthValue == "" {
		return "", "", "", fmt.Errorf("draft period option values not found")
	}
	return yearValue, monthValue, ajaxURL, nil
}

func parseKMDMainSection(html string) (*KMDMainSection, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, err
	}
	form := doc.Find(`form[action*="vatDeclarationForm"]`).First()
	if form.Length() == 0 {
		return nil, fmt.Errorf("main KMD form not found")
	}
	action, _ := form.Attr("action")
	section := &KMDMainSection{
		FormAction:   action,
		SaveButtonID: form.Find(`input[name="saveButton"]`).AttrOr("id", ""),
		Messages:     extractFeedbackMessages(doc),
	}
	section.Flags.NoSales = form.Find(`input[name="noSalesData:noSales"]`).Is("[checked]")
	section.Flags.NoPurchases = form.Find(`input[name="noPurchData:noPurchases"]`).Is("[checked]")
	section.Fields.TransactionsWithRate24 = fieldValue(form, "transactionsWithRate24Data:transactionsWithRate24")
	section.Fields.TransactionsWithRate20 = fieldValue(form, "transactionsWithRate20DataNew:transactionsWithRate20")
	section.Fields.TransactionsWithRate22 = fieldValue(form, "transactionsWithRate22DataNew:transactionsWithRate22")
	section.Fields.TransactionsWithRate9 = fieldValue(form, "transactionsWithRate9")
	section.Fields.TransactionsWithRate5 = fieldValue(form, "transactionsWithRate5Data:transactionsWithRate5")
	section.Fields.TransactionsWithRate13 = fieldValue(form, "transactionsWithRate13Data:transactionsWithRate13")
	section.Fields.TransactionsZeroVAT = fieldValue(form, "transactionsZeroVat")
	section.Fields.EUSupplyInclGoods = fieldValue(form, "euSupplyInclGoodsZeroVat")
	section.Fields.EUSupplyGoods = fieldValue(form, "euSupplyGoodsZeroVat")
	section.Fields.ExportZeroVAT = fieldValue(form, "exportZeroVat")
	section.Fields.SalePassengersReturn = fieldValue(form, "salePassengersWithReturnVat")
	section.Fields.InputVATTotal = fieldValue(form, "inputVatTotal")
	section.Fields.ImportVAT = fieldValue(form, "importVat")
	section.Fields.FixedAssetsVAT = fieldValue(form, "fixedAssetsVat")
	section.Fields.CarsVAT = fieldValue(form, "carTaxationRows:carsVat")
	section.Fields.NumberOfCars = fieldValue(form, "carTaxationRows:numberOfCars")
	section.Fields.CarsPartialVAT = fieldValue(form, "carTaxationRows:carsPartialVat")
	section.Fields.NumberOfCarsPartial = fieldValue(form, "carTaxationRows:numberOfCarsPartial")
	section.Fields.EUAcquisitionsTotal = fieldValue(form, "euAcquisitionsGoodsTotal")
	section.Fields.EUAcquisitionsGoods = fieldValue(form, "euAcquisitionsGoods")
	section.Fields.OtherGoodsTotal = fieldValue(form, "acquisitionOtherGoodsTotal")
	section.Fields.ImmovablesAndMetal = fieldValue(form, "acquisitionImmovablesAndMetal")
	section.Fields.ExemptSupply = fieldValue(form, "supplyExemptFromTax")
	section.Fields.SpecialArrangements = fieldValue(form, "supplySpecialArrangements")
	section.Fields.AdjustmentsPlus = fieldValue(form, "adjustmentsPlus")
	section.Fields.AdjustmentsMinus = fieldValue(form, "adjustmentsMinus")
	section.Computed.VATTotal = fieldValue(form, "vatTotal")
	section.Computed.VATFromImport = fieldValue(form, "vatFromImport")
	section.Computed.VATPayable = fieldValue(form, "vatPayable")
	section.Computed.OverpaidVAT = fieldValue(form, "overpaidVat")
	return section, nil
}

func parseKMDINFASection(html string) (*KMDINFARows, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, err
	}
	form := doc.Find(`form[action*="addSaleLineForm"]`).First()
	result := &KMDINFARows{
		AddFormAction: form.AttrOr("action", ""),
		Messages:      extractFeedbackMessages(doc),
	}
	result.ListFormAction = doc.Find(`form[action*="saleLinesForm"]`).First().AttrOr("action", "")
	doc.Find("tr").Each(func(i int, row *goquery.Selection) {
		cells := row.Find("td")
		if cells.Length() < 8 {
			return
		}
		values := make([]string, 0, cells.Length())
		cells.Each(func(i int, cell *goquery.Selection) {
			values = append(values, cleanText(cell.Text()))
		})
		if values[0] == "" || values[0] == "Nr" || values[1] == "" || values[2] == "" {
			return
		}
		if values[0] == "1" || isInteger(values[0]) {
			result.Rows = append(result.Rows, KMDINFARow{
				PartnerCode:        values[1],
				PartnerName:        values[2],
				InvoiceNumber:      values[3],
				InvoiceDate:        values[4],
				InvoiceSum:         values[5],
				TaxRate:            values[6],
				SumForRateInPeriod: values[7],
			})
		}
	})
	if result.AddFormAction == "" && result.ListFormAction == "" && len(result.Rows) == 0 {
		return nil, fmt.Errorf("INF A section not found")
	}
	return result, nil
}

func parseKMDINFBSection(html string) (*KMDINFBRows, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, err
	}
	form := doc.Find(`form[action*="addPurchaseLineForm"]`).First()
	result := &KMDINFBRows{
		AddFormAction: form.AttrOr("action", ""),
		Messages:      extractFeedbackMessages(doc),
	}
	result.ListFormAction = doc.Find(`form[action*="purchaseLinesForm"]`).First().AttrOr("action", "")
	doc.Find("tr").Each(func(i int, row *goquery.Selection) {
		cells := row.Find("td")
		if cells.Length() < 7 {
			return
		}
		values := make([]string, 0, cells.Length())
		cells.Each(func(i int, cell *goquery.Selection) {
			values = append(values, cleanText(cell.Text()))
		})
		if values[0] == "" || values[0] == "Nr" || values[1] == "" || values[2] == "" {
			return
		}
		if values[0] == "1" || isInteger(values[0]) {
			result.Rows = append(result.Rows, KMDINFBRow{
				PartnerCode:   values[1],
				PartnerName:   values[2],
				InvoiceNumber: values[3],
				InvoiceDate:   values[4],
				InvoiceSumVAT: values[5],
				VATInPeriod:   values[6],
			})
		}
	})
	if result.AddFormAction == "" && result.ListFormAction == "" && len(result.Rows) == 0 {
		return nil, fmt.Errorf("INF B section not found")
	}
	return result, nil
}

func deriveWicketBehaviorURL(rawAction, buttonName string) string {
	converted := strings.Replace(rawAction, ".IFormSubmitListener-", ".IBehaviorListener.0-", 1)
	converted = strings.Replace(converted, ".ILinkListener-", ".IBehaviorListener.0-", 1)
	if buttonName != "" {
		converted += "-" + buttonName
	}
	return converted
}

func extractWicketComponentHTML(body []byte) (string, error) {
	type component struct {
		Content string `xml:",cdata"`
	}
	type ajaxResponse struct {
		Components []component `xml:"component"`
	}
	var resp ajaxResponse
	if err := xml.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("parsing wicket ajax response: %w", err)
	}
	for _, component := range resp.Components {
		if strings.TrimSpace(component.Content) != "" {
			return component.Content, nil
		}
	}
	return "", fmt.Errorf("no wicket component HTML found")
}

func extractWicketRedirectURL(body []byte) (string, error) {
	var resp wicketRedirectResponse
	if err := xml.Unmarshal(body, &resp); err != nil {
		return "", err
	}
	return strings.TrimSpace(resp.Redirect), nil
}

func setKMDNavigationHeaders(req *http.Request) {
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
}

func setKMDWicketHeaders(req *http.Request, pageURL string) {
	setKMDNavigationHeaders(req)
	req.Header.Set("Wicket-Ajax", "true")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Accept", "application/xml, text/xml, */*; q=0.01")
	if u, err := url.Parse(pageURL); err == nil {
		req.Header.Set("Wicket-Ajax-BaseURL", strings.TrimPrefix(u.RequestURI(), "/customer-kmd2/"))
	}
}

func resolveKMDURL(pageURL, ref string) string {
	if ref == "" {
		return pageURL
	}
	if strings.HasPrefix(ref, "http://") || strings.HasPrefix(ref, "https://") {
		return ref
	}
	base, err := url.Parse(pageURL)
	if err != nil {
		return ref
	}
	resolved, err := base.Parse(ref)
	if err != nil {
		return ref
	}
	return resolved.String()
}

func hiddenFieldName(action string) string {
	re := regexp.MustCompile(`page\?`)
	if re.MatchString(action) {
		return strings.Split(strings.TrimPrefix(action, "./"), "?")[0] + "_hf_0"
	}
	return "id_hf_0"
}

func fieldValue(form *goquery.Selection, name string) string {
	return cleanText(form.Find(fmt.Sprintf(`[name="%s"]`, name)).First().AttrOr("value", ""))
}

func cleanText(s string) string {
	return strings.TrimSpace(strings.Join(strings.Fields(strings.ReplaceAll(s, "\u00a0", " ")), " "))
}

func extractFeedbackMessages(doc *goquery.Document) []string {
	var messages []string
	doc.Find("#feedbackPanel, .emta-error").Each(func(i int, sel *goquery.Selection) {
		text := cleanText(sel.Text())
		if text != "" {
			messages = append(messages, text)
		}
	})
	return messages
}

func extractFeedbackMessagesFromHTML(html string) []string {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil
	}
	return extractFeedbackMessages(doc)
}

func setString(values url.Values, name, current string, patch *string) {
	if patch != nil {
		values.Set(name, *patch)
		return
	}
	values.Set(name, current)
}

func setCheckbox(values url.Values, name string, current bool, patch *bool) {
	use := current
	if patch != nil {
		use = *patch
	}
	if use {
		values.Set(name, "on")
	}
}

func parseKMDStatus(html string) string {
	re := regexp.MustCompile(`Staatus:\s*</[^>]+>\s*([^<]+)<`)
	if m := re.FindStringSubmatch(html); m != nil {
		return cleanText(m[1])
	}
	return ""
}

func normalizeINFATaxRate(rate string) string {
	switch cleanText(rate) {
	case "24%":
		return "RATE_24"
	case "22%":
		return "RATE_22"
	case "20%":
		return "RATE_20"
	case "13%":
		return "RATE_13"
	case "9%":
		return "RATE_9"
	case "5%":
		return "RATE_5"
	case "Erikord 24%":
		return "RATE_24_SPECIAL"
	case "Erikord 22%":
		return "RATE_22_SPECIAL"
	case "Erikord 20%":
		return "RATE_20_SPECIAL"
	case "Erikord 9%":
		return "RATE_9_SPECIAL"
	case "Erikord 5%":
		return "RATE_5_SPECIAL"
	default:
		return cleanText(rate)
	}
}

func normalizeINFACommentCode(code string) string {
	switch cleanText(code) {
	case "01":
		return "check105"
	case "02":
		return "check106"
	case "03":
		return "check107"
	default:
		return cleanText(code)
	}
}

func normalizeINFBCommentCode(code string) string {
	switch cleanText(code) {
	case "11":
		return "check134"
	case "12":
		return "check135"
	default:
		return cleanText(code)
	}
}

func parseProviderForm(html string) (action, authst string, err error) {
	re := regexp.MustCompile(`action="(provider=[^"]+)"[^>]*>[\s\S]*?name="authst"\s+value="([^"]+)"`)
	m := re.FindStringSubmatch(html)
	if m == nil {
		return "", "", fmt.Errorf("could not find KMD provider form on login page")
	}
	return m[1], m[2], nil
}

func mergeINFARows(existing, patch []KMDINFARow) ([]KMDINFARow, bool, error) {
	merged := append([]KMDINFARow(nil), existing...)
	changed := false
	for _, row := range patch {
		matches := 0
		matchIdx := -1
		for i, item := range merged {
			if item.PartnerCode == row.PartnerCode && item.InvoiceNumber == row.InvoiceNumber {
				matches++
				matchIdx = i
			}
		}
		if matches > 1 {
			return nil, false, fmt.Errorf("multiple INF A rows matched %s / %s", row.PartnerCode, row.InvoiceNumber)
		}
		if matches == 1 {
			if !equalINFARow(merged[matchIdx], row) {
				merged[matchIdx] = row
				changed = true
			}
			continue
		}
		merged = append(merged, row)
		changed = true
	}
	return merged, changed, nil
}

func mergeINFBRows(existing, patch []KMDINFBRow) ([]KMDINFBRow, bool, error) {
	merged := append([]KMDINFBRow(nil), existing...)
	changed := false
	for _, row := range patch {
		matches := 0
		matchIdx := -1
		for i, item := range merged {
			if item.PartnerCode == row.PartnerCode && item.InvoiceNumber == row.InvoiceNumber {
				matches++
				matchIdx = i
			}
		}
		if matches > 1 {
			return nil, false, fmt.Errorf("multiple INF B rows matched %s / %s", row.PartnerCode, row.InvoiceNumber)
		}
		if matches == 1 {
			if !equalINFBRow(merged[matchIdx], row) {
				merged[matchIdx] = row
				changed = true
			}
			continue
		}
		merged = append(merged, row)
		changed = true
	}
	return merged, changed, nil
}

func equalINFARow(a, b KMDINFARow) bool {
	return a.PartnerCode == b.PartnerCode &&
		a.PartnerName == b.PartnerName &&
		a.InvoiceNumber == b.InvoiceNumber &&
		a.InvoiceDate == b.InvoiceDate &&
		a.InvoiceSum == b.InvoiceSum &&
		a.TaxRate == b.TaxRate &&
		a.SumForRateInPeriod == b.SumForRateInPeriod &&
		strings.Join(a.CommentCodes, ",") == strings.Join(b.CommentCodes, ",")
}

func equalINFBRow(a, b KMDINFBRow) bool {
	return a.PartnerCode == b.PartnerCode &&
		a.PartnerName == b.PartnerName &&
		a.InvoiceNumber == b.InvoiceNumber &&
		a.InvoiceDate == b.InvoiceDate &&
		a.InvoiceSumVAT == b.InvoiceSumVAT &&
		a.VATInPeriod == b.VATInPeriod &&
		strings.Join(a.CommentCodes, ",") == strings.Join(b.CommentCodes, ",")
}

func deleteINFARow(existing []KMDINFARow, partnerCode, invoiceNumber string) ([]KMDINFARow, bool, error) {
	filtered := make([]KMDINFARow, 0, len(existing))
	matches := 0
	for _, row := range existing {
		if row.PartnerCode == partnerCode && row.InvoiceNumber == invoiceNumber {
			matches++
			continue
		}
		filtered = append(filtered, row)
	}
	if matches > 1 {
		return nil, false, fmt.Errorf("multiple INF A rows matched %s / %s", partnerCode, invoiceNumber)
	}
	if matches == 0 {
		return existing, false, nil
	}
	return filtered, true, nil
}

func deleteINFBRow(existing []KMDINFBRow, partnerCode, invoiceNumber string) ([]KMDINFBRow, bool, error) {
	filtered := make([]KMDINFBRow, 0, len(existing))
	matches := 0
	for _, row := range existing {
		if row.PartnerCode == partnerCode && row.InvoiceNumber == invoiceNumber {
			matches++
			continue
		}
		filtered = append(filtered, row)
	}
	if matches > 1 {
		return nil, false, fmt.Errorf("multiple INF B rows matched %s / %s", partnerCode, invoiceNumber)
	}
	if matches == 0 {
		return existing, false, nil
	}
	return filtered, true, nil
}

func isInteger(s string) bool {
	_, err := strconv.Atoi(strings.TrimSpace(s))
	return err == nil
}

func parseStableKMDPeriod(declarationID string) (int, int) {
	parts := strings.SplitN(declarationID, "|", 2)
	if len(parts) == 0 {
		return 0, 0
	}
	period := strings.SplitN(parts[0], "-", 2)
	if len(period) != 2 {
		return 0, 0
	}
	year, _ := strconv.Atoi(period[0])
	month, _ := strconv.Atoi(period[1])
	return year, month
}

func resolveKMDDeclarationLink(html, declarationID string) (string, error) {
	items, err := parseKMDList(html)
	if err != nil {
		return "", err
	}
	for _, item := range items {
		if declarationID == item.DeclarationID || declarationID == item.UpdateID || declarationID == item.ViewID {
			if item.UpdateID != "" {
				return item.UpdateID, nil
			}
			if item.ViewID != "" {
				return item.ViewID, nil
			}
		}
	}
	return "", fmt.Errorf("KMD declaration %q not found in current list", declarationID)
}

func makeKMDStableID(item KMDListItem) string {
	parts := []string{
		fmt.Sprintf("%04d-%02d", item.Year, item.Month),
		sanitizeStableID(item.DocumentType),
		sanitizeStableID(item.Status),
	}
	if item.SubmittedDate != "" {
		parts = append(parts, sanitizeStableID(item.SubmittedDate))
	}
	return strings.Join(parts, "|")
}

func sanitizeStableID(s string) string {
	s = cleanText(strings.ToLower(s))
	replacer := strings.NewReplacer(" ", "_", ".", "-", "/", "-", "ä", "a", "ö", "o", "õ", "o", "ü", "u", "š", "s", "ž", "z")
	return replacer.Replace(s)
}
