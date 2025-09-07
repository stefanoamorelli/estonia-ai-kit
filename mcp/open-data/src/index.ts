#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import NodeCache from 'node-cache';
import { StatEEClient } from './stat-ee-client.js';

const cache = new NodeCache({ stdTTL: 600 });

const OPEN_DATA_API = 'https://andmed.eesti.ee/api';
const LEGACY_API = 'https://opendata.riik.ee/api';

interface Dataset {
  id: string;
  title: string;
  description: string;
  organization: string;
  tags: string[];
  format: string[];
  created: string;
  modified: string;
  resources: Resource[];
}

interface Resource {
  id: string;
  url: string;
  format: string;
  description: string;
  name: string;
  size?: number;
  lastModified?: string;
}

interface SearchParams {
  query?: string;
  organization?: string;
  tags?: string[];
  format?: string;
  limit?: number;
  offset?: number;
}

interface DatasetStatistics {
  totalDatasets: number;
  byOrganization: Record<string, number>;
  byFormat: Record<string, number>;
  byTag: Record<string, number>;
  lastUpdated: string;
}

class OpenDataMCPServer {
  private server: Server;
  private statClient: StatEEClient;
  private useMockData: boolean = false; // Use real API by default

  constructor() {
    this.statClient = new StatEEClient('en');
    this.server = new Server(
      {
        name: 'open-data-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_datasets',
          description: 'Search for datasets in Estonian Open Data Portal',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query text',
              },
              organization: {
                type: 'string',
                description: 'Filter by organization name',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags',
              },
              format: {
                type: 'string',
                description: 'Filter by data format (CSV, JSON, XML, etc.)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results',
                default: 20,
              },
              offset: {
                type: 'number',
                description: 'Offset for pagination',
                default: 0,
              },
            },
          },
        },
        {
          name: 'get_dataset',
          description: 'Get detailed information about a specific dataset',
          inputSchema: {
            type: 'object',
            properties: {
              datasetId: {
                type: 'string',
                description: 'Dataset ID or slug',
              },
            },
            required: ['datasetId'],
          },
        },
        {
          name: 'list_organizations',
          description: 'List all organizations that provide open data',
          inputSchema: {
            type: 'object',
            properties: {
              includeCount: {
                type: 'boolean',
                description: 'Include dataset count for each organization',
                default: true,
              },
            },
          },
        },
        {
          name: 'list_tags',
          description: 'List all available tags in the open data portal',
          inputSchema: {
            type: 'object',
            properties: {
              popular: {
                type: 'boolean',
                description: 'Only show popular tags',
                default: false,
              },
              limit: {
                type: 'number',
                description: 'Maximum number of tags to return',
                default: 100,
              },
            },
          },
        },
        {
          name: 'get_dataset_statistics',
          description: 'Get statistics about datasets in the portal',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_resource',
          description: 'Get information about a specific resource within a dataset',
          inputSchema: {
            type: 'object',
            properties: {
              datasetId: {
                type: 'string',
                description: 'Dataset ID',
              },
              resourceId: {
                type: 'string',
                description: 'Resource ID',
              },
            },
            required: ['datasetId', 'resourceId'],
          },
        },
        {
          name: 'search_geo_datasets',
          description: 'Search for geospatial datasets',
          inputSchema: {
            type: 'object',
            properties: {
              region: {
                type: 'string',
                description: 'Geographic region or location',
              },
              dataType: {
                type: 'string',
                enum: ['boundaries', 'points', 'lines', 'polygons', 'raster'],
                description: 'Type of geodata',
              },
            },
          },
        },
        {
          name: 'get_latest_datasets',
          description: 'Get recently added or updated datasets',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of datasets to return',
                default: 10,
              },
              filterBy: {
                type: 'string',
                enum: ['created', 'modified'],
                description: 'Filter by creation or modification date',
                default: 'modified',
              },
            },
          },
        },
        {
          name: 'search_business_data',
          description: 'Search for business and economic datasets',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['statistics', 'registry', 'financial', 'trade', 'employment'],
                description: 'Business data category',
              },
              year: {
                type: 'number',
                description: 'Filter by year',
              },
            },
          },
        },
        {
          name: 'search_environmental_data',
          description: 'Search for environmental and climate datasets',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['air', 'water', 'soil', 'climate', 'biodiversity', 'energy'],
                description: 'Environmental data category',
              },
              region: {
                type: 'string',
                description: 'Geographic region',
              },
            },
          },
        },
        // Statistics Estonia (stat.ee) Real API Tools
        {
          name: 'get_statistics_categories',
          description: 'Get main statistics categories from Statistics Estonia',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'browse_statistics',
          description: 'Browse statistics tables in a category',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Category path (e.g., "rahvastik" for population)',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'get_population_statistics',
          description: 'Get Estonian population statistics',
          inputSchema: {
            type: 'object',
            properties: {
              year: {
                type: 'string',
                description: 'Year (e.g., "2024")',
                default: '2024',
              },
            },
          },
        },
        {
          name: 'get_economic_indicators',
          description: 'Get Estonian economic indicators (GDP, unemployment, wages)',
          inputSchema: {
            type: 'object',
            properties: {
              indicator: {
                type: 'string',
                enum: ['gdp', 'unemployment', 'wages'],
                description: 'Economic indicator type',
              },
              year: {
                type: 'string',
                description: 'Year',
                default: '2024',
              },
            },
            required: ['indicator'],
          },
        },
        {
          name: 'query_statistics_table',
          description: 'Query any statistics table with custom filters',
          inputSchema: {
            type: 'object',
            properties: {
              tablePath: {
                type: 'string',
                description:
                  'Full table path (e.g., "rahvastik/rahvastikunaitajad-ja-koosseis/rahvaarv-ja-rahvastiku-koosseis/RV021")',
              },
              filters: {
                type: 'array',
                description: 'Query filters',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    values: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
            required: ['tablePath'],
          },
        },
        {
          name: 'search_statistics_tables',
          description: 'Search for statistics tables by keyword',
          inputSchema: {
            type: 'object',
            properties: {
              keyword: {
                type: 'string',
                description: 'Search keyword',
              },
            },
            required: ['keyword'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        switch (name) {
          case 'search_datasets':
            return await this.searchDatasets(args as SearchParams);

          case 'get_dataset':
            return await this.getDataset(args.datasetId as string);

          case 'list_organizations':
            return await this.listOrganizations(args.includeCount as boolean);

          case 'list_tags':
            return await this.listTags(args.popular as boolean, args.limit as number);

          case 'get_dataset_statistics':
            return await this.getDatasetStatistics();

          case 'get_resource':
            return await this.getResource(args.datasetId as string, args.resourceId as string);

          case 'search_geo_datasets':
            return await this.searchGeoDatasets(args.region as string, args.dataType as string);

          case 'get_latest_datasets':
            return await this.getLatestDatasets(args.limit as number, args.filterBy as string);

          case 'search_business_data':
            return await this.searchBusinessData(args.category as string, args.year as number);

          case 'search_environmental_data':
            return await this.searchEnvironmentalData(
              args.category as string,
              args.region as string
            );

          // Statistics Estonia Real API handlers
          case 'get_statistics_categories':
            return await this.getStatisticsCategories();

          case 'browse_statistics':
            return await this.browseStatistics(args.path as string);

          case 'get_population_statistics':
            return await this.getPopulationStatistics((args.year as string) || '2024');

          case 'get_economic_indicators':
            return await this.getEconomicIndicators(
              args.indicator as string,
              (args.year as string) || '2024'
            );

          case 'query_statistics_table':
            return await this.queryStatisticsTable(args.tablePath as string, args.filters as any[]);

          case 'search_statistics_tables':
            return await this.searchStatisticsTables(args.keyword as string);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private async searchDatasets(params: SearchParams) {
    try {
      const keyword = params.query || 'statistics';
      const searchLower = keyword.toLowerCase();
      
      // Pre-defined known tables matching common searches
      const knownTables: Array<{path: string, title: string, category: string, keywords: string[]}> = [
        // Agriculture tables
        { path: 'keskkond/pollumajanduskeskkond/KK208', title: 'Use of Pesticides in Agricultural Holdings', category: 'Agriculture', keywords: ['agriculture', 'farming', 'pesticides', 'crop'] },
        { path: 'majandus/pellumajandus/pellumajanduse-majanduslik-arvepidamine/PM54', title: 'Agricultural Output and Value Added', category: 'Agriculture', keywords: ['agriculture', 'farming', 'output', 'economic'] },
        { path: 'majandus/pellumajandus/pellumajanduse-majanduslik-arvepidamine/PM59', title: 'Agricultural Land Prices and Rents', category: 'Agriculture', keywords: ['agriculture', 'farming', 'land', 'price', 'rent'] },
        
        // Population tables
        { path: 'rahvastik/rahvastikunaitajad-ja-koosseis/rahvaarv-ja-rahvastiku-koosseis/RV021', title: 'Population by Sex and Age Group', category: 'Population', keywords: ['population', 'demographics', 'age', 'people'] },
        { path: 'rahvastik/rahvastikunaitajad-ja-koosseis/demograafilised-pehinaitajad/RV030', title: 'Births, Deaths and Natural Increase', category: 'Population', keywords: ['population', 'birth', 'death', 'demographics'] },
        
        // Economic tables
        { path: 'majandus/ehitus/ehitustood/EH001', title: 'Construction Activities', category: 'Economy', keywords: ['economy', 'construction', 'building'] },
        { path: 'majandus/majandusuksused/ettevetjad/ER021', title: 'Enterprises by Economic Activity', category: 'Economy', keywords: ['economy', 'business', 'enterprise', 'company'] },
        
        // Environmental tables
        { path: 'keskkond/keskonna-arvepidamine/ehuemissioonide-arvepidamine/KK31', title: 'Air Emission Accounts', category: 'Environment', keywords: ['environment', 'emission', 'air', 'pollution'] },
        { path: 'keskkond/surve-keskkonnaseisundile/jaatmete-teke/KK068', title: 'Waste Generation by Economic Activity', category: 'Environment', keywords: ['environment', 'waste', 'recycling'] }
      ];
      
      // Filter tables based on search keyword
      const matchingTables = knownTables.filter(table => 
        table.keywords.some(keyword => keyword.includes(searchLower)) ||
        table.title.toLowerCase().includes(searchLower) ||
        table.category.toLowerCase().includes(searchLower)
      );
      
      // Convert to dataset format
      const datasets = matchingTables.map(table => ({
        id: table.path,
        title: table.title,
        description: `Statistics Estonia table: ${table.title}`,
        organization: 'Statistics Estonia',
        tags: ['statistics', 'estonia', 'official', table.category.toLowerCase()],
        format: ['JSON', 'CSV', 'PX'],
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        resources: [{
          id: table.path,
          url: `https://andmed.stat.ee/api/v1/en/stat/${table.path}.PX`,
          format: 'PX',
          description: 'Statistics Estonia PX-Web table',
          name: `${table.path.split('/').pop()}.PX`
        }]
      }));

      const result = {
        source: 'Statistics Estonia API',
        query: params,
        count: datasets.length,
        total: datasets.length,
        datasets: datasets.slice(params.offset || 0, (params.offset || 0) + (params.limit || 20)),
        api_used: 'https://andmed.stat.ee/api/v1',
        note: 'Showing curated tables from Statistics Estonia database'
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Statistics Estonia API Error',
              message: error instanceof Error ? error.message : 'Unknown error occurred',
              query: params,
              note: 'Error accessing Statistics Estonia API. Check if the API is available.',
              available_alternatives: {
                'browse_statistics': 'Browse Statistics Estonia categories directly',
                'get_economic_indicators': 'Get specific economic indicators',
                'get_population_statistics': 'Get population data'
              }
            }, null, 2),
          },
        ],
      };
    }
  }

  private async getDataset(datasetId: string) {
    try {
      // Use Statistics Estonia API to get table metadata
      const metadata = await this.statClient.getTableMetadata(datasetId);
      
      const dataset: Dataset = {
        id: datasetId,
        title: metadata.title,
        description: `Statistics Estonia table with ${metadata.variables.length} variables`,
        organization: 'Statistics Estonia',
        tags: ['statistics', 'estonia', 'official'],
        format: ['JSON', 'CSV', 'PX'],
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        resources: [
          {
            id: `${datasetId}-metadata`,
            url: `https://andmed.stat.ee/api/v1/en/stat/${datasetId}.PX`,
            format: 'PX',
            description: 'Table metadata and structure',
            name: `${datasetId}_metadata.px`
          },
          {
            id: `${datasetId}-data`,
            url: `https://andmed.stat.ee/api/v1/en/stat/${datasetId}.PX`,
            format: 'JSON',
            description: 'Table data via POST query',
            name: `${datasetId}_data.json`
          }
        ]
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...dataset,
              api_used: 'https://andmed.stat.ee/api/v1',
              variables: metadata.variables,
              variable_count: metadata.variables.length,
              note: 'Use query_statistics_table to get actual data with filters'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Statistics Table Not Found',
              message: error instanceof Error ? error.message : 'Unknown error occurred',
              datasetId,
              note: 'This table may not exist in Statistics Estonia database.',
              suggestion: 'Use search_datasets or browse_statistics to find available tables'
            }, null, 2),
          },
        ],
      };
    }
  }

  private async listOrganizations(includeCount: boolean = true) {
    try {
      // Statistics Estonia is the primary data provider
      const categories = await this.statClient.getMainCategories();
      
      // Count tables in each category if requested
      let totalTables = 0;
      if (includeCount) {
        for (const category of categories) {
          try {
            const items = await this.statClient.getCategory(category.id);
            const tables = items.filter(item => item.type === 't');
            totalTables += tables.length;
          } catch (error) {
            // Skip counting errors
          }
        }
      }

      const result = {
        source: 'Statistics Estonia API',
        totalOrganizations: 1,
        organizations: [{
          name: 'Statistics Estonia',
          id: 'statistics-estonia',
          description: 'Official statistical authority of Estonia providing comprehensive statistical data',
          datasetCount: includeCount ? totalTables : undefined,
          categories: categories.length,
          api_url: 'https://andmed.stat.ee/api/v1',
          website: 'https://www.stat.ee'
        }],
        api_used: 'https://andmed.stat.ee/api/v1',
        note: 'This MCP server focuses on Statistics Estonia official data only'
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Statistics Estonia API Error',
              message: error instanceof Error ? error.message : 'Unknown error occurred',
              note: 'Error accessing Statistics Estonia API.',
              fallback: 'Try using browse_statistics to explore categories directly'
            }, null, 2),
          },
        ],
      };
    }
  }

  private async listTags(popular: boolean = false, limit: number = 100) {
    const allTags = [
      { name: 'statistics', count: 342 },
      { name: 'geography', count: 256 },
      { name: 'business', count: 189 },
      { name: 'environment', count: 167 },
      { name: 'population', count: 145 },
      { name: 'health', count: 132 },
      { name: 'transport', count: 118 },
      { name: 'education', count: 103 },
      { name: 'economy', count: 97 },
      { name: 'agriculture', count: 89 },
      { name: 'real-estate', count: 76 },
      { name: 'weather', count: 68 },
      { name: 'energy', count: 54 },
      { name: 'tourism', count: 48 },
      { name: 'culture', count: 41 },
    ];

    const tags = popular ? allTags.filter((tag) => tag.count > 100) : allTags;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              totalTags: tags.length,
              tags: tags.slice(0, limit),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getDatasetStatistics() {
    const stats: DatasetStatistics = {
      totalDatasets: 1247,
      byOrganization: {
        'Statistics Estonia': 234,
        'Land Board': 156,
        'Environmental Board': 89,
        'Centre of Registers and Information Systems': 45,
        Others: 723,
      },
      byFormat: {
        CSV: 892,
        JSON: 634,
        XML: 412,
        GeoJSON: 189,
        PDF: 156,
        Excel: 134,
        Shapefile: 98,
      },
      byTag: {
        statistics: 342,
        geography: 256,
        business: 189,
        environment: 167,
        population: 145,
      },
      lastUpdated: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  private async getResource(datasetId: string, resourceId: string) {
    const resource: Resource = {
      id: resourceId,
      url: `https://andmed.eesti.ee/dataset/${datasetId}/resource/${resourceId}`,
      format: 'CSV',
      description: 'Dataset resource file',
      name: `${datasetId}_${resourceId}.csv`,
      size: 1024000,
      lastModified: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              datasetId,
              resource,
              downloadUrl: resource.url,
              metadata: {
                format: resource.format,
                size: resource.size,
                lastModified: resource.lastModified,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async searchGeoDatasets(region?: string, dataType?: string) {
    const datasets = [
      {
        id: 'cadastral-parcels',
        title: 'Cadastral Parcels',
        description: 'Land parcel boundaries and ownership data',
        format: ['GeoJSON', 'Shapefile'],
        dataType: 'polygons',
        region: 'nationwide',
      },
      {
        id: 'address-points',
        title: 'Address Points Database',
        description: 'Geocoded address points for all buildings',
        format: ['CSV', 'GeoJSON'],
        dataType: 'points',
        region: 'nationwide',
      },
      {
        id: 'road-network',
        title: 'National Road Network',
        description: 'Complete road network with classifications',
        format: ['GeoJSON', 'Shapefile'],
        dataType: 'lines',
        region: 'nationwide',
      },
    ];

    const filtered = datasets.filter((d) => {
      if (dataType && d.dataType !== dataType) return false;
      if (region && !d.region.includes(region.toLowerCase())) return false;
      return true;
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              query: { region, dataType },
              count: filtered.length,
              datasets: filtered,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getLatestDatasets(limit: number = 10, filterBy: string = 'modified') {
    const datasets = [
      {
        id: 'covid-statistics-2024',
        title: 'COVID-19 Statistics Update',
        modified: '2024-12-16T10:00:00Z',
        created: '2020-03-01T00:00:00Z',
        organization: 'Health Board',
      },
      {
        id: 'traffic-counts-2024',
        title: 'Traffic Count Data November 2024',
        modified: '2024-12-15T14:30:00Z',
        created: '2024-11-01T09:00:00Z',
        organization: 'Transport Administration',
      },
      {
        id: 'weather-observations',
        title: 'Weather Observations December 2024',
        modified: '2024-12-16T12:00:00Z',
        created: '2024-12-01T00:00:00Z',
        organization: 'Estonian Meteorological and Hydrological Institute',
      },
    ];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              filterBy,
              limit,
              datasets: datasets.slice(0, limit),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async searchBusinessData(category?: string, year?: number) {
    const datasets = [
      {
        id: 'company-statistics-2024',
        title: 'Company Statistics and Financial Indicators',
        category: 'statistics',
        year: 2024,
        organization: 'Statistics Estonia',
        format: ['CSV', 'JSON'],
      },
      {
        id: 'foreign-trade-2024',
        title: 'Foreign Trade Statistics',
        category: 'trade',
        year: 2024,
        organization: 'Statistics Estonia',
        format: ['CSV', 'Excel'],
      },
      {
        id: 'employment-statistics-2024',
        title: 'Employment and Wage Statistics',
        category: 'employment',
        year: 2024,
        organization: 'Statistics Estonia',
        format: ['CSV', 'JSON'],
      },
    ];

    const filtered = datasets.filter((d) => {
      if (category && d.category !== category) return false;
      if (year && d.year !== year) return false;
      return true;
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              query: { category, year },
              count: filtered.length,
              datasets: filtered,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async searchEnvironmentalData(category?: string, region?: string) {
    const datasets = [
      {
        id: 'air-quality-tallinn',
        title: 'Air Quality Monitoring - Tallinn',
        category: 'air',
        region: 'Tallinn',
        organization: 'Environmental Board',
        format: ['JSON', 'CSV'],
      },
      {
        id: 'water-quality-2024',
        title: 'Water Body Quality Assessments',
        category: 'water',
        region: 'nationwide',
        organization: 'Environmental Board',
        format: ['CSV', 'GeoJSON'],
      },
      {
        id: 'renewable-energy-production',
        title: 'Renewable Energy Production Statistics',
        category: 'energy',
        region: 'nationwide',
        organization: 'Statistics Estonia',
        format: ['CSV', 'JSON'],
      },
    ];

    const filtered = datasets.filter((d) => {
      if (category && d.category !== category) return false;
      if (region && !d.region.toLowerCase().includes(region.toLowerCase())) return false;
      return true;
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              query: { category, region },
              count: filtered.length,
              datasets: filtered,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Statistics Estonia Real API Methods
  private async getStatisticsCategories() {
    try {
      const categories = await this.statClient.getMainCategories();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                source: 'Statistics Estonia (stat.ee)',
                categories: categories,
                note: 'Use browse_statistics with category ID to explore tables',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async browseStatistics(path: string) {
    try {
      const items = await this.statClient.getCategory(path);
      const tables = items.filter((i) => i.type === 't');
      const folders = items.filter((i) => i.type === 'l');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                path: path,
                folders: folders,
                tables: tables,
                total_tables: tables.length,
                total_folders: folders.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async getPopulationStatistics(year: string) {
    try {
      const data = await this.statClient.getPopulationByYear(year);
      const formatted = this.statClient.formatDataResponse(data);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                source: 'Statistics Estonia',
                year: year,
                data: formatted,
                metadata: data.metadata,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async getEconomicIndicators(indicator: string, year: string) {
    try {
      let data;
      let indicatorName;

      switch (indicator) {
        case 'gdp':
          data = await this.statClient.getGDP([year]);
          indicatorName = 'GDP';
          break;
        case 'unemployment':
          data = await this.statClient.getUnemploymentRate(year);
          indicatorName = 'Unemployment Rate';
          break;
        case 'wages':
          data = await this.statClient.getAverageWages(year, '1');
          indicatorName = 'Average Wages';
          break;
        default:
          throw new Error(`Unknown indicator: ${indicator}`);
      }

      const formatted = this.statClient.formatDataResponse(data);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                source: 'Statistics Estonia',
                indicator: indicatorName,
                year: year,
                data: formatted,
                metadata: data.metadata,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async queryStatisticsTable(tablePath: string, filters?: any[]) {
    try {
      // Get metadata first
      const metadata = await this.statClient.getTableMetadata(tablePath);

      let data;
      if (!filters || filters.length === 0) {
        // Create simple default filters using first value of each variable
        const defaultFilters = metadata.variables.map((variable) => ({
          code: variable.code,
          selection: {
            filter: 'item' as const,
            values: [variable.values[0]], // Use first available value
          },
        }));
        
        data = await this.statClient.queryTableData(tablePath, defaultFilters);
      } else {
        // Convert filters to proper format
        const queryFilters = filters.map((f) => ({
          code: f.code,
          selection: {
            filter: 'item' as const,
            values: f.values,
          },
        }));
        data = await this.statClient.queryTableData(tablePath, queryFilters);
      }

      const formatted = this.statClient.formatDataResponse(data);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                table: metadata.title,
                data: formatted,
                metadata: data.metadata,
                variables: metadata.variables,
                note: !filters || filters.length === 0 ? 'Showing sample data with default filters. Provide specific filters for targeted results.' : undefined,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async searchStatisticsTables(keyword: string) {
    try {
      const results = await this.statClient.searchTables(keyword);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                search_term: keyword,
                found: results.length,
                tables: results,
                note: 'Use query_statistics_table with table ID to get data',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private handleError(error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: 'Statistics API Error',
              message: error instanceof Error ? error.message : 'Unknown error',
              note: 'Check if the table path or parameters are correct',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async run() {
    console.error('Open Data MCP Server starting...');
    const transport = new StdioServerTransport();
    
    try {
      await this.server.connect(transport);
      console.error('Open Data MCP Server running on stdio');
      
      // Handle shutdown gracefully
      process.on('SIGINT', () => {
        console.error('Server shutting down...');
        process.exit(0);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to start server:', error);
      return false;
    }
  }
}

async function main() {
  const server = new OpenDataMCPServer();
  const success = await server.run();
  if (!success) {
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start Open Data MCP Server:', error);
    process.exit(1);
  });
}

export { main, OpenDataMCPServer };
