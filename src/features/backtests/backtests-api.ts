import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { env } from '@/config/env';
import { ApiError, apiClient } from '@/lib/api-client';
import { createLogger } from '@/lib/logger';

import { fixtureBacktest, fixtureBacktests } from './fixtures';
import {
  backtestDetailSchema,
  backtestListResponseSchema,
  type BacktestDetail,
  type BacktestFilters,
} from './types';

/**
 * Transport layer for the backtests feature. Every function returns parsed,
 * validated data — callers get a `BacktestDetail`, never a raw `unknown`.
 * No React here: these stay trivially unit-testable and reusable outside hooks.
 *
 * Demo data comes from `mock-data/backtests.json` via `./fixtures`, either
 * because `VITE_USE_FIXTURES=true` forces it or because the backend could not
 * be reached at all.
 */

const log = createLogger('backtests');

/** Fake latency, so loading states are visible in the demo instead of flashing. */
const FIXTURE_DELAY_MS = 220;

async function withFixtureDelay<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));
  return value;
}

/**
 * True when nothing was listening at the other end.
 *
 * Two shapes, because it depends on how the app is talking to the API. Called
 * directly, an absent server is a network failure and `ApiError` reports status
 * 0. Called through the Vite dev proxy — the default — the proxy answers on the
 * server's behalf with a 502, so the browser gets a real response and status 0
 * never happens. Both have to count or the fallback would never fire in dev,
 * which is the one place it exists for.
 *
 * 4xx is excluded on purpose: a backend that *is* running and is returning 404
 * or 422 has a bug worth seeing, and quietly swapping in demo data would turn
 * it into charts full of plausible fiction.
 */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

function isUnreachable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0 || GATEWAY_STATUSES.has(error.status);
}

/**
 * Only ever in dev.
 *
 * A production deployment hitting a 502 should show its error state, not serve
 * fabricated numbers to someone who thinks they are looking at real results.
 */
function canFallBack(error: unknown): boolean {
  return env.isDev && isUnreachable(error);
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

export async function fetchBacktests(filters: BacktestFilters = {}) {
  if (env.useFixtures) return mockBacktestList(filters);

  try {
    const data = await apiClient.get<unknown>('/backtests', { params: filters });
    return backtestListResponseSchema.parse(data);
  } catch (error) {
    if (!canFallBack(error)) throw error;
    log.warn('backend unreachable, serving mock-data/backtests.json', { endpoint: '/backtests' });
    return mockBacktestList(filters);
  }
}

export async function fetchBacktest(id: string): Promise<BacktestDetail> {
  if (env.useFixtures) return withFixtureDelay(await fixtureBacktest(id));

  try {
    const data = await apiClient.get<unknown>(`/backtests/${encodeURIComponent(id)}`);
    return backtestDetailSchema.parse(data);
  } catch (error) {
    if (!canFallBack(error)) throw error;
    log.warn('backend unreachable, serving mock-data/backtests.json', { id });
    return withFixtureDelay(await fixtureBacktest(id));
  }
}

export async function deleteBacktest(id: string): Promise<void> {
  if (env.useFixtures) return withFixtureDelay(undefined);

  await apiClient.delete(`/backtests/${encodeURIComponent(id)}`);
}

export const backtestKeys = {
  all: ['backtests'] as const,
  lists: () => [...backtestKeys.all, 'list'] as const,
  list: (filters: BacktestFilters) => [...backtestKeys.lists(), filters] as const,
  details: () => [...backtestKeys.all, 'detail'] as const,
  detail: (id: string) => [...backtestKeys.details(), id] as const,
  trades: (id: string) => [...backtestKeys.detail(id), 'trades'] as const,
} as const;

export function useBacktests(filters: BacktestFilters = {}) {
  return useQuery({
    queryKey: backtestKeys.list(filters),
    queryFn: () => fetchBacktests(filters),
    // Keeps the previous page on screen while the next one loads instead of
    // flashing a skeleton on every pagination click.
    placeholderData: (previous) => previous,
  });
}

export function useBacktest(id: string | undefined) {
  return useQuery({
    queryKey: backtestKeys.detail(id ?? ''),
    queryFn: () => fetchBacktest(id ?? ''),
    enabled: Boolean(id),
    // A completed backtest never changes, so cache it for the session.
    staleTime: Number.POSITIVE_INFINITY,
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
      queryFn: () => fetchBacktest(id),
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
    mutationFn: deleteBacktest,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: backtestKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: backtestKeys.lists() });
    },
  });
}
