import '@/test/storage-global';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

import type * as BacktestsModule from '@/features/backtests';
import type * as StrategiesModule from '@/features/strategies';

import { useWatchlistUniverse } from './use-watchlist-universe';
import { useWatchlistStore } from './watchlist-store';

interface StrategiesResult {
  data: unknown;
  isPending: boolean;
  isError: boolean;
}

const data = vi.hoisted(() => {
  const strategies: StrategiesResult = { data: undefined, isPending: false, isError: false };
  return { strategies };
});

vi.mock('@/features/strategies', async (importOriginal) => ({
  ...(await importOriginal<typeof StrategiesModule>()),
  useStrategies: () => data.strategies,
}));
vi.mock('@/features/backtests', async (importOriginal) => ({
  ...(await importOriginal<typeof BacktestsModule>()),
  useAllBacktests: () => ({ data: { items: [] } }),
}));

function strategy(id: string, universe: string[], status = 'active') {
  return { id, name: id, className: id, status, universe };
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useWatchlistStore.getState().reset();
  data.strategies = {
    data: [
      strategy('a', ['NVDA', 'AAPL']),
      strategy('b', ['AAPL', 'SPY']),
      strategy('off', ['TSLA'], 'draft'),
    ],
    isPending: false,
    isError: false,
  };
});

it('is the active strategies’ tickers, most traded first, like the dashboard', () => {
  const { result } = renderHook(() => useWatchlistUniverse(), { wrapper });

  expect(result.current.tickers).toEqual(['AAPL', 'NVDA', 'SPY']);
  expect(result.current.isEdited).toBe(false);
});

it('follows the dashboard’s additions and removals', () => {
  const { result } = renderHook(() => useWatchlistUniverse(), { wrapper });

  act(() => {
    useWatchlistStore.getState().add('MSFT');
    useWatchlistStore.getState().remove('SPY');
  });

  expect(result.current.tickers).toEqual(['AAPL', 'NVDA', 'MSFT']);
  expect(result.current.isEdited).toBe(true);
});

it('keeps the same list object until its tickers change', () => {
  const { result, rerender } = renderHook(() => useWatchlistUniverse(), { wrapper });
  const first = result.current.tickers;

  rerender();

  expect(result.current.tickers).toBe(first);
});

it('reports a strategy list that failed, keeping only local additions', () => {
  data.strategies = { data: undefined, isPending: false, isError: true };
  useWatchlistStore.getState().add('MSFT');

  const { result } = renderHook(() => useWatchlistUniverse(), { wrapper });

  expect(result.current.isUnavailable).toBe(true);
  expect(result.current.tickers).toEqual(['MSFT']);
});
