import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RiigiteatajaClient } from './index';

describe('RiigiteatajaClient', () => {
  let client: RiigiteatajaClient;

  beforeEach(() => {
    client = new RiigiteatajaClient();
    global.fetch = vi.fn();
  });

  describe('fetchDocument', () => {
    it('should use XmlFetcher for English documents', async () => {
      const mockHtml = '<html><a href="/en/tolge/xml/123">XML</a></html>';
      const mockXml = `
        <oigusakt>
          <aktinimi><nimi><pealkiri>English Law</pealkiri></nimi></aktinimi>
          <sisu></sisu>
        </oigusakt>
      `;

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, text: async () => mockHtml })
        .mockResolvedValueOnce({ ok: true, text: async () => mockXml });

      const document = await client.fetchDocument(123, 'en');

      expect(document?.language).toBe('en');
      expect(document?.title).toBe('English Law');
    });

    it('should try ApiFetcher first for Estonian documents', async () => {
      const mockXml = `
        <oigusakt>
          <aktinimi><nimi><pealkiri>Estonian Law</pealkiri></nimi></aktinimi>
          <sisu></sisu>
        </oigusakt>
      `;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockXml
      });

      const document = await client.fetchDocument(123, 'et');

      expect(document?.language).toBe('et');
      expect(document?.title).toBe('Estonian Law');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/akt/123/xml'),
        expect.any(Object)
      );
    });

    it('should fallback to XmlFetcher if ApiFetcher fails for Estonian', async () => {
      const mockHtml = '<html><a href="/akt/123/xml">XML</a></html>';
      const mockXml = `
        <oigusakt>
          <aktinimi><nimi><pealkiri>Estonian Law Fallback</pealkiri></nimi></aktinimi>
          <sisu></sisu>
        </oigusakt>
      `;

      // ApiFetcher will retry 3 times, so we need to reject 4 times total
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockRejectedValueOnce(new Error('API Error'))
        .mockRejectedValueOnce(new Error('API Error'))
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({ ok: true, text: async () => mockHtml })
        .mockResolvedValueOnce({ ok: true, text: async () => mockXml });

      const document = await client.fetchDocument(123, 'et');

      expect(document?.title).toBe('Estonian Law Fallback');
    });
  });

  describe('searchLaws', () => {
    it('should delegate to ApiFetcher', async () => {
      const mockResponse = {
        metaandmed: { kokku: 1, leht: 1, limiit: 50 },
        aktid: [
          {
            globaalID: 123,
            pealkiri: 'Test Law',
            liik: 'seadus'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.searchLaws({ otsisona: 'test' });

      expect(result.total).toBe(1);
      expect(result.results[0].id).toBe(123);
    });
  });

  describe('fetchBilingual', () => {
    it('should fetch both Estonian and English versions in parallel', async () => {
      const mockEstXml = `
        <oigusakt>
          <aktinimi><nimi><pealkiri>Estonian Version</pealkiri></nimi></aktinimi>
          <sisu></sisu>
        </oigusakt>
      `;

      const mockEngHtml = '<html><a href="/en/tolge/xml/123">XML</a></html>';
      const mockEngXml = `
        <oigusakt>
          <aktinimi><nimi><pealkiri>English Version</pealkiri></nimi></aktinimi>
          <sisu></sisu>
        </oigusakt>
      `;

      let fetchCallCount = 0;
      (global.fetch as any).mockImplementation((url: string) => {
        fetchCallCount++;

        if (url.includes('/akt/123/xml')) {
          return Promise.resolve({
            ok: true,
            text: async () => mockEstXml
          });
        }

        if (url.includes('/en/eli/123/consolide')) {
          return Promise.resolve({
            ok: true,
            text: async () => mockEngHtml
          });
        }

        if (url.includes('/en/tolge/xml/123')) {
          return Promise.resolve({
            ok: true,
            text: async () => mockEngXml
          });
        }

        return Promise.reject(new Error('Unexpected URL'));
      });

      const { estonian, english } = await client.fetchBilingual(123);

      expect(estonian?.title).toBe('Estonian Version');
      expect(estonian?.language).toBe('et');
      expect(english?.title).toBe('English Version');
      expect(english?.language).toBe('en');

      // Should fetch in parallel (not wait for one to complete)
      expect(fetchCallCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle missing translations gracefully', async () => {
      const mockEstXml = `
        <oigusakt>
          <aktinimi><nimi><pealkiri>Estonian Only</pealkiri></nimi></aktinimi>
          <sisu></sisu>
        </oigusakt>
      `;

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/akt/123/xml')) {
          return Promise.resolve({
            ok: true,
            text: async () => mockEstXml
          });
        }

        if (url.includes('/en/')) {
          return Promise.resolve({
            ok: false,
            status: 404
          });
        }

        return Promise.reject(new Error('Unexpected URL'));
      });

      const { estonian, english } = await client.fetchBilingual(123);

      expect(estonian?.title).toBe('Estonian Only');
      expect(english).toBeNull();
    });
  });

  describe('discoverTranslations', () => {
    it('should discover available English translations', async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/en/eli/100/consolide">Law 1</a>
            <a href="/en/eli/200/consolide">Law 2</a>
          </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml
      });

      const translations = await client.discoverTranslations(10);

      expect(translations).toHaveLength(2);
      expect(translations[0].globalId).toBe(100);
      expect(translations[1].globalId).toBe(200);
    });
  });
});
