import { FetcherConfig, DocumentSection } from '../types';

export abstract class BaseFetcher {
  protected readonly baseUrl: string;
  protected readonly timeout: number;
  protected readonly maxRetries: number;
  protected readonly language: string;

  constructor(config: FetcherConfig = {}) {
    this.baseUrl = config.baseUrl || 'https://www.riigiteataja.ee';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.language = config.language || 'et';
  }

  protected async fetchWithRetry(url: string, retries = 0): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok && retries < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
        return this.fetchWithRetry(url, retries + 1);
      }

      return response;
    } catch (error) {
      if (retries < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
        return this.fetchWithRetry(url, retries + 1);
      }
      throw error;
    }
  }

  protected extractText(sisuTekst: any): string {
    let text = '';

    if (!sisuTekst) return text;

    if (typeof sisuTekst === 'string') {
      return sisuTekst.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    }

    if (sisuTekst.tavatekst) {
      if (typeof sisuTekst.tavatekst === 'string') {
        text += sisuTekst.tavatekst;
      } else if (sisuTekst.tavatekst?._ !== undefined) {
        text += String(sisuTekst.tavatekst._);
      } else if (Array.isArray(sisuTekst.tavatekst)) {
        text += sisuTekst.tavatekst.join(' ');
      }
    }

    if (sisuTekst.viide) {
      const viited = Array.isArray(sisuTekst.viide) ? sisuTekst.viide : [sisuTekst.viide];
      for (const viide of viited) {
        if (viide.kuvatavtekst) {
          const linkText = viide.kuvatavtekst.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          text += ' ' + linkText;
        }
      }
    }

    if (sisuTekst.htmlkonteiner) {
      const html = sisuTekst.htmlkonteiner.replace(/<!\[CDATA\[|\]\]>/g, '');
      const cleanText = html.replace(/<[^>]*>/g, ' ').trim();
      text += ' ' + cleanText;
    }

    return text.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
  }

  protected abstract extractSections(xmlData: any): DocumentSection[];
}
