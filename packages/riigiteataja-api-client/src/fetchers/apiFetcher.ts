import { parseStringPromise } from 'xml2js';
import {
  LegalDocument,
  DocumentSection,
  ApiSearchResult,
  ApiSearchParams,
  FetcherConfig
} from '../types';
import { BaseFetcher } from './baseFetcher';

/**
 * Fetcher for documents via the official Riigiteataja API
 * Primarily used for Estonian language documents
 */
export class ApiFetcher extends BaseFetcher {
  private readonly searchEndpoint = '/api/oigusakt_otsing/1/otsi';
  private readonly maxResultsPerPage = 500;

  constructor(config: FetcherConfig = {}) {
    super(config);
  }

  async search(params: ApiSearchParams = {}): Promise<ApiSearchResult> {
    const queryParams = new URLSearchParams();

    if (params.otsingutyyp) queryParams.set('otsingutyyp', params.otsingutyyp);
    if (params.otsisona) queryParams.set('otsisona', params.otsisona);
    if (params.valjakuulutamisaeg_algus)
      queryParams.set('valjakuulutamisaeg_algus', params.valjakuulutamisaeg_algus);
    if (params.valjakuulutamisaeg_lopp)
      queryParams.set('valjakuulutamisaeg_lopp', params.valjakuulutamisaeg_lopp);
    if (params.kehtivaeg_algus) queryParams.set('kehtivaeg_algus', params.kehtivaeg_algus);
    if (params.kehtivaeg_lopp) queryParams.set('kehtivaeg_lopp', params.kehtivaeg_lopp);
    if (params.akti_liik) queryParams.set('akti_liik', params.akti_liik);
    if (params.andja) queryParams.set('andja', params.andja);
    if (params.sorteeri) queryParams.set('sorteeri', params.sorteeri);
    queryParams.set('lehekull', String(params.lehekull || 1));
    queryParams.set('tulemusi', String(params.tulemusi || this.maxResultsPerPage));

    const url = `${this.baseUrl}${this.searchEndpoint}?${queryParams}`;

    const response = await this.fetchWithRetry(url);
    const data = await response.json();

    return this.transformApiResponse(data);
  }

  async fetchDocument(globalId: number): Promise<LegalDocument | null> {
    try {
      const xmlPath = `/akt/${globalId}/xml`;
      const xmlData = await this.fetchXml(xmlPath);
      if (!xmlData) return null;

      return this.parseXmlToDocument(xmlData, globalId);
    } catch (error) {
      console.error(`Failed to fetch document ${globalId} via API:`, error);
      return null;
    }
  }

  private async fetchXml(path: string): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchWithRetry(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch XML: ${response.status}`);
    }

    const xmlContent = await response.text();

    if (xmlContent.includes('<!DOCTYPE html>')) {
      throw new Error('Received HTML instead of XML');
    }

    return await parseStringPromise(xmlContent, {
      explicitArray: false,
      ignoreAttrs: false,
      trim: true,
      normalizeTags: true,
      explicitRoot: false
    });
  }

  private transformApiResponse(data: any): ApiSearchResult {
    const results =
      data.aktid?.map((akt: any) => ({
        id: akt.globaalID,
        pealkiri: akt.pealkiri,
        liik: akt.liik,
        url: akt.url,
        avaldamisaeg: akt.muudetud,
        joustumine: akt.kehtivus?.algus,
        kehtiv: !akt.kehtivKehtetus,
        muutmisaeg: akt.muudetud
      })) || [];

    return {
      results,
      total: data.metaandmed?.kokku || 0,
      page: data.metaandmed?.leht || 1,
      pageSize: data.metaandmed?.limiit || this.maxResultsPerPage
    };
  }

  private parseXmlToDocument(xmlData: any, globalId: number): LegalDocument {
    const metadata = Array.isArray(xmlData.metaandmed)
      ? xmlData.metaandmed[xmlData.metaandmed.length - 1]
      : xmlData.metaandmed;

    const title = xmlData.aktinimi?.nimi?.pealkiri || xmlData.pealkiri || '';
    const sections = this.extractSections(xmlData);

    const content = sections
      .map(s => `${s.number}${s.title ? ' ' + s.title : ''}\n${s.content}`)
      .join('\n\n');

    return {
      id: `law-${globalId}`,
      title,
      type: xmlData.liik || 'seadus',
      url: `${this.baseUrl}/akt/${globalId}`,
      datePublished: metadata?.vastuvoetud?.aktikuupaev
        ? new Date(metadata.vastuvoetud.aktikuupaev)
        : null,
      dateEffective: metadata?.kehtivus?.algus || new Date().toISOString(),
      language: this.language as 'et' | 'en',
      content,
      sections,
      metadata: {
        issuer: metadata?.valjaandja,
        status: 'avaldatud',
        amendments: [],
        relatedDocuments: [],
        keywords: metadata?.marksona
          ? Array.isArray(metadata.marksona)
            ? metadata.marksona
            : [metadata.marksona]
          : [],
        consolidatedVersion: true,
        fetchedAt: new Date().toISOString(),
        source: 'riigiteataja.ee API',
        globalId,
        hasEnglishTranslation: false
      }
    };
  }

  protected extractSections(xmlData: any): DocumentSection[] {
    const sections: DocumentSection[] = [];

    const processParagraph = (para: any): void => {
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
          } else if (typeof p.kuvatavnr === 'object') {
            number = JSON.stringify(p.kuvatavnr);
          }
        }

        if (!number && p.paragrahvnr) {
          number = `§ ${p.paragrahvnr}`;
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
            }
          }
        }

        if (p.paragrahvpealkiri || content) {
          sections.push({
            id: p['$']?.id || `para-${p.paragrahvnr || sections.length}`,
            number,
            title: p.paragrahvpealkiri || '',
            content: content.trim(),
            level: 1
          });
        }
      }
    };

    if (xmlData.sisu) {
      if (xmlData.sisu.paragrahv) {
        processParagraph(xmlData.sisu.paragrahv);
      }

      if (xmlData.sisu.peatykk) {
        const chapters = Array.isArray(xmlData.sisu.peatykk)
          ? xmlData.sisu.peatykk
          : [xmlData.sisu.peatykk];
        for (const chapter of chapters) {
          if (chapter.paragrahv) {
            processParagraph(chapter.paragrahv);
          }

          if (chapter.jagu) {
            const jagud = Array.isArray(chapter.jagu) ? chapter.jagu : [chapter.jagu];
            for (const jagu of jagud) {
              if (jagu.paragrahv) {
                processParagraph(jagu.paragrahv);
              }
            }
          }
        }
      }
    }

    return sections;
  }
}
