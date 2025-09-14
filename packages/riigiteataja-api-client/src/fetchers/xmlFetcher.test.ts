import { describe, it, expect, beforeEach, vi } from 'vitest';
import { XmlFetcher } from './xmlFetcher';

describe('XmlFetcher', () => {
  let fetcherEn: XmlFetcher;
  let fetcherEt: XmlFetcher;

  beforeEach(() => {
    fetcherEn = new XmlFetcher({ language: 'en' });
    fetcherEt = new XmlFetcher({ language: 'et' });
    global.fetch = vi.fn();
  });

  describe('discoverDocuments', () => {
    it('should discover English translations from HTML', async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/en/eli/512092025009/consolide">Constitution of Estonia</a>
            <a href="/en/eli/512092025010/consolide">Tax Law</a>
          </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml
      });

      const documents = await fetcherEn.discoverDocuments(10);

      expect(documents).toHaveLength(2);
      expect(documents[0].globalId).toBe(512092025009);
      expect(documents[0].title).toBe('Constitution of Estonia');
      expect(documents[1].globalId).toBe(512092025010);
    });

    it('should respect limit parameter', async () => {
      const mockHtml = `
        <html>
          <body>
            ${Array.from(
              { length: 10 },
              (_, i) => `<a href="/en/eli/${100 + i}/consolide">Law ${i}</a>`
            ).join('\n')}
          </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml
      });

      const documents = await fetcherEn.discoverDocuments(5);

      expect(documents).toHaveLength(5);
    });
  });

  describe('fetchDocument', () => {
    it('should fetch English translation with correct URL', async () => {
      const mockDiscoveryHtml = `
        <html>
          <body>
            <a href="/en/tolge/xml/999">Download XML</a>
          </body>
        </html>
      `;

      const mockXml = `
        <oigusakt>
          <aktinimi>
            <nimi>
              <pealkiri>Test Law EN</pealkiri>
            </nimi>
          </aktinimi>
          <sisu>
            <paragrahv>
              <kuvatavnr>§ 1.</kuvatavnr>
              <loige>
                <sisutekst>
                  <tavatekst>English content</tavatekst>
                </sisutekst>
              </loige>
            </paragrahv>
          </sisu>
        </oigusakt>
      `;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockDiscoveryHtml
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockXml
        });

      const document = await fetcherEn.fetchDocument(123);

      expect(document).not.toBeNull();
      expect(document?.language).toBe('en');
      expect(document?.title).toBe('Test Law EN');
      expect(document?.sections[0].content).toBe('English content');
    });

    it('should handle missing translations gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const document = await fetcherEn.fetchDocument(123);

      expect(document).toBeNull();
    });

    it('should extract sections with proper numbering', async () => {
      const mockXml = `
        <oigusakt>
          <sisu>
            <paragrahv>
              <kuvatavnr><![CDATA[§ 1.]]></kuvatavnr>
              <paragrahvpealkiri>First Section</paragrahvpealkiri>
              <loige>
                <sisutekst>
                  <tavatekst>Content 1</tavatekst>
                </sisutekst>
              </loige>
            </paragrahv>
            <paragrahv>
              <paragrahvnr>2</paragrahvnr>
              <loige>
                <sisutekst>
                  <tavatekst>Content 2</tavatekst>
                </sisutekst>
              </loige>
            </paragrahv>
          </sisu>
        </oigusakt>
      `;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '<html><a href="/en/tolge/xml/123">XML</a></html>'
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockXml
        });

      const document = await fetcherEn.fetchDocument(123);

      expect(document?.sections).toHaveLength(2);
      expect(document?.sections[0].number).toBe('§ 1.');
      expect(document?.sections[0].title).toBe('First Section');
      expect(document?.sections[1].number).toBe('§ 2');
    });
  });

  describe('language configuration', () => {
    it('should use correct URLs for Estonian', async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/eli/123/consolide">Estonian Law</a>
          </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml
      });

      const documents = await fetcherEt.discoverDocuments(10);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/eli/index'),
        expect.any(Object)
      );
    });

    it('should use correct URLs for English', async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/en/eli/123/consolide">English Law</a>
          </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml
      });

      const documents = await fetcherEn.discoverDocuments(10);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/en/eli/index'),
        expect.any(Object)
      );
    });
  });
});
