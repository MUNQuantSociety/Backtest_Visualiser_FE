import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';

import { fetchBacktest, fetchBacktests, fetchCoverage } from './backtests-api';
import { fixtureBacktest, fixtureBacktests } from './fixtures';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: true, isProd: false },
}));

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

vi.mock('./fixtures', () => ({ fixtureBacktests: vi.fn(), fixtureBacktest: vi.fn() }));

describe('real backtest failures', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([0, 502, 503, 504])(
    'does not replace a failed list or detail (%s) with demo runs',
    async (status) => {
      const error = new ApiError('Backend unavailable', status, 'UNAVAILABLE');
      vi.mocked(apiClient.get).mockRejectedValue(error);
      await expect(fetchBacktests()).rejects.toBe(error);
      await expect(fetchBacktest('run-1')).rejects.toBe(error);
      expect(fixtureBacktests).not.toHaveBeenCalled();
      expect(fixtureBacktest).not.toHaveBeenCalled();
    },
  );
});

describe('real coverage for selected tickers', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends the explicit universe and preserves its actual date range', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      tickers: [],
      start: '2025-03-28',
      end: '2025-11-07',
      missing: [],
    });
    const result = await fetchCoverage('portfolio_1', ['CRWV', 'NBIS']);
    expect(apiClient.get).toHaveBeenCalledWith('/market-data/coverage', {
      params: { tickers: 'CRWV,NBIS' },
    });
    expect(result.start).toBe('2025-03-28');
    expect(result.end).toBe('2025-11-07');
  });

  it.each([0, 502, 503, 504])(
    'does not hide a timeout/outage (%s) with demo coverage',
    async (status) => {
      const error = new ApiError('Coverage request failed', status, 'COVERAGE_UNAVAILABLE');
      vi.mocked(apiClient.get).mockRejectedValue(error);
      await expect(fetchCoverage('portfolio_1', ['CRWV', 'NBIS'])).rejects.toBe(error);
      expect(fixtureBacktests).not.toHaveBeenCalled();
    },
  );
});
