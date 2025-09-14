import axios from 'axios';
import * as cheerio from 'cheerio';

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
  keywords?: string[];
}

export class FAQService {
  private baseUrl = 'https://www.riigiteataja.ee';
  private faqUrl = 'https://www.riigiteataja.ee/kkk.html';
  private cache: Map<string, { data: unknown; expiry: number }> = new Map();
  private cacheTTL = 3600000; // 1 hour

  async fetchFAQ(): Promise<FAQItem[]> {
    const cacheKey = 'faq_items';
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as FAQItem[];
    }

    try {
      const response = await axios.get(this.faqUrl, {
        headers: {
          'User-Agent': 'Estonia-AI-Kit/1.0'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const faqItems: FAQItem[] = [];
      let currentId = 1;

      // Try to parse FAQ items from the page
      $('div.faq-item, div.accordion-item, article.faq, .kkk-item').each((_, element) => {
        const $el = $(element);
        const question = $el.find('h2, h3, .question, .accordion-header').text().trim();
        const answer = $el.find('p, .answer, .accordion-body').text().trim();

        if (question && answer) {
          faqItems.push({
            id: `faq_${currentId}`,
            question: this.cleanText(question),
            answer: this.cleanText(answer),
            keywords: this.extractKeywords(question + ' ' + answer)
          });
          currentId++;
        }
      });

      const allItems = faqItems.length > 0 ? faqItems : this.getFallbackFAQItems();
      this.setCache(cacheKey, allItems);
      return allItems;
    } catch (error) {
      console.error('Error fetching FAQ:', error);
      return this.getFallbackFAQItems();
    }
  }

  async searchFAQ(query: string): Promise<FAQItem[]> {
    const allFAQs = await this.fetchFAQ();
    const queryLower = query.toLowerCase();

    return allFAQs.filter(faq => {
      const searchText =
        `${faq.question} ${faq.answer} ${faq.keywords?.join(' ') || ''}`.toLowerCase();
      return searchText.includes(queryLower);
    });
  }

  async getFAQByCategory(category: string): Promise<FAQItem[]> {
    const allFAQs = await this.fetchFAQ();
    return allFAQs.filter(faq => faq.category?.toLowerCase() === category.toLowerCase());
  }

  async getFAQById(id: string): Promise<FAQItem | null> {
    const allFAQs = await this.fetchFAQ();
    return allFAQs.find(faq => faq.id === id) || null;
  }

  private getFallbackFAQItems(): FAQItem[] {
    return [
      {
        id: 'faq_1',
        question: 'What comprises the publication mark and act identification number?',
        answer:
          'Each act has a publication mark in the metadata block. The 12-digit ID includes: first digit for RT section, next 8 digits for publication date, and last 3 digits for article number.',
        category: 'Act Identification',
        keywords: ['publication mark', 'identification', 'metadata', 'RT section']
      },
      {
        id: 'faq_2',
        question: 'How are explanatory notes accessed?',
        answer:
          'Explanatory notes are available through the "Procedural Information" button which links to government draft information systems.',
        category: 'Documentation',
        keywords: ['explanatory notes', 'procedural information', 'government drafts']
      },
      {
        id: 'faq_3',
        question: 'How to create a link that always opens the current valid legal act?',
        answer:
          'Add "?leiaKehtiv" to the end of any act\'s link to always open the current valid version.',
        category: 'Linking',
        keywords: ['dynamic link', 'valid act', 'leiaKehtiv', 'current version']
      },
      {
        id: 'faq_4',
        question: 'How to link to a specific paragraph?',
        answer: 'Add "#para" followed by paragraph/section/point details to the link.',
        category: 'Linking',
        keywords: ['paragraph link', 'section', 'specific reference', 'anchor']
      },
      {
        id: 'faq_5',
        question: 'What translation options exist?',
        answer:
          'English translations are available for informational purposes. Some Russian translations exist on the "Jurist aitab" portal. Note that translations do not have legal force.',
        category: 'Translations',
        keywords: ['translation', 'English', 'Russian', 'legal force', 'Jurist aitab']
      },
      {
        id: 'faq_6',
        question: 'Is there API access to Riigiteataja data?',
        answer:
          'Yes, Riigiteataja provides open data and API access for programmatic access to legal acts and publications.',
        category: 'Technical',
        keywords: ['API', 'open data', 'programmatic access', 'integration']
      },
      {
        id: 'faq_7',
        question: 'How are court decisions published?',
        answer:
          'Court decisions are published with personal data replaced or anonymized according to legal requirements.',
        category: 'Court Decisions',
        keywords: ['court decisions', 'personal data', 'anonymization', 'publication']
      },
      {
        id: 'faq_8',
        question: 'What browsers are supported?',
        answer:
          'Riigiteataja supports modern web browsers with JavaScript enabled for full functionality.',
        category: 'Technical',
        keywords: ['browser', 'compatibility', 'JavaScript', 'requirements']
      }
    ];
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the',
      'is',
      'at',
      'which',
      'on',
      'and',
      'a',
      'an',
      'as',
      'are',
      'was',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'must',
      'can',
      'to',
      'of',
      'in',
      'for',
      'with',
      'by',
      'from',
      'about',
      'into',
      'onto',
      'upon'
    ]);

    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10);
  }

  private getFromCache(key: string): unknown {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheTTL
    });
  }

  clearCache(): void {
    this.cache.clear();
  }
}
