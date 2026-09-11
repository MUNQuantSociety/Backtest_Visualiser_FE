import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';

import { fixtureStrategyBlueprints } from './fixtures';
import { fetchStrategies } from './strategies-api';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: true, isProd: false },
}));
vi.mock('@/features/backtests/data', () => ({ fetchBacktests: vi.fn() }));
vi.mock('./fixtures', () => ({ fixtureStrategyBlueprints: vi.fn() }));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe('real strategy catalogue', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns only the API catalogue', async () => {
    const items = ['portfolio_1', 'portfolio_2'].map((id) => ({
      id,
      name: id,
      className: 'Strategy',
      description: '',
      status: 'active',
      tags: [],
      parameters: [],
      universe: ['AAPL'],
      runCount: 0,
      bestSharpe: null,
      bestReturn: null,
      lastRunAt: null,
    }));
    vi.mocked(apiClient.get).mockResolvedValue({ items, total: items.length });
    expect((await fetchStrategies()).map((item) => item.id)).toEqual([
      'portfolio_1',
      'portfolio_2',
    ]);
    expect(apiClient.get).toHaveBeenCalledWith('/strategies', undefined);
    expect(fixtureStrategyBlueprints).not.toHaveBeenCalled();
  });

  it.each([0, 502, 503, 504])(
    'does not replace an API/storage failure (%s) with samples',
    async (status) => {
      const error = new ApiError('Strategy storage is unavailable', status, 'STORAGE_UNAVAILABLE');
      vi.mocked(apiClient.get).mockRejectedValue(error);
      await expect(fetchStrategies()).rejects.toBe(error);
      expect(fixtureStrategyBlueprints).not.toHaveBeenCalled();
    },
  );
});
