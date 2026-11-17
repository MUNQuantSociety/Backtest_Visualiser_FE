import { beforeEach, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';

import { fetchChartDrawings, saveChartDrawings } from './chart-drawings-api';

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: vi.fn(), put: vi.fn() },
}));

const TREND = {
  id: 'a',
  tool: 'trend' as const,
  points: [
    { date: '2026-04-01', price: 250 },
    { date: '2026-11-02', price: 350 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

it("reads a ticker's drawings, dropping the null text of drawings that are not notes", async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    ticker: 'AAPL',
    drawings: [
      { ...TREND, text: null },
      { id: 'n', tool: 'text', points: [{ date: '2026-06-01', price: 300 }], text: 'Breakout' },
    ],
    updatedAt: '2026-11-17T15:51:46+00:00',
  });

  const saved = await fetchChartDrawings('AAPL');

  expect(apiClient.get).toHaveBeenCalledWith('/chart-drawings/AAPL', {});
  expect(saved.drawings).toEqual([
    TREND,
    { id: 'n', tool: 'text', points: [{ date: '2026-06-01', price: 300 }], text: 'Breakout' },
  ]);
});

it('saves the whole list, with the ticker escaped in the path', async () => {
  vi.mocked(apiClient.put).mockResolvedValue({
    ticker: '^GSPC',
    drawings: [TREND],
    updatedAt: null,
  });

  await saveChartDrawings('^GSPC', [TREND]);

  expect(apiClient.put).toHaveBeenCalledWith('/chart-drawings/%5EGSPC', { drawings: [TREND] });
});

it('rejects a response that is not a list of drawings', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    ticker: 'AAPL',
    drawings: [{ id: 1 }],
    updatedAt: null,
  });

  await expect(fetchChartDrawings('AAPL')).rejects.toThrow();
});
