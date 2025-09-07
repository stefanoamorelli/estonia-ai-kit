import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as zlib from 'zlib';
import { parse } from 'csv-parse';
import { CompanyData, CompanySearchParams, AnnualReport, BoardMember } from '../types/index.js';

interface OpenDataFile {
  name: string;
  url: string;
  format: 'csv' | 'json' | 'xml';
  description: string;
  updateFrequency: string;
}

interface CompanyBasicData {
  ariregistri_kood: string;
  nimi?: string;
  ' nimi'?: string; // BOM issue
  ettevotja_staatus: string;
  ettevotja_staatus_tekstina: string;
  ettevotja_aadress: string;
  asukoht_ettevotja_aadressis?: string;
  indeks_ettevotja_aadressis?: string;
  kmkr_nr?: string;
  ettevotja_oiguslik_vorm?: string;
  // Legacy field names (for compatibility)
  staatus?: string;
  staatus_tekstina?: string;
  aadress?: string;
}

export class RIKOpenDataClient {
  private client: AxiosInstance;
  private cache: NodeCache;
  private dataCache: NodeCache;
  private readonly BASE_URL = 'https://avaandmed.ariregister.rik.ee';
  private readonly DATA_DIR = path.join(process.cwd(), '.rik-data');
  
  private readonly OPEN_DATA_FILES: OpenDataFile[] = [
    {
      name: 'basic_data',
      url: '/sites/default/files/avaandmed/ettevotja_rekvisiidid__lihtandmed.csv.zip',
      format: 'csv',
      description: 'Basic company data - registry code, name, status, address',
      updateFrequency: 'daily'
    },
    {
      name: 'general_data',
      url: '/sites/default/files/avaandmed/ettevotja_rekvisiidid__yldandmed.json.zip',
      format: 'json',
      description: 'General company information including activity areas',
      updateFrequency: 'daily'
    },
    {
      name: 'registry_cards',
      url: '/sites/default/files/avaandmed/ettevotja_rekvisiidid__registrikaardid.json.zip',
      format: 'json',
      description: 'Detailed registry card information',
      updateFrequency: 'daily'
    },
    {
      name: 'board_members',
      url: '/sites/default/files/avaandmed/ettevotja_rekvisiidid__kaardile_kantud_isikud.json.zip',
      format: 'json',
      description: 'Board members and representatives',
      updateFrequency: 'daily'
    },
    {
      name: 'shareholders',
      url: '/sites/default/files/avaandmed/ettevotja_rekvisiidid__osanikud.json.zip',
      format: 'json',
      description: 'Company shareholders',
      updateFrequency: 'daily'
    },
    {
      name: 'beneficial_owners',
      url: '/sites/default/files/avaandmed/ettevotja_rekvisiidid__kasusaajad.json.zip',
      format: 'json',
      description: 'Beneficial owners information',
      updateFrequency: 'daily'
    }
  ];

  constructor() {
    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 60000,
      headers: {
        'User-Agent': 'Estonia-AI-Kit/1.0',
        'Accept': 'application/json, text/csv, application/zip',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    this.cache = new NodeCache({
      stdTTL: 86400, // 24 hours for file metadata
      checkperiod: 3600
    });

    this.dataCache = new NodeCache({
      stdTTL: 3600, // 1 hour for actual data
      checkperiod: 600
    });
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.DATA_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  private async getDataFilePath(file: OpenDataFile): Promise<string> {
    // Map file names to actual extracted file names
    const fileMapping: Record<string, string> = {
      'basic_data': 'ettevotja_rekvisiidid__lihtandmed.csv',
      'general_data': 'ettevotja_rekvisiidid__yldandmed.json',
      'registry_cards': 'ettevotja_rekvisiidid__registrikaardid.json',
      'board_members': 'ettevotja_rekvisiidid__kaardile_kantud_isikud.json',
      'shareholders': 'ettevotja_rekvisiidid__osanikud.json',
      'beneficial_owners': 'ettevotja_rekvisiidid__kasusaajad.json'
    };
    
    const actualFileName = fileMapping[file.name] || `${file.name}.${file.format}`;
    const filePath = path.join(this.DATA_DIR, actualFileName);
    
    // Check if file exists
    try {
      await fs.stat(filePath);
      return filePath;
    } catch (error) {
      throw new Error(
        `Data file not found: ${actualFileName}\n` +
        `Please run: bun run download-data\n` +
        `This will download the latest data files from RIK.`
      );
    }
  }

  private async loadBasicData(): Promise<Map<string, CompanyBasicData>> {
    const cacheKey = 'basic_data_map';
    const cached = this.dataCache.get<Map<string, CompanyBasicData>>(cacheKey);
    if (cached) return cached;

    const file = this.OPEN_DATA_FILES.find(f => f.name === 'basic_data')!;
    const filePath = await this.getDataFilePath(file);
    
    const companies = new Map<string, CompanyBasicData>();
    
    return new Promise((resolve, reject) => {
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        delimiter: ';',
        bom: true,
        trim: true
      });

      parser.on('readable', function() {
        let record;
        while ((record = parser.read()) !== null) {
          companies.set(record.ariregistri_kood, record);
        }
      });

      parser.on('error', reject);
      parser.on('end', () => {
        this.dataCache.set(cacheKey, companies);
        resolve(companies);
      });

      const stream = createReadStream(filePath);
      stream.pipe(parser);
    });
  }

  private async loadJsonData(fileName: string): Promise<any[]> {
    const cacheKey = `json_data_${fileName}`;
    const cached = this.dataCache.get<any[]>(cacheKey);
    if (cached) return cached;

    const file = this.OPEN_DATA_FILES.find(f => f.name === fileName);
    if (!file || file.format !== 'json') {
      throw new Error(`JSON file not found: ${fileName}`);
    }

    const filePath = await this.getDataFilePath(file);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    this.dataCache.set(cacheKey, data);
    return data;
  }

  async searchCompanies(params: CompanySearchParams): Promise<CompanyData[]> {
    const companies = await this.loadBasicData();
    const results: CompanyData[] = [];
    
    for (const [code, company] of companies) {
      let match = false;
      
      const companyName = company.nimi || (company as any)[' nimi'] || ''; // Handle BOM
      const companyAddress = company.ettevotja_aadress || '';
      
      if (params.registryCode && company.ariregistri_kood === params.registryCode) {
        match = true;
      } else if (params.name && companyName && companyName.toLowerCase().includes(params.name.toLowerCase())) {
        match = true;
      } else if (params.query) {
        const searchText = `${companyName} ${companyAddress}`.toLowerCase();
        if (searchText.includes(params.query.toLowerCase())) {
          match = true;
        }
      }
      
      if (match) {
        results.push({
          registry_code: company.ariregistri_kood,
          name: company.nimi || (company as any)[' nimi'] || '', // Handle BOM issue
          status: company.ettevotja_staatus,
          status_text: company.ettevotja_staatus_tekstina,
          address: company.ettevotja_aadress || '',
          vat_number: company.kmkr_nr
        });
        
        if (results.length >= (params.limit || 100)) {
          break;
        }
      }
    }
    
    return results;
  }

  async getCompanyDetails(registryCode: string): Promise<CompanyData> {
    const companies = await this.loadBasicData();
    const company = companies.get(registryCode);
    
    if (!company) {
      throw new Error(`Company not found: ${registryCode}`);
    }
    
    // Try to load additional data from general_data
    try {
      const generalData = await this.loadJsonData('general_data');
      const detailedInfo = generalData.find((c: any) => c.ariregistri_kood === registryCode);
      
      if (detailedInfo) {
        return {
          registry_code: company.ariregistri_kood,
          name: company.nimi || (company as any)[' nimi'] || '',
          status: company.ettevotja_staatus || company.staatus || '',
          status_text: company.ettevotja_staatus_tekstina || company.staatus_tekstina || '',
          address: company.ettevotja_aadress || company.aadress || '',
          vat_number: company.kmkr_nr,
          email: detailedInfo.email,
          phone: detailedInfo.telefon,
          capital: detailedInfo.kapital,
          activity_area: detailedInfo.tegevusala,
          founded_date: detailedInfo.asutamise_kuupaev
        };
      }
    } catch (error) {
      console.error('Failed to load general data:', error);
    }
    
    return {
      registry_code: company.ariregistri_kood,
      name: company.nimi || (company as any)[' nimi'] || `Company ${registryCode}`,
      status: company.ettevotja_staatus,
      status_text: company.ettevotja_staatus_tekstina,
      address: company.ettevotja_aadress || '',
      vat_number: company.kmkr_nr
    };
  }

  async getBoardMembers(registryCode: string): Promise<BoardMember[]> {
    try {
      const boardData = await this.loadJsonData('board_members');
      const members = boardData.filter((m: any) => m.ariregistri_kood === registryCode);
      
      return members.map((m: any) => ({
        name: m.isiku_nimi || m.nimi,
        role: m.isiku_roll || m.roll || 'Board Member',
        start_date: m.algus_kp || new Date().toISOString().split('T')[0],
        end_date: m.lopp_kp
      }));
    } catch (error) {
      console.error('Failed to load board members:', error);
      return [];
    }
  }

  async checkDataAvailability(): Promise<{[key: string]: boolean}> {
    const availability: {[key: string]: boolean} = {};
    
    for (const file of this.OPEN_DATA_FILES) {
      try {
        const response = await this.client.head(file.url);
        availability[file.name] = response.status === 200;
      } catch {
        availability[file.name] = false;
      }
    }
    
    return availability;
  }

  async getDatasetInfo(): Promise<OpenDataFile[]> {
    return this.OPEN_DATA_FILES.map(file => ({
      ...file,
      fullUrl: `${this.BASE_URL}${file.url}`,
      cachePath: path.join(this.DATA_DIR, `${file.name}.${file.format}`)
    }));
  }

  async searchByPerson(name?: string, personalCode?: string): Promise<any[]> {
    try {
      const boardData = await this.loadJsonData('board_members');
      const results = [];
      
      for (const member of boardData) {
        let match = false;
        
        if (name && member.isiku_nimi?.toLowerCase().includes(name.toLowerCase())) {
          match = true;
        }
        
        if (match) {
          const companies = await this.loadBasicData();
          const company = companies.get(member.ariregistri_kood);
          
          if (company) {
            results.push({
              company_name: company.nimi,
              registry_code: member.ariregistri_kood,
              role: member.isiku_roll || 'Board Member',
              person_name: member.isiku_nimi,
              start_date: member.algus_kp
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('Failed to search by person:', error);
      return [];
    }
  }

  async getStatistics(): Promise<any> {
    const companies = await this.loadBasicData();
    
    const stats = {
      total_companies: companies.size,
      by_status: {} as Record<string, number>,
      last_update: new Date().toISOString()
    };
    
    for (const company of companies.values()) {
      const status = company.ettevotja_staatus_tekstina || 'Unknown';
      stats.by_status[status] = (stats.by_status[status] || 0) + 1;
    }
    
    return stats;
  }
}