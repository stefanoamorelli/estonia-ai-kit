import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { RIKClient } from './clients/index.js';
import { CompanyHandlers } from './handlers/company-handlers.js';
import { rikTools } from './tools/index.js';

export class RIKMCPServer {
  private server: Server;
  private rikClient: RIKClient;
  private companyHandlers: CompanyHandlers;

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

    this.rikClient = new RIKClient();
    this.companyHandlers = new CompanyHandlers(this.rikClient as any);
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
            result = await this.rikClient.getStatistics();
            break;

          case 'check_data_availability':
            result = await this.rikClient.checkDataAvailability();
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
    // console.error('RIK MCP Server starting...');
    const transport = new StdioServerTransport();
    
    try {
      await this.server.connect(transport);
      // console.error('RIK MCP Server running on stdio');
      
      // Handle shutdown gracefully
      process.on('SIGINT', () => {
        // console.error('Server shutting down...');
        process.exit(0);
      });
      
      return true;
    } catch (error) {
      // console.error('Failed to start server:', error);
      return false;
    }
  }
}
