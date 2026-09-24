import '@/test/storage-global';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { strategyKeys } from '@/features/strategies/keys';
import { ApiError, apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';

import { useBacktests, useSubmitBacktest } from './backtests-api';
import { mergeRunRows, readPendingRuns, rememberPendingRun } from './pending-runs';
import type { BacktestDetail, BacktestSummary } from './types';
import { usePendingRunRows, usePendingRuns } from './use-pending-runs';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: true, isProd: false },
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

/**
 * The backend lists a run only once it has finished, so the run history
 * cannot notice a new run on its own and the detail page that could is gone as
 * soon as the person leaves it. These cover the watch that outlives both.
 */

/** What `POST /backtests` answers with: the run as it was accepted. */
const accepted: BacktestSummary = {
  id: 'run-1',
  name: 'Running test',
  strategyId: 'strategy-1',
  strategyName: 'Momentum',
  symbol: 'AAPL',
  timeframe: '1d',
  status: 'queued',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  createdAt: '2026-01-01T00:00:00Z',
  initialCapital: 100_000,
  finalEquity: 100_000,
  totalReturn: 0,
  sharpe: 0,
  maxDrawdown: 0,
};
const running: BacktestDetail = {
  ...accepted,
  status: 'running',
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
const completed: BacktestDetail = { ...running, status: 'completed', progressPct: 100 };
const emptyPage = { items: [], total: 0, page: 1, pageSize: 25 };
const finishedPage = { items: [completed], total: 1, page: 1, pageSize: 25 };

let client: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

const get = vi.mocked(apiClient.get);
const listCalls = () => get.mock.calls.filter(([url]) => url === '/backtests').length;
const detailCalls = () => get.mock.calls.filter(([url]) => url === '/backtests/run-1').length;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  localStorage.clear();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 5 * 60 * 1000 } },
  });
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
});

describe('usePendingRuns', () => {
  it('puts a run started here into the run history the moment it finishes', async () => {
    rememberPendingRun(accepted);
    // The run history is open and holds nothing in flight — the backend does
    // not list a running run — so on its own it would never refetch.
    get.mockImplementation((url) => Promise.resolve(url === '/backtests' ? emptyPage : running));
    const strategies = vi.fn(() => Promise.resolve([]));
    const { result, unmount } = renderHook(
      () => ({
        list: useBacktests(),
        catalogue: useQuery({ queryKey: strategyKeys.lists(), queryFn: strategies }),
        pending: usePendingRuns(),
      }),
      { wrapper: Wrapper },
    );
    await advance(50);
    expect(result.current.list.data?.items).toEqual([]);
    expect(listCalls()).toBe(1);
    expect(detailCalls()).toBe(1);

    await advance(3_050);
    expect(detailCalls()).toBe(2);
    expect(listCalls()).toBe(1);

    get.mockImplementation((url) =>
      Promise.resolve(url === '/backtests' ? finishedPage : completed),
    );
    await advance(3_050);
    expect(result.current.list.data?.items[0]?.id).toBe('run-1');
    expect(listCalls()).toBe(2);
    expect(strategies).toHaveBeenCalledTimes(2);
    expect(readPendingRuns()).toEqual([]);

    // Settled once: nothing polls, nothing refetches, after that.
    await advance(60_000);
    expect(detailCalls()).toBe(3);
    expect(listCalls()).toBe(2);
    expect(strategies).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('resumes a watch left over from before a reload', async () => {
    localStorage.setItem(
      'mqs.pending-runs',
      JSON.stringify([{ id: 'run-1', submittedAt: new Date().toISOString(), summary: accepted }]),
    );
    get.mockImplementation(() => Promise.resolve(completed));
    const { result, unmount } = renderHook(() => usePendingRuns(), { wrapper: Wrapper });
    expect(result.current.map((run) => run.id)).toEqual(['run-1']);

    await advance(50);
    expect(detailCalls()).toBe(1);
    expect(readPendingRuns()).toEqual([]);
    unmount();
  });

  it('refreshes its own lists when another tab saw the run finish first', async () => {
    rememberPendingRun(accepted);
    get.mockImplementation((url) => Promise.resolve(url === '/backtests' ? emptyPage : running));
    const { unmount } = renderHook(() => ({ list: useBacktests(), pending: usePendingRuns() }), {
      wrapper: Wrapper,
    });
    await advance(50);
    expect(listCalls()).toBe(1);

    // The other tab forgot the run; only the `storage` event reaches here.
    get.mockImplementation((url) =>
      Promise.resolve(url === '/backtests' ? finishedPage : completed),
    );
    localStorage.setItem('mqs.pending-runs', '[]');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'mqs.pending-runs' }));
    });
    await advance(50);
    expect(listCalls()).toBe(2);

    // And the watch is over: nothing polls the run from here any more.
    await advance(60_000);
    expect(detailCalls()).toBe(1);
    unmount();
  });

  it('stops watching a run the backend no longer knows about', async () => {
    rememberPendingRun(accepted);
    get.mockRejectedValue(new ApiError('Not found', 404, 'NOT_FOUND'));
    const { unmount } = renderHook(() => usePendingRuns(), { wrapper: Wrapper });
    await advance(50);
    expect(readPendingRuns()).toEqual([]);

    await advance(60_000);
    expect(detailCalls()).toBe(1);
    unmount();
  });

  it('keeps polling through a transient error', async () => {
    rememberPendingRun(accepted);
    get.mockRejectedValue(new ApiError('Timed out', 0, 'ECONNABORTED'));
    const { unmount } = renderHook(() => usePendingRuns(), { wrapper: Wrapper });
    await advance(50);
    expect(readPendingRuns().map((run) => run.id)).toEqual(['run-1']);

    await advance(3_050);
    expect(detailCalls()).toBe(2);
    unmount();
  });
});

describe('the run history row for a run started here', () => {
  /** Every row list the page rendered, as `id:status`, in render order. */
  function renderHistory() {
    const seen: string[][] = [];
    const view = renderHook(
      () => {
        const list = useBacktests();
        const pending = usePendingRuns();
        const rows = mergeRunRows(list.data?.items ?? [], pending);
        seen.push(rows.map((row) => `${row.id}:${row.status}`));
        return rows;
      },
      { wrapper: Wrapper },
    );
    return { ...view, seen };
  }

  it('shows the run as queued before the first poll answers', () => {
    rememberPendingRun(accepted);
    get.mockImplementation((url) => Promise.resolve(url === '/backtests' ? emptyPage : running));
    const { seen, unmount } = renderHistory();

    expect(seen[0]).toEqual(['run-1:queued']);
    unmount();
  });

  it('moves the row through running to completed, never showing it twice or not at all', async () => {
    rememberPendingRun(accepted);
    get.mockImplementation((url) => Promise.resolve(url === '/backtests' ? emptyPage : running));
    const { result, seen, unmount } = renderHistory();
    await advance(50);
    expect(result.current.map((row) => row.status)).toEqual(['running']);

    get.mockImplementation((url) =>
      Promise.resolve(url === '/backtests' ? finishedPage : completed),
    );
    await advance(3_050);
    await advance(60_000);

    expect(seen.every((rows) => rows.length === 1)).toBe(true);
    const statuses = seen.map(([row]) => row).filter((row, index, all) => row !== all[index - 1]);
    expect(statuses).toEqual(['run-1:queued', 'run-1:running', 'run-1:completed']);
    expect(readPendingRuns()).toEqual([]);
    unmount();
  });
});

describe('usePendingRunRows', () => {
  it('neither polls nor settles a run on its own', async () => {
    rememberPendingRun(accepted);
    get.mockImplementation(() => Promise.resolve(completed));
    const { result, unmount } = renderHook(() => usePendingRunRows(), { wrapper: Wrapper });
    await advance(50);
    expect(result.current.map((row) => row.status)).toEqual(['completed']);

    await advance(60_000);
    expect(detailCalls()).toBe(1);
    expect(readPendingRuns().map((run) => run.id)).toEqual(['run-1']);
    unmount();
  });
});

describe('useSubmitBacktest', () => {
  it('remembers the accepted run so the shell keeps watching it', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      id: 'run-9',
      name: 'Fresh',
      strategyId: 'strategy-1',
      strategyName: 'Momentum',
      symbol: 'AAPL',
      timeframe: '1d',
      status: 'queued',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      createdAt: '2026-01-01T00:00:00Z',
      initialCapital: 100_000,
      finalEquity: 100_000,
      totalReturn: 0,
      sharpe: 0,
      maxDrawdown: 0,
      progressPct: 0,
      errorMessage: null,
    });
    const { result, unmount } = renderHook(() => useSubmitBacktest(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        strategyKey: 'strategy-1',
        name: 'Fresh',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        initialCapital: 100_000,
        mode: 'event',
        params: {},
      });
    });

    expect(readPendingRuns().map((run) => run.id)).toEqual(['run-9']);
    unmount();
  });
});
