/**
 * Document Chunker
 * Creates one chunk per legal section (§) for better retrieval
 */

import { LegalDocument, VectorDocument } from '../types/types';

export class DocumentChunker {
  
  /**
   * Chunk document by legal sections (§)
   * Each section becomes its own chunk for precise retrieval
   */
  chunkDocument(document: LegalDocument): Omit<VectorDocument, 'embedding'>[] {
    const chunks: Omit<VectorDocument, 'embedding'>[] = [];
    
    // First, try to use structured sections if available
    if (document.sections && document.sections.length > 0) {
      return this.chunkByStructuredSections(document);
    }
    
    // Otherwise, parse the content for § symbols
    return this.chunkByParsedSections(document);
  }
  
  private chunkByStructuredSections(document: LegalDocument): Omit<VectorDocument, 'embedding'>[] {
    const chunks: Omit<VectorDocument, 'embedding'>[] = [];
    
    document.sections.forEach((section, idx) => {
      // Create one chunk per section
      chunks.push({
        id: `${document.id}-${section.id}`,
        documentId: document.id,
        chunkId: section.id,
        content: `${section.number} ${section.title}\n${section.content}`,
        metadata: {
          title: document.title,
          section: section.number,
          sectionTitle: section.title,
          type: document.type,
          url: document.url,
          dateEffective: document.dateEffective.toISOString()
        }
      });
      
      // If section has subsections (paragraphs), create chunks for them too
      const paragraphs = this.extractParagraphs(section.content);
      if (paragraphs.length > 1) {
        paragraphs.forEach((para, paraIdx) => {
          if (para.trim()) {
            chunks.push({
              id: `${document.id}-${section.id}-p${paraIdx + 1}`,
              documentId: document.id,
              chunkId: `${section.id}-p${paraIdx + 1}`,
              content: `${section.number} (${paraIdx + 1}) ${para}`,
              metadata: {
                title: document.title,
                section: section.number,
                paragraph: paraIdx + 1,
                sectionTitle: section.title,
                type: document.type,
                url: document.url,
                dateEffective: document.dateEffective.toISOString()
              }
            });
          }
        });
      }
    });
    
    return chunks;
  }
  
  private chunkByParsedSections(document: LegalDocument): Omit<VectorDocument, 'embedding'>[] {
    const chunks: Omit<VectorDocument, 'embedding'>[] = [];
    
    // Split content by § symbols
    const sectionRegex = /§\s*\d+[a-z]?\.?\s+[^\n]+/g;
    const content = document.content;
    const sections: { number: string; title: string; content: string }[] = [];
    
    let lastIndex = 0;
    let match;
    
    while ((match = sectionRegex.exec(content)) !== null) {
      // Save previous section if exists
      if (sections.length > 0) {
        const prevSection = sections[sections.length - 1];
        prevSection.content = content.slice(lastIndex, match.index).trim();
      }
      
      // Extract section number and title
      const headerMatch = match[0].match(/§\s*(\d+[a-z]?)\.?\s+(.+)/);
      if (headerMatch) {
        sections.push({
          number: `§ ${headerMatch[1]}`,
          title: headerMatch[2].trim(),
          content: ''
        });
        lastIndex = match.index + match[0].length;
      }
    }
    
    // Add content for last section
    if (sections.length > 0) {
      sections[sections.length - 1].content = content.slice(lastIndex).trim();
    }
    
    // Create chunks from parsed sections
    sections.forEach((section, idx) => {
      // Main section chunk
      chunks.push({
        id: `${document.id}-s${idx}`,
        documentId: document.id,
        chunkId: `section-${idx}`,
        content: `${section.number}. ${section.title}\n${section.content}`,
        metadata: {
          title: document.title,
          section: section.number,
          sectionTitle: section.title,
          type: document.type,
          url: document.url,
          dateEffective: document.dateEffective.toISOString()
        }
      });
      
      // Parse paragraphs within section
      const paragraphs = this.extractParagraphs(section.content);
      if (paragraphs.length > 1) {
        paragraphs.forEach((para, paraIdx) => {
          if (para.trim() && para.length > 50) { // Only create chunk if paragraph is substantial
            chunks.push({
              id: `${document.id}-s${idx}-p${paraIdx + 1}`,
              documentId: document.id,
              chunkId: `section-${idx}-para-${paraIdx + 1}`,
              content: `${section.number} (${paraIdx + 1}) ${para}`,
              metadata: {
                title: document.title,
                section: section.number,
                paragraph: paraIdx + 1,
                sectionTitle: section.title,
                type: document.type,
                url: document.url,
                dateEffective: document.dateEffective.toISOString()
              }
            });
          }
        });
      }
    });
    
    // If no sections found, create at least one chunk for the whole document
    if (chunks.length === 0) {
      chunks.push({
        id: `${document.id}-full`,
        documentId: document.id,
        chunkId: 'full-document',
        content: document.content.slice(0, 1000), // Limit size
        metadata: {
          title: document.title,
          type: document.type,
          url: document.url,
          dateEffective: document.dateEffective.toISOString()
        }
      });
    }
    
    return chunks;
  }
  
  private extractParagraphs(content: string): string[] {
    // Match patterns like (1), (2), etc.
    const paragraphRegex = /\((\d+)\)\s*([^(]+?)(?=\(\d+\)|$)/g;
    const paragraphs: string[] = [];
    let match;
    
    while ((match = paragraphRegex.exec(content)) !== null) {
      paragraphs.push(match[2].trim());
    }
    
    return paragraphs;
  }
  
  /**
   * Get statistics about chunking
   */
  getChunkingStats(document: LegalDocument): {
    totalChunks: number;
    sectionsFound: number;
    paragraphsFound: number;
  } {
    const chunks = this.chunkDocument(document);
    const sections = chunks.filter(c => c.metadata.section && !c.metadata.paragraph);
    const paragraphs = chunks.filter(c => c.metadata.paragraph);
    
    return {
      totalChunks: chunks.length,
      sectionsFound: sections.length,
      paragraphsFound: paragraphs.length
    };
  }
}