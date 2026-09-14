import { useQueries } from '@tanstack/react-query';
import { z } from 'zod';

import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';
import { createLogger } from '@/lib/logger';
import type { DashboardPeriod } from '@/lib/ui-store';

import { backtestKeys } from './backtests-api';
import { fixtureBacktest } from './fixtures';
import { equityPointSchema, type BacktestSummary } from './types';

const log = createLogger('dashboard');
const equitySchema = z.object({
  id: z.string(),
  strategyId: z.string(),
  symbol: z.string(),
  equityCurve: z.array(equityPointSchema),
  window: z.object({
    period: z.enum(['1y', '2y', '5y', 'max']),
    requestedStart: z.string().nullable(),
    requestedEnd: z.string(),
    availableStart: z.string().nullable(),
    availableEnd: z.string().nullable(),
  }),
});
export type BacktestEquity = z.infer<typeof equitySchema>;
export interface EquityRequest {
  period: DashboardPeriod;
  endDate: string;
}

/** A shared calendar anchor, not each strategy's individual last observation. */
export function dashboardEndDate(runs: readonly BacktestSummary[]): string | undefined {
  return runs
    .map((run) => run.endDate)
    .filter(Boolean)
    .sort()
    .at(-1);
}

export const equityKey = (id: string, window: EquityRequest) =>
  [...backtestKeys.detail(id), 'equity', window] as const;

export async function fetchBacktestEquity(
  id: string,
  window: EquityRequest,
  signal?: AbortSignal,
): Promise<BacktestEquity> {
  log.info('loading equity window', { id, ...window });
  let data: unknown;
  if (env.useFixtures) {
    const run = await fixtureBacktest(id);
    const end = new Date(`${window.endDate}T00:00:00Z`);
    const years = { '1y': 1, '2y': 2, '5y': 5, max: 0 }[window.period];
    const month = end.getUTCMonth();
    end.setUTCFullYear(end.getUTCFullYear() - years);
    if (end.getUTCMonth() !== month) end.setUTCDate(0);
    const start = years ? end.toISOString().slice(0, 10) : null;
    data = {
      id,
      strategyId: run.strategyId,
      symbol: run.symbol,
      equityCurve: run.equityCurve.filter(
        (point) => (!start || point.date >= start) && point.date <= window.endDate,
      ),
      window: {
        period: window.period,
        requestedStart: start,
        requestedEnd: window.endDate,
        availableStart: run.equityCurve[0]?.date ?? null,
        availableEnd: run.equityCurve.at(-1)?.date ?? null,
      },
    };
  } else {
    data = await apiClient.get<unknown>(`/backtests/${id}/equity`, {
      params: window,
      ...(signal === undefined ? {} : { signal }),
    });
  }
  const result = equitySchema.parse(data);
  log.info('equity window ready', {
    id,
    ...result.window,
    points: result.equityCurve.length,
    actualStart: result.equityCurve[0]?.date ?? null,
    actualEnd: result.equityCurve.at(-1)?.date ?? null,
  });
  return result;
}

export function useBacktestEquities(ids: readonly string[], window: EquityRequest) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: equityKey(id, window),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchBacktestEquity(id, window, signal),
      staleTime: Infinity,
    })),
    combine: (results) => {
      // Never display a partly *loaded* book as if it represented every run:
      // nothing is handed out until the whole set has settled. A run whose
      // history then failed is left out and named in `failed`, rather than
      // blanking the others — the dashboard asks for every saved run, so one
      // report that has gone missing must not take the book down with it.
      const settled = results.every((result) => !result.isPending);
      const failed = results.flatMap((result, index) => {
        const id = ids[index];
        return result.error && id !== undefined ? [{ id, error: result.error }] : [];
      });
      return {
        data: settled ? results.flatMap((result) => (result.data ? [result.data] : [])) : [],
        failed,
        isPending: !settled,
        isFetching: results.some((result) => result.isFetching),
        error: failed[0]?.error ?? null,
        refetch: () => Promise.all(results.map((result) => result.refetch())),
      };
    },
  });
}
