import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';

import { useBacktest, useBacktests } from './backtests-api';
import { fixtureBacktest, fixtureBacktests } from './fixtures';
import type { BacktestDetail } from './types';

const config = vi.hoisted(() => ({
  apiBaseUrl: '/api',
  apiTimeout: 30_000,
  useFixtures: false,
  isDev: true,
  isProd: false,
}));
vi.mock('@/config/env', () => ({ env: config }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});
vi.mock('./fixtures', () => ({ fixtureBacktests: vi.fn(), fixtureBacktest: vi.fn() }));

const run: BacktestDetail = {
  id: 'run-1',
  name: 'Running test',
  strategyId: 'strategy-1',
  strategyName: 'Momentum',
  symbol: 'AAPL',
  timeframe: '1d',
  status: 'running',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  createdAt: '2026-01-01T00:00:00Z',
  initialCapital: 100_000,
  finalEquity: 100_000,
  totalReturn: 0,
  sharpe: 0,
  maxDrawdown: 0,
  progressPct: 10,
  errorMessage: null,
  parameters: {},
  equityCurve: [],
  trades: [],
  metrics: {
    totalReturn: 0,
    cagr: 0,
    sharpe: 0,
    sortino: 0,
    maxDrawdown: 0,
    volatility: 0,
    winRate: 0,
    profitFactor: 0,
    totalTrades: 0,
  },
};
const page = { items: [run], total: 1, page: 1, pageSize: 25 };
let client: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  config.useFixtures = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
});

describe('backtest polling lifecycle', () => {
  it('polls real running runs, stops after an outage, and supports a manual retry', async () => {
    const get = vi.mocked(apiClient.get);
    get.mockImplementation((url) => Promise.resolve(url === '/backtests' ? page : run));
    const { result, unmount } = renderHook(
      () => ({ list: useBacktests(), detail: useBacktest(run.id) }),
      { wrapper: Wrapper },
    );
    await advance(50);
    expect(result.current.list.isSuccess).toBe(true);
    expect(result.current.detail.isSuccess).toBe(true);
    expect(get).toHaveBeenCalledTimes(2);

    get.mockRejectedValue(new ApiError('Timed out', 0, 'ECONNABORTED'));
    await advance(3_050);
    expect(result.current.list.isError).toBe(true);
    expect(result.current.detail.isError).toBe(true);
    expect(get).toHaveBeenCalledTimes(4);
    await advance(60_000);
    expect(get).toHaveBeenCalledTimes(4);
    expect(fixtureBacktests).not.toHaveBeenCalled();
    expect(fixtureBacktest).not.toHaveBeenCalled();

    get.mockImplementation((url) => Promise.resolve(url === '/backtests' ? page : run));
    await act(async () => {
      await result.current.list.refetch();
    });
    await advance(3_050);
    expect(result.current.list.isSuccess).toBe(true);
    expect(get).toHaveBeenCalledTimes(6);
    unmount();
  });

  it('does not repeatedly poll static fixtures with unfinished statuses', async () => {
    config.useFixtures = true;
    vi.mocked(fixtureBacktests).mockResolvedValue([run]);
    vi.mocked(fixtureBacktest).mockResolvedValue(run);
    const { result, unmount } = renderHook(
      () => ({ list: useBacktests(), detail: useBacktest(run.id) }),
      { wrapper: Wrapper },
    );
    await advance(300);
    expect(result.current.list.isSuccess).toBe(true);
    expect(result.current.detail.isSuccess).toBe(true);
    await advance(60_000);
    expect(fixtureBacktests).toHaveBeenCalledTimes(1);
    expect(fixtureBacktest).toHaveBeenCalledTimes(1);
    expect(apiClient.get).not.toHaveBeenCalled();
    unmount();
  });

  it('aborts list and detail requests when their last subscriber leaves', async () => {
    const signals: AbortSignal[] = [];
    vi.mocked(apiClient.get).mockImplementation((_url, options) => {
      signals.push(options!.signal as AbortSignal);
      return new Promise(() => {});
    });
    const { unmount } = renderHook(() => ({ list: useBacktests(), detail: useBacktest(run.id) }), {
      wrapper: Wrapper,
    });
    await advance(0);
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => !signal.aborted)).toBe(true);
    unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
