export interface CompanySearchParams {
  query?: string;
  registryCode?: string;
  name?: string;
  status?: 'R' | 'K' | 'L' | 'N';
  address?: string;
  field?: string;
}

export interface CompanyData {
  registry_code: string;
  name: string;
  status: string;
  status_text: string;
  address: string;
  establishment_date?: string;
  capital?: number;
  activity_areas?: string[];
  email?: string;
  phone?: string;
  tax_debt?: boolean;
}

export interface AnnualReport {
  year: number;
  submitted_date: string;
  status: string;
  document_url?: string;
}

export interface BoardMember {
  name: string;
  personal_code?: string;
  role: string;
  start_date: string;
  end_date?: string;
  representation_rights?: string;
}

export interface PersonSearchResult {
  company_name: string;
  company_registry_code: string;
  role: string;
  start_date: string;
  end_date?: string;
  active: boolean;
}