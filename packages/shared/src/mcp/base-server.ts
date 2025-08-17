import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { MCPServerConfig } from './types.js';

export abstract class BaseMCPServer {
  protected server: Server;
  protected tools: Tool[];

  constructor(config: MCPServerConfig) {
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.tools = [];
    this.registerTools();
    this.setupHandlers();
  }

  protected abstract registerTools(): void;

  protected abstract handleToolCall(name: string, args: any): Promise<any>;

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.tools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.handleToolCall(name, args);
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
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

  protected addTool(tool: Tool) {
    this.tools.push(tool);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    const serverName = (this.server as any).serverInfo?.name || 'MCP Server';
    const serverVersion = (this.server as any).serverInfo?.version || 'unknown';
    console.error(`${serverName} v${serverVersion} running on stdio`);
  }
}
