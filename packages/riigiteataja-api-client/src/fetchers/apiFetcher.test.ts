import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiFetcher } from './apiFetcher';

describe('ApiFetcher', () => {
  let fetcher: ApiFetcher;

  beforeEach(() => {
    fetcher = new ApiFetcher();
    global.fetch = vi.fn();
  });

  describe('search', () => {
    it('should construct correct search URL with parameters', async () => {
      const mockResponse = {
        metaandmed: { kokku: 10, leht: 1, limiit: 50 },
        aktid: []
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await fetcher.search({
        otsisona: 'test',
        tulemusi: 50
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('otsisona=test'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('tulemusi=50'),
        expect.any(Object)
      );
    });

    it('should transform API response correctly', async () => {
      const mockApiResponse = {
        metaandmed: { kokku: 1, leht: 1, limiit: 50 },
        aktid: [
          {
            globaalID: 123,
            pealkiri: 'Test Law',
            liik: 'seadus',
            url: '/akt/123',
            muudetud: '2024-01-01',
            kehtivus: { algus: '2024-01-01' },
            kehtivKehtetus: false
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      });

      const result = await fetcher.search();

      expect(result.total).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe(123);
      expect(result.results[0].pealkiri).toBe('Test Law');
      expect(result.results[0].kehtiv).toBe(true);
    });
  });

  describe('fetchDocument', () => {
    it('should fetch and parse XML document', async () => {
      const mockXml = `
        <oigusakt>
          <aktinimi>
            <nimi>
              <pealkiri>Test Law</pealkiri>
            </nimi>
          </aktinimi>
          <sisu>
            <paragrahv>
              <kuvatavnr>§ 1.</kuvatavnr>
              <loige>
                <sisutekst>
                  <tavatekst>Test content</tavatekst>
                </sisutekst>
              </loige>
            </paragrahv>
          </sisu>
        </oigusakt>
      `;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockXml
      });

      const document = await fetcher.fetchDocument(123);

      expect(document).not.toBeNull();
      expect(document?.title).toBe('Test Law');
      expect(document?.sections).toHaveLength(1);
      expect(document?.sections[0].number).toBe('§ 1.');
      expect(document?.sections[0].content).toBe('Test content');
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const document = await fetcher.fetchDocument(123);

      expect(document).toBeNull();
    });

    it('should reject HTML responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => '<!DOCTYPE html><html></html>'
      });

      const document = await fetcher.fetchDocument(123);

      expect(document).toBeNull();
    });
  });

  describe('retry logic', () => {
    it('should retry failed requests', async () => {
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ metaandmed: {}, aktid: [] })
        });
      });

      const result = await fetcher.search();

      expect(callCount).toBe(3);
      expect(result).toBeDefined();
    });

    it('should fail after max retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(fetcher.search()).rejects.toThrow('Network error');
      expect(global.fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });
});
