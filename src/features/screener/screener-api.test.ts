import { beforeEach, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';

import { fetchQuotes, QUOTES_BATCH_SIZE } from './screener-api';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: vi.fn() },
}));

function wireQuote(ticker: string) {
  return {
    ticker,
    name: `${ticker} Inc.`,
    exchange: 'NASDAQ',
    kind: 'stock',
    price: 100,
    change: -1,
    changeRatio: -0.01,
    open: 101,
    previousClose: 101,
    dayHigh: 102,
    dayLow: 99,
    yearHigh: 150,
    yearLow: 80,
    volume: 1_000_000,
    marketCap: 2e12,
    average50: 98,
    average200: 95,
    asOf: '2026-10-23T20:00:00+00:00',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

it('asks the backend for the watchlist and returns its quotes', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ quotes: [wireQuote('AAPL')], missing: ['ZZZZ'] });

  const result = await fetchQuotes(['AAPL', 'ZZZZ']);

  expect(result.quotes.map((quote) => quote.ticker)).toEqual(['AAPL']);
  expect(result.missing).toEqual(['ZZZZ']);
  expect(apiClient.get).toHaveBeenCalledWith('/market-data/quotes', {
    params: { tickers: 'AAPL,ZZZZ' },
  });
});

it('splits a long watchlist into batches the backend accepts and keeps the order', async () => {
  const tickers = Array.from({ length: QUOTES_BATCH_SIZE + 2 }, (_, i) => `T${String(i)}`);
  vi.mocked(apiClient.get).mockImplementation((_url, config) => {
    const asked = String((config as { params: { tickers: string } }).params.tickers).split(',');
    return Promise.resolve({ quotes: asked.map(wireQuote), missing: [] });
  });

  const result = await fetchQuotes(tickers);

  expect(apiClient.get).toHaveBeenCalledTimes(2);
  expect(result.quotes.map((quote) => quote.ticker)).toEqual(tickers);
});

it('rejects a response that is not quotes', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ quotes: [{ ticker: 'AAPL' }], missing: [] });

  await expect(fetchQuotes(['AAPL'])).rejects.toThrow();
});
