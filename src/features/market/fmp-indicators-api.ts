import { keepPreviousData, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { z } from 'zod';

import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

/**
 * FMP's technical indicators, as the backend serves them.
 *
 * `GET /market-data/fmp-indicators` lists what a strategy can register as
 * `FmpIndicator`, and `GET /market-data/indicator-series` returns one of them
 * for a ticker over a window, through the same loader a backtest reads. So a
 * line on the Build chart and the number a rule-built strategy trades on are
 * the same number for the same day.
 */

const fmpIndicatorSchema = z.object({
  name: z.string(),
  label: z.string(),
  shortLabel: z.string(),
  pane: z.enum(['price', 'separate']),
  defaultPeriod: z.number().int(),
  minPeriod: z.number().int(),
  maxPeriod: z.number().int(),
  minValue: z.number().nullable(),
  maxValue: z.number().nullable(),
});

const catalogueSchema = z.object({ items: z.array(fmpIndicatorSchema) });

export type FmpIndicatorInfo = z.infer<typeof fmpIndicatorSchema>;

const seriesSchema = z.object({
  ticker: z.string(),
  indicator: z.string(),
  period: z.number().int(),
  points: z.array(z.object({ date: z.string(), value: z.number() })),
});

export type IndicatorSeries = z.infer<typeof seriesSchema>;

/** The indicators the backend can fetch; public, fixed and free of provider quota. */
export async function fetchFmpIndicators(signal?: AbortSignal): Promise<FmpIndicatorInfo[]> {
  const data = await apiClient.get<unknown>('/market-data/fmp-indicators', {
    ...(signal ? { signal } : {}),
  });
  return catalogueSchema.parse(data).items;
}

/**
 * The catalogue, fetched once per session. Fixture sessions have no backend;
 * callers fall back to their own copy of the list while this is unavailable.
 */
export function useFmpIndicators() {
  return useQuery({
    queryKey: ['market-data', 'fmp-indicators'] as const,
    queryFn: ({ signal }) => fetchFmpIndicators(signal),
    enabled: !env.useFixtures,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}

/** One indicator's daily values for a ticker, oldest first. */
export async function fetchIndicatorSeries(
  request: { ticker: string; indicator: string; period: number; start: string; end: string },
  signal?: AbortSignal,
): Promise<IndicatorSeries> {
  const data = await apiClient.get<unknown>('/market-data/indicator-series', {
    params: request,
    ...(signal ? { signal } : {}),
  });
  return seriesSchema.parse(data);
}

/** A chart line to draw: which indicator, over which period. */
export interface IndicatorLineRequest {
  indicator: string;
  period: number;
}

/** Each line's series (undefined until it loads), and how the requests stand. */
export interface IndicatorSeriesResult {
  data: (IndicatorSeries | undefined)[];
  isFetching: boolean;
  /** Per line, the failure's message, or null. */
  errors: (string | null)[];
}

// Module-level, so the combined result keeps its identity until a query's
// result changes: a chart keyed on `data` then redraws only when it must.
function combineSeries(results: UseQueryResult<IndicatorSeries>[]): IndicatorSeriesResult {
  return {
    data: results.map((result) => result.data),
    isFetching: results.some((result) => result.isFetching),
    errors: results.map((result) => (result.isError ? result.error.message : null)),
  };
}

/**
 * Several indicator lines for one ticker and window, one request each, so
 * adding a line does not refetch the others. The backend caches each for 15
 * minutes, and so does this.
 */
export function useIndicatorSeries(
  ticker: string,
  window: { start: string; end: string },
  lines: readonly IndicatorLineRequest[],
) {
  return useQueries({
    queries: lines.map(({ indicator, period }) => ({
      queryKey: [
        'market-data',
        'indicator-series',
        ticker,
        indicator,
        period,
        window.start,
        window.end,
      ] as const,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchIndicatorSeries({ ticker, indicator, period, ...window }, signal),
      enabled: ticker.length > 0 && !env.useFixtures,
      staleTime: 15 * 60 * 1000,
      retry: false,
      placeholderData: keepPreviousData,
    })),
    combine: combineSeries,
  });
}
