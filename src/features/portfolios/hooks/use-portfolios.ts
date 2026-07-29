import { useQuery } from '@tanstack/react-query';

import { LIVE_REFETCH_MS } from '@/config/constants';

import {
  fetchPortfolio,
  fetchPortfolioCorrelations,
  fetchPortfolioEquity,
  fetchPortfolioExecutions,
  fetchPortfolios,
} from '../api/portfolios-api';
import { portfolioKeys } from '../api/query-keys';
import type { ExecutionFilters } from '../types/portfolio';

/**
 * React Query bindings for the live portfolios.
 *
 * The polling story is the difference between this feature and `backtests`: a
 * finished backtest is immutable and cached forever, whereas a live portfolio's
 * value changes on every OMS tick. Anything showing money refetches; anything
 * derived from a slow rolling window does not.
 */

export function usePortfolios() {
  return useQuery({
    queryKey: portfolioKeys.list(),
    queryFn: fetchPortfolios,
    refetchInterval: LIVE_REFETCH_MS,
    // Pause polling in a hidden tab — a dashboard left open overnight should
    // not keep hitting the API to render pixels nobody is looking at.
    refetchIntervalInBackground: false,
  });
}

export interface PortfolioTotals {
  totalValue: number;
  cash: number;
  dayPnl: number;
  totalPnl: number;
  totalReturn: number;
  runningCount: number;
  portfolioCount: number;
}

/**
 * Master-portfolio roll-up across every sleeve.
 *
 * Derived from the list query rather than fetched separately, so the headline
 * figure can never disagree with the cards beneath it — two endpoints sampled
 * milliseconds apart would eventually show a total that does not match its
 * parts, and nobody would be able to reproduce it.
 */
export function usePortfolioTotals(): { totals: PortfolioTotals | undefined; isPending: boolean } {
  const { data, isPending } = usePortfolios();

  if (!data) return { totals: undefined, isPending };

  const totals = data.items.reduce<PortfolioTotals>(
    (accumulator, portfolio) => ({
      totalValue: accumulator.totalValue + portfolio.totalValue,
      cash: accumulator.cash + portfolio.cash,
      dayPnl: accumulator.dayPnl + portfolio.dayPnl,
      totalPnl: accumulator.totalPnl + portfolio.totalPnl,
      totalReturn: 0,
      runningCount: accumulator.runningCount + (portfolio.state === 'running' ? 1 : 0),
      portfolioCount: accumulator.portfolioCount + 1,
    }),
    {
      totalValue: 0,
      cash: 0,
      dayPnl: 0,
      totalPnl: 0,
      totalReturn: 0,
      runningCount: 0,
      portfolioCount: 0,
    },
  );

  // Return on deployed capital, not on current value — dividing by the current
  // total would understate a gain and overstate a loss.
  const deployed = totals.totalValue - totals.totalPnl;
  totals.totalReturn = deployed === 0 ? 0 : totals.totalPnl / deployed;

  return { totals, isPending };
}

export function usePortfolio(id: string | undefined) {
  return useQuery({
    queryKey: portfolioKeys.detail(id ?? ''),
    queryFn: () => fetchPortfolio(id ?? ''),
    enabled: Boolean(id),
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: false,
  });
}

export function usePortfolioEquity(id: string | undefined, days = 180) {
  return useQuery({
    queryKey: portfolioKeys.equity(id ?? '', days),
    queryFn: () => fetchPortfolioEquity(id ?? '', days),
    enabled: Boolean(id),
    // Daily closes; refetching every 15s would redraw an identical chart and
    // throw away the user's zoom for nothing.
    staleTime: 5 * 60_000,
  });
}

export function usePortfolioExecutions(id: string | undefined, filters: ExecutionFilters = {}) {
  return useQuery({
    queryKey: portfolioKeys.executions(id ?? '', filters),
    queryFn: () => fetchPortfolioExecutions(id ?? '', filters),
    enabled: Boolean(id),
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}

export function usePortfolioCorrelations(id: string | undefined) {
  return useQuery({
    queryKey: portfolioKeys.correlations(id ?? ''),
    queryFn: () => fetchPortfolioCorrelations(id ?? ''),
    enabled: Boolean(id),
    // A rolling correlation over 90 days barely moves intraday.
    staleTime: 30 * 60_000,
  });
}
