import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';
import * as cheerio from 'cheerio';
import { CompanyData, CompanySearchParams, AnnualReport, BoardMember } from '../types/index.js';

export class RIKApiClient {
  private client: AxiosInstance;
  private cache: NodeCache;
  private readonly ARIREGISTER_API = 'https://ariregister.rik.ee';
  private readonly AVAANDMED_API = 'https://avaandmed.ariregister.rik.ee/en';

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      maxRedirects: 10,
      validateStatus: (status) => status < 500,
    });

    this.cache = new NodeCache({
      stdTTL: 600,
      checkperiod: 120,
    });
  }

  async searchCompanies(params: CompanySearchParams): Promise<any> {
    const cacheKey = `search_${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      // First approach: Try direct URL construction for known registry codes
      if (params.registryCode) {
        const directUrl = `${this.ARIREGISTER_API}/eng/company/${params.registryCode}`;
        const response = await this.client.get(directUrl);

        if (response.status === 200) {
          const results = this.parseDirectCompanyPage(response.data, params.registryCode);
          if (results.length > 0) {
            this.cache.set(cacheKey, results);
            return results;
          }
        }
      }

      // Fallback: Use search form
      const searchParams = new URLSearchParams();
      if (params.registryCode) {
        searchParams.append('s__company_registry_code', params.registryCode);
      }
      if (params.name) {
        searchParams.append('s__company_name', params.name);
      }
      if (params.query) {
        searchParams.append('search', params.query);
        searchParams.append('search_type', 'all');
      }
      searchParams.append('submit_search', '1');

      const response = await this.client.get(
        `${this.ARIREGISTER_API}/eng/company_search?${searchParams}`
      );

      const results = this.parseSearchResults(response.data);
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      throw new Error(
        `Failed to search companies: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getCompanyDetails(registryCode: string): Promise<CompanyData> {
    const cacheKey = `details_${registryCode}`;
    const cached = this.cache.get<CompanyData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(`${this.ARIREGISTER_API}/eng/company/${registryCode}`);

      if (response.status !== 200) {
        throw new Error(`Company not found: ${registryCode}`);
      }

      const details = this.parseCompanyDetails(response.data, registryCode);
      this.cache.set(cacheKey, details);
      return details;
    } catch (error) {
      throw new Error(
        `Failed to get company details: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
      throw new Error(
        `Failed to get annual reports: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
      throw new Error(
        `Failed to get board members: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async checkTaxDebt(registryCode: string): Promise<boolean> {
    try {
      const response = await this.client.get(
        `${this.ARIREGISTER_API}/eng/company/${registryCode}/tax_debt`
      );

      return this.parseTaxDebtStatus(response.data);
    } catch (error) {
      throw new Error(
        `Failed to check tax debt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
      throw new Error(
        `Failed to search by person: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  getCompanyExtractUrl(registryCode: string, language: 'et' | 'en' = 'en'): string {
    const lang = language === 'et' ? 'est' : 'eng';
    return `${this.ARIREGISTER_API}/${lang}/company/${registryCode}/registry_card`;
  }

  private parseDirectCompanyPage(html: string, registryCode: string): any[] {
    const $ = cheerio.load(html);

    // Check if we're on the search form page (not found)
    if ($('form#search_form').length > 0 && !html.includes(registryCode)) {
      return [];
    }

    // Extract basic company info from the page
    const title = $('title').text();
    const pageText = $('body').text();

    // If the registry code appears in the page, we likely have company data
    if (pageText.includes(registryCode)) {
      return [
        {
          registry_code: registryCode,
          name: 'Company data available - Please use specific methods for detailed information',
          status: 'Found',
          url: `${this.ARIREGISTER_API}/eng/company/${registryCode}`,
        },
      ];
    }

    return [];
  }

  private parseSearchResults(html: string): any[] {
    const $ = cheerio.load(html);
    const results: any[] = [];

    // Look for company links in search results
    $('a[href*="/eng/company/"]').each((i, elem) => {
      const link = $(elem);
      const href = link.attr('href');
      const text = link.text().trim();

      if (href && text && !text.includes('Search')) {
        const registryCodeMatch = href.match(/\/company\/(\d+)/);
        if (registryCodeMatch) {
          results.push({
            registry_code: registryCodeMatch[1],
            name: text,
            url: `${this.ARIREGISTER_API}${href}`,
          });
        }
      }
    });

    // Also look for table-based results
    $('table')
      .find('tr')
      .each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const possibleCode = cells.eq(0).text().trim();
          const possibleName = cells.eq(1).text().trim();

          if (/^\d{8}$/.test(possibleCode)) {
            results.push({
              registry_code: possibleCode,
              name: possibleName || 'Unknown',
              status: cells.eq(2)?.text().trim() || 'Unknown',
            });
          }
        }
      });

    return results;
  }

  private parseCompanyDetails(html: string, registryCode: string): CompanyData {
    const $ = cheerio.load(html);

    // Default structure
    const details: CompanyData = {
      registry_code: registryCode,
      name: '',
      status: '',
      status_text: '',
      address: '',
    };

    // Try to extract company name from title or headings
    const title = $('title').text();
    const titleMatch = title.match(/^(.+?)\s*[\|–-]/);
    if (titleMatch) {
      details.name = titleMatch[1].trim();
    }

    // Look for company name in h1 or similar
    $('h1, .company_display_name, .company-name').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && !text.includes('Search') && !details.name) {
        details.name = text;
      }
    });

    // Extract data from definition lists or tables
    $('dt, th').each((i, elem) => {
      const label = $(elem).text().trim().toLowerCase();
      const value = $(elem).next('dd, td').text().trim();

      if (label.includes('status') && value) {
        details.status = value.substring(0, 10);
        details.status_text = value;
      } else if (label.includes('address') && value) {
        details.address = value;
      } else if (label.includes('name') && value && !details.name) {
        details.name = value;
      }
    });

    // Fallback: if we still don't have a name, use a placeholder
    if (!details.name) {
      details.name = `Company ${registryCode}`;
    }

    return details;
  }

  private parseAnnualReports(html: string): AnnualReport[] {
    const $ = cheerio.load(html);
    const reports: AnnualReport[] = [];

    // Look for report links or table rows
    $('a[href*="annual_report"], a[href*="aruanne"]').each((i, elem) => {
      const link = $(elem);
      const href = link.attr('href');
      const text = link.text().trim();

      // Extract year from text or href
      const yearMatch = (text + href).match(/20\d{2}/);
      if (yearMatch) {
        reports.push({
          year: parseInt(yearMatch[0]),
          submitted_date: new Date().toISOString().split('T')[0],
          status: 'Submitted',
          document_url: href?.startsWith('http') ? href : `${this.ARIREGISTER_API}${href}`,
        });
      }
    });

    // Look for table-based report listings
    $('table')
      .find('tr')
      .each((i, row) => {
        const cells = $(row).find('td');
        const rowText = cells.text();

        const yearMatch = rowText.match(/20\d{2}/);
        if (yearMatch && rowText.toLowerCase().includes('report')) {
          reports.push({
            year: parseInt(yearMatch[0]),
            submitted_date: new Date().toISOString().split('T')[0],
            status: rowText.toLowerCase().includes('missing') ? 'Missing' : 'Submitted',
          });
        }
      });

    return reports;
  }

  private parseBoardMembers(html: string): BoardMember[] {
    const $ = cheerio.load(html);
    const members: BoardMember[] = [];

    // Look for participant/member tables
    $('table')
      .find('tr')
      .each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const name = cells.eq(0).text().trim();
          const role = cells.eq(1).text().trim();

          if (name && !name.includes('Name') && role) {
            const startDate = cells.eq(2)?.text().trim();
            members.push({
              name,
              role,
              start_date: startDate || new Date().toISOString().split('T')[0],
            });
          }
        }
      });

    // Also look for list-based member displays
    $('.participant, .board-member, [class*="member"]').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length < 200) {
        // Try to parse "Name - Role" format
        const parts = text.split(/[-–—]/);
        if (parts.length >= 2) {
          members.push({
            name: parts[0].trim(),
            role: parts[1].trim(),
            start_date: new Date().toISOString().split('T')[0],
          });
        }
      }
    });

    return members;
  }

  private parseTaxDebtStatus(html: string): boolean {
    const $ = cheerio.load(html);
    const pageText = $('body').text().toLowerCase();

    // Check for indicators of tax debt
    if (pageText.includes('no tax debt') || pageText.includes('ei ole maksuvõlga')) {
      return false;
    }
    if (pageText.includes('has tax debt') || pageText.includes('maksuvõlg')) {
      return true;
    }

    // Default to false if we can't determine
    return false;
  }

  private parsePersonSearchResults(html: string): any[] {
    const $ = cheerio.load(html);
    const results: any[] = [];

    // Look for person-company associations
    $('a[href*="/company/"]').each((i, elem) => {
      const link = $(elem);
      const href = link.attr('href');
      const companyName = link.text().trim();

      // Look for role information nearby
      const parent = link.parent();
      const parentText = parent.text();

      if (href && companyName) {
        const registryCodeMatch = href.match(/\/company\/(\d+)/);
        results.push({
          company_name: companyName,
          registry_code: registryCodeMatch ? registryCodeMatch[1] : '',
          role: parentText.replace(companyName, '').trim() || 'Associated',
          url: href.startsWith('http') ? href : `${this.ARIREGISTER_API}${href}`,
        });
      }
    });

    return results;
  }
}
