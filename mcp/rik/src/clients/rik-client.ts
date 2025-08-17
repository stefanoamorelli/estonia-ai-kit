import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';
import { CompanyData, CompanySearchParams, AnnualReport, BoardMember } from '../types/index.js';

export class RIKApiClient {
  private client: AxiosInstance;
  private cache: NodeCache;
  private readonly ARIREGISTER_API = 'https://ariregister.rik.ee';
  private readonly AVAANDMED_API = 'https://avaandmed.ariregister.rik.ee/en';

  constructor() {
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Estonia-AI-Kit-RIK-MCP/1.0',
        'Accept': 'application/json, text/html',
      },
    });

    this.cache = new NodeCache({ 
      stdTTL: 600,
      checkperiod: 120 
    });
  }

  async searchCompanies(params: CompanySearchParams): Promise<any> {
    const cacheKey = `search_${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const searchParams = new URLSearchParams();
    if (params.query) searchParams.append('search', params.query);
    if (params.registryCode) searchParams.append('code', params.registryCode);
    if (params.name) searchParams.append('name', params.name);
    if (params.status) searchParams.append('status', params.status);
    if (params.address) searchParams.append('address', params.address);

    try {
      const response = await this.client.get(
        `${this.ARIREGISTER_API}/eng/company_search?${searchParams}`
      );
      
      const results = this.parseSearchResults(response.data);
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      throw new Error(`Failed to search companies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCompanyDetails(registryCode: string): Promise<CompanyData> {
    const cacheKey = `details_${registryCode}`;
    const cached = this.cache.get<CompanyData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(
        `${this.ARIREGISTER_API}/eng/company/${registryCode}`
      );
      
      const details = this.parseCompanyDetails(response.data);
      this.cache.set(cacheKey, details);
      return details;
    } catch (error) {
      throw new Error(`Failed to get company details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAnnualReports(registryCode: string): Promise<AnnualReport[]> {
    const cacheKey = `reports_${registryCode}`;
    const cached = this.cache.get<AnnualReport[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(
        `${this.ARIREGISTER_API}/eng/company/${registryCode}/annual_reports`
      );
      
      const reports = this.parseAnnualReports(response.data);
      this.cache.set(cacheKey, reports);
      return reports;
    } catch (error) {
      throw new Error(`Failed to get annual reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBoardMembers(registryCode: string): Promise<BoardMember[]> {
    const cacheKey = `board_${registryCode}`;
    const cached = this.cache.get<BoardMember[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(
        `${this.ARIREGISTER_API}/eng/company/${registryCode}/participants`
      );
      
      const members = this.parseBoardMembers(response.data);
      this.cache.set(cacheKey, members);
      return members;
    } catch (error) {
      throw new Error(`Failed to get board members: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkTaxDebt(registryCode: string): Promise<boolean> {
    try {
      const response = await this.client.get(
        `${this.ARIREGISTER_API}/eng/company/${registryCode}/tax_debt`
      );
      
      return this.parseTaxDebtStatus(response.data);
    } catch (error) {
      throw new Error(`Failed to check tax debt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchByPerson(name?: string, personalCode?: string): Promise<any> {
    if (!name && !personalCode) {
      throw new Error('Either name or personalCode must be provided');
    }

    const cacheKey = `person_${name}_${personalCode}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const searchParams = new URLSearchParams();
      if (name) searchParams.append('person_name', name);
      if (personalCode) searchParams.append('person_code', personalCode);

      const response = await this.client.get(
        `${this.ARIREGISTER_API}/eng/participant_search?${searchParams}`
      );
      
      const results = this.parsePersonSearchResults(response.data);
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      throw new Error(`Failed to search by person: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getCompanyExtractUrl(registryCode: string, language: 'et' | 'en' = 'en'): string {
    const lang = language === 'et' ? 'est' : 'eng';
    return `${this.ARIREGISTER_API}/${lang}/company/${registryCode}/registry_card`;
  }

  private parseSearchResults(html: string): any[] {
    return [];
  }

  private parseCompanyDetails(html: string): CompanyData {
    return {
      registry_code: '',
      name: '',
      status: '',
      status_text: '',
      address: '',
    };
  }

  private parseAnnualReports(html: string): AnnualReport[] {
    return [];
  }

  private parseBoardMembers(html: string): BoardMember[] {
    return [];
  }

  private parseTaxDebtStatus(html: string): boolean {
    return false;
  }

  private parsePersonSearchResults(html: string): any[] {
    return [];
  }
}