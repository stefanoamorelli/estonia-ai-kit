export interface LegalDocument {
  id: string;
  title: string;
  type: 'law' | 'regulation' | 'decree' | 'order' | 'other';
  url: string;
  datePublished: Date;
  dateEffective: Date;
  language: 'et' | 'en' | 'ru';
  content: string;
  sections: DocumentSection[];
  metadata: DocumentMetadata;
}

export interface DocumentSection {
  id: string;
  title: string;
  number: string;
  content: string;
  level: number;
  parent?: string;
}

export interface DocumentMetadata {
  issuer?: string;
  status: 'valid' | 'repealed' | 'amended';
  amendments?: string[];
  relatedDocuments?: string[];
  keywords?: string[];
  consolidatedVersion?: boolean;
}

export interface VectorDocument {
  id: string;
  documentId: string;
  chunkId: string;
  content: string;
  metadata: {
    title: string;
    section?: string;
    type: string;
    url: string;
    dateEffective: string;
  };
  embedding?: number[];
}

export interface QueryResult {
  documentId: string;
  score: number;
  content: string;
  metadata: VectorDocument['metadata'];
}

export interface RagConfig {
  embeddingModel: 'xenova' | 'openai' | 'cohere';
  vectorStore: 'chroma' | 'faiss' | 'qdrant';
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  apiKeys?: {
    openai?: string;
    cohere?: string;
  };
}