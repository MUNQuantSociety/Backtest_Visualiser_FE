import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type { DashboardPeriod } from '@/lib/ui-store';

import {
  equityKey,
  fetchBacktestEquity,
  useBacktestEquities,
  type BacktestEquity,
} from './equity-api';

vi.mock('@/config/env', () => ({ env: { useFixtures: false } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn() }) }));

const endDate = '2026-09-09';
const response = (period: DashboardPeriod): BacktestEquity => ({
  id: 'run-1',
  strategyId: 'strategy-1',
  symbol: 'SPY',
  equityCurve: [{ date: endDate, equity: 120, benchmark: 110 }],
  window: {
    period,
    requestedStart: null,
    requestedEnd: endDate,
    availableStart: '2020-01-01',
    availableEnd: endDate,
  },
});
let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => client.clear());

describe('backend dashboard periods', () => {
  it.each(['1y', '2y', '5y', 'max'] as const)(
    'sends %s and the shared end date to the backend',
    async (period) => {
      vi.mocked(apiClient.get).mockResolvedValue(response(period));
      const signal = new AbortController().signal;
      expect(await fetchBacktestEquity('run-1', { period, endDate }, signal)).toEqual(
        response(period),
      );
      expect(apiClient.get).toHaveBeenCalledWith('/backtests/run-1/equity', {
        params: { period, endDate },
        signal,
      });
    },
  );

  it('changes query keys, cancels an old period, and cannot replace a newer selection with stale data', async () => {
    const get = vi.mocked(apiClient.get);
    let oldSignal: AbortSignal | undefined;
    let resolveOld!: (value: BacktestEquity) => void;
    get.mockImplementation((_url, config) => {
      const params = config?.params as { period?: DashboardPeriod } | undefined;
      if (params?.period === '1y') {
        oldSignal = config?.signal as AbortSignal;
        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      }
      return Promise.resolve(response('5y'));
    });
    const { result, rerender } = renderHook(
      ({ period }: { period: DashboardPeriod }) =>
        useBacktestEquities(['run-1'], { period, endDate }),
      { wrapper: Wrapper, initialProps: { period: '1y' } },
    );
    expect(result.current.isPending).toBe(true);
    rerender({ period: '5y' });
    await waitFor(() => expect(result.current.data[0]?.window.period).toBe('5y'));
    expect(oldSignal?.aborted).toBe(true);
    resolveOld(response('1y'));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data[0]?.window.period).toBe('5y');
    expect(client.getQueryData(equityKey('run-1', { period: '5y', endDate }))).toEqual(
      response('5y'),
    );
    expect(equityKey('run-1', { period: '5y', endDate })).not.toEqual(
      equityKey('run-1', { period: '5y', endDate: '2025-09-09' }),
    );
  });

  it('exposes API failures and does not substitute old or demo data', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Backend unavailable'));
    const { result } = renderHook(() => useBacktestEquities(['run-1'], { period: '2y', endDate }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.error?.message).toBe('Backend unavailable'));
    expect(result.current.data).toEqual([]);
  });
});
