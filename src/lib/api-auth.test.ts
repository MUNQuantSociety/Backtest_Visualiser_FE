import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './api-client';

const session = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  clear: vi.fn(),
  signal: new AbortController().signal,
}));
vi.mock('@/lib/auth-session', () => ({
  authIsConfigured: () => true,
  authSession: session,
  SessionExpiredError: class extends Error {},
}));
vi.mock('@/config/env', () => ({
  env: {
    apiBaseUrl: 'https://api.example.com/api',
    apiTimeout: 30000,
    isDev: false,
    devUserId: 'must-not-be-used',
  },
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const success = (config: InternalAxiosRequestConfig): AxiosResponse => ({
  data: {},
  status: 200,
  statusText: 'OK',
  headers: new AxiosHeaders(),
  config,
});
const unauthorized = (config: InternalAxiosRequestConfig) =>
  new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    ...success(config),
    status: 401,
    data: { detail: 'Sign in required' },
  });

beforeEach(() => {
  vi.clearAllMocks();
  session.getAccessToken.mockResolvedValue('access-token');
});

describe('production API authorization', () => {
  it.each(['/backtests', '/auth/me', '/strategies', '/backtests/run/export.csv'])(
    'sends only the access token to API %s',
    async (path) => {
      let sent: InternalAxiosRequestConfig | undefined;
      await apiClient.get(path, {
        adapter: (config) => {
          sent = config;
          return Promise.resolve(success(config));
        },
        headers: { 'X-User-Id': 'old-owner' },
      });
      expect(sent?.headers.get('Authorization')).toBe('Bearer access-token');
      expect(sent?.headers.has('X-User-Id')).toBe(false);
    },
  );

  it.each([
    'https://outside.example/api/backtests',
    'https://api.example.com/api-other',
    'https://api.example.com/other',
  ])('does not disclose identity to %s', async (path) => {
    let sent: InternalAxiosRequestConfig | undefined;
    await apiClient.get(path, {
      adapter: (config) => {
        sent = config;
        return Promise.resolve(success(config));
      },
    });
    expect(sent?.headers.has('Authorization')).toBe(false);
    expect(session.getAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes a rejected access token and retries only once', async () => {
    let token = 'first-access';
    session.getAccessToken.mockImplementation((rejected?: string) => {
      if (rejected) token = 'second-access';
      return Promise.resolve(token);
    });
    const sent: unknown[] = [];
    await apiClient.get('/backtests', {
      adapter: (config) => {
        sent.push(config.headers.get('Authorization'));
        return sent.length === 1
          ? Promise.reject(unauthorized(config))
          : Promise.resolve(success(config));
      },
    });
    expect(sent).toEqual(['Bearer first-access', 'Bearer second-access']);
    expect(session.getAccessToken).toHaveBeenCalledWith('first-access');
  });

  it('ends a session after the replacement token also gets 401 without a retry loop', async () => {
    const adapter = vi.fn((config: InternalAxiosRequestConfig) =>
      Promise.reject(unauthorized(config)),
    );
    await expect(apiClient.post('/backtests', {}, { adapter })).rejects.toMatchObject({
      status: 401,
    });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(session.clear).toHaveBeenCalledOnce();
  });

  it('does not retry public anonymous 401 responses', async () => {
    session.getAccessToken.mockResolvedValue(null);
    const adapter = vi.fn((config: InternalAxiosRequestConfig) =>
      Promise.reject(unauthorized(config)),
    );
    await expect(apiClient.get('/auth/me', { adapter })).rejects.toMatchObject({ status: 401 });
    expect(adapter).toHaveBeenCalledOnce();
  });
});
