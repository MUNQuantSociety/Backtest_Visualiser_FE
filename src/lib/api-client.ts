import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/config/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('api');

/**
 * A normalised error shape. Every failure the UI sees is an ApiError, so
 * components never branch on `axios.isAxiosError` or poke at `err.response`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** 5xx and network blips are worth retrying; 4xx are not. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads a string field from an unvalidated error body without trusting it. */
function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    // No response => network failure, DNS, CORS, or timeout.
    if (!error.response) {
      const isTimeout = error.code === 'ECONNABORTED';
      return new ApiError(
        isTimeout ? 'The request timed out.' : 'Could not reach the server.',
        0,
        error.code ?? 'NETWORK_ERROR',
      );
    }

    const status: number = error.response.status;
    // `error.response.data` is `any`; widening to `unknown` first forces the
    // guard below to do the narrowing instead of letting `any` spread.
    const raw: unknown = error.response.data;
    const body = isRecord(raw) ? raw : {};

    return new ApiError(
      readString(body, 'message') ?? readString(body, 'detail') ?? error.message,
      status,
      readString(body, 'code') ?? `HTTP_${String(status)}`,
      body['errors'],
    );
  }

  return new ApiError(
    error instanceof Error ? error.message : 'An unexpected error occurred.',
    0,
    'UNKNOWN',
  );
}

/** Carries the send timestamp so the response side can report a duration. */
interface TimedConfig extends InternalAxiosRequestConfig {
  startedAt?: number;
}

function describe(config: { method?: string | undefined; url?: string | undefined }): string {
  return `${(config.method ?? 'get').toUpperCase()} ${config.url ?? '(no url)'}`;
}

function elapsedMs(config: TimedConfig | undefined): number | undefined {
  if (config?.startedAt === undefined) return undefined;
  return Math.round(performance.now() - config.startedAt);
}

function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: env.apiBaseUrl,
    timeout: env.apiTimeout,
    headers: { 'Content-Type': 'application/json' },
    // Send cookies so an httpOnly session cookie works. Prefer this over
    // storing a token in localStorage, which is readable by any XSS payload.
    withCredentials: true,
  });

  instance.interceptors.request.use((config) => {
    (config as TimedConfig).startedAt = performance.now();
    // `config.params` is typed `any`; widen to `unknown` so it cannot spread.
    const params: unknown = config.params;
    log.debug(`→ ${describe(config)}`, params === undefined ? undefined : { params });
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      const ms = elapsedMs(response.config as TimedConfig);
      log.info(`← ${String(response.status)} ${describe(response.config)}`, { ms });
      return response;
    },
    (error: unknown) => {
      const apiError = toApiError(error);
      const config =
        error instanceof AxiosError ? (error.config as TimedConfig | undefined) : undefined;

      log.error(`✗ ${config ? describe(config) : 'request failed'}`, {
        status: apiError.status,
        code: apiError.code,
        message: apiError.message,
        retryable: apiError.isRetryable,
        ms: elapsedMs(config),
      });

      return Promise.reject(apiError);
    },
  );

  return instance;
}

const client = createApiClient();

/**
 * Thin typed wrapper. Feature `api/` modules call these and then parse the
 * result with a Zod schema — this layer deliberately does no validation, so
 * each feature owns the contract for its own endpoints.
 */
export const apiClient = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const { data } = await client.get<T>(url, config);
    return data;
  },
  post: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const { data } = await client.post<T>(url, body, config);
    return data;
  },
  put: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const { data } = await client.put<T>(url, body, config);
    return data;
  },
  patch: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const { data } = await client.patch<T>(url, body, config);
    return data;
  },
  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const { data } = await client.delete<T>(url, config);
    return data;
  },
  /** Escape hatch for interceptors, cancellation, upload progress, etc. */
  raw: client,
};
