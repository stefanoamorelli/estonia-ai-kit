#!/usr/bin/env bun

/**
 * COMPARE: ChatGPT alone vs ChatGPT with FAISS RAG
 * Shows the difference between generic answers and answers with legal sources
 * 
 * @author Stefano Amorelli <stefano@amorelli.tech>
 * @license AGPL-3.0
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

class ChatGPTComparison {
  private index: IndexFlatIP | null = null;
  private metadata: any = null;
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

  async initialize(): Promise<void> {
    console.log(s.cyan + '📂 Loading FAISS index...' + s.reset);
    
    const indexPath = './faiss-index';
    const indexFile = path.join(indexPath, 'vectors.faiss');
    const metadataFile = path.join(indexPath, 'metadata.json');
    
    try {
      await fs.access(indexFile);
      this.index = IndexFlatIP.read(indexFile);
      this.metadata = JSON.parse(await fs.readFile(metadataFile, 'utf-8'));
      console.log(s.green + `✅ Loaded ${this.index.ntotal()} legal sections\n` + s.reset);
    } catch {
      console.error(s.red + '❌ Index not found! Build it first:' + s.reset);
      console.log(s.yellow + '  bun src/build-index.ts' + s.reset);
      process.exit(1);
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
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
    
    const data = await response.json();
    return data.data[0].embedding;
  }

  async searchRAG(query: string, topK: number = 3): Promise<string> {
    const embedding = await this.getEmbedding(query);
    const results = await this.index!.search(embedding, topK);
    
    let context = '';
    for (let i = 0; i < results.labels.length; i++) {
      const idx = results.labels[i];
      if (idx >= 0 && idx < this.metadata.documents.length) {
        const doc = this.metadata.documents[idx];
        const section = doc.metadata.section || 'General';
        context += `[${section}] ${doc.content}\n\n`;
      }
    }
    
    return context;
  }

  async askChatGPT(prompt: string, withRAG: boolean = false, ragContext: string = ''): Promise<string> {
    let systemPrompt = 'You are a helpful assistant answering questions about Estonian law.';
    let userPrompt = prompt;
    
    if (withRAG && ragContext) {
      systemPrompt = 'You are a legal assistant. Answer based on the provided Estonian law excerpts. Cite specific sections when possible.';
      userPrompt = `Based on the following Estonian law sections:\n\n${ragContext}\n\nQuestion: ${prompt}\n\nProvide a precise answer with section citations.`;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }

  async compare(query: string): Promise<void> {
    console.log(s.cyan + s.bright + '❓ Question: ' + s.reset + query + '\n');
    console.log('━'.repeat(80) + '\n');
    
    // Get ChatGPT answer WITHOUT RAG
    console.log(s.red + '🤖 ChatGPT ALONE (No sources):' + s.reset);
    console.log('   ' + s.yellow + 'Getting generic answer...' + s.reset);
    const chatgptAnswer = await this.askChatGPT(query);
    console.log('\n' + this.wrapText(chatgptAnswer, 76));
    
    console.log('\n' + s.red + '⚠️  Issues:' + s.reset);
    console.log('   • No legal citations');
    console.log('   • May be outdated or incorrect');
    console.log('   • Cannot verify accuracy');
    
    console.log('\n' + '━'.repeat(80) + '\n');
    
    // Get ChatGPT answer WITH RAG
    console.log(s.green + '🤖 ChatGPT + FAISS RAG (With Estonian law):' + s.reset);
    console.log('   ' + s.yellow + 'Searching legal database...' + s.reset);
    const ragContext = await this.searchRAG(query);
    
    // Show which sections were found
    const sections = ragContext.match(/\[§ \d+[^\]]*\]/g) || [];
    if (sections.length > 0) {
      console.log('   ' + s.cyan + 'Found sections: ' + sections.slice(0, 3).join(', ') + s.reset);
    }
    
    console.log('   ' + s.yellow + 'Generating answer with legal context...' + s.reset);
    const ragAnswer = await this.askChatGPT(query, true, ragContext);
    console.log('\n' + this.wrapText(ragAnswer, 76));
    
    console.log('\n' + s.green + '✅ Advantages:' + s.reset);
    console.log('   • Cites specific Estonian law sections');
    console.log('   • Based on actual legal text');
    console.log('   • Verifiable and accurate');
    console.log('   • Source: riigiteataja.ee');
    
    console.log('\n' + '━'.repeat(80));
  }

  private wrapText(text: string, width: number): string {
    const words = text.split(' ');
    let lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + ' ' + word).length <= width) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    return lines.map(line => '   ' + line).join('\n');
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.clear();
    const boxWidth = 74;
    const line = '═'.repeat(boxWidth);
    
    const centerText = (text: string, width: number) => {
      const padding = Math.max(0, width - text.length);
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    };
    
    console.log(s.cyan + s.bright + '╔' + line + '╗' + s.reset);
    console.log(s.cyan + s.bright + '║' + centerText('🤖 ChatGPT vs ChatGPT + FAISS RAG Comparison', boxWidth) + '║' + s.reset);
    console.log(s.cyan + s.bright + '║' + centerText('', boxWidth) + '║' + s.reset);
    console.log(s.cyan + s.bright + '║' + centerText('Estonia AI Kit - Riigi Teataja FAISS RAG', boxWidth) + '║' + s.reset);
    console.log(s.cyan + s.bright + '║' + centerText('Author: Stefano Amorelli <stefano@amorelli.tech>', boxWidth) + '║' + s.reset);
    console.log(s.cyan + s.bright + '║' + centerText('GitHub: github.com/estonia-ai-kit/riigiteataja-rag', boxWidth) + '║' + s.reset);
    console.log(s.cyan + s.bright + '║' + centerText('License: AGPL-3.0', boxWidth) + '║' + s.reset);
    console.log(s.cyan + s.bright + '╚' + line + '╝' + s.reset);
    
    console.log('\n' + s.bright + 'Usage:' + s.reset);
    console.log('  ' + s.green + 'bun src/compare.ts "your legal question"' + s.reset);
    
    console.log('\n' + s.bright + 'Example questions:' + s.reset);
    console.log('  • "What are the requirements for Estonian citizenship?"');
    console.log('  • "What are the fundamental rights in Estonian constitution?"');
    console.log('  • "Who can become president of Estonia?"');
    console.log('  • "What is the role of Riigikogu?"');
    console.log('  • "How are constitutional amendments made?"');
    
    console.log('\n' + s.yellow + 'This will show:' + s.reset);
    console.log('  1. ChatGPT answer WITHOUT sources (generic, possibly wrong)');
    console.log('  2. ChatGPT answer WITH FAISS RAG (accurate, with citations)\n');
    
    process.exit(0);
  }
  
  const query = args.join(' ');
  const comparison = new ChatGPTComparison();
  
  console.clear();
  const boxWidth = 74;
  const line = '═'.repeat(boxWidth);
  
  const centerText = (text: string, width: number) => {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  };
  
  console.log(s.cyan + s.bright + '╔' + line + '╗' + s.reset);
  console.log(s.cyan + s.bright + '║' + centerText('🤖 ChatGPT vs ChatGPT + FAISS RAG Comparison', boxWidth) + '║' + s.reset);
  console.log(s.cyan + s.bright + '║' + centerText('', boxWidth) + '║' + s.reset);
  console.log(s.cyan + s.bright + '║' + centerText('Estonia AI Kit - Riigi Teataja FAISS RAG', boxWidth) + '║' + s.reset);
  console.log(s.cyan + s.bright + '║' + centerText('Author: Stefano Amorelli <stefano@amorelli.tech>', boxWidth) + '║' + s.reset);
  console.log(s.cyan + s.bright + '║' + centerText('GitHub: github.com/estonia-ai-kit/riigiteataja-rag', boxWidth) + '║' + s.reset);
  console.log(s.cyan + s.bright + '║' + centerText('License: AGPL-3.0', boxWidth) + '║' + s.reset);
  console.log(s.cyan + s.bright + '╚' + line + '╝' + s.reset);
  console.log('\n');
  
  try {
    await comparison.initialize();
    await comparison.compare(query);
    
    console.log('\n' + s.cyan + '💡 Key Insight:' + s.reset);
    console.log('   RAG provides accurate, verifiable answers from Estonian law.');
    console.log('   Without RAG, ChatGPT gives generic answers that may be wrong.\n');
    
  } catch (error) {
    console.error(s.red + '❌ Error:', error.message + s.reset);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}