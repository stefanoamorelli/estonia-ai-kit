import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { RIKApiClient } from './clients/rik-client.js';
import { RIKOpenDataClient } from './clients/rik-open-data-client.js';
import { CompanyHandlers } from './handlers/company-handlers.js';
import { rikTools } from './tools/index.js';

export class RIKMCPServer {
  private server: Server;
  private apiClient: RIKApiClient;
  private openDataClient: RIKOpenDataClient;
  private companyHandlers: CompanyHandlers;
  private useOpenData: boolean = true; // Use open data by default

  constructor() {
    this.server = new Server(
      {
        name: 'rik-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiClient = new RIKApiClient();
    this.openDataClient = new RIKOpenDataClient();
    // Use open data client by default for better reliability
    this.companyHandlers = new CompanyHandlers(
      this.useOpenData ? this.openDataClient : this.apiClient
    );
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: rikTools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        let result: any;

        switch (name) {
          case 'search_company':
            result = await this.companyHandlers.searchCompany(args as any);
            break;

          case 'get_company_details':
            result = await this.companyHandlers.getCompanyDetails(args.registryCode as string);
            break;

          case 'get_company_extract':
            result = await this.companyHandlers.getCompanyExtract(
              args.registryCode as string,
              (args.language as 'et' | 'en') || 'en'
            );
            break;

          case 'get_annual_reports':
            result = await this.companyHandlers.getAnnualReports(args.registryCode as string);
            break;

          case 'check_tax_debt':
            result = await this.companyHandlers.checkTaxDebt(args.registryCode as string);
            break;

          case 'get_board_members':
            result = await this.companyHandlers.getBoardMembers(args.registryCode as string);
            break;

          case 'search_by_person':
            result = await this.companyHandlers.searchByPerson(
              args.name as string,
              args.personalCode as string
            );
            break;

          case 'get_registry_statistics':
            if (this.openDataClient && 'getStatistics' in this.openDataClient) {
              result = await this.openDataClient.getStatistics();
            } else {
              result = { error: 'Statistics not available with current client' };
            }
            break;

          case 'check_data_availability':
            if (this.openDataClient && 'checkDataAvailability' in this.openDataClient) {
              result = await this.openDataClient.checkDataAvailability();
            } else {
              result = { error: 'Data availability check not available with current client' };
            }
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

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
              text: JSON.stringify(
                {
                  error: 'Tool execution failed',
                  message: error instanceof Error ? error.message : 'Unknown error',
                  tool: name,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('RIK MCP Server v1.0.0 running on stdio');
  }
}
