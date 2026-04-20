package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/stefanoamorelli/estonia-ai-kit/cli/emta/api"
)

func init() {
	var declarationID string
	var inputPath string
	var year int
	var month int
	var submitConfirm bool
	var partnerCode string
	var invoiceNumber string

	kmdCmd := &cobra.Command{
		Use:   "kmd",
		Short: "Käibedeklaratsioon (KMD) operations",
	}

	kmdListCmd := &cobra.Command{
		Use:   "list",
		Short: "List all KMD declarations",
		RunE: func(cmd *cobra.Command, args []string) error {
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}
			items, err := client.ListKMDDeclarations()
			if err != nil {
				return err
			}
			return printJSON(items)
		},
	}

	kmdSubmitCmd := &cobra.Command{
		Use:   "submit",
		Short: "Submit a saved KMD draft by declaration id",
		RunE: func(cmd *cobra.Command, args []string) error {
			if declarationID == "" {
				return fmt.Errorf("--declaration-id is required")
			}
			if !submitConfirm {
				return fmt.Errorf("--confirm is required for submit")
			}
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}
			result, err := client.SubmitKMD(declarationID)
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	kmdSubmitCmd.Flags().StringVar(&declarationID, "declaration-id", "", "Stable declaration id from kmd list")
	kmdSubmitCmd.Flags().BoolVar(&submitConfirm, "confirm", false, "Actually submit the declaration")

	mainCmd := &cobra.Command{
		Use:   "main",
		Short: "KMD base form",
	}

	mainCreateCmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new KMD draft and optionally fill the main form",
		RunE: func(cmd *cobra.Command, args []string) error {
			if year == 0 || month == 0 {
				return fmt.Errorf("--year and --month are required")
			}
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}

			section, err := client.CreateKMDDraft(year, month)
			if err != nil {
				return err
			}

			if inputPath != "" {
				var patch api.KMDMainPatch
				if err := readJSONFile(inputPath, &patch); err != nil {
					return err
				}

				items, err := client.ListKMDDeclarations()
				if err != nil {
					return err
				}
				declarationID = findDraftDeclarationID(items, year, month)
				if declarationID == "" {
					return fmt.Errorf("created draft for %04d-%02d but could not resolve declaration id from list", year, month)
				}

				section, err = client.UpdateKMDMain(declarationID, patch)
				if err != nil {
					return err
				}
			}

			if section.DeclarationID == "" {
				items, err := client.ListKMDDeclarations()
				if err == nil {
					section.DeclarationID = findDraftDeclarationID(items, year, month)
				}
			}

			return printJSON(section)
		},
	}
	mainCreateCmd.Flags().StringVar(&inputPath, "input", "", "Path to KMD main JSON input")
	mainCreateCmd.Flags().IntVar(&year, "year", 0, "Tax year")
	mainCreateCmd.Flags().IntVar(&month, "month", 0, "Tax month (1-12)")

	mainReadCmd := &cobra.Command{
		Use:   "read",
		Short: "Read KMD main form by declaration id",
		RunE: func(cmd *cobra.Command, args []string) error {
			if declarationID == "" {
				return fmt.Errorf("--declaration-id is required")
			}
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}
			section, err := client.ReadKMDMain(declarationID)
			if err != nil {
				return err
			}
			return printJSON(section)
		},
	}
	mainReadCmd.Flags().StringVar(&declarationID, "declaration-id", "", "Opaque declaration id from kmd list")

	mainUpdateCmd := &cobra.Command{
		Use:   "update",
		Short: "Update and save KMD main form by declaration id",
		RunE: func(cmd *cobra.Command, args []string) error {
			if declarationID == "" || inputPath == "" {
				return fmt.Errorf("--declaration-id and --input are required")
			}
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}
			var patch api.KMDMainPatch
			if err := readJSONFile(inputPath, &patch); err != nil {
				return err
			}
			section, err := client.UpdateKMDMain(declarationID, patch)
			if err != nil {
				return err
			}
			return printJSON(section)
		},
	}
	mainUpdateCmd.Flags().StringVar(&declarationID, "declaration-id", "", "Opaque declaration id from kmd list")
	mainUpdateCmd.Flags().StringVar(&inputPath, "input", "", "Path to KMD main JSON input")

	infACmd := &cobra.Command{
		Use:   "inf-a",
		Short: "KMD INF A section",
	}

	infAReadCmd := &cobra.Command{
		Use:   "read",
		Short: "Read KMD INF A rows by declaration id",
		RunE: func(cmd *cobra.Command, args []string) error {
			if declarationID == "" {
				return fmt.Errorf("--declaration-id is required")
			}
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}
			rows, err := client.ReadKMDINFA(declarationID)
			if err != nil {
				return err
			}
			return printJSON(rows)
		},
	}
	infAReadCmd.Flags().StringVar(&declarationID, "declaration-id", "", "Opaque declaration id from kmd list")

	infAUpdateCmd := &cobra.Command{
		Use:   "update",
		Short: "Add/update KMD INF A rows by declaration id",
		RunE: func(cmd *cobra.Command, args []string) error {
			if declarationID == "" || inputPath == "" {
				return fmt.Errorf("--declaration-id and --input are required")
			}
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}
			var patch api.KMDINFAPatch
			if err := readJSONFile(inputPath, &patch); err != nil {
				return err
			}
			rows, err := client.UpdateKMDINFA(declarationID, patch)
			if err != nil {
				return err
			}
			return printJSON(rows)
		},
	}
	infAUpdateCmd.Flags().StringVar(&declarationID, "declaration-id", "", "Opaque declaration id from kmd list")
	infAUpdateCmd.Flags().StringVar(&inputPath, "input", "", "Path to KMD INF A JSON input")

	infADeleteCmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete KMD INF A row by partner code and invoice number",
		RunE: func(cmd *cobra.Command, args []string) error {
			if declarationID == "" || partnerCode == "" || invoiceNumber == "" {
				return fmt.Errorf("--declaration-id, --partner-code and --invoice-number are required")
			}
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}
			rows, err := client.DeleteKMDINFA(declarationID, partnerCode, invoiceNumber)
			if err != nil {
				return err
			}
			return printJSON(rows)
		},
	}
	infADeleteCmd.Flags().StringVar(&declarationID, "declaration-id", "", "Stable declaration id from kmd list")
	infADeleteCmd.Flags().StringVar(&partnerCode, "partner-code", "", "Partner code")
	infADeleteCmd.Flags().StringVar(&invoiceNumber, "invoice-number", "", "Invoice number")

	infBCmd := &cobra.Command{
		Use:   "inf-b",
		Short: "KMD INF B section",
	}

	infBReadCmd := &cobra.Command{
		Use:   "read",
		Short: "Read KMD INF B rows by declaration id",
		RunE: func(cmd *cobra.Command, args []string) error {
			if declarationID == "" {
				return fmt.Errorf("--declaration-id is required")
			}
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}
			rows, err := client.ReadKMDINFB(declarationID)
			if err != nil {
				return err
			}
			return printJSON(rows)
		},
	}
	infBReadCmd.Flags().StringVar(&declarationID, "declaration-id", "", "Opaque declaration id from kmd list")

	infBUpdateCmd := &cobra.Command{
		Use:   "update",
		Short: "Add/update KMD INF B rows by declaration id",
		RunE: func(cmd *cobra.Command, args []string) error {
			if declarationID == "" || inputPath == "" {
				return fmt.Errorf("--declaration-id and --input are required")
			}
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}
			var patch api.KMDINFBPatch
			if err := readJSONFile(inputPath, &patch); err != nil {
				return err
			}
			rows, err := client.UpdateKMDINFB(declarationID, patch)
			if err != nil {
				return err
			}
			return printJSON(rows)
		},
	}
	infBUpdateCmd.Flags().StringVar(&declarationID, "declaration-id", "", "Opaque declaration id from kmd list")
	infBUpdateCmd.Flags().StringVar(&inputPath, "input", "", "Path to KMD INF B JSON input")

	infBDeleteCmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete KMD INF B row by partner code and invoice number",
		RunE: func(cmd *cobra.Command, args []string) error {
			if declarationID == "" || partnerCode == "" || invoiceNumber == "" {
				return fmt.Errorf("--declaration-id, --partner-code and --invoice-number are required")
			}
			client, err := loadEMTAClient()
			if err != nil {
				return err
			}
			rows, err := client.DeleteKMDINFB(declarationID, partnerCode, invoiceNumber)
			if err != nil {
				return err
			}
			return printJSON(rows)
		},
	}
	infBDeleteCmd.Flags().StringVar(&declarationID, "declaration-id", "", "Stable declaration id from kmd list")
	infBDeleteCmd.Flags().StringVar(&partnerCode, "partner-code", "", "Partner code")
	infBDeleteCmd.Flags().StringVar(&invoiceNumber, "invoice-number", "", "Invoice number")

	mainCmd.AddCommand(mainCreateCmd, mainReadCmd, mainUpdateCmd)
	infACmd.AddCommand(infAReadCmd, infAUpdateCmd, infADeleteCmd)
	infBCmd.AddCommand(infBReadCmd, infBUpdateCmd, infBDeleteCmd)
	kmdCmd.AddCommand(kmdListCmd, kmdSubmitCmd, mainCmd, infACmd, infBCmd)
	rootCmd.AddCommand(kmdCmd)
}

func loadEMTAClient() (*api.Client, error) {
	session, err := loadSession()
	if err != nil {
		return nil, err
	}
	return api.NewClient(session), nil
}

func printJSON(v any) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

func readJSONFile(path string, target any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("parsing %s: %w", path, err)
	}
	return nil
}

func findDraftDeclarationID(items []api.KMDListItem, year, month int) string {
	for _, item := range items {
		if item.Year == year && item.Month == month && item.UpdateID != "" && !strings.EqualFold(item.Status, "Esitatud") {
			return item.UpdateID
		}
	}
	for _, item := range items {
		if item.Year == year && item.Month == month && item.UpdateID != "" {
			return item.UpdateID
		}
	}
	return ""
}
