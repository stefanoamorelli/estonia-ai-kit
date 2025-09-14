export interface LegalDocument {
  id: string;
  title: string;
  type: 'seadus' | 'määrus' | 'korraldus' | 'käskkiri' | 'other';
  url: string;
  datePublished: Date | null;
  dateEffective: Date | string;
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
  status: 'avaldatud' | 'kehtetu' | 'muudetud';
  amendments?: string[];
  relatedDocuments?: string[];
  keywords?: string[];
  consolidatedVersion?: boolean;
  fetchedAt?: string;
  source?: string;
  globalId?: number;
  hasEnglishTranslation?: boolean;
  translationId?: string;
}

export interface ApiSearchParams {
  otsingutyyp?: 'otsisona' | 'pealkiri' | 'sisu';
  otsisona?: string;
  valjakuulutamisaeg_algus?: string;
  valjakuulutamisaeg_lopp?: string;
  kehtivaeg_algus?: string;
  kehtivaeg_lopp?: string;
  akti_liik?: string;
  andja?: string;
  sorteeri?: 'avaldamisaeg' | 'relevants';
  lehekull?: number;
  tulemusi?: number;
}

export interface ApiSearchResult {
  results: ApiDocument[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiDocument {
  id: number;
  pealkiri: string;
  liik: string;
  url: string;
  avaldamisaeg?: string;
  joustumine?: string;
  xml_url?: string;
  kehtiv?: boolean;
  muutmisaeg?: string;
}

export interface EnglishTranslation {
  id: string;
  globalId: number;
  translationId: string;
  title: string;
  url: string;
  xmlUrl: string;
}

export interface FetcherConfig {
  baseUrl?: string;
  language?: 'et' | 'en';
  timeout?: number;
  maxRetries?: number;
}
