export interface SearchParams {
  query: string;
  type?: 'seadus' | 'määrus' | 'korraldus' | 'käskkiri' | 'all';
  status?: 'kehtiv' | 'kehtetu' | 'all';
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export class LinkService {
  private baseUrl = 'https://www.riigiteataja.ee';

  /**
   * Create a dynamic link that always opens the current valid version of a legal act
   */
  createDynamicLink(actUrl: string): string {
    if (!actUrl.startsWith('http')) {
      actUrl = `${this.baseUrl}${actUrl.startsWith('/') ? '' : '/'}${actUrl}`;
    }
    return `${actUrl}${actUrl.includes('?') ? '&' : '?'}leiaKehtiv`;
  }

  /**
   * Create a link to a specific paragraph in a legal act
   */
  createParagraphLink(actUrl: string, paragraphId: string): string {
    if (!actUrl.startsWith('http')) {
      actUrl = `${this.baseUrl}${actUrl.startsWith('/') ? '' : '/'}${actUrl}`;
    }
    return `${actUrl}#para${paragraphId}`;
  }

  /**
   * Create a link to the English translation of a legal act
   */
  createTranslationLink(actId: string, language: 'en' = 'en'): string {
    const baseUrl = actId.startsWith('http') ? actId : `${this.baseUrl}/${language}/eli/${actId}`;

    return `${baseUrl}/consolide/current`;
  }

  /**
   * Create a link to a specific version of a legal act
   */
  createSpecificVersionLink(actId: string, version: string): string {
    const baseUrl = actId.startsWith('http') ? actId : `${this.baseUrl}/akt/${actId}`;

    return `${baseUrl}/${version}`;
  }

  /**
   * Generate a search URL for Riigiteataja with specified parameters
   */
  generateSearchUrl(params: SearchParams): string {
    const searchParams = new URLSearchParams();

    if (params.query) {
      searchParams.append('sakk', params.query);
    }
    if (params.type && params.type !== 'all') {
      searchParams.append('liik', params.type);
    }
    if (params.status && params.status !== 'all') {
      searchParams.append('kehtivus', params.status);
    }
    if (params.dateFrom) {
      searchParams.append('kuupaev_algus', params.dateFrom);
    }
    if (params.dateTo) {
      searchParams.append('kuupaev_lopp', params.dateTo);
    }

    return `${this.baseUrl}/otsingu_tulemus.html?${searchParams.toString()}`;
  }

  /**
   * Extract act ID from a Riigiteataja URL
   */
  extractActIdFromUrl(url: string): string {
    // Try to match /akt/123456789 pattern
    const match = url.match(/akt\/(\d+)/i);
    if (match) {
      return match[1];
    }

    // Try to match /eli/.../123456789 pattern
    const eliMatch = url.match(/eli\/[^/]+\/(\d+)/i);
    if (eliMatch) {
      return eliMatch[1];
    }

    // Fallback to last path segment
    const pathParts = url.split('/');
    return pathParts[pathParts.length - 1].replace(/[^\w\d]/g, '') || 'unknown';
  }

  /**
   * Get common legal act types in Estonia
   */
  getCommonLegalActTypes(): Array<{ type: string; description: string; estonian: string }> {
    return [
      { type: 'seadus', description: 'Law', estonian: 'seadus' },
      { type: 'määrus', description: 'Regulation', estonian: 'määrus' },
      { type: 'korraldus', description: 'Order', estonian: 'korraldus' },
      { type: 'käskkiri', description: 'Directive', estonian: 'käskkiri' },
      { type: 'otsus', description: 'Decision', estonian: 'otsus' },
      { type: 'põhimäärus', description: 'Statute', estonian: 'põhimäärus' },
      { type: 'direktiiv', description: 'Directive (EU)', estonian: 'direktiiv' },
      { type: 'määrus', description: 'Regulation (EU)', estonian: 'määrus' }
    ];
  }
}
