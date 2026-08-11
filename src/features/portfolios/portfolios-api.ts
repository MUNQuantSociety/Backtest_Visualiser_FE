import { useQuery } from '@tanstack/react-query';

import { LIVE_REFETCH_MS } from '@/config/constants';
import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

import {
  fixtureCorrelations,
  fixtureEquity,
  fixtureExecutions,
  fixturePortfolio,
  fixturePortfolios,
} from './fixtures';
import { portfolioKeys } from './query-keys';
import {
  correlationMatrixSchema,
  equitySeriesSchema,
  executionListResponseSchema,
  portfolioDetailSchema,
  portfolioListResponseSchema,
  type CorrelationMatrix,
  type EquitySeries,
  type ExecutionFilters,
  type PortfolioDetail,
} from './types';

/**
 * Transport layer for MQS Master's live portfolios. Every function returns
 * parsed, validated data — callers get a `PortfolioDetail`, never a raw
 * `unknown`. No React here, so these stay trivially testable outside hooks.
 *
 * Fixtures are swapped in at this layer and nowhere else. Components, hooks and
 * query keys are identical in both modes, which is what makes deleting the
 * fixture path a one-line change once a real server answers.
 */

/** Fake latency, so loading states are visible in the demo instead of flashing. */
const FIXTURE_DELAY_MS = 220;

async function withFixtureDelay<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));
  return value;
}

export async function fetchPortfolios() {
  if (env.useFixtures) {
    const items = fixturePortfolios();
    return withFixtureDelay(
      portfolioListResponseSchema.parse({
        items,
        total: items.length,
        page: 1,
        pageSize: items.length,
      }),
    );
  }

  const data = await apiClient.get<unknown>('/live/portfolios');
  return portfolioListResponseSchema.parse(data);
}

export async function fetchPortfolio(id: string): Promise<PortfolioDetail> {
  if (env.useFixtures) {
    return withFixtureDelay(portfolioDetailSchema.parse(fixturePortfolio(id)));
  }

  const data = await apiClient.get<unknown>(`/live/portfolios/${encodeURIComponent(id)}`);
  return portfolioDetailSchema.parse(data);
}

export async function fetchPortfolioEquity(id: string, days: number): Promise<EquitySeries> {
  if (env.useFixtures) {
    return withFixtureDelay(
      equitySeriesSchema.parse({ points: fixtureEquity(id, days), downsampled: false }),
    );
  }

  const data = await apiClient.get<unknown>(`/live/portfolios/${encodeURIComponent(id)}/equity`, {
    params: { days },
  });
  return equitySeriesSchema.parse(data);
}

export async function fetchPortfolioExecutions(id: string, filters: ExecutionFilters = {}) {
  if (env.useFixtures) {
    const all = fixtureExecutions(id);
    const pageSize = filters.pageSize ?? 25;
    const page = filters.page ?? 1;
    const start = (page - 1) * pageSize;

    return withFixtureDelay(
      executionListResponseSchema.parse({
        items: all.slice(start, start + pageSize),
        total: all.length,
        page,
        pageSize,
      }),
    );
  }

  const data = await apiClient.get<unknown>(
    `/live/portfolios/${encodeURIComponent(id)}/executions`,
    { params: filters },
  );
  return executionListResponseSchema.parse(data);
}

export async function fetchPortfolioCorrelations(id: string): Promise<CorrelationMatrix> {
  if (env.useFixtures) {
    return withFixtureDelay(correlationMatrixSchema.parse(fixtureCorrelations(id)));
  }

  const data = await apiClient.get<unknown>(
    `/live/portfolios/${encodeURIComponent(id)}/correlations`,
  );
  return correlationMatrixSchema.parse(data);
}

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
