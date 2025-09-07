import { RIKApiClient } from '../clients/rik-client.js';
import { RIKOpenDataClient } from '../clients/rik-open-data-client.js';
import { CompanySearchParams } from '../types/index.js';

export class CompanyHandlers {
  private client: RIKApiClient | RIKOpenDataClient;

  constructor(client: RIKApiClient | RIKOpenDataClient) {
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
    if ('getCompanyExtractUrl' in this.client) {
      const extractUrl = this.client.getCompanyExtractUrl(registryCode, language);
      return {
        registry_code: registryCode,
        extract_url: extractUrl,
        language,
        note: 'Visit the URL to download the official registry card PDF',
      };
    } else {
      return {
        registry_code: registryCode,
        extract_url: `https://ariregister.rik.ee/${language === 'et' ? 'est' : 'eng'}/company/${registryCode}/registry_card`,
        language,
        note: 'Visit the URL to download the official registry card PDF',
      };
    }
  }

  async getAnnualReports(registryCode: string) {
    if ('getAnnualReports' in this.client) {
      const reports = await this.client.getAnnualReports(registryCode);
      return {
        success: true,
        registry_code: registryCode,
        count: reports.length,
        reports,
      };
    } else {
      return {
        success: false,
        registry_code: registryCode,
        message: 'Annual reports data not available in open data files. Please use the web portal.',
        portal_url: `https://ariregister.rik.ee/eng/company/${registryCode}/annual_reports`,
      };
    }
  }

  async checkTaxDebt(registryCode: string) {
    if ('checkTaxDebt' in this.client) {
      const hasTaxDebt = await this.client.checkTaxDebt(registryCode);
      return {
        registry_code: registryCode,
        has_tax_debt: hasTaxDebt,
        checked_at: new Date().toISOString(),
      };
    } else {
      return {
        registry_code: registryCode,
        message:
          'Tax debt information is not available in open data. This requires EMTA authentication.',
        checked_at: new Date().toISOString(),
      };
    }
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
