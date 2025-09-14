import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import { LegalDocument, DocumentSection, EnglishTranslation, FetcherConfig } from '../types';
import { BaseFetcher } from './baseFetcher';

/**
 * Fetcher for XML documents with HTML discovery
 * Used for translations and documents not available via API
 */
export class XmlFetcher extends BaseFetcher {
  constructor(config: FetcherConfig = {}) {
    super(config);
  }

  async discoverDocuments(limit: number = 100): Promise<EnglishTranslation[]> {
    const documents: EnglishTranslation[] = [];
    const searchUrl =
      this.language === 'en' ? `${this.baseUrl}/en/eli/index` : `${this.baseUrl}/eli/index`;

    try {
      const response = await this.fetchWithRetry(searchUrl);
      const html = await response.text();
      const $ = cheerio.load(html);

      const selector = this.language === 'en' ? 'a[href*="/en/eli/"]' : 'a[href*="/eli/"]';

      $(selector).each((_, element) => {
        const href = $(element).attr('href');
        const title = $(element).text().trim();

        if (href && title && href.includes('/consolide')) {
          const match = href.match(/\/(?:en\/)?eli\/(\d+)\/consolide/);
          if (match) {
            const globalId = parseInt(match[1], 10);
            documents.push({
              id: `law-${this.language}-${globalId}`,
              globalId,
              translationId: String(globalId),
              title,
              url: `${this.baseUrl}${href}`,
              xmlUrl: this.getXmlUrl(globalId)
            });
          }
        }

        if (documents.length >= limit) return false;
      });
    } catch (error) {
      console.error('Failed to discover documents:', error);
    }

    return documents;
  }

  async fetchDocument(globalId: number): Promise<LegalDocument | null> {
    try {
      const documentId = await this.discoverDocumentId(globalId);
      if (!documentId) {
        console.warn(`No document found for ID ${globalId} in ${this.language}`);
        return null;
      }

      const xmlUrl = this.getXmlUrl(documentId);
      const response = await this.fetchWithRetry(xmlUrl);

      if (!response.ok) {
        console.warn(`Failed to fetch XML for document ${documentId}: ${response.status}`);
        return null;
      }

      const xmlContent = await response.text();

      if (xmlContent.includes('<!DOCTYPE html>')) {
        console.warn(`Received HTML instead of XML for document ${documentId}`);
        return null;
      }

      const xmlData = await parseStringPromise(xmlContent, {
        explicitArray: false,
        ignoreAttrs: false,
        trim: true,
        normalizeTags: true,
        explicitRoot: false
      });

      return this.parseXmlDocument(xmlData, globalId, documentId);
    } catch (error) {
      console.error(`Failed to fetch document ${globalId}:`, error);
      return null;
    }
  }

  private getXmlUrl(documentId: string | number): string {
    if (this.language === 'en') {
      return `${this.baseUrl}/en/tolge/xml/${documentId}`;
    }
    return `${this.baseUrl}/akt/${documentId}/xml`;
  }

  private async discoverDocumentId(globalId: number): Promise<string | null> {
    try {
      const searchUrl =
        this.language === 'en'
          ? `${this.baseUrl}/en/eli/${globalId}/consolide`
          : `${this.baseUrl}/eli/${globalId}/consolide`;

      const response = await this.fetchWithRetry(searchUrl);

      if (!response.ok) return null;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Look for XML link
      const xmlLinkSelector =
        this.language === 'en' ? 'a[href*="/en/tolge/xml/"]' : 'a[href*="/akt/"][href*="/xml"]';

      const xmlLink = $(xmlLinkSelector).first();
      if (xmlLink.length) {
        const href = xmlLink.attr('href');
        const match =
          this.language === 'en'
            ? href?.match(/\/en\/tolge\/xml\/(\d+)/)
            : href?.match(/\/akt\/(\d+)\/xml/);
        if (match) {
          return match[1];
        }
      }

      // Look for data attribute
      const dataAttr = $('[data-document-id], [data-translation-id]').first();
      if (dataAttr.length) {
        return dataAttr.attr('data-document-id') || dataAttr.attr('data-translation-id') || null;
      }

      return String(globalId);
    } catch (error) {
      console.error(`Failed to discover document ID for ${globalId}:`, error);
      return null;
    }
  }

  private parseXmlDocument(xmlData: any, globalId: number, documentId: string): LegalDocument {
    const title = this.extractTitle(xmlData);
    const sections = this.extractSections(xmlData);
    const content = sections
      .map(s => `${s.number}${s.title ? ' ' + s.title : ''}\n${s.content}`)
      .join('\n\n');

    return {
      id: `law-${this.language}-${documentId}`,
      title,
      type: 'seadus',
      url:
        this.language === 'en'
          ? `${this.baseUrl}/en/eli/${globalId}/consolide`
          : `${this.baseUrl}/eli/${globalId}/consolide`,
      datePublished: null,
      dateEffective: new Date().toISOString(),
      language: this.language as 'et' | 'en',
      content,
      sections,
      metadata: {
        issuer: 'Riigikogu',
        status: 'avaldatud',
        amendments: [],
        relatedDocuments: [],
        keywords: [],
        consolidatedVersion: true,
        fetchedAt: new Date().toISOString(),
        source: `riigiteataja.ee ${this.language.toUpperCase()}`,
        globalId,
        translationId: documentId,
        hasEnglishTranslation: this.language === 'en'
      }
    };
  }

  private extractTitle(xmlData: any): string {
    if (xmlData.oigusakt?.metaandmed?.aktinimi?.pealkiri) {
      return xmlData.oigusakt.metaandmed.aktinimi.pealkiri;
    }
    if (xmlData.metaandmed?.aktinimi?.pealkiri) {
      return xmlData.metaandmed.aktinimi.pealkiri;
    }
    if (xmlData.aktinimi?.nimi?.pealkiri) {
      return xmlData.aktinimi.nimi.pealkiri;
    }
    return 'Untitled Document';
  }

  protected extractSections(xmlData: any): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const root = xmlData.oigusakt || xmlData;

    const processParagraph = (para: any, index: number): void => {
      if (!para) return;

      const paragraphs = Array.isArray(para) ? para : [para];

      for (const p of paragraphs) {
        let number = '';

        if (p.kuvatavnr) {
          if (typeof p.kuvatavnr === 'string') {
            number = p.kuvatavnr.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          } else if (p.kuvatavnr?._ !== undefined) {
            number = String(p.kuvatavnr._)
              .replace(/<!\[CDATA\[|\]\]>/g, '')
              .trim();
          }
        }

        if (!number && p.paragrahvnr) {
          number = `§ ${p.paragrahvnr}`;
        }

        if (!number) {
          number = `§ ${index + 1}`;
        }

        let content = '';

        if (p.loige) {
          const loiged = Array.isArray(p.loige) ? p.loige : [p.loige];
          for (const loige of loiged) {
            if (loige.sisutekst) {
              const text = this.extractText(loige.sisutekst);
              if (text) {
                content += text + '\n';
              }
            } else if (typeof loige === 'string') {
              content += loige + '\n';
            }
          }
        } else if (p.sisutekst) {
          content = this.extractText(p.sisutekst);
        } else if (p.tavatekst) {
          content = this.extractText({ tavatekst: p.tavatekst });
        }

        if (content || p.paragrahvpealkiri) {
          sections.push({
            id: `para-${sections.length + 1}`,
            number,
            title: p.paragrahvpealkiri || '',
            content: content.trim(),
            level: 1
          });
        }
      }
    };

    if (root.sisu) {
      if (root.sisu.paragrahv) {
        processParagraph(root.sisu.paragrahv, 0);
      }

      if (root.sisu.peatykk) {
        const chapters = Array.isArray(root.sisu.peatykk) ? root.sisu.peatykk : [root.sisu.peatykk];
        for (const chapter of chapters) {
          if (chapter.paragrahv) {
            processParagraph(chapter.paragrahv, sections.length);
          }

          if (chapter.jagu) {
            const jagud = Array.isArray(chapter.jagu) ? chapter.jagu : [chapter.jagu];
            for (const jagu of jagud) {
              if (jagu.paragrahv) {
                processParagraph(jagu.paragrahv, sections.length);
              }
            }
          }
        }
      }
    }

    return sections;
  }
}
