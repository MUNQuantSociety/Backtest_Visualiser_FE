import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';

import { fixtureIndicators } from './fixtures';
import { fetchIndicators, fetchRunNews } from './market-api';
import type { TickerIndicators } from './types';

const config = vi.hoisted(() => ({
  apiBaseUrl: '/api',
  apiTimeout: 30_000,
  useFixtures: false,
  isDev: true,
  isProd: false,
}));
vi.mock('@/config/env', () => ({ env: config }));
vi.mock('./fixtures', () => ({ fixtureIndicators: vi.fn() }));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const article = {
  id: '42',
  source: 'reuters.com',
  publishedAt: '2026-07-15T18:00:00+00:00',
  headline: 'Apple beats on revenue',
  summary: 'Apple beats on revenue. Guidance raised.',
  url: 'https://www.reuters.com/markets/apple-beats',
  tickers: ['AAPL'],
  score: 0.4,
};

const indicatorRow: TickerIndicators = {
  ticker: 'AAPL',
  last: 211.5,
  rsi14: 48.2,
  macdHistogram: 0.31,
  smaRegime: 'above',
  momentum20d: 0.021,
  sentiment7d: -0.13,
  sentimentDelta7d: 0.04,
  asOf: '2026-07-15',
};

const run = { tickers: ['MSFT', 'AAPL'], start: '2026-05-01', end: '2026-05-29' };

describe('fetchRunNews', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    config.useFixtures = false;
  });

  it('returns the articles the API sends', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [article] });

    await expect(fetchRunNews(run, 8)).resolves.toEqual([article]);
  });

  it('asks for the run’s sorted tickers and its own dates', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [] });

    await fetchRunNews(run, 8);

    expect(apiClient.get).toHaveBeenCalledWith('/news', {
      params: { tickers: 'AAPL,MSFT', start: '2026-05-01', end: '2026-05-29', limit: 8 },
    });
  });

  it('calls the API even in fixture mode', async () => {
    config.useFixtures = true;
    vi.mocked(apiClient.get).mockResolvedValue({ items: [article] });

    await expect(fetchRunNews(run, 8)).resolves.toEqual([article]);
  });

  it.each([0, 404, 503])('surfaces a %i in dev', async (status) => {
    vi.mocked(apiClient.get).mockRejectedValue(new ApiError('unavailable', status, 'error'));

    await expect(fetchRunNews(run, 8)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('fetchIndicators', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    config.useFixtures = false;
  });

  it('returns the rows the API sends', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [indicatorRow] });

    await expect(fetchIndicators(['AAPL'])).resolves.toEqual([indicatorRow]);
  });

  it('asks for the 7-day window with sorted tickers', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [] });

    await fetchIndicators(['MSFT', 'AAPL']);

    expect(apiClient.get).toHaveBeenCalledWith('/indicators', {
      params: { tickers: 'AAPL,MSFT', window: '7d' },
    });
  });

  it('makes no request for an empty universe', async () => {
    await expect(fetchIndicators([])).resolves.toEqual([]);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it.each([0, 404, 503])('surfaces a %i in dev instead of serving fixtures', async (status) => {
    vi.mocked(apiClient.get).mockRejectedValue(new ApiError('unavailable', status, 'error'));

    await expect(fetchIndicators(['AAPL'])).rejects.toBeInstanceOf(ApiError);
    expect(fixtureIndicators).not.toHaveBeenCalled();
  });

  it('serves fixtures in fixture mode', async () => {
    config.useFixtures = true;
    vi.mocked(fixtureIndicators).mockReturnValue([indicatorRow]);

    await expect(fetchIndicators(['AAPL'])).resolves.toEqual([indicatorRow]);
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
