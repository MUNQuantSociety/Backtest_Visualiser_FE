import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  backtestKeys,
  equityKey,
  fetchBacktestEquity,
  fetchAllBacktests,
} from '@/features/backtests/data';
import type * as BacktestData from '@/features/backtests/data';
import { fetchStrategies, strategyKeys } from '@/features/strategies/data';
import type * as StrategyData from '@/features/strategies/data';
import { useUiStore } from '@/lib/ui-store';

import { prefetchDashboardData } from './dashboard-data';

vi.mock('@/features/backtests/data', async (importOriginal) => ({
  ...(await importOriginal<typeof BacktestData>()),
  fetchAllBacktests: vi.fn(),
  fetchBacktestEquity: vi.fn(),
}));
vi.mock('@/features/strategies/data', async (importOriginal) => ({
  ...(await importOriginal<typeof StrategyData>()),
  fetchStrategies: vi.fn(),
}));

afterEach(() => vi.resetAllMocks());

describe('dashboard data prefetch', () => {
  it('starts both lists together and fills the same cache the page reads', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 300_000, retry: false } },
    });
    const run = {
      id: 'run-1',
      strategyId: 'strategy-1',
      status: 'completed' as const,
      sharpe: 1,
      name: 'Run',
      strategyName: 'Strategy',
      symbol: 'AAPL',
      timeframe: '1d',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      createdAt: '2026-01-01',
      initialCapital: 100_000,
      finalEquity: 110_000,
      totalReturn: 0.1,
      maxDrawdown: -0.1,
    };
    const strategies = [
      {
        id: 'strategy-1',
        name: 'Strategy',
        className: 'Strategy',
        description: '',
        status: 'active' as const,
        tags: [],
        parameters: [],
        universe: ['AAPL'],
        runCount: 1,
        bestSharpe: 1,
        bestReturn: 0.1,
        lastRunAt: '2026-01-01',
      },
    ];
    let resolveStrategies!: (value: typeof strategies) => void;
    vi.mocked(fetchStrategies).mockReturnValue(
      new Promise((resolve) => {
        resolveStrategies = resolve;
      }),
    );
    const rerun = { ...run, id: 'run-2', name: 'Second run', sharpe: 0.1 };
    const historical = { ...run, id: 'run-3', strategyId: 'not-in-catalogue' };
    const page = { items: [run, rerun, historical], total: 3, page: 1, pageSize: 100 };
    vi.mocked(fetchAllBacktests).mockResolvedValue(page);
    const detail = {
      ...run,
      progressPct: 100,
      errorMessage: null,
      parameters: {},
      equityCurve: [],
      trades: [],
      metrics: {
        totalReturn: 0.1,
        cagr: 0.1,
        sharpe: 1,
        sortino: 1,
        maxDrawdown: -0.1,
        volatility: 0.1,
        winRate: 0.5,
        profitFactor: 1,
        totalTrades: 10,
      },
    };
    const window = { period: useUiStore.getState().dashboardPeriod, endDate: run.endDate };
    const equity = {
      ...detail,
      window: {
        period: window.period,
        requestedStart: '2023-12-31',
        requestedEnd: run.endDate,
        availableStart: run.startDate,
        availableEnd: run.endDate,
      },
    };
    vi.mocked(fetchBacktestEquity).mockResolvedValue(equity);

    const prefetch = prefetchDashboardData(client);
    expect(fetchStrategies).toHaveBeenCalledTimes(1);
    expect(fetchAllBacktests).toHaveBeenCalledTimes(1);
    expect(fetchBacktestEquity).not.toHaveBeenCalled();
    // React StrictMode temporarily unsubscribes a mounting page. Its prefetch
    // must keep running so this cannot double the API/S3 work.
    const observer = new QueryObserver(client, { queryKey: strategyKeys.lists() });
    const unsubscribe = observer.subscribe(() => {});
    unsubscribe();
    expect(client.getQueryState(strategyKeys.lists())?.fetchStatus).toBe('fetching');
    resolveStrategies(strategies);
    await prefetch;
    expect(client.getQueryData(strategyKeys.lists())).toEqual(strategies);
    expect(client.getQueryData(backtestKeys.completeList())).toEqual(page);
    expect(client.getQueryData(equityKey(run.id, window))).toEqual(equity);
    await prefetchDashboardData(client);
    expect(fetchStrategies).toHaveBeenCalledTimes(1);
    expect(fetchAllBacktests).toHaveBeenCalledTimes(1);
    expect(fetchBacktestEquity).toHaveBeenCalledTimes(3);
    expect(fetchBacktestEquity).toHaveBeenCalledWith(rerun.id, window);
    expect(fetchBacktestEquity).toHaveBeenCalledWith(historical.id, window);
    client.clear();
  });

  it('keeps API errors in the query cache for the page instead of fabricating data', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const error = new Error('Backend unavailable');
    vi.mocked(fetchStrategies).mockRejectedValue(error);
    vi.mocked(fetchAllBacktests).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    await expect(prefetchDashboardData(client)).resolves.toBeUndefined();
    expect(client.getQueryState(strategyKeys.lists())?.error).toBe(error);
    expect(fetchBacktestEquity).not.toHaveBeenCalled();
    client.clear();
  });
});
