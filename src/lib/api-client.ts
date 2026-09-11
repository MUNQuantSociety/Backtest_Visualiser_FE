import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/config/env';
import { sanitiseLogUrl } from '@/lib/log-data';
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
    if (this.code === 'ERR_CANCELED') return false;
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
        isTimeout
          ? 'The request timed out.'
          : error.code === 'ERR_CANCELED'
            ? 'The request was cancelled.'
            : 'Could not reach the server.',
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
  requestId?: string;
  waitingTimer?: ReturnType<typeof setInterval>;
}

function describe(config: { method?: string | undefined; url?: string | undefined }): string {
  return `${(config.method ?? 'get').toUpperCase()} ${config.url ? sanitiseLogUrl(config.url) : '(no url)'}`;
}

function elapsedMs(config: TimedConfig | undefined): number | undefined {
  if (config?.startedAt === undefined) return undefined;
  return Math.round(performance.now() - config.startedAt);
}

function requestContext(config: TimedConfig | undefined) {
  const params: unknown = config?.params;
  return {
    requestId: config?.requestId,
    params,
    timeoutMs: config?.timeout,
    ms: elapsedMs(config),
  };
}

function stopWaiting(config: TimedConfig | undefined) {
  if (config?.waitingTimer !== undefined) {
    clearInterval(config.waitingTimer);
    delete config.waitingTimer;
  }
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
    const timed = config as TimedConfig;
    timed.startedAt = performance.now();
    timed.requestId = crypto.randomUUID();
    // Correlate the same-origin dev proxy without adding cross-origin CORS requirements.
    const url = new URL(instance.getUri(config), window.location.href);
    if (env.isDev && env.devUserId) {
      const backend = new URL(env.apiBaseUrl, window.location.href);
      const backtestsPath = `${backend.pathname.replace(/\/$/, '')}/backtests`;
      // The explicit local account only owns backtest requests to this backend.
      // Absolute third-party URLs and unrelated endpoints must not receive it.
      if (
        url.origin === backend.origin &&
        (url.pathname === backtestsPath || url.pathname.startsWith(`${backtestsPath}/`))
      ) {
        config.headers.set('X-User-Id', env.devUserId);
      }
    }
    if (env.isDev && url.origin === window.location.origin) {
      config.headers.set('X-Client-Request-Id', timed.requestId);
    }
    log.info(`request started: ${describe(config)}`, requestContext(timed));
    if (env.isDev) {
      timed.waitingTimer = setInterval(() => {
        log.warn(`request still waiting: ${describe(config)}`, {
          ...requestContext(timed),
          remainingMs: timed.timeout ? Math.max(0, timed.timeout - (elapsedMs(timed) ?? 0)) : null,
        });
      }, 5000);
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      const config = response.config as TimedConfig;
      const serverRequestId: unknown = response.headers['x-request-id'];
      stopWaiting(config);
      log.info(`request completed: ${describe(config)}`, {
        ...requestContext(config),
        status: response.status,
        serverRequestId,
      });
      return response;
    },
    (error: unknown) => {
      const apiError = toApiError(error);
      const config =
        error instanceof AxiosError ? (error.config as TimedConfig | undefined) : undefined;

      stopWaiting(config);
      const cancelled = apiError.code === 'ERR_CANCELED';
      const write = cancelled ? log.info : log.error;
      write(
        `request ${cancelled ? 'cancelled' : 'failed'}: ${config ? describe(config) : 'unknown request'}`,
        {
          ...requestContext(config),
          status: apiError.status,
          code: apiError.code,
          message: apiError.message,
          retryable: apiError.isRetryable,
          details: apiError.details,
        },
      );

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
