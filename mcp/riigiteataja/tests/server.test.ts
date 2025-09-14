import { describe, it, expect, beforeEach } from 'vitest';
import { RiigiteatajaClient } from '@estonia-ai-kit/riigiteataja-api-client';

describe('RiigiteatajaClient', () => {
  let client: RiigiteatajaClient;

  beforeEach(() => {
    client = new RiigiteatajaClient();
  });

  describe('FAQ Operations', () => {
    it('should fetch FAQ items', async () => {
      const faqs = await client.faq.fetchFAQ();
      
      expect(faqs).toBeDefined();
      expect(Array.isArray(faqs)).toBe(true);
      expect(faqs.length).toBeGreaterThan(0);
      
      const firstFaq = faqs[0];
      expect(firstFaq).toHaveProperty('id');
      expect(firstFaq).toHaveProperty('question');
      expect(firstFaq).toHaveProperty('answer');
    });

    it('should search FAQ items', async () => {
      const results = await client.faq.searchFAQ('publication mark');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      if (results.length > 0) {
        const relevantResult = results[0];
        const searchText = `${relevantResult.question} ${relevantResult.answer}`.toLowerCase();
        expect(searchText).toContain('publication');
      }
    });

    it('should get FAQ by category', async () => {
      const results = await client.faq.getFAQByCategory('Linking');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      results.forEach(faq => {
        expect(faq.category).toBe('Linking');
      });
    });

    it('should get FAQ by ID', async () => {
      const faq = await client.faq.getFAQById('faq_1');
      
      if (faq) {
        expect(faq).toBeDefined();
        expect(faq.id).toBe('faq_1');
        expect(faq.question).toBeTruthy();
        expect(faq.answer).toBeTruthy();
      }
    });
  });

  describe('Link Generation', () => {
    it('should create dynamic link', () => {
      const link = client.links.createDynamicLink('/akt/12345');
      
      expect(link).toContain('riigiteataja.ee');
      expect(link).toContain('leiaKehtiv');
    });

    it('should create paragraph link', () => {
      const link = client.links.createParagraphLink('/akt/12345', '12lg1p3');
      
      expect(link).toContain('riigiteataja.ee');
      expect(link).toContain('#para12lg1p3');
    });

    it('should handle full URLs in link creation', () => {
      const fullUrl = 'https://www.riigiteataja.ee/akt/12345';
      const dynamicLink = client.links.createDynamicLink(fullUrl);
      
      expect(dynamicLink).toBe('https://www.riigiteataja.ee/akt/12345?leiaKehtiv');
    });

    it('should create translation link', () => {
      const link = client.links.createTranslationLink('12345');
      
      expect(link).toContain('riigiteataja.ee');
      expect(link).toContain('/en/eli/');
      expect(link).toContain('/consolide/current');
    });

    it('should generate search URL', () => {
      const url = client.links.generateSearchUrl({
        query: 'test',
        type: 'seadus',
        status: 'kehtiv'
      });
      
      expect(url).toContain('riigiteataja.ee');
      expect(url).toContain('sakk=test');
      expect(url).toContain('liik=seadus');
      expect(url).toContain('kehtivus=kehtiv');
    });

    it('should extract act ID from URL', () => {
      const id = client.links.extractActIdFromUrl('https://www.riigiteataja.ee/akt/123456789');
      expect(id).toBe('123456789');
    });

    it('should get common legal act types', () => {
      const types = client.links.getCommonLegalActTypes();
      
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types[0]).toHaveProperty('type');
      expect(types[0]).toHaveProperty('description');
    });
  });

  describe('Cache Operations', () => {
    it('should clear cache without errors', () => {
      expect(() => client.faq.clearCache()).not.toThrow();
    });
  });
});