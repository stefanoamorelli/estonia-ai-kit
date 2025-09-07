#!/usr/bin/env bun

/**
 * BUILD FAISS INDEX FROM REAL SCRAPED LAWS
 * Uses actual Estonian law texts from riigiteataja.ee
 * 
 * @author Stefano Amorelli <stefano@amorelli.tech>
 * @license AGPL-3.0
 */

import { IndexFlatIP } from 'faiss-node';
import { DocumentChunker } from '../lib/chunker';
import * as fs from 'fs/promises';
import * as path from 'path';

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

class RealFAISSIndexBuilder {
  private index: IndexFlatIP | null = null;
  private chunker: DocumentChunker;
  private dimension = 1536; // OpenAI dimension
  private indexPath = './faiss-index-real';
  private documents: any[] = [];
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      console.error(s.red + '❌ OPENAI_API_KEY not set!' + s.reset);
      console.log('\nSet your API key:');
      console.log(s.yellow + '  export OPENAI_API_KEY="sk-..."' + s.reset);
      process.exit(1);
    }
    this.chunker = new DocumentChunker();
  }

  async initialize(): Promise<void> {
    console.log(s.cyan + s.bright + '🌐 REAL FAISS INDEX BUILDER' + s.reset);
    console.log('━'.repeat(60));
    
    console.log('\n📊 Configuration:');
    console.log(`   • Data source: REAL laws from riigiteataja.ee`);
    console.log(`   • Embeddings: OpenAI text-embedding-3-small`);
    console.log(`   • Dimension: ${this.dimension}`);
    
    this.index = new IndexFlatIP(this.dimension);
    console.log(`\n✅ FAISS index initialized\n`);
  }

  async loadRealLaws(): Promise<any[]> {
    console.log(s.blue + '📂 Loading REAL scraped laws...\n' + s.reset);
    
    const lawsPath = './data';
    const files = await fs.readdir(lawsPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const laws = [];
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(lawsPath, file), 'utf-8');
      const law = JSON.parse(content);
      
      // Fix date fields if they're strings
      if (typeof law.dateEffective === 'string') {
        law.dateEffective = new Date(law.dateEffective);
      }
      if (typeof law.datePublished === 'string') {
        law.datePublished = new Date(law.datePublished);
      }
      
      laws.push(law);
      console.log(`   ✅ Loaded: ${law.title} (${law.sections.length} sections)`);
    }
    
    console.log(`\n   📚 Total: ${laws.length} REAL laws loaded\n`);
    return laws;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }

  async buildIndex(): Promise<void> {
    console.log(s.blue + '📚 Building index from REAL laws...\n' + s.reset);
    
    const realLaws = await this.loadRealLaws();
    
    let totalChunks = 0;
    let totalSections = 0;
    let totalParagraphs = 0;
    
    for (const law of realLaws) {
      console.log(`📄 Processing: ${s.bright}${law.title}${s.reset}`);
      
      // Create chunks for each section and paragraph
      const chunks = this.chunker.chunkDocument(law);
      const stats = this.chunker.getChunkingStats(law);
      
      console.log(`   📊 Structure: ${stats.sectionsFound} sections, ${stats.paragraphsFound} paragraphs`);
      console.log(`   📝 Creating ${chunks.length} searchable chunks`);
      
      // Batch process for efficiency
      const batchSize = 20;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        // Prepare texts with context
        const texts = batch.map(chunk => {
          let contextText = `Estonian Law: ${chunk.metadata.title}. `;
          if (chunk.metadata.section) {
            contextText += `Section ${chunk.metadata.section}`;
            if (chunk.metadata.sectionTitle) {
              contextText += ` - ${chunk.metadata.sectionTitle}`;
            }
            if (chunk.metadata.paragraph) {
              contextText += `, Paragraph ${chunk.metadata.paragraph}`;
            }
            contextText += '. ';
          }
          return contextText + chunk.content;
        });
        
        // Generate embeddings
        if (i === 0) {
          console.log(`   🤖 Generating OpenAI embeddings...`);
        }
        
        const embeddings = await this.embedBatch(texts);
        
        // Add to FAISS
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings[j];
          
          if (embedding) {
            await this.index!.add(embedding);
            
            this.documents.push({
              id: chunk.id,
              documentId: chunk.documentId,
              chunkId: chunk.chunkId,
              content: chunk.content,
              metadata: chunk.metadata
            });
            
            totalChunks++;
            if (chunk.metadata.paragraph) {
              totalParagraphs++;
            } else if (chunk.metadata.section) {
              totalSections++;
            }
          }
        }
      }
      
      console.log(`   ✅ Indexed ${chunks.length} chunks\n`);
      
      // Rate limit respect
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(s.green + s.bright + `✅ REAL index complete!` + s.reset);
    console.log(`   📊 Statistics:`);
    console.log(`      • Total chunks: ${totalChunks}`);
    console.log(`      • Law sections: ${totalSections}`);
    console.log(`      • Paragraphs: ${totalParagraphs}`);
    console.log(`      • REAL laws indexed: ${realLaws.length}`);
    console.log(`      • Data source: riigiteataja.ee (REAL)\n`);
  }

  async saveIndex(): Promise<void> {
    if (!this.index) {
      throw new Error('No index to save');
    }
    
    console.log(s.cyan + '💾 Saving REAL FAISS index...\n' + s.reset);
    
    await fs.mkdir(this.indexPath, { recursive: true });
    
    // Save FAISS vectors
    const indexFile = path.join(this.indexPath, 'vectors.faiss');
    await this.index.write(indexFile);
    console.log(`   ✅ FAISS vectors: ${indexFile}`);
    
    const stats = await fs.stat(indexFile);
    console.log(`   📦 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Save metadata
    const metadata = {
      version: 'REAL-1.0.0',
      createdAt: new Date().toISOString(),
      dimension: this.dimension,
      embeddingModel: 'openai/text-embedding-3-small',
      totalVectors: this.index.ntotal(),
      documents: this.documents,
      statistics: {
        totalChunks: this.documents.length,
        uniqueLaws: [...new Set(this.documents.map(d => d.metadata.title))].length,
        sections: this.documents.filter(d => d.metadata.section && !d.metadata.paragraph).length,
        paragraphs: this.documents.filter(d => d.metadata.paragraph).length
      },
      laws: [...new Set(this.documents.map(d => d.metadata.title))].sort(),
      dataSource: 'riigiteataja.ee (REAL scraped data)'
    };
    
    const metadataFile = path.join(this.indexPath, 'metadata.json');
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`   ✅ Metadata: ${metadataFile}`);
    
    console.log('\n' + s.green + s.bright + '✅ REAL FAISS index ready!' + s.reset);
  }

  async testQueries(): Promise<void> {
    console.log('\n' + s.magenta + '🧪 Testing on REAL law content...\n' + s.reset);
    
    const testQueries = [
      'Estonian flag colors',
      'constitutional rights',
      'freedom of speech',
      'voting requirements',
      'presidential powers'
    ];
    
    for (const query of testQueries) {
      const embedding = (await this.embedBatch([query]))[0];
      const results = await this.index!.search(embedding, 1);
      
      if (results.labels[0] >= 0) {
        const doc = this.documents[results.labels[0]];
        console.log(`   ✅ "${query}"`);
        console.log(`      → ${doc.metadata.section || 'General'} - ${doc.metadata.title}`);
      }
    }
    
    console.log('\n' + s.green + '✅ REAL data search working!' + s.reset);
  }
}

async function main() {
  const builder = new RealFAISSIndexBuilder();
  
  console.clear();
  console.log(s.cyan + s.bright + 
    '╔══════════════════════════════════════════════════════════════════════════╗' + s.reset);
  console.log(s.cyan + s.bright + 
    '║                  🌐 BUILD FAISS INDEX FROM REAL LAWS                    ║' + s.reset);
  console.log(s.cyan + s.bright + 
    '║                                                                          ║' + s.reset);
  console.log(s.cyan + s.bright + 
    '║   Using ACTUAL scraped data from riigiteataja.ee                        ║' + s.reset);
  console.log(s.cyan + s.bright + 
    '║   Not mock data - this is real Estonian law!                            ║' + s.reset);
  console.log(s.cyan + s.bright + 
    '╚══════════════════════════════════════════════════════════════════════════╝' + s.reset);
  console.log('\n');
  
  try {
    await builder.initialize();
    await builder.buildIndex();
    await builder.saveIndex();
    await builder.testQueries();
    
    console.log('\n' + s.green + s.bright + '🎉 REAL LAW INDEX READY!' + s.reset);
    console.log('\n📂 Index location: ' + s.cyan + './faiss-index-real/' + s.reset);
    console.log('\n🔍 Search REAL Estonian laws:');
    console.log('   ' + s.bright + 'bun src/search-real.ts "constitutional rights"' + s.reset);
    console.log('   ' + s.bright + 'bun src/search-real.ts "Estonian flag"' + s.reset);
    console.log('   ' + s.bright + 'bun src/search-real.ts "freedom of speech"' + s.reset + '\n');
    
  } catch (error) {
    console.error(s.red + '❌ Error:', error.message + s.reset);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}