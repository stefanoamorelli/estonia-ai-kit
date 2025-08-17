#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import soap from 'soap';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import NodeCache from 'node-cache';

const parseXML = promisify(parseString);
const cache = new NodeCache({ stdTTL: 300 });

const XROAD_REGISTRY_CODE = '70000349';
const XROAD_SUBSYSTEM_TOR = 'tor';
const XROAD_SUBSYSTEM_MKR = 'mkrliides';
const XROAD_SUBSYSTEM_TSD = 'tsd';

interface XRoadHeader {
  client: {
    xRoadInstance: string;
    memberClass: string;
    memberCode: string;
    subsystemCode: string;
  };
  service: {
    xRoadInstance: string;
    memberClass: string;
    memberCode: string;
    subsystemCode: string;
    serviceCode: string;
    serviceVersion: string;
  };
  userId: string;
  id: string;
  protocolVersion: string;
}

interface TaxDebtInfo {
  hasDebt: boolean;
  debtAmount?: number;
  lastChecked: string;
  registryCode: string;
}

interface EmploymentRegistration {
  employeeCode: string;
  employeeName: string;
  startDate: string;
  endDate?: string;
  position?: string;
  salary?: number;
}

interface VATReturn {
  period: string;
  submitted: boolean;
  submissionDate?: string;
  amount?: number;
  status: string;
}

class EMTAMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'emta-mcp-server',
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
          name: 'check_tax_debt',
          description: 'Check if a company or person has tax debts with EMTA',
          inputSchema: {
            type: 'object',
            properties: {
              registryCode: {
                type: 'string',
                description: 'Company registry code or personal identification code',
              },
              type: {
                type: 'string',
                enum: ['company', 'person'],
                description: 'Type of entity to check',
                default: 'company',
              },
            },
            required: ['registryCode'],
          },
        },
        {
          name: 'get_vat_info',
          description: 'Get VAT registration information for a company',
          inputSchema: {
            type: 'object',
            properties: {
              registryCode: {
                type: 'string',
                description: 'Company registry code',
              },
            },
            required: ['registryCode'],
          },
        },
        {
          name: 'check_vat_number',
          description: 'Validate Estonian VAT number',
          inputSchema: {
            type: 'object',
            properties: {
              vatNumber: {
                type: 'string',
                description: 'VAT number to validate (format: EE + 9 digits)',
              },
            },
            required: ['vatNumber'],
          },
        },
        {
          name: 'get_tax_residency',
          description: 'Get tax residency information for a person',
          inputSchema: {
            type: 'object',
            properties: {
              personalCode: {
                type: 'string',
                description: 'Estonian personal identification code',
              },
              year: {
                type: 'number',
                description: 'Tax year',
              },
            },
            required: ['personalCode', 'year'],
          },
        },
        {
          name: 'get_employment_registrations',
          description: 'Get employment registrations for a company',
          inputSchema: {
            type: 'object',
            properties: {
              registryCode: {
                type: 'string',
                description: 'Company registry code',
              },
              startDate: {
                type: 'string',
                description: 'Start date for the period (YYYY-MM-DD)',
              },
              endDate: {
                type: 'string',
                description: 'End date for the period (YYYY-MM-DD)',
              },
            },
            required: ['registryCode'],
          },
        },
        {
          name: 'register_employment',
          description: 'Register new employment (requires authorization)',
          inputSchema: {
            type: 'object',
            properties: {
              companyCode: {
                type: 'string',
                description: 'Company registry code',
              },
              employeeCode: {
                type: 'string',
                description: 'Employee personal identification code',
              },
              startDate: {
                type: 'string',
                description: 'Employment start date (YYYY-MM-DD)',
              },
              position: {
                type: 'string',
                description: 'Job position',
              },
              salary: {
                type: 'number',
                description: 'Monthly salary in EUR',
              },
            },
            required: ['companyCode', 'employeeCode', 'startDate'],
          },
        },
        {
          name: 'get_vat_returns',
          description: 'Get VAT return information for a company',
          inputSchema: {
            type: 'object',
            properties: {
              registryCode: {
                type: 'string',
                description: 'Company registry code',
              },
              year: {
                type: 'number',
                description: 'Tax year',
              },
            },
            required: ['registryCode', 'year'],
          },
        },
        {
          name: 'get_social_tax_info',
          description: 'Get social tax payment information',
          inputSchema: {
            type: 'object',
            properties: {
              registryCode: {
                type: 'string',
                description: 'Company registry code',
              },
              period: {
                type: 'string',
                description: 'Period in format YYYY-MM',
              },
            },
            required: ['registryCode', 'period'],
          },
        },
        {
          name: 'get_customs_declarations',
          description: 'Get customs declarations for a company',
          inputSchema: {
            type: 'object',
            properties: {
              registryCode: {
                type: 'string',
                description: 'Company registry code',
              },
              startDate: {
                type: 'string',
                description: 'Start date (YYYY-MM-DD)',
              },
              endDate: {
                type: 'string',
                description: 'End date (YYYY-MM-DD)',
              },
            },
            required: ['registryCode'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'check_tax_debt':
            return await this.checkTaxDebt(
              args.registryCode as string,
              args.type as string || 'company'
            );
          
          case 'get_vat_info':
            return await this.getVATInfo(args.registryCode as string);
          
          case 'check_vat_number':
            return await this.checkVATNumber(args.vatNumber as string);
          
          case 'get_tax_residency':
            return await this.getTaxResidency(
              args.personalCode as string,
              args.year as number
            );
          
          case 'get_employment_registrations':
            return await this.getEmploymentRegistrations(
              args.registryCode as string,
              args.startDate as string,
              args.endDate as string
            );
          
          case 'register_employment':
            return await this.registerEmployment(
              args.companyCode as string,
              args.employeeCode as string,
              args.startDate as string,
              args.position as string,
              args.salary as number
            );
          
          case 'get_vat_returns':
            return await this.getVATReturns(
              args.registryCode as string,
              args.year as number
            );
          
          case 'get_social_tax_info':
            return await this.getSocialTaxInfo(
              args.registryCode as string,
              args.period as string
            );
          
          case 'get_customs_declarations':
            return await this.getCustomsDeclarations(
              args.registryCode as string,
              args.startDate as string,
              args.endDate as string
            );
          
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

  private generateXRoadHeader(serviceCode: string, subsystem: string): XRoadHeader {
    return {
      client: {
        xRoadInstance: 'EE',
        memberClass: 'COM',
        memberCode: 'YOUR_MEMBER_CODE',
        subsystemCode: 'YOUR_SUBSYSTEM',
      },
      service: {
        xRoadInstance: 'EE',
        memberClass: 'GOV',
        memberCode: XROAD_REGISTRY_CODE,
        subsystemCode: subsystem,
        serviceCode: serviceCode,
        serviceVersion: 'v1',
      },
      userId: 'EE:YOUR_USER_ID',
      id: `${Date.now()}`,
      protocolVersion: '4.0',
    };
  }

  private async checkTaxDebt(registryCode: string, type: string) {
    const cacheKey = `tax_debt_${registryCode}_${type}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(cached, null, 2),
          },
        ],
      };
    }

    const mockData: TaxDebtInfo = {
      hasDebt: false,
      registryCode: registryCode,
      lastChecked: new Date().toISOString(),
    };

    cache.set(cacheKey, mockData);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ...mockData,
            note: 'X-Road service requires authentication. This is simulated data.',
            service: `EE/GOV/${XROAD_REGISTRY_CODE}/${XROAD_SUBSYSTEM_TOR}/maksuvolgnevus`,
          }, null, 2),
        },
      ],
    };
  }

  private async getVATInfo(registryCode: string) {
    const cacheKey = `vat_info_${registryCode}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(cached, null, 2),
          },
        ],
      };
    }

    const vatNumber = `EE${registryCode.padStart(9, '0')}`;
    const mockData = {
      registryCode: registryCode,
      vatNumber: vatNumber,
      isVATRegistered: true,
      registrationDate: '2020-01-15',
      status: 'Active',
      vatPeriod: 'Monthly',
      lastReturn: '2024-11-01',
    };

    cache.set(cacheKey, mockData);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ...mockData,
            note: 'X-Road service requires authentication. This is simulated data.',
            service: `EE/GOV/${XROAD_REGISTRY_CODE}/${XROAD_SUBSYSTEM_MKR}/kmnrinfo`,
          }, null, 2),
        },
      ],
    };
  }

  private async checkVATNumber(vatNumber: string) {
    if (!vatNumber.startsWith('EE') || vatNumber.length !== 11) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              valid: false,
              error: 'Invalid VAT number format. Estonian VAT numbers must start with EE followed by 9 digits.',
            }, null, 2),
          },
        ],
      };
    }

    const registryCode = vatNumber.substring(2).replace(/^0+/, '');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            vatNumber: vatNumber,
            valid: true,
            registryCode: registryCode,
            country: 'Estonia',
            countryCode: 'EE',
            note: 'Basic format validation only. Full validation requires X-Road access.',
          }, null, 2),
        },
      ],
    };
  }

  private async getTaxResidency(personalCode: string, year: number) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            personalCode: personalCode,
            year: year,
            isResident: true,
            daysInEstonia: 183,
            taxRate: 20,
            note: 'X-Road service requires authentication. This is simulated data.',
            service: `EE/GOV/${XROAD_REGISTRY_CODE}/${XROAD_SUBSYSTEM_TOR}/residentsus`,
          }, null, 2),
        },
      ],
    };
  }

  private async getEmploymentRegistrations(registryCode: string, startDate?: string, endDate?: string) {
    const mockData: EmploymentRegistration[] = [
      {
        employeeCode: '38001010001',
        employeeName: 'John Doe',
        startDate: '2023-01-15',
        position: 'Software Developer',
        salary: 3500,
      },
      {
        employeeCode: '49002020002',
        employeeName: 'Jane Smith',
        startDate: '2023-06-01',
        position: 'Project Manager',
        salary: 4200,
      },
    ];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            registryCode: registryCode,
            period: {
              start: startDate || 'all',
              end: endDate || 'current',
            },
            employments: mockData,
            totalEmployees: mockData.length,
            note: 'X-Road service requires authentication. This is simulated data.',
            service: `EE/GOV/${XROAD_REGISTRY_CODE}/${XROAD_SUBSYSTEM_TOR}/toosuhtedParing`,
          }, null, 2),
        },
      ],
    };
  }

  private async registerEmployment(
    companyCode: string,
    employeeCode: string,
    startDate: string,
    position?: string,
    salary?: number
  ) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'simulated',
            message: 'Employment registration would be submitted via X-Road',
            data: {
              companyCode,
              employeeCode,
              startDate,
              position,
              salary,
            },
            note: 'This service requires X-Road authentication and does not require Service Level Agreement',
            service: `EE/GOV/${XROAD_REGISTRY_CODE}/${XROAD_SUBSYSTEM_TOR}/TOOTREG/v2`,
          }, null, 2),
        },
      ],
    };
  }

  private async getVATReturns(registryCode: string, year: number) {
    const mockData: VATReturn[] = [];
    for (let month = 1; month <= 12; month++) {
      mockData.push({
        period: `${year}-${month.toString().padStart(2, '0')}`,
        submitted: month < 11,
        submissionDate: month < 11 ? `${year}-${(month + 1).toString().padStart(2, '0')}-20` : undefined,
        amount: month < 11 ? Math.floor(Math.random() * 10000) : undefined,
        status: month < 11 ? 'Submitted' : 'Pending',
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            registryCode: registryCode,
            year: year,
            returns: mockData,
            note: 'X-Road service requires authentication. This is simulated data.',
            service: `EE/GOV/${XROAD_REGISTRY_CODE}/${XROAD_SUBSYSTEM_MKR}/kmdParing`,
          }, null, 2),
        },
      ],
    };
  }

  private async getSocialTaxInfo(registryCode: string, period: string) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            registryCode: registryCode,
            period: period,
            socialTaxBase: 15000,
            socialTaxAmount: 4950,
            socialTaxRate: 33,
            employeeCount: 5,
            submitted: true,
            submissionDate: `${period}-20`,
            note: 'X-Road service requires authentication. This is simulated data.',
            service: `EE/GOV/${XROAD_REGISTRY_CODE}/${XROAD_SUBSYSTEM_TSD}/getTsdStatus`,
          }, null, 2),
        },
      ],
    };
  }

  private async getCustomsDeclarations(registryCode: string, startDate?: string, endDate?: string) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            registryCode: registryCode,
            period: {
              start: startDate || '2024-01-01',
              end: endDate || new Date().toISOString().split('T')[0],
            },
            declarations: [
              {
                declarationNumber: 'EE2024000123',
                date: '2024-10-15',
                type: 'Import',
                status: 'Cleared',
                value: 25000,
                currency: 'EUR',
              },
              {
                declarationNumber: 'EE2024000456',
                date: '2024-11-01',
                type: 'Export',
                status: 'Cleared',
                value: 35000,
                currency: 'EUR',
              },
            ],
            totalDeclarations: 2,
            note: 'X-Road service requires authentication. This is simulated data.',
            service: 'Customs declarations via X-Road',
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('EMTA MCP Server running on stdio');
  }
}

const server = new EMTAMCPServer();
server.run().catch(console.error);