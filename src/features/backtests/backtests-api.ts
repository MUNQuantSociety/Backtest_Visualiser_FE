import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { env } from '@/config/env';
import { ApiError, apiClient } from '@/lib/api-client';
import { createLogger } from '@/lib/logger';

import { fixtureBacktest, fixtureBacktests } from './fixtures';
import {
  backtestDetailSchema,
  backtestListResponseSchema,
  backtestSummarySchema,
  coverageResponseSchema,
  isInFlight,
  type BacktestDetail,
  type BacktestFilters,
  type BacktestRunRequest,
  type BacktestSummary,
  type CoverageResponse,
} from './types';

/**
 * Transport layer for the backtests feature. Every function returns parsed,
 * validated data — callers get a `BacktestDetail`, never a raw `unknown`.
 * No React here: these stay trivially unit-testable and reusable outside hooks.
 *
 * Demo data comes from `mock-data/backtests.json` via `./fixtures` only when
 * explicitly enabled with `VITE_USE_FIXTURES=true`.
 */

const log = createLogger('backtests');

/** Fake latency, so loading states are visible in the demo instead of flashing. */
const FIXTURE_DELAY_MS = 220;

async function withFixtureDelay<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));
  return value;
}

/** Filtering and paging applied locally, so the demo exercises the same
 *  round trip the real endpoint will: query in, filtered page out. */
async function mockBacktestList(filters: BacktestFilters) {
  const all = await fixtureBacktests();
  const search = filters.search?.toLowerCase();

  const items = all.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.strategyId && item.strategyId !== filters.strategyId) return false;
    if (
      search &&
      !`${item.name} ${item.symbol} ${item.strategyName}`.toLowerCase().includes(search)
    ) {
      return false;
    }
    return true;
  });

  const pageSize = filters.pageSize ?? items.length;
  const page = filters.page ?? 1;

  return withFixtureDelay(
    backtestListResponseSchema.parse({
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      pageSize,
    }),
  );
}

export async function fetchBacktests(filters: BacktestFilters = {}, signal?: AbortSignal) {
  if (env.useFixtures) {
    log.info('loading backtest list', { source: 'fixtures', filters });
    return mockBacktestList(filters);
  }

  const data = await apiClient.get<unknown>('/backtests', {
    params: filters,
    ...(signal ? { signal } : {}),
  });
  return backtestListResponseSchema.parse(data);
}

/** Complete saved history for the dashboard; ordinary lists remain paginated. */
export async function fetchAllBacktests(signal?: AbortSignal) {
  const first = await fetchBacktests({ page: 1, pageSize: 100 }, signal);
  const items = [...first.items];
  let page = first;
  while (page.page * page.pageSize < page.total) {
    page = await fetchBacktests({ page: page.page + 1, pageSize: first.pageSize }, signal);
    if (page.items.length === 0)
      throw new Error('Run history changed while loading. Please retry.');
    items.push(...page.items);
  }
  return {
    ...first,
    items: [...new Map(items.map((run) => [run.id, run])).values()],
    total: page.total,
  };
}

export async function fetchBacktest(id: string, signal?: AbortSignal): Promise<BacktestDetail> {
  if (env.useFixtures) {
    log.info('loading backtest detail', { id, source: 'fixtures' });
    return withFixtureDelay(await fixtureBacktest(id));
  }

  const data = await apiClient.get<unknown>(`/backtests/${encodeURIComponent(id)}`, {
    ...(signal ? { signal } : {}),
  });
  const detail = backtestDetailSchema.parse(data);
  const write = detail.status === 'failed' ? log.error : log.info;
  write('backtest status received', {
    id,
    source: 'backend',
    status: detail.status,
    progressPct: detail.progressPct,
    errorMessage: detail.errorMessage,
    polling: isInFlight(detail.status) ? 'continue every 3 seconds while subscribed' : 'finished',
  });
  return detail;
}

/**
 * Launches a run. The endpoint answers 202 with the row it just created.
 *
 * No fixture branch: demos can show results without a backend, but there is no
 * honest way to fake having *started* something, and a fabricated queued row
 * would sit there forever pretending to make progress.
 */
export async function submitBacktest(request: BacktestRunRequest): Promise<BacktestSummary> {
  log.info('submitting backtest', {
    strategyKey: request.strategyKey,
    startDate: request.startDate,
    endDate: request.endDate,
    mode: request.mode,
    params: request.params,
  });
  if (env.useFixtures) {
    throw new ApiError(
      'Running a backtest needs the backend. Set VITE_USE_FIXTURES=false and start the API.',
      0,
      'FIXTURES_ENABLED',
    );
  }

  const data = await apiClient.post<unknown>('/backtests', request);
  const summary = backtestSummarySchema.parse(data);
  log.info('backtest submission accepted', {
    runId: summary.id,
    status: summary.status,
    strategyKey: request.strategyKey,
  });
  return summary;
}

/**
 * How far the market data goes for one strategy's universe.
 *
 * The run form needs this before it can offer a date: coverage ends weeks
 * behind the calendar, so a picker bounded by today produces an empty window
 * and a run that fails for a reason the author did not cause.
 */
export async function fetchCoverage(
  strategyKey: string,
  tickers?: readonly string[],
): Promise<CoverageResponse> {
  const context = {
    strategyKey,
    requestedTickers: tickers ?? null,
    selection: tickers ? 'custom tickers' : 'strategy universe',
    source: env.useFixtures ? 'fixtures' : 'backend',
  };
  log.info('coverage check started', context);
  const startedAt = performance.now();
  try {
    if (env.useFixtures) {
      const coverage = await withFixtureDelay(await fixtureCoverage(strategyKey));
      log.warn('coverage check completed using demo data', { ...context, ...coverage });
      return coverage;
    }

    // Real run eligibility must come from the backend, including for custom
    // tickers. A timeout is not missing history and must not become demo coverage.
    const data = await apiClient.get<unknown>('/market-data/coverage', {
      params: tickers ? { tickers: tickers.join(',') } : { strategyKey },
    });
    log.debug('coverage response received; validating fields', context);
    const coverage = coverageResponseSchema.parse(data);
    log.info('coverage check completed', {
      ...context,
      ms: Math.round(performance.now() - startedAt),
      ...coverage,
    });
    if (coverage.missing.length > 0)
      log.warn('coverage has tickers with no market data', {
        ...context,
        missing: coverage.missing,
      });
    return coverage;
  } catch (error) {
    log.error('coverage check failed; no coverage substituted', {
      ...context,
      ms: Math.round(performance.now() - startedAt),
      error,
    });
    throw error;
  }
}

/**
 * Coverage implied by the demo runs: the tickers a strategy's runs traded, and
 * the span those runs cover. Derived rather than invented so the run dialog's
 * date bounds agree with the curves it will show — and so the backtests
 * feature need not import the strategies catalogue, which imports it back.
 */
async function fixtureCoverage(strategyKey: string): Promise<CoverageResponse> {
  const runs = (await fixtureBacktests()).filter((run) => run.strategyId === strategyKey);
  const tickers = [...new Set(runs.map((run) => run.symbol))];
  const start = runs.reduce<string | null>(
    (earliest, run) => (earliest === null || run.startDate < earliest ? run.startDate : earliest),
    null,
  );
  const end = runs.reduce<string | null>(
    (latest, run) => (latest === null || run.endDate > latest ? run.endDate : latest),
    null,
  );
  return coverageResponseSchema.parse({
    tickers: tickers.map((ticker) => ({ ticker, firstBar: start, lastBar: end })),
    start,
    end,
    missing: [],
  });
}

export async function deleteBacktest(id: string): Promise<void> {
  if (env.useFixtures) return withFixtureDelay(undefined);

  await apiClient.delete(`/backtests/${encodeURIComponent(id)}`);
}

export const backtestKeys = {
  all: ['backtests'] as const,
  lists: () => [...backtestKeys.all, 'list'] as const,
  completeList: () => [...backtestKeys.lists(), 'all'] as const,
  list: (filters: BacktestFilters) => [...backtestKeys.lists(), filters] as const,
  details: () => [...backtestKeys.all, 'detail'] as const,
  detail: (id: string) => [...backtestKeys.details(), id] as const,
  trades: (id: string) => [...backtestKeys.detail(id), 'trades'] as const,
  coverage: (strategyKey: string) => [...backtestKeys.all, 'coverage', strategyKey] as const,
} as const;

/**
 * How often to re-ask about a run that has not finished.
 *
 * A backtest is minutes of work, so this is about keeping a progress bar
 * honest, not about catching the finish instantly. Anything much faster would
 * be polling a database for no added information.
 */
const IN_FLIGHT_POLL_MS = 3_000;

export function useAllBacktests() {
  return useQuery({
    queryKey: backtestKeys.completeList(),
    queryFn: ({ signal }) => fetchAllBacktests(signal),
    // A run may have finished while its detail page was open.
    refetchOnMount: 'always',
  });
}

export function useBacktests(filters: BacktestFilters = {}) {
  return useQuery({
    queryKey: backtestKeys.list(filters),
    queryFn: ({ signal }) => fetchBacktests(filters, signal),
    // Keeps the previous page on screen while the next one loads instead of
    // flashing a skeleton on every pagination click.
    placeholderData: (previous) => previous,
    // Only while something on this page can still change. A list of finished
    // runs is static, and polling it would be a request per interval forever.
    refetchInterval: (query) =>
      !env.useFixtures &&
      query.state.status !== 'error' &&
      query.state.data?.items.some((run) => isInFlight(run.status))
        ? IN_FLIGHT_POLL_MS
        : false,
    refetchIntervalInBackground: false,
  });
}

export function useBacktest(id: string | undefined) {
  return useQuery({
    queryKey: backtestKeys.detail(id ?? ''),
    queryFn: ({ signal }) => fetchBacktest(id ?? '', signal),
    enabled: Boolean(id),
    /*
     * A finished backtest never changes, so it stays cached for the session.
     * That does not stop an unfinished one from updating: `refetchInterval`
     * fetches regardless of staleness, so the two settings do not fight.
     *
     * `staleTime` is deliberately a constant rather than a function of the
     * run's status. The function form is accepted by this version and silently
     * stops `refetchInterval` from ever being armed, which had a running run
     * frozen at 10% on screen until a hard reload. Checked against the running
     * app: a constant here plus the callback below polls, updates, and stops on
     * its own when the run finishes.
     */
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: (query) =>
      !env.useFixtures &&
      query.state.status !== 'error' &&
      query.state.data &&
      isInFlight(query.state.data.status)
        ? IN_FLIGHT_POLL_MS
        : false,
    refetchIntervalInBackground: false,
  });
}

/** Coverage for one strategy. Disabled until a strategy is actually chosen. */
export function useCoverage(strategyKey: string | undefined, tickers?: readonly string[]) {
  return useQuery({
    queryKey: [...backtestKeys.coverage(strategyKey ?? ''), tickers ?? null],
    queryFn: () => fetchCoverage(strategyKey ?? '', tickers),
    // Fixture mode derives coverage from the demo runs, so it stays enabled.
    enabled: Boolean(strategyKey) && (tickers === undefined || tickers.length > 0),
    // Coverage moves when the data loader runs, which is not during a sitting.
    staleTime: 5 * 60 * 1_000,
  });
}

export function useSubmitBacktest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['backtests', 'submit'],
    mutationFn: submitBacktest,
    onSuccess: (summary) => {
      // The new row belongs at the top of every list, and its detail is
      // already worth fetching: the user is about to watch it run.
      queryClient.setQueryData(backtestKeys.detail(summary.id), undefined);
      void queryClient.invalidateQueries({ queryKey: backtestKeys.lists() });
    },
  });
}

/**
 * Several backtest details at once, for side-by-side comparison.
 *
 * `useQueries` rather than a bulk endpoint: each detail is already cached
 * individually by `useBacktest`, so opening a run you have compared before is
 * free, and adding a fourth strategy fetches one payload instead of re-fetching
 * all four.
 */
export function useBacktestDetails(ids: readonly string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: backtestKeys.detail(id),
      queryFn: ({ signal }) => fetchBacktest(id, signal),
      staleTime: Number.POSITIVE_INFINITY,
    })),
    combine: (results) => ({
      data: results.flatMap((result) => (result.data ? [result.data] : [])),
      isPending: results.some((result) => result.isPending),
      isError: results.some((result) => result.isError),
    }),
  });
}

export function useDeleteBacktest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['backtests', 'delete'],
    mutationFn: deleteBacktest,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: backtestKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: backtestKeys.lists() });
    },
  });
}
