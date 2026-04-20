package api

import (
	"strings"
	"testing"
)

func TestParseKMDList(t *testing.T) {
	html := `
<table>
  <tr>
    <td><div>1</div></td>
    <td><div>25.02.2026</div></td>
    <td><div>2026</div></td>
    <td><div>1</div></td>
    <td><div>Esitatud</div></td>
    <td><div>Deklaratsioon</div></td>
    <td><div>Example User</div></td>
    <td><div>Ei</div></td>
    <td><a href="./declarations?1-1.ILinkListener-contentPanel-contentComponent-vat_declarations-1-view">Vaata</a></td>
    <td><a href="./declarations?1-1.ILinkListener-contentPanel-contentComponent-vat_declarations-1-edit">Paranda</a></td>
  </tr>
</table>`

	items, err := parseKMDList(html)
	if err != nil {
		t.Fatalf("parseKMDList returned error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if items[0].DeclarationID != "2026-01|deklaratsioon|esitatud|25-02-2026" {
		t.Fatalf("unexpected declaration id: %q", items[0].DeclarationID)
	}
	if items[0].UpdateID != "./declarations?1-1.ILinkListener-contentPanel-contentComponent-vat_declarations-1-edit" {
		t.Fatalf("unexpected update id: %q", items[0].UpdateID)
	}
	if items[0].Year != 2026 || items[0].Month != 1 {
		t.Fatalf("unexpected period: %+v", items[0])
	}
}

func TestParseKMDMainSection(t *testing.T) {
	html := `
<div id="feedbackPanel" class="emta-error"><span id="id67">Saved ok</span></div>
<form id="id65" method="post" action="./page?3-1.IFormSubmitListener-contentPanel-contentComponent-kmd~tabs-panel-vatDeclarationForm">
<input type="hidden" name="id65_hf_0" id="id65_hf_0" />
<input type="checkbox" name="noSalesData:noSales"/>
<input type="checkbox" name="noPurchData:noPurchases" checked="checked"/>
<input type="text" name="transactionsWithRate24Data:transactionsWithRate24" value="6 471,00"/>
<input type="text" name="inputVatTotal" value="317,03"/>
<input type="text" name="euAcquisitionsGoodsTotal" value="218,99"/>
<input type="text" name="acquisitionOtherGoodsTotal" value="5,09"/>
<input type="text" name="vatTotal" value="1 553,04" disabled="disabled"/>
<input type="text" name="vatPayable" value="1 236,01" disabled="disabled"/>
<input type="submit" name="saveButton" id="id64" value="Salvesta"/>
</form>`

	section, err := parseKMDMainSection(html)
	if err != nil {
		t.Fatalf("parseKMDMainSection returned error: %v", err)
	}
	if section.Fields.TransactionsWithRate24 != "6 471,00" {
		t.Fatalf("unexpected line 1 value: %q", section.Fields.TransactionsWithRate24)
	}
	if !section.Flags.NoPurchases {
		t.Fatal("expected no purchases flag to be true")
	}
	if section.Computed.VATPayable != "1 236,01" {
		t.Fatalf("unexpected payable VAT: %q", section.Computed.VATPayable)
	}
	if len(section.Messages) != 1 || section.Messages[0] != "Saved ok" {
		t.Fatalf("unexpected messages: %+v", section.Messages)
	}
	if !strings.Contains(section.FormAction, "vatDeclarationForm") {
		t.Fatalf("unexpected form action: %q", section.FormAction)
	}
}

func TestDeriveWicketBehaviorURL(t *testing.T) {
	got := deriveWicketBehaviorURL("./page?3-1.IFormSubmitListener-contentPanel-contentComponent-kmd~tabs-panel-vatDeclarationForm", "saveButton")
	want := "./page?3-1.IBehaviorListener.0-contentPanel-contentComponent-kmd~tabs-panel-vatDeclarationForm-saveButton"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestMergeINFARowsUpdatesExistingMatch(t *testing.T) {
	existing := []KMDINFARow{{
		PartnerCode: "10000000", PartnerName: "Old", InvoiceNumber: "INV1", InvoiceDate: "01.01.2026", InvoiceSum: "10,00", TaxRate: "24%", SumForRateInPeriod: "10,00",
	}}
	patch := []KMDINFARow{{
		PartnerCode: "10000000", PartnerName: "New", InvoiceNumber: "INV1", InvoiceDate: "01.01.2026", InvoiceSum: "11,00", TaxRate: "24%", SumForRateInPeriod: "11,00",
	}}

	merged, changed, err := mergeINFARows(existing, patch)
	if err != nil {
		t.Fatalf("mergeINFARows returned error: %v", err)
	}
	if !changed {
		t.Fatal("expected changed to be true")
	}
	if len(merged) != 1 || merged[0].PartnerName != "New" || merged[0].InvoiceSum != "11,00" {
		t.Fatalf("unexpected merged rows: %+v", merged)
	}
}

func TestMergeINFBRowsAppendsNewRow(t *testing.T) {
	existing := []KMDINFBRow{{
		PartnerCode: "A", InvoiceNumber: "1",
	}}
	patch := []KMDINFBRow{{
		PartnerCode: "B", InvoiceNumber: "2",
	}}

	merged, changed, err := mergeINFBRows(existing, patch)
	if err != nil {
		t.Fatalf("mergeINFBRows returned error: %v", err)
	}
	if !changed || len(merged) != 2 {
		t.Fatalf("unexpected merge result: changed=%v rows=%+v", changed, merged)
	}
}

func TestParseKMDINFASection(t *testing.T) {
	html := `
<form action="./page?3-1.IFormSubmitListener-contentPanel-contentComponent-kmd~tabs-panel-salesPanelBody-addSaleLineForm"></form>
<form action="./page?3-1.IFormSubmitListener-contentPanel-contentComponent-kmd~tabs-panel-salesPanelBody-saleLinesForm"></form>
<table>
  <tr>
    <td>1</td>
    <td>10000000</td>
    <td>EXAMPLE CUSTOMER OÜ</td>
    <td>INV-2026-001</td>
    <td>27.02.2026</td>
    <td>6 471,00</td>
    <td>24%</td>
    <td>6 471,00</td>
  </tr>
</table>`

	rows, err := parseKMDINFASection(html)
	if err != nil {
		t.Fatalf("parseKMDINFASection returned error: %v", err)
	}
	if rows.AddFormAction == "" || rows.ListFormAction == "" {
		t.Fatalf("expected form actions, got %+v", rows)
	}
	if len(rows.Rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(rows.Rows))
	}
	if rows.Rows[0].InvoiceNumber != "INV-2026-001" {
		t.Fatalf("unexpected row: %+v", rows.Rows[0])
	}
}

func TestParseKMDINFBSection(t *testing.T) {
	html := `
<form action="./page?3-1.IFormSubmitListener-contentPanel-contentComponent-kmd~tabs-panel-purchasesPanelBody-addPurchaseLineForm"></form>
<form action="./page?3-1.IFormSubmitListener-contentPanel-contentComponent-kmd~tabs-panel-purchasesPanelBody-purchaseLinesForm"></form>
<table>
  <tr>
    <td>1</td>
    <td>10000001</td>
    <td>Example Supplier OÜ</td>
    <td>INV-123</td>
    <td>15.03.2026</td>
    <td>124,00</td>
    <td>24,00</td>
  </tr>
</table>`

	rows, err := parseKMDINFBSection(html)
	if err != nil {
		t.Fatalf("parseKMDINFBSection returned error: %v", err)
	}
	if rows.AddFormAction == "" || rows.ListFormAction == "" {
		t.Fatalf("expected form actions, got %+v", rows)
	}
	if len(rows.Rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(rows.Rows))
	}
	if rows.Rows[0].InvoiceNumber != "INV-123" {
		t.Fatalf("unexpected row: %+v", rows.Rows[0])
	}
}

func TestMergeINFARowsNoChange(t *testing.T) {
	existing := []KMDINFARow{{
		PartnerCode: "10000000", PartnerName: "EXAMPLE CUSTOMER OÜ", InvoiceNumber: "INV-2026-001", InvoiceDate: "27.02.2026", InvoiceSum: "6 471,00", TaxRate: "24%", SumForRateInPeriod: "6 471,00",
	}}

	merged, changed, err := mergeINFARows(existing, existing)
	if err != nil {
		t.Fatalf("mergeINFARows returned error: %v", err)
	}
	if changed {
		t.Fatal("expected changed to be false")
	}
	if len(merged) != 1 {
		t.Fatalf("unexpected merged rows: %+v", merged)
	}
}

func TestMergeINFARowsAmbiguous(t *testing.T) {
	existing := []KMDINFARow{
		{PartnerCode: "10000000", InvoiceNumber: "A"},
		{PartnerCode: "10000000", InvoiceNumber: "A"},
	}
	_, _, err := mergeINFARows(existing, []KMDINFARow{{PartnerCode: "10000000", InvoiceNumber: "A"}})
	if err == nil {
		t.Fatal("expected ambiguity error")
	}
}

func TestMergeINFBRowsUpdatesExistingMatch(t *testing.T) {
	existing := []KMDINFBRow{{
		PartnerCode: "10000001", PartnerName: "Old", InvoiceNumber: "INV-123", InvoiceDate: "15.03.2026", InvoiceSumVAT: "124,00", VATInPeriod: "24,00",
	}}
	patch := []KMDINFBRow{{
		PartnerCode: "10000001", PartnerName: "New", InvoiceNumber: "INV-123", InvoiceDate: "15.03.2026", InvoiceSumVAT: "248,00", VATInPeriod: "48,00",
	}}

	merged, changed, err := mergeINFBRows(existing, patch)
	if err != nil {
		t.Fatalf("mergeINFBRows returned error: %v", err)
	}
	if !changed {
		t.Fatal("expected changed to be true")
	}
	if len(merged) != 1 || merged[0].PartnerName != "New" || merged[0].VATInPeriod != "48,00" {
		t.Fatalf("unexpected merged rows: %+v", merged)
	}
}
