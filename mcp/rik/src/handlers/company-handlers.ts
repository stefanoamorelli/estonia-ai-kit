import { RIKApiClient } from '../clients/rik-client.js';
import { CompanySearchParams } from '../types/index.js';

export class CompanyHandlers {
  private client: RIKApiClient;

  constructor(client: RIKApiClient) {
    this.client = client;
  }

  async searchCompany(params: CompanySearchParams) {
    const results = await this.client.searchCompanies(params);
    return {
      success: true,
      count: results.length,
      results,
    };
  }

  async getCompanyDetails(registryCode: string) {
    const details = await this.client.getCompanyDetails(registryCode);
    return {
      success: true,
      data: details,
    };
  }

  async getCompanyExtract(registryCode: string, language: 'et' | 'en' = 'en') {
    const extractUrl = this.client.getCompanyExtractUrl(registryCode, language);
    return {
      registry_code: registryCode,
      extract_url: extractUrl,
      language,
      note: 'Visit the URL to download the official registry card PDF',
    };
  }

  async getAnnualReports(registryCode: string) {
    const reports = await this.client.getAnnualReports(registryCode);
    return {
      success: true,
      registry_code: registryCode,
      count: reports.length,
      reports,
    };
  }

  async checkTaxDebt(registryCode: string) {
    const hasTaxDebt = await this.client.checkTaxDebt(registryCode);
    return {
      registry_code: registryCode,
      has_tax_debt: hasTaxDebt,
      checked_at: new Date().toISOString(),
    };
  }

  async getBoardMembers(registryCode: string) {
    const members = await this.client.getBoardMembers(registryCode);
    return {
      success: true,
      registry_code: registryCode,
      count: members.length,
      members,
    };
  }

  async searchByPerson(name?: string, personalCode?: string) {
    const results = await this.client.searchByPerson(name, personalCode);
    return {
      success: true,
      search_criteria: { name, personalCode },
      count: results.length,
      results,
    };
  }
}
