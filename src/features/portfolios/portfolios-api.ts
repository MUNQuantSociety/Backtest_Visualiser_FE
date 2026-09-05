import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { LIVE_REFETCH_MS } from '@/config/constants';
import { env } from '@/config/env';
import { ApiError, apiClient } from '@/lib/api-client';
import { createLogger } from '@/lib/logger';

import {
  fixtureAttribution,
  fixtureComposition,
  fixtureCorrelations,
  fixtureEquity,
  fixtureExecutions,
  fixtureMasterEquity,
  fixturePortfolio,
  fixturePortfolios,
  fixtureRisk,
} from './fixtures';
import { portfolioKeys } from './query-keys';
import {
  attributionReportSchema,
  compositionSeriesSchema,
  correlationMatrixSchema,
  equitySeriesSchema,
  executionListResponseSchema,
  masterEquitySchema,
  portfolioDetailSchema,
  portfolioListResponseSchema,
  riskReportSchema,
  type AttributionReport,
  type CompositionSeries,
  type CorrelationMatrix,
  type EquitySamplePoint,
  type EquitySeries,
  type Execution,
  type ExecutionFilters,
  type MasterEquity,
  type PortfolioDetail,
  type RiskReport,
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

const log = createLogger('portfolios');

/** Fake latency, so loading states are visible in the demo instead of flashing. */
const FIXTURE_DELAY_MS = 220;

async function withFixtureDelay<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));
  return value;
}

/** Statuses that mean "nothing answered", as opposed to "the backend said no". */
const UNREACHABLE = new Set([0, 502, 503, 504]);

/**
 * Serve the fixture when fixtures are on, or — in development only — when the
 * backend did not answer. `alsoOn` widens that to statuses a not-yet-built
 * endpoint returns, so a 404 from `/live/risk` renders the demo panel instead
 * of an error until the endpoint exists. Production never falls back: a live
 * view that quietly shows demo money is worse than one that shows an error.
 */
async function fetchOrFixture<T>(
  label: string,
  request: () => Promise<T>,
  fixture: () => T,
  alsoOn: readonly number[] = [],
): Promise<T> {
  if (env.useFixtures) return withFixtureDelay(fixture());
  try {
    return await request();
  } catch (error) {
    const status = error instanceof ApiError ? error.status : null;
    if (env.isDev && status !== null && (UNREACHABLE.has(status) || alsoOn.includes(status))) {
      log.warn(`${label}: backend unreachable, serving fixture data`, { status });
      return fixture();
    }
    throw error;
  }
}

export async function fetchPortfolios() {
  return fetchOrFixture(
    'GET /live/portfolios',
    async () => portfolioListResponseSchema.parse(await apiClient.get<unknown>('/live/portfolios')),
    () => {
      const items = fixturePortfolios();
      return portfolioListResponseSchema.parse({
        items,
        total: items.length,
        page: 1,
        pageSize: items.length,
      });
    },
  );
}

export async function fetchPortfolio(id: string): Promise<PortfolioDetail> {
  return fetchOrFixture(
    `GET /live/portfolios/${id}`,
    async () =>
      portfolioDetailSchema.parse(
        await apiClient.get<unknown>(`/live/portfolios/${encodeURIComponent(id)}`),
      ),
    () => portfolioDetailSchema.parse(fixturePortfolio(id)),
  );
}

export async function fetchPortfolioEquity(id: string, days: number): Promise<EquitySeries> {
  return fetchOrFixture(
    `GET /live/portfolios/${id}/equity`,
    async () =>
      equitySeriesSchema.parse(
        await apiClient.get<unknown>(`/live/portfolios/${encodeURIComponent(id)}/equity`, {
          params: { days },
        }),
      ),
    () => equitySeriesSchema.parse({ points: fixtureEquity(id, days), downsampled: false }),
  );
}

export async function fetchPortfolioComposition(
  id: string,
  days: number,
): Promise<CompositionSeries> {
  return fetchOrFixture(
    `GET /live/portfolios/${id}/composition`,
    async () =>
      compositionSeriesSchema.parse(
        await apiClient.get<unknown>(`/live/portfolios/${encodeURIComponent(id)}/composition`, {
          params: { days },
        }),
      ),
    () => compositionSeriesSchema.parse(fixtureComposition(id, days)),
  );
}

export async function fetchPortfolioExecutions(id: string, filters: ExecutionFilters = {}) {
  return fetchOrFixture(
    `GET /live/portfolios/${id}/executions`,
    async () =>
      executionListResponseSchema.parse(
        await apiClient.get<unknown>(`/live/portfolios/${encodeURIComponent(id)}/executions`, {
          params: filters,
        }),
      ),
    () => {
      // Filtering and paging applied locally, so the demo exercises the same
      // round trip the real endpoint will: query in, page out.
      const all = fixtureExecutions(id).filter(
        (execution) => !filters.ticker || execution.ticker === filters.ticker,
      );
      const pageSize = filters.pageSize ?? 25;
      const page = filters.page ?? 1;
      const start = (page - 1) * pageSize;
      return executionListResponseSchema.parse({
        items: all.slice(start, start + pageSize),
        total: all.length,
        page,
        pageSize,
      });
    },
  );
}

export async function fetchPortfolioCorrelations(id: string): Promise<CorrelationMatrix> {
  return fetchOrFixture(
    `GET /live/portfolios/${id}/correlations`,
    async () =>
      correlationMatrixSchema.parse(
        await apiClient.get<unknown>(`/live/portfolios/${encodeURIComponent(id)}/correlations`),
      ),
    () => correlationMatrixSchema.parse(fixtureCorrelations(id)),
  );
}

/* ---- The master book. These endpoints are not built yet; a 404 is expected. ---- */

const NOT_BUILT = [404] as const;

export async function fetchMasterEquity(days: number): Promise<MasterEquity> {
  return fetchOrFixture(
    'GET /live/equity',
    async () =>
      masterEquitySchema.parse(await apiClient.get<unknown>('/live/equity', { params: { days } })),
    () => masterEquitySchema.parse({ points: fixtureMasterEquity(days), downsampled: false }),
    NOT_BUILT,
  );
}

export async function fetchAttribution(): Promise<AttributionReport> {
  return fetchOrFixture(
    'GET /live/attribution',
    async () => attributionReportSchema.parse(await apiClient.get<unknown>('/live/attribution')),
    () => attributionReportSchema.parse(fixtureAttribution()),
    NOT_BUILT,
  );
}

export async function fetchRisk(): Promise<RiskReport> {
  return fetchOrFixture(
    'GET /live/risk',
    async () => riskReportSchema.parse(await apiClient.get<unknown>('/live/risk')),
    () => riskReportSchema.parse(fixtureRisk()),
    NOT_BUILT,
  );
}

/**
 * The one write this app makes to the live system: close every position.
 * Never falls back — a flatten that "succeeded" against a fixture would be a
 * lie about real money, so fixtures refuse and an unreachable backend errors.
 */
export async function flattenBook(): Promise<void> {
  if (env.useFixtures) {
    throw new Error('Fixtures are read-only: nothing was sent to the engine.');
  }
  await apiClient.post<unknown>('/live/flatten', { confirm: 'FLATTEN' });
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

export function usePortfolioComposition(id: string | undefined, days = 180) {
  return useQuery({
    queryKey: portfolioKeys.composition(id ?? '', days),
    queryFn: () => fetchPortfolioComposition(id ?? '', days),
    enabled: Boolean(id),
    // Same reasoning as the equity series: this is historical, not live.
    staleTime: 5 * 60_000,
  });
}

/* ---- Master-book hooks ---- */

export function useMasterEquity(days: number) {
  return useQuery({
    queryKey: portfolioKeys.masterEquity(days),
    queryFn: () => fetchMasterEquity(days),
    staleTime: 5 * 60_000,
  });
}

export function useAttribution() {
  return useQuery({
    queryKey: portfolioKeys.attribution(),
    queryFn: fetchAttribution,
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: false,
  });
}

export function useRisk() {
  return useQuery({
    queryKey: portfolioKeys.risk(),
    queryFn: fetchRisk,
    // A VaR recomputed every 15 seconds is noise; once a minute is plenty.
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * Every sleeve's detail, one query each so the cache is shared with the
 * portfolio pages — opening a sleeve after the overview costs nothing.
 */
export function useSleeveDetails(ids: readonly string[]) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: portfolioKeys.detail(id),
      queryFn: () => fetchPortfolio(id),
      refetchInterval: LIVE_REFETCH_MS,
      refetchIntervalInBackground: false,
    })),
  });
  const data = results.flatMap((result) => (result.data ? [result.data] : []));
  return { data, isPending: results.some((result) => result.isPending) };
}

export function useSleeveEquities(ids: readonly string[], days: number) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: portfolioKeys.equity(id, days),
      queryFn: () => fetchPortfolioEquity(id, days),
      staleTime: 5 * 60_000,
    })),
  });
  const byId = new Map<string, readonly EquitySamplePoint[]>();
  results.forEach((result, index) => {
    const id = ids[index];
    if (id && result.data) byId.set(id, result.data.points);
  });
  return { byId, isPending: results.some((result) => result.isPending) };
}

const SLEEVE_FILLS_PAGE: ExecutionFilters = { pageSize: 50 };

export function useSleeveExecutions(ids: readonly string[]) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: portfolioKeys.executions(id, SLEEVE_FILLS_PAGE),
      queryFn: () => fetchPortfolioExecutions(id, SLEEVE_FILLS_PAGE),
      refetchInterval: LIVE_REFETCH_MS,
      refetchIntervalInBackground: false,
    })),
  });
  const byId = new Map<string, readonly Execution[]>();
  results.forEach((result, index) => {
    const id = ids[index];
    if (id && result.data) byId.set(id, result.data.items);
  });
  return { byId, isPending: results.some((result) => result.isPending) };
}

export function useFlattenBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: flattenBook,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portfolioKeys.all }),
  });
}
