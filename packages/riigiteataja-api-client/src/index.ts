export * from './types';
export * from './fetchers';
export * from './faq';
export * from './links';

import { ApiFetcher } from './fetchers/apiFetcher';
import { XmlFetcher } from './fetchers/xmlFetcher';
import { FAQService } from './faq';
import { LinkService } from './links';
import { LegalDocument, FetcherConfig } from './types';

export class RiigiteatajaClient {
  private apiFetcher: ApiFetcher;
  private xmlFetcherEt: XmlFetcher;
  private xmlFetcherEn: XmlFetcher;
  public faq: FAQService;
  public links: LinkService;

  constructor(config: FetcherConfig = {}) {
    this.apiFetcher = new ApiFetcher(config);
    this.xmlFetcherEt = new XmlFetcher({ ...config, language: 'et' });
    this.xmlFetcherEn = new XmlFetcher({ ...config, language: 'en' });
    this.faq = new FAQService();
    this.links = new LinkService();
  }

  async fetchDocument(
    globalId: number,
    language: 'et' | 'en' = 'et'
  ): Promise<LegalDocument | null> {
    if (language === 'en') {
      return this.xmlFetcherEn.fetchDocument(globalId);
    }
    // Try API first for Estonian, fallback to XML if needed
    const apiDoc = await this.apiFetcher.fetchDocument(globalId);
    if (apiDoc) return apiDoc;

    return this.xmlFetcherEt.fetchDocument(globalId);
  }

  async searchLaws(params: any = {}) {
    return this.apiFetcher.search(params);
  }

  async discoverTranslations(limit: number = 100) {
    return this.xmlFetcherEn.discoverDocuments(limit);
  }

  async fetchBilingual(globalId: number): Promise<{
    estonian: LegalDocument | null;
    english: LegalDocument | null;
  }> {
    const [estonian, english] = await Promise.all([
      this.fetchDocument(globalId, 'et'),
      this.fetchDocument(globalId, 'en')
    ]);

    return { estonian, english };
  }
}

export default RiigiteatajaClient;
