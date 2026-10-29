import { beforeEach, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';

import { candleWindow, fetchCandles } from './candles-api';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

it('turns a range into an inclusive window ending today', () => {
  const today = new Date(Date.UTC(2026, 9, 7));
  expect(candleWindow('1M', today)).toEqual({ start: '2026-09-07', end: '2026-10-07' });
  expect(candleWindow('1Y', today)).toEqual({ start: '2025-10-07', end: '2026-10-07' });
  expect(candleWindow('5Y', today)).toEqual({ start: '2021-10-07', end: '2026-10-07' });
});

it('asks the backend for one ticker and window and returns its candles', async () => {
  const candle = { date: '2026-03-02', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 };
  vi.mocked(apiClient.get).mockResolvedValue({ ticker: 'AAPL', candles: [candle] });

  await expect(fetchCandles('AAPL', '2026-03-01', '2026-03-31')).resolves.toEqual([candle]);
  expect(apiClient.get).toHaveBeenCalledWith('/market-data/candles', {
    params: { ticker: 'AAPL', start: '2026-03-01', end: '2026-03-31' },
  });
});

it('rejects a response that is not candles', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ ticker: 'AAPL', points: [] });

  await expect(fetchCandles('AAPL', '2026-03-01', '2026-03-31')).rejects.toThrow();
});
