#!/usr/bin/env bun

/**
 * SCRAPE REAL ESTONIAN LAWS WITH PUPPETEER
 * Gets actual law texts from riigiteataja.ee
 * 
 * @author Stefano Amorelli <stefano@amorelli.tech>
 * @license AGPL-3.0
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LegalDocument } from '../types/types';

const s = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

class RealPuppeteerScraper {
  private browser: any = null;
  private page: any = null;
  private outputPath = './data';
  
  // REAL working URLs from riigiteataja.ee
  private lawUrls = [
    {
      url: 'https://www.riigiteataja.ee/en/eli/530122020003/consolide',
      name: 'Constitution of Estonia',
      id: 'constitution'
    },
    {
      url: 'https://www.riigiteataja.ee/en/eli/504042022003/consolide',
      name: 'Estonian Flag Act',
      id: 'flag-act'
    },
    {
      url: 'https://www.riigiteataja.ee/en/eli/521042021006/consolide',
      name: 'Personal Data Protection Act',
      id: 'data-protection'
    },
    {
      url: 'https://www.riigiteataja.ee/en/eli/515082022007/consolide',
      name: 'Citizenship Act',
      id: 'citizenship-act'
    },
    {
      url: 'https://www.riigiteataja.ee/en/eli/506112023003/consolide',
      name: 'Language Act',
      id: 'language-act'
    },
    {
      url: 'https://www.riigiteataja.ee/en/eli/513042022004/consolide',
      name: 'Alcohol Act',
      id: 'alcohol-act'
    },
    {
      url: 'https://www.riigiteataja.ee/en/eli/521032022010/consolide',
      name: 'Traffic Act',
      id: 'traffic-act'
    },
    {
      url: 'https://www.riigiteataja.ee/en/eli/515042022003/consolide',
      name: 'Penal Code',
      id: 'penal-code'
    },
    {
      url: 'https://www.riigiteataja.ee/en/eli/504112022005/consolide',
      name: 'Law of Obligations Act',
      id: 'obligations-act'
    },
    {
      url: 'https://www.riigiteataja.ee/en/eli/511082023002/consolide',
      name: 'Family Law Act',
      id: 'family-law'
    }
  ];

  async initialize(): Promise<void> {
    console.log(s.cyan + s.bright + '🌐 REAL LAW SCRAPER (Puppeteer)' + s.reset);
    console.log('━'.repeat(60));
    
    // Create output directory
    await fs.mkdir(this.outputPath, { recursive: true });
    console.log(`📁 Output directory: ${this.outputPath}\n`);
    
    // Launch browser
    console.log('🚀 Launching browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Set user agent to avoid blocking
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('✅ Browser ready\n');
  }

  async scrapeAll(): Promise<LegalDocument[]> {
    console.log(s.blue + '📚 Scraping REAL Estonian laws from riigiteataja.ee...\n' + s.reset);
    
    const documents: LegalDocument[] = [];
    
    for (const law of this.lawUrls) {
      try {
        console.log(`📄 Scraping: ${s.bright}${law.name}${s.reset}`);
        console.log(`   URL: ${law.url}`);
        
        const doc = await this.scrapeLaw(law);
        if (doc) {
          documents.push(doc);
          
          // Save to file
          const filePath = path.join(this.outputPath, `${law.id}.json`);
          await fs.writeFile(filePath, JSON.stringify(doc, null, 2));
          console.log(`   ✅ Saved to ${filePath}`);
          console.log(`   📊 Found ${doc.sections.length} sections`);
          console.log(`   📝 Total content: ${doc.content.length} characters\n`);
        }
        
        // Respectful delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.log(s.red + `   ❌ Failed: ${error.message}` + s.reset + '\n');
      }
    }
    
    console.log(s.green + `✅ Successfully scraped ${documents.length} laws\n` + s.reset);
    return documents;
  }

  async scrapeLaw(lawInfo: { url: string; name: string; id: string }): Promise<LegalDocument | null> {
    // Navigate to the page
    await this.page.goto(lawInfo.url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for content to load
    await this.page.waitForSelector('.terviktekst, .act, #article-content', { timeout: 10000 });
    
    // Extract the law data
    const lawData = await this.page.evaluate(() => {
      // Get title
      const title = document.querySelector('h1')?.textContent?.trim() || 
                   document.querySelector('.act-title')?.textContent?.trim() || '';
      
      // Get the main content container
      const contentElement = document.querySelector('.terviktekst') ||
                            document.querySelector('.act') ||
                            document.querySelector('#article-content');
      
      if (!contentElement) {
        return null;
      }
      
      // Extract all sections
      const sections: any[] = [];
      let fullText = '';
      
      // Find all paragraph elements that contain § symbols
      const allElements = contentElement.querySelectorAll('p, div.paragrahv, div.section, div.pg, span.paragrahv');
      
      let currentSection: any = null;
      let sectionContent = '';
      
      allElements.forEach((elem: any) => {
        const text = elem.textContent?.trim() || '';
        
        // Check if this is a new section (contains § at the beginning)
        if (text.match(/^§\s*\d+[a-z]?\.?\s/)) {
          // Save previous section if exists
          if (currentSection) {
            currentSection.content = sectionContent.trim();
            sections.push(currentSection);
            fullText += currentSection.number + ' ' + currentSection.title + '\n' + currentSection.content + '\n\n';
          }
          
          // Parse new section
          const sectionMatch = text.match(/^§\s*(\d+[a-z]?)\.?\s+(.+?)(?:\n|$)/);
          if (sectionMatch) {
            currentSection = {
              id: `section-${sectionMatch[1]}`,
              number: `§ ${sectionMatch[1]}`,
              title: sectionMatch[2].trim(),
              content: '',
              level: 1
            };
            // Get rest of the content after the title
            const restOfContent = text.replace(/^§\s*\d+[a-z]?\.?\s+[^\n]+/, '').trim();
            sectionContent = restOfContent;
          }
        } else if (currentSection) {
          // Add to current section content
          sectionContent += '\n' + text;
        } else {
          // No section yet, add to full text
          fullText += text + '\n';
        }
      });
      
      // Save last section
      if (currentSection) {
        currentSection.content = sectionContent.trim();
        sections.push(currentSection);
        fullText += currentSection.number + ' ' + currentSection.title + '\n' + currentSection.content + '\n\n';
      }
      
      // If no sections found, try alternative parsing
      if (sections.length === 0) {
        const textContent = contentElement.textContent || '';
        const sectionMatches = textContent.matchAll(/§\s*(\d+[a-z]?)\.?\s+([^\n§]+)([\s\S]*?)(?=§\s*\d+|$)/g);
        
        for (const match of sectionMatches) {
          sections.push({
            id: `section-${match[1]}`,
            number: `§ ${match[1]}`,
            title: match[2].trim(),
            content: match[3].trim(),
            level: 1
          });
        }
        
        if (sections.length === 0) {
          fullText = textContent;
        }
      }
      
      // Get metadata
      const passedDate = document.querySelector('.passed-date')?.textContent?.trim() || '';
      const effectiveDate = document.querySelector('.effective-date')?.textContent?.trim() || '';
      
      return {
        title,
        sections,
        fullText: fullText || contentElement.textContent || '',
        passedDate,
        effectiveDate
      };
    });
    
    if (!lawData) {
      throw new Error('Could not extract law data');
    }
    
    // Create the document
    const document: LegalDocument = {
      id: lawInfo.id,
      title: lawData.title || lawInfo.name,
      type: 'law',
      url: lawInfo.url,
      datePublished: new Date(),
      dateEffective: new Date(),
      language: 'en',
      content: lawData.fullText,
      sections: lawData.sections,
      metadata: {
        issuer: 'Riigikogu',
        status: 'valid',
        amendments: [],
        relatedDocuments: [],
        keywords: [],
        consolidatedVersion: true,
        scrapedAt: new Date().toISOString(),
        source: 'riigiteataja.ee'
      }
    };
    
    return document;
  }

  async generateExport(): Promise<void> {
    console.log(s.cyan + '📦 Generating TypeScript export...\n' + s.reset);
    
    const files = await fs.readdir(this.outputPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const allLaws: LegalDocument[] = [];
    
    for (const file of jsonFiles) {
      const filePath = path.join(this.outputPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const law = JSON.parse(content);
      allLaws.push(law);
    }
    
    // Create export file
    const exportPath = path.join(this.outputPath, 'real-estonian-laws.ts');
    const exportContent = `/**
 * REAL Estonian Laws scraped from riigiteataja.ee
 * Scraped on: ${new Date().toISOString()}
 * Total laws: ${allLaws.length}
 * Total sections: ${allLaws.reduce((sum, law) => sum + law.sections.length, 0)}
 */

import { LegalDocument } from '../types';

export const realEstonianLaws: LegalDocument[] = ${JSON.stringify(allLaws, null, 2)};

export default realEstonianLaws;
`;
    
    await fs.writeFile(exportPath, exportContent);
    console.log(s.green + `✅ Export created: ${exportPath}` + s.reset);
    console.log(`   • ${allLaws.length} laws`);
    console.log(`   • ${allLaws.reduce((sum, law) => sum + law.sections.length, 0)} total sections`);
    console.log(`   • ${allLaws.reduce((sum, law) => sum + law.content.length, 0).toLocaleString()} total characters\n`);
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  const scraper = new RealPuppeteerScraper();
  
  console.clear();
  console.log(s.cyan + s.bright + 
    '╔══════════════════════════════════════════════════════════════════════════╗' + s.reset);
  console.log(s.cyan + s.bright + 
    '║              🌐 SCRAPE REAL ESTONIAN LAWS (PUPPETEER)                   ║' + s.reset);
  console.log(s.cyan + s.bright + 
    '║                                                                          ║' + s.reset);
  console.log(s.cyan + s.bright + 
    '║   Getting ACTUAL law texts from riigiteataja.ee                         ║' + s.reset);
  console.log(s.cyan + s.bright + 
    '║   No mock data - this is the real deal!                                 ║' + s.reset);
  console.log(s.cyan + s.bright + 
    '╚══════════════════════════════════════════════════════════════════════════╝' + s.reset);
  console.log('\n');
  
  try {
    await scraper.initialize();
    const documents = await scraper.scrapeAll();
    await scraper.generateExport();
    await scraper.cleanup();
    
    console.log(s.green + s.bright + '🎉 REAL laws scraped successfully!' + s.reset);
    console.log('\n📁 Scraped laws saved in: ' + s.cyan + './real-laws-data/' + s.reset);
    console.log('\nNext steps:');
    console.log('1. Build FAISS index with REAL data:');
    console.log('   ' + s.yellow + 'bun src/build-real-faiss-index.ts' + s.reset);
    console.log('2. Search REAL Estonian laws:');
    console.log('   ' + s.yellow + 'bun src/search-real.ts "your query"' + s.reset + '\n');
    
  } catch (error) {
    console.error(s.red + '❌ Error:', error.message + s.reset);
    await scraper.cleanup();
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}