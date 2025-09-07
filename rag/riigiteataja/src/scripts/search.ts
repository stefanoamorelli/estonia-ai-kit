#!/usr/bin/env bun

/**
 * SEARCH REAL ESTONIAN LAWS
 * Search the FAISS index built from real riigiteataja.ee data
 * 
 * Usage: bun src/search-real.ts "your query"
 */

import { IndexFlatIP } from 'faiss-node';
import * as fs from 'fs/promises';
import * as path from 'path';

const s = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

class LawSearcher {
  private index: IndexFlatIP | null = null;
  private metadata: any = null;
  private indexPath = './faiss-index';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.error(s.red + '❌ OPENAI_API_KEY not set!' + s.reset);
      console.log('\nSet your API key:');
      console.log(s.yellow + '  export OPENAI_API_KEY="sk-..."' + s.reset);
      process.exit(1);
    }
  }

  async load(): Promise<void> {
    console.log(s.cyan + '📂 Loading law index...' + s.reset);
    
    const indexFile = path.join(this.indexPath, 'vectors.faiss');
    const metadataFile = path.join(this.indexPath, 'metadata.json');
    
    try {
      await fs.access(indexFile);
      await fs.access(metadataFile);
    } catch {
      console.error(s.red + '❌ Index not found!' + s.reset);
      console.log('\nBuild it first:');
      console.log(s.yellow + '  bun src/build-index.ts' + s.reset);
      process.exit(1);
    }
    
    this.index = IndexFlatIP.read(indexFile);
    this.metadata = JSON.parse(await fs.readFile(metadataFile, 'utf-8'));
    
    console.log(s.green + `✅ Loaded ${this.index.ntotal()} vectors` + s.reset);
    console.log(`   📜 Source: ${this.metadata.dataSource}`);
    console.log(`   📚 Laws: ${this.metadata.statistics.uniqueLaws}`);
    console.log(`   📑 Sections: ${this.metadata.statistics.sections}`);
    console.log(`   📝 Paragraphs: ${this.metadata.statistics.paragraphs}`);
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  }

  async search(query: string, topK: number = 10): Promise<void> {
    if (!this.index || !this.metadata) {
      throw new Error('Index not loaded');
    }
    
    console.log('\n' + s.cyan + '🔍 Query: ' + s.reset + s.bright + query + s.reset);
    
    console.time('⚡ Total search time');
    
    // Generate query embedding
    const queryEmbedding = await this.embedQuery(query);
    
    // Search FAISS
    const results = await this.index.search(queryEmbedding, topK);
    
    console.timeEnd('⚡ Total search time');
    
    console.log('\n' + s.green + '📊 Results from Estonian Laws:' + s.reset);
    console.log('━'.repeat(80));
    
    // Display top results
    for (let i = 0; i < Math.min(5, results.labels.length); i++) {
      const idx = results.labels[i];
      const score = results.distances[i];
      
      if (idx >= 0 && idx < this.metadata.documents.length) {
        const doc = this.metadata.documents[idx];
        
        // Format reference
        let reference = doc.metadata.section || 'General';
        if (doc.metadata.sectionTitle) {
          reference += ` - ${doc.metadata.sectionTitle}`;
        }
        if (doc.metadata.paragraph) {
          reference += ` (${doc.metadata.paragraph})`;
        }
        
        console.log(`\n${i + 1}. ${s.yellow}${reference}${s.reset}`);
        console.log(`   Law: ${s.magenta}${doc.metadata.title}${s.reset}`);
        console.log(`   Score: ${s.green}${score.toFixed(4)}${s.reset}`);
        
        // Show content preview
        const preview = doc.content.replace(/\n/g, ' ').slice(0, 200);
        console.log(`   "${preview}..."`);
      }
    }
    
    console.log('\n' + '━'.repeat(80));
    
    // Show summary
    const uniqueLaws = new Set(
      results.labels
        .slice(0, topK)
        .filter(idx => idx >= 0 && idx < this.metadata.documents.length)
        .map(idx => this.metadata.documents[idx].metadata.title)
    );
    
    console.log(s.green + `✅ Found relevant content in ${uniqueLaws.size} law(s)` + s.reset);
    console.log(s.cyan + `📜 Data source: riigiteataja.ee` + s.reset);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(s.cyan + s.bright + '🔍 Search Estonian Laws' + s.reset);
    console.log('\nUsage:');
    console.log('  ' + s.green + 'bun src/search.ts "your query"' + s.reset);
    console.log('\nExample queries for Estonian Constitution:');
    console.log('  • "fundamental rights and freedoms"');
    console.log('  • "presidential powers"');
    console.log('  • "Estonian citizenship"');
    console.log('  • "freedom of speech"');
    console.log('  • "right to vote"');
    console.log('  • "parliament Riigikogu"');
    console.log('  • "constitutional court"');
    console.log('\nNote: This searches law text from riigiteataja.ee');
    process.exit(0);
  }
  
  const query = args.join(' ');
  const searcher = new LawSearcher();
  
  try {
    await searcher.load();
    await searcher.search(query);
  } catch (error) {
    console.error(s.red + '❌ Search failed:', error.message + s.reset);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}