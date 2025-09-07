import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';

export interface StatEECategory {
  id: string;
  type: 'l' | 't'; // l = folder, t = table
  text: string;
  updated?: string;
}

export interface TableMetadata {
  title: string;
  variables: Variable[];
}

export interface Variable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
  time?: boolean;
  elimination?: boolean;
}

export interface QueryFilter {
  code: string;
  selection: {
    filter: 'item' | 'all' | 'top' | 'bottom';
    values: string[];
  };
}

export interface StatDataResponse {
  columns: Array<{
    code: string;
    text: string;
    type?: string;
  }>;
  comments: any[];
  data: Array<{
    key: string[];
    values: string[];
  }>;
  metadata: Array<{
    infofile: string;
    updated: string;
    label: string;
    source: string;
  }>;
}

export class StatEEClient {
  private client: AxiosInstance;
  private cache: NodeCache;
  private readonly BASE_URL = 'https://andmed.stat.ee/api/v1';

  constructor(language: 'en' | 'et' = 'en') {
    this.client = axios.create({
      baseURL: `${this.BASE_URL}/${language}/stat`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.cache = new NodeCache({
      stdTTL: 3600, // 1 hour cache
      checkperiod: 600,
    });
  }

  /**
   * Get main categories (Environment, Economy, Population, etc.)
   */
  async getMainCategories(): Promise<StatEECategory[]> {
    const cacheKey = 'main_categories';
    const cached = this.cache.get<StatEECategory[]>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get('');
    this.cache.set(cacheKey, response.data);
    return response.data;
  }

  /**
   * Navigate through category hierarchy
   */
  async getCategory(path: string): Promise<StatEECategory[]> {
    const cacheKey = `category_${path}`;
    const cached = this.cache.get<StatEECategory[]>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get(path);
    this.cache.set(cacheKey, response.data);
    return response.data;
  }

  /**
   * Get table metadata (variables, dimensions, etc.)
   */
  async getTableMetadata(tablePath: string): Promise<TableMetadata> {
    const cacheKey = `metadata_${tablePath}`;
    const cached = this.cache.get<TableMetadata>(cacheKey);
    if (cached) return cached;

    // Ensure .PX extension
    const fullPath = tablePath.endsWith('.PX') ? tablePath : `${tablePath}.PX`;
    const response = await this.client.get(fullPath);
    this.cache.set(cacheKey, response.data);
    return response.data;
  }

  /**
   * Query table data with filters
   */
  async queryTableData(
    tablePath: string,
    filters: QueryFilter[],
    format: 'json' | 'csv' = 'json'
  ): Promise<StatDataResponse> {
    const fullPath = tablePath.endsWith('.PX') ? tablePath : `${tablePath}.PX`;

    const query = {
      query: filters,
      response: {
        format: format,
      },
    };

    const response = await this.client.post(fullPath, query);
    return response.data;
  }

  /**
   * Helper: Get latest data for a table
   */
  async getLatestData(tablePath: string, limit: number = 1): Promise<StatDataResponse> {
    const metadata = await this.getTableMetadata(tablePath);

    // Find time variable
    const timeVar = metadata.variables.find((v) => v.time === true);
    if (!timeVar) {
      throw new Error('No time variable found in table');
    }

    // Get latest years
    const latestYears = timeVar.values.slice(-limit);

    // Build query with latest years and all other dimensions
    const filters: QueryFilter[] = metadata.variables.map((variable) => {
      if (variable.code === timeVar.code) {
        return {
          code: variable.code,
          selection: {
            filter: 'item',
            values: latestYears,
          },
        };
      } else if (variable.elimination) {
        // Use first value for eliminable variables
        return {
          code: variable.code,
          selection: {
            filter: 'item',
            values: [variable.values[0]],
          },
        };
      } else {
        return {
          code: variable.code,
          selection: {
            filter: 'all',
            values: [],
          },
        };
      }
    });

    return this.queryTableData(tablePath, filters);
  }

  /**
   * Search for tables by keyword
   */
  async searchTables(keyword: string, path: string = ''): Promise<StatEECategory[]> {
    const results: StatEECategory[] = [];

    try {
      // For now, just search main categories - recursive search would require careful navigation
      const items = await this.getCategory(path);

      for (const item of items) {
        if (item.text && item.text.toLowerCase().includes(keyword.toLowerCase())) {
          results.push(item);
        }
      }
    } catch (error) {
      console.error('Search error:', error instanceof Error ? error.message : String(error));
    }

    return results;
  }

  /**
   * Get population statistics
   */
  async getPopulationByYear(year: string): Promise<StatDataResponse> {
    const tablePath =
      'rahvastik/rahvastikunaitajad-ja-koosseis/rahvaarv-ja-rahvastiku-koosseis/RV021';

    const filters: QueryFilter[] = [
      {
        code: 'Aasta',
        selection: {
          filter: 'item',
          values: [year],
        },
      },
      {
        code: 'Sugu',
        selection: {
          filter: 'item',
          values: ['1'], // Total
        },
      },
      {
        code: 'Vanuserühm',
        selection: {
          filter: 'item',
          values: ['1'], // Total age groups
        },
      },
    ];

    return this.queryTableData(tablePath, filters);
  }

  /**
   * Get economic indicators
   */
  async getGDP(years: string[] = ['2024']): Promise<StatDataResponse> {
    const tablePath = 'majandus/rahvamajanduse-arvepidamine/sisemajanduse-koguprodukt-skp/RAA0061';

    const filters: QueryFilter[] = [
      {
        code: 'Aasta_Kvartal',
        selection: {
          filter: 'item',
          values: years,
        },
      },
      {
        code: 'Näitaja',
        selection: {
          filter: 'item',
          values: ['1'], // GDP at current prices
        },
      },
    ];

    return this.queryTableData(tablePath, filters);
  }

  /**
   * Get unemployment rate
   */
  async getUnemploymentRate(year: string = '2024'): Promise<StatDataResponse> {
    const tablePath = 'sotsiaalelu/tooturg/heivatud-tootud-ja-mitteaktiivsed/TT0200';

    const filters: QueryFilter[] = [
      {
        code: 'Aasta',
        selection: {
          filter: 'item',
          values: [year],
        },
      },
      {
        code: 'Näitaja',
        selection: {
          filter: 'item',
          values: ['3'], // Unemployment rate
        },
      },
      {
        code: 'Sugu',
        selection: {
          filter: 'item',
          values: ['1'], // Total
        },
      },
    ];

    return this.queryTableData(tablePath, filters);
  }

  /**
   * Get average wages
   */
  async getAverageWages(year: string = '2024', quarter: string = '1'): Promise<StatDataResponse> {
    const tablePath = 'sotsiaalelu/palk-ja-toojeukulu/palk/PA5311';

    const filters: QueryFilter[] = [
      {
        code: 'Aasta',
        selection: {
          filter: 'item',
          values: [year],
        },
      },
      {
        code: 'Kvartal',
        selection: {
          filter: 'item',
          values: [quarter],
        },
      },
      {
        code: 'Näitaja',
        selection: {
          filter: 'item',
          values: ['1'], // Average gross wages
        },
      },
    ];

    return this.queryTableData(tablePath, filters);
  }

  /**
   * Format data response for easier consumption
   */
  formatDataResponse(response: StatDataResponse): any[] {
    return response.data.map((item) => {
      const result: any = {};

      // Map keys to column names
      item.key.forEach((value, index) => {
        const column = response.columns[index];
        result[column.text] = value;
      });

      // Add values
      item.values.forEach((value, index) => {
        result[`value_${index}`] = value;
      });

      return result;
    });
  }
}
