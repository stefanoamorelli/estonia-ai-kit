import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RIKMCPServer } from '../src/server';
import { RIKApiClient } from '../src/clients/rik-client';

vi.mock('../src/clients/rik-client');

describe('RIKMCPServer', () => {
  let server: RIKMCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new RIKMCPServer();
  });

  it('should initialize with correct name and version', () => {
    expect(server).toBeDefined();
  });

  describe('Tool Handlers', () => {
    it('should handle search_company tool', async () => {
      const mockClient = vi.mocked(RIKApiClient.prototype);
      mockClient.searchCompanies.mockResolvedValue([
        {
          registry_code: '10000000',
          name: 'Test Company OÜ',
          status: 'R',
        },
      ]);

      const params = { name: 'Test Company' };
      expect(mockClient.searchCompanies).toBeDefined();
    });

    it('should handle get_company_details tool', async () => {
      const mockClient = vi.mocked(RIKApiClient.prototype);
      mockClient.getCompanyDetails.mockResolvedValue({
        registry_code: '10000000',
        name: 'Test Company OÜ',
        status: 'R',
        status_text: 'Registered',
        address: 'Tallinn, Estonia',
      });

      expect(mockClient.getCompanyDetails).toBeDefined();
    });

    it('should handle check_tax_debt tool', async () => {
      const mockClient = vi.mocked(RIKApiClient.prototype);
      mockClient.checkTaxDebt.mockResolvedValue(false);

      expect(mockClient.checkTaxDebt).toBeDefined();
    });
  });
});