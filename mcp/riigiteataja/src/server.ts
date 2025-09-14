import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { RiigiteatajaClient } from '@estonia-ai-kit/riigiteataja-api-client';
import { riigiteatajaTools } from './tools/index.js';

export class RiigiteatajaMCPServer {
  private server: Server;
  private client: RiigiteatajaClient;

  constructor() {
    this.server = new Server(
      {
        name: 'riigiteataja-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.client = new RiigiteatajaClient();
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: riigiteatajaTools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        let result: unknown;

        switch (name) {
          // FAQ Tools
          case 'get_all_faq':
            result = await this.client.faq.fetchFAQ();
            break;

          case 'search_faq':
            result = await this.client.faq.searchFAQ(args.query as string);
            break;

          case 'get_faq_by_category':
            result = await this.client.faq.getFAQByCategory(args.category as string);
            break;

          case 'get_faq_by_id':
            result = await this.client.faq.getFAQById(args.id as string);
            break;

          // Link Generation Tools
          case 'create_dynamic_link':
            result = {
              link: this.client.links.createDynamicLink(args.actUrl as string),
              description: 'Dynamic link that always opens the current valid version',
            };
            break;

          case 'create_paragraph_link':
            result = {
              link: this.client.links.createParagraphLink(
                args.actUrl as string,
                args.paragraphId as string
              ),
              description: `Link to paragraph ${args.paragraphId}`,
            };
            break;

          case 'create_translation_link':
            result = {
              link: this.client.links.createTranslationLink(args.actId as string),
              description: 'Link to English translation',
            };
            break;

          case 'generate_search_url':
            result = {
              url: this.client.links.generateSearchUrl({
                query: args.query as string,
                type: args.type as
                  | 'seadus'
                  | 'määrus'
                  | 'korraldus'
                  | 'käskkiri'
                  | 'all'
                  | undefined,
                status: args.status as 'kehtiv' | 'kehtetu' | 'all' | undefined,
                dateFrom: args.dateFrom as string | undefined,
                dateTo: args.dateTo as string | undefined,
              }),
              description: 'Search URL for Riigiteataja',
            };
            break;

          case 'get_legal_act_types':
            result = this.client.links.getCommonLegalActTypes();
            break;

          case 'extract_act_id':
            result = {
              actId: this.client.links.extractActIdFromUrl(args.url as string),
            };
            break;

          // Document Fetching Tools (using shared API)
          case 'fetch_legal_document':
            result = await this.client.fetchDocument(
              args.globalId as number,
              (args.language as 'et' | 'en') || 'et'
            );
            break;

          case 'search_legal_documents':
            result = await this.client.searchLaws({
              query: args.query,
              kehtivus: args.kehtivus,
              liik: args.liik,
              andja: args.andja,
            });
            break;

          case 'fetch_bilingual_document':
            result = await this.client.fetchBilingual(args.globalId as number);
            break;

          // Cache Management
          case 'clear_cache':
            this.client.faq.clearCache();
            result = { success: true, message: 'Cache cleared successfully' };
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
                  error: true,
                  message: error instanceof Error ? error.message : 'An unknown error occurred',
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

  async run(): Promise<boolean> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      return true;
    } catch (error) {
      console.error('Failed to start server:', error);
      return false;
    }
  }
}
