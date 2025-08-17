import NodeCache from 'node-cache';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { APIClientConfig, CacheConfig, ErrorResponse, SuccessResponse } from './types.js';

export class BaseAPIClient {
  protected client: AxiosInstance;
  protected cache?: NodeCache;

  constructor(config: APIClientConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 10000,
      headers: {
        'User-Agent': 'Estonia-AI-Kit/1.0',
        ...config.headers,
      },
    });

    if (config.cacheEnabled) {
      this.cache = new NodeCache({
        stdTTL: config.cacheTTL || 600,
        checkperiod: 120,
      });
    }

    this.setupInterceptors(config.retryAttempts || 3);
  }

  private setupInterceptors(retryAttempts: number) {
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        if (!config || !config.retry) {
          config.retry = 0;
        }

        if (config.retry >= retryAttempts) {
          return Promise.reject(error);
        }

        config.retry += 1;

        if (error.response?.status === 429) {
          const delay = this.getRetryDelay(config.retry);
          await this.sleep(delay);
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  private getRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const cacheKey = `GET:${url}:${JSON.stringify(config?.params || {})}`;
    
    if (this.cache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const response = await this.client.get<T>(url, config);
    
    if (this.cache) {
      this.cache.set(cacheKey, response.data);
    }

    return response.data;
  }

  protected async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }
}

export class CacheManager {
  private cache: NodeCache;

  constructor(config?: CacheConfig) {
    this.cache = new NodeCache({
      stdTTL: config?.stdTTL || 600,
      checkperiod: config?.checkperiod || 120,
      useClones: config?.useClones !== false,
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    return ttl ? this.cache.set(key, value, ttl) : this.cache.set(key, value);
  }

  delete(key: string): number {
    return this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  keys(): string[] {
    return this.cache.keys();
  }
}

export function createErrorResponse(message: string, statusCode?: number, details?: any): ErrorResponse {
  return {
    error: 'API_ERROR',
    message,
    statusCode,
    details,
  };
}

export function createSuccessResponse<T>(data: T, metadata?: Record<string, any>): SuccessResponse<T> {
  return {
    success: true,
    data,
    metadata,
  };
}

export function validateRegistryCode(code: string): boolean {
  return /^\d{8}$/.test(code);
}

export function validatePersonalCode(code: string): boolean {
  return /^[1-6]\d{10}$/.test(code);
}

export function validateVATNumber(vatNumber: string): boolean {
  return /^EE\d{9}$/.test(vatNumber);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function parseEstonianDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('.');
  return new Date(`${year}-${month}-${day}`);
}