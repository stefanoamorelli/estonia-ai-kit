export interface MCPServerConfig {
  name: string;
  version: string;
  description?: string;
}

export interface APIClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  retryAttempts?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

export interface CacheConfig {
  stdTTL?: number;
  checkperiod?: number;
  useClones?: boolean;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode?: number;
  details?: any;
}

export interface SuccessResponse<T = any> {
  success: boolean;
  data: T;
  metadata?: Record<string, any>;
}

export type APIResponse<T = any> = SuccessResponse<T> | ErrorResponse;

export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
}

export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, any>;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

export interface DateRange {
  startDate: string;
  endDate: string;
}
