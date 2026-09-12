import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';

import { fetchBacktests, submitBacktest } from './backtests-api';

const config = vi.hoisted(
  (): {
    apiBaseUrl: string;
    apiTimeout: number;
    useFixtures: boolean;
    isDev: boolean;
    isProd: boolean;
    devUserId: string | undefined;
  } => ({
    apiBaseUrl: '/api',
    apiTimeout: 30_000,
    useFixtures: false,
    isDev: true,
    isProd: false,
    devUserId: '76125fb2-45a8-4ff5-9195-3bb0dc092c91',
  }),
);
vi.mock('@/config/env', () => ({ env: config }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const originalAdapter = apiClient.raw.defaults.adapter;
let requests: InternalAxiosRequestConfig[];
const summary = {
  id: 'run-1',
  name: 'Temporary account test',
  strategyId: 'portfolio_1',
  strategyName: 'Portfolio 1',
  symbol: 'AAPL',
  timeframe: '1d',
  status: 'queued',
  startDate: '2025-01-01',
  endDate: '2025-02-01',
  createdAt: '2025-02-02T00:00:00Z',
  initialCapital: 100_000,
  finalEquity: 100_000,
  totalReturn: 0,
  sharpe: 0,
  maxDrawdown: 0,
};

beforeEach(() => {
  config.isDev = true;
  config.devUserId = '76125fb2-45a8-4ff5-9195-3bb0dc092c91';
  requests = [];
  apiClient.raw.defaults.adapter = (request) => {
    requests.push(request);
    return Promise.resolve({
      data:
        request.method === 'post' ? summary : { items: [summary], total: 1, page: 1, pageSize: 20 },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config: request,
    });
  };
});
afterEach(() => {
  if (originalAdapter === undefined) delete apiClient.raw.defaults.adapter;
  else apiClient.raw.defaults.adapter = originalAdapter;
});

describe('temporary development backtest ownership', () => {
  it('sends the same owner on the actual dashboard list and run submission requests', async () => {
    await fetchBacktests({ page: 1 });
    await submitBacktest({
      name: 'Temporary account test',
      strategyKey: 'portfolio_1',
      startDate: '2025-01-01',
      endDate: '2025-02-01',
      initialCapital: 100_000,
    });
    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ['get', '/backtests'],
      ['post', '/backtests'],
    ]);
    expect(requests.map((request) => request.headers.get('X-User-Id'))).toEqual([
      config.devUserId,
      config.devUserId,
    ]);
  });

  it('includes the owner on backtest detail and equity requests', async () => {
    await apiClient.get('/backtests/run-1');
    await apiClient.get('/backtests/run-1/equity');
    expect(requests.every((request) => request.headers.get('X-User-Id') === config.devUserId)).toBe(
      true,
    );
  });

  it.each(['/strategies', '/strategies/upload'])(
    'includes the owner when uploading to %s for validation',
    async (url) => {
      await apiClient.post(url, {});
      expect(requests[0]!.headers.get('X-User-Id')).toBe(config.devUserId);
    },
  );

  it.each([
    '/strategies/check',
    '/strategies/upload/check',
    '/strategies-other',
    'https://third-party.example/api/strategies',
  ])('does not send the temporary identity on unrelated POST %s', async (url) => {
    await apiClient.post(url, {});
    expect(requests[0]!.headers.has('X-User-Id')).toBe(false);
  });

  it.each([
    '/strategies',
    '/market-data/coverage',
    '/backtests-other',
    'https://third-party.example/api/backtests',
    '//third-party.example/api/backtests/run-1',
  ])('does not send the temporary identity to %s', async (url) => {
    await apiClient.get(url);
    expect(requests[0]!.headers.has('X-User-Id')).toBe(false);
  });

  it('preserves normal request identity when the override is absent', async () => {
    config.devUserId = undefined;
    await apiClient.get('/backtests', { headers: { 'X-User-Id': 'existing-account' } });
    expect(requests[0]!.headers.get('X-User-Id')).toBe('existing-account');
  });

  it('does not inject a temporary identity in production', async () => {
    config.isDev = false;
    await apiClient.post('/backtests', {});
    expect(requests[0]!.headers.has('X-User-Id')).toBe(false);
  });
});
