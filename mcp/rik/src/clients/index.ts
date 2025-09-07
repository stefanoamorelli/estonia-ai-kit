import { RIKOpenDataClient } from './rik-open-data-client.js';
import { RIKDatabaseClient } from './rik-database-client.js';
import { CompanyData, CompanySearchParams, BoardMember, AnnualReport } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export class RIKClient {
  private openDataClient: RIKOpenDataClient;
  private dbClient: RIKDatabaseClient | null = null;

  constructor() {
    this.openDataClient = new RIKOpenDataClient();
    
    // Try to use database if available
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const dbPath = path.join(__dirname, '../../.rik-data/rik_data.db');
      if (fs.existsSync(dbPath)) {
        this.dbClient = new RIKDatabaseClient();
        // Don't log to stdout - it breaks MCP protocol
      }
    } catch (error) {
      // Database not available, falling back to file-based queries
    }
  }

  async searchCompanies(params: CompanySearchParams): Promise<CompanyData[]> {
    // Use database if available
    if (this.dbClient) {
      try {
        return await this.dbClient.searchCompanies(params);
      } catch (error) {
        // Database search failed, try next method
      }
    }
    
    // Fall back to open data client
    try {
      return await this.openDataClient.searchCompanies(params);
    } catch (error) {
      // Open data search failed
      return [];
    }
  }

  async getCompanyDetails(registryCode: string): Promise<CompanyData> {
    // Use database if available
    if (this.dbClient) {
      try {
        return await this.dbClient.getCompanyDetails(registryCode);
      } catch (error) {
        // console.error('Database details failed:', error);
      }
    }
    
    // Fall back to open data client
    return await this.openDataClient.getCompanyDetails(registryCode);
  }

  async getBoardMembers(registryCode: string): Promise<BoardMember[]> {
    // Use database if available
    if (this.dbClient) {
      try {
        const members = await this.dbClient.getBoardMembers(registryCode);
        if (members.length > 0) {
          return members;
        }
      } catch (error) {
        // console.error('Database board members failed:', error);
      }
    }
    
    // Fall back to open data client
    try {
      return await this.openDataClient.getBoardMembers(registryCode);
    } catch (error) {
      // console.error('Open data board members failed:', error);
      return [];
    }
  }

  async getShareholders(registryCode: string): Promise<any[]> {
    if (this.dbClient) {
      try {
        return await this.dbClient.getShareholders(registryCode);
      } catch (error) {
        // console.error('Database shareholders failed:', error);
      }
    }
    return [];
  }

  async getBeneficialOwners(registryCode: string): Promise<any[]> {
    if (this.dbClient) {
      try {
        return await this.dbClient.getBeneficialOwners(registryCode);
      } catch (error) {
        // console.error('Database beneficial owners failed:', error);
      }
    }
    return [];
  }

  async searchByPerson(name: string): Promise<any[]> {
    if (this.dbClient) {
      try {
        return await this.dbClient.searchByPerson(name);
      } catch (error) {
        // console.error('Database person search failed:', error);
      }
    }
    
    try {
      return await this.openDataClient.searchByPerson(name);
    } catch (error) {
      // console.error('Open data person search failed:', error);
      return [];
    }
  }

  async getStatistics(): Promise<any> {
    if (this.dbClient) {
      try {
        return await this.dbClient.getStatistics();
      } catch (error) {
        // console.error('Database statistics failed:', error);
      }
    }
    
    return await this.openDataClient.getStatistics();
  }

  async checkDataAvailability(): Promise<{ [key: string]: boolean }> {
    const availability: { [key: string]: boolean } = {};
    
    // Check database
    if (this.dbClient) {
      availability.database = true;
      const stats = await this.dbClient.getStatistics();
      availability.database_companies = stats.total_companies > 0;
      availability.database_board_members = stats.total_board_members > 0;
    } else {
      availability.database = false;
    }
    
    // Check open data files
    const openDataAvailability = await this.openDataClient.checkDataAvailability();
    return { ...availability, ...openDataAvailability };
  }
}

// Export the client class
export { RIKClient as default };