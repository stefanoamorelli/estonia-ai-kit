import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { CompanyData, CompanySearchParams, BoardMember } from '../types/index.js';

export class RIKDatabaseClient {
  private db: Database.Database;
  private readonly DB_PATH: string;

  constructor() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    this.DB_PATH = path.join(__dirname, '../../.rik-data/rik_data.db');
    
    this.db = new Database(this.DB_PATH, {
      readonly: true,
      fileMustExist: true
    });
    
    // Enable query optimization
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 30000000000');
  }

  async searchCompanies(params: CompanySearchParams): Promise<CompanyData[]> {
    let query = `
      SELECT 
        c.registry_code,
        c.name,
        c.status,
        c.status_text,
        c.address,
        c.vat_number,
        c.normalized_address,
        c.postal_code,
        c.first_registration_date,
        g.email,
        g.phone,
        g.capital,
        g.activity_area,
        g.founded_date
      FROM companies c
      LEFT JOIN company_general_data g ON c.registry_code = g.registry_code
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    
    if (params.registryCode) {
      query += ' AND c.registry_code = ?';
      queryParams.push(params.registryCode);
    }
    
    if (params.name) {
      query += ' AND c.name LIKE ?';
      queryParams.push(`%${params.name}%`);
    }
    
    if (params.address) {
      query += ' AND (c.normalized_address LIKE ? OR c.address LIKE ? OR c.location LIKE ?)';
      queryParams.push(`%${params.address}%`, `%${params.address}%`, `%${params.address}%`);
    }
    
    if (params.query) {
      query += ' AND (c.name LIKE ? OR c.normalized_address LIKE ? OR c.registry_code LIKE ?)';
      queryParams.push(`%${params.query}%`, `%${params.query}%`, `%${params.query}%`);
    }
    
    query += ' LIMIT ?';
    queryParams.push(params.limit || 100);
    
    const stmt = this.db.prepare(query);
    const results = stmt.all(...queryParams);
    
    return results.map((row: any) => ({
      registry_code: row.registry_code,
      name: row.name,
      status: row.status,
      status_text: row.status_text,
      address: row.normalized_address || row.address || '',
      vat_number: row.vat_number,
      email: row.email,
      phone: row.phone,
      capital: row.capital,
      activity_area: row.activity_area,
      founded_date: row.founded_date || row.first_registration_date
    }));
  }

  async getCompanyDetails(registryCode: string): Promise<CompanyData> {
    const query = `
      SELECT 
        c.*,
        g.email,
        g.phone,
        g.capital,
        g.activity_area,
        g.founded_date,
        g.website,
        g.employees_count,
        g.main_activity_code,
        g.main_activity_text
      FROM companies c
      LEFT JOIN company_general_data g ON c.registry_code = g.registry_code
      WHERE c.registry_code = ?
    `;
    
    const stmt = this.db.prepare(query);
    const company = stmt.get(registryCode) as any;
    
    if (!company) {
      throw new Error(`Company not found: ${registryCode}`);
    }
    
    return {
      registry_code: company.registry_code,
      name: company.name,
      status: company.status,
      status_text: company.status_text,
      address: company.normalized_address || company.address || '',
      vat_number: company.vat_number,
      email: company.email,
      phone: company.phone,
      capital: company.capital,
      activity_area: company.activity_area || company.main_activity_text,
      founded_date: company.founded_date || company.first_registration_date
    };
  }

  async getBoardMembers(registryCode: string): Promise<BoardMember[]> {
    const query = `
      SELECT 
        first_name,
        last_name,
        full_name,
        role_text,
        start_date,
        end_date,
        person_type,
        email
      FROM board_members
      WHERE registry_code = ?
      ORDER BY start_date DESC
    `;
    
    const stmt = this.db.prepare(query);
    const members = stmt.all(registryCode);
    
    return members.map((m: any) => ({
      name: m.full_name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown',
      role: m.role_text || 'Board Member',
      start_date: m.start_date,
      end_date: m.end_date
    }));
  }

  async getShareholders(registryCode: string): Promise<any[]> {
    const query = `
      SELECT 
        shareholder_name,
        shareholder_type,
        share_amount,
        share_currency,
        ownership_percentage,
        start_date,
        end_date
      FROM shareholders
      WHERE registry_code = ?
      ORDER BY ownership_percentage DESC
    `;
    
    const stmt = this.db.prepare(query);
    return stmt.all(registryCode);
  }

  async getBeneficialOwners(registryCode: string): Promise<any[]> {
    const query = `
      SELECT 
        owner_name,
        owner_type,
        control_type,
        control_percentage,
        start_date,
        end_date
      FROM beneficial_owners
      WHERE registry_code = ?
      ORDER BY control_percentage DESC
    `;
    
    const stmt = this.db.prepare(query);
    return stmt.all(registryCode);
  }

  async searchByPerson(name: string): Promise<any[]> {
    const query = `
      SELECT 
        b.registry_code,
        b.full_name as person_name,
        b.role_text as role,
        b.start_date,
        b.end_date,
        c.name as company_name,
        c.status_text
      FROM board_members b
      JOIN companies c ON b.registry_code = c.registry_code
      WHERE b.full_name LIKE ?
      ORDER BY b.start_date DESC
      LIMIT 100
    `;
    
    const stmt = this.db.prepare(query);
    return stmt.all(`%${name}%`);
  }

  async getStatistics(): Promise<any> {
    const stats = {
      total_companies: (this.db.prepare('SELECT COUNT(*) as count FROM companies').get() as any).count,
      total_board_members: (this.db.prepare('SELECT COUNT(*) as count FROM board_members').get() as any).count,
      total_shareholders: (this.db.prepare('SELECT COUNT(*) as count FROM shareholders').get() as any).count,
      total_beneficial_owners: (this.db.prepare('SELECT COUNT(*) as count FROM beneficial_owners').get() as any).count,
      by_status: {} as Record<string, number>,
      by_legal_form: {} as Record<string, number>
    };
    
    // Get status breakdown
    const statusQuery = this.db.prepare(`
      SELECT status_text, COUNT(*) as count 
      FROM companies 
      GROUP BY status_text 
      ORDER BY count DESC
    `);
    
    for (const row of statusQuery.all()) {
      const r = row as any;
      stats.by_status[r.status_text] = r.count;
    }
    
    // Get legal form breakdown
    const legalFormQuery = this.db.prepare(`
      SELECT legal_form, COUNT(*) as count 
      FROM companies 
      WHERE legal_form IS NOT NULL
      GROUP BY legal_form 
      ORDER BY count DESC
      LIMIT 10
    `);
    
    for (const row of legalFormQuery.all()) {
      const r = row as any;
      stats.by_legal_form[r.legal_form] = r.count;
    }
    
    return stats;
  }

  async getCompaniesByAddress(address: string, limit: number = 100): Promise<CompanyData[]> {
    const query = `
      SELECT 
        c.registry_code,
        c.name,
        c.status,
        c.status_text,
        c.normalized_address as address,
        c.vat_number
      FROM companies c
      WHERE c.normalized_address LIKE ? 
         OR c.address LIKE ?
         OR c.location LIKE ?
      LIMIT ?
    `;
    
    const stmt = this.db.prepare(query);
    const results = stmt.all(`%${address}%`, `%${address}%`, `%${address}%`, limit);
    
    return results.map((row: any) => ({
      registry_code: row.registry_code,
      name: row.name,
      status: row.status,
      status_text: row.status_text,
      address: row.address || '',
      vat_number: row.vat_number
    }));
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}