import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const riigiteatajaTools: Tool[] = [
  // FAQ Tools
  {
    name: 'get_all_faq',
    description: 'Get all FAQ items from Riigiteataja (Estonian State Gazette)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_faq',
    description: 'Search FAQ items by keyword or phrase',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find relevant FAQ items',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_faq_by_category',
    description: 'Get FAQ items filtered by category',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description:
            'Category name (e.g., "Act Identification", "Documentation", "Linking", "Translations", "Technical", "Court Decisions")',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'get_faq_by_id',
    description: 'Get a specific FAQ item by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'FAQ item ID (e.g., "faq_1")',
        },
      },
      required: ['id'],
    },
  },

  // Link Generation Tools
  {
    name: 'create_dynamic_link',
    description: 'Create a dynamic link that always opens the current valid version of a legal act',
    inputSchema: {
      type: 'object',
      properties: {
        actUrl: {
          type: 'string',
          description: 'URL or path to the legal act',
        },
      },
      required: ['actUrl'],
    },
  },
  {
    name: 'create_paragraph_link',
    description: 'Create a link to a specific paragraph in a legal act',
    inputSchema: {
      type: 'object',
      properties: {
        actUrl: {
          type: 'string',
          description: 'URL or path to the legal act',
        },
        paragraphId: {
          type: 'string',
          description: 'Paragraph identifier (e.g., "12", "12lg1", "12lg1p3")',
        },
      },
      required: ['actUrl', 'paragraphId'],
    },
  },

  // Legal Document Tools (using shared API)
  {
    name: 'fetch_legal_document',
    description: 'Fetch a legal document by its global ID using the Riigiteataja API',
    inputSchema: {
      type: 'object',
      properties: {
        globalId: {
          type: 'number',
          description: 'Global ID of the document',
        },
        language: {
          type: 'string',
          description: 'Language (et or en)',
          enum: ['et', 'en'],
        },
      },
      required: ['globalId'],
    },
  },
  {
    name: 'search_legal_documents',
    description: 'Search for legal documents using the Riigiteataja API',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        kehtivus: {
          type: 'string',
          description: 'Validity status',
          enum: ['kehtiv', 'kehtetu', 'all'],
        },
        liik: {
          type: 'string',
          description: 'Document type',
        },
        andja: {
          type: 'string',
          description: 'Issuer',
        },
      },
      required: [],
    },
  },
  {
    name: 'fetch_bilingual_document',
    description: 'Fetch both Estonian and English versions of a legal document',
    inputSchema: {
      type: 'object',
      properties: {
        globalId: {
          type: 'number',
          description: 'Global ID of the document',
        },
      },
      required: ['globalId'],
    },
  },

  // Legal Act Tools
  {
    name: 'get_legal_act_metadata',
    description: 'Get basic metadata about a legal act (limited information due to no API access)',
    inputSchema: {
      type: 'object',
      properties: {
        actId: {
          type: 'string',
          description: 'Legal act ID or full URL',
        },
      },
      required: ['actId'],
    },
  },
  {
    name: 'generate_search_url',
    description: 'Generate a search URL for Riigiteataja to find legal acts',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        type: {
          type: 'string',
          description: 'Type of legal act (seadus, määrus, korraldus, käskkiri, or all)',
          enum: ['seadus', 'määrus', 'korraldus', 'käskkiri', 'all'],
        },
        status: {
          type: 'string',
          description: 'Status of the act (kehtiv, kehtetu, or all)',
          enum: ['kehtiv', 'kehtetu', 'all'],
        },
        dateFrom: {
          type: 'string',
          description: 'Start date for search (YYYY-MM-DD format)',
        },
        dateTo: {
          type: 'string',
          description: 'End date for search (YYYY-MM-DD format)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_translation_link',
    description: 'Create a link to the English translation of a legal act',
    inputSchema: {
      type: 'object',
      properties: {
        actId: {
          type: 'string',
          description: 'Legal act ID',
        },
      },
      required: ['actId'],
    },
  },
  {
    name: 'get_legal_act_types',
    description: 'Get a list of common legal act types in Estonia',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'extract_act_id',
    description: 'Extract the act ID from a Riigiteataja URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Riigiteataja URL',
        },
      },
      required: ['url'],
    },
  },

  // Cache Management
  {
    name: 'clear_cache',
    description: 'Clear the cached FAQ data to force a fresh fetch',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];
