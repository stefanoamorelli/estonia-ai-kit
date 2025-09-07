import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const rikTools: Tool[] = [
  {
    name: 'search_company',
    description: 'Search for Estonian companies in the Business Register',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'General search query',
        },
        registryCode: {
          type: 'string',
          description: 'Company registry code (8 digits)',
        },
        name: {
          type: 'string',
          description: 'Company name or part of it',
        },
        status: {
          type: 'string',
          enum: ['R', 'K', 'L', 'N'],
          description:
            'Company status: R (registered), K (deleted), L (liquidated), N (in liquidation)',
        },
        address: {
          type: 'string',
          description: 'Company address or part of it',
        },
      },
    },
  },
  {
    name: 'get_company_details',
    description: 'Get detailed information about a specific company',
    inputSchema: {
      type: 'object',
      properties: {
        registryCode: {
          type: 'string',
          description: 'Company registry code (8 digits)',
        },
      },
      required: ['registryCode'],
    },
  },
  {
    name: 'get_company_extract',
    description: 'Get official registry card/extract for a company',
    inputSchema: {
      type: 'object',
      properties: {
        registryCode: {
          type: 'string',
          description: 'Company registry code (8 digits)',
        },
        language: {
          type: 'string',
          enum: ['et', 'en'],
          description: 'Language for the extract',
          default: 'en',
        },
      },
      required: ['registryCode'],
    },
  },
  {
    name: 'get_annual_reports',
    description: 'Get list of annual reports for a company',
    inputSchema: {
      type: 'object',
      properties: {
        registryCode: {
          type: 'string',
          description: 'Company registry code (8 digits)',
        },
      },
      required: ['registryCode'],
    },
  },
  {
    name: 'check_tax_debt',
    description: 'Check if a company has tax debts',
    inputSchema: {
      type: 'object',
      properties: {
        registryCode: {
          type: 'string',
          description: 'Company registry code (8 digits)',
        },
      },
      required: ['registryCode'],
    },
  },
  {
    name: 'get_board_members',
    description: 'Get board members and representatives of a company',
    inputSchema: {
      type: 'object',
      properties: {
        registryCode: {
          type: 'string',
          description: 'Company registry code (8 digits)',
        },
      },
      required: ['registryCode'],
    },
  },
  {
    name: 'search_by_person',
    description: 'Search companies by person name or personal code',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Person name',
        },
        personalCode: {
          type: 'string',
          description: 'Estonian personal identification code',
        },
      },
    },
  },
  {
    name: 'get_registry_statistics',
    description: 'Get statistics about Estonian Business Register',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'check_data_availability',
    description: 'Check which open data files are available for download',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
