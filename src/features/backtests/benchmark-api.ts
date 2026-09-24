import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

import type { BenchmarkClose } from './benchmark-book';

/** The ticker the SPY benchmark option reads. */
export const SPY_TICKER = 'SPY';

const closesResponseSchema = z.object({
  ticker: z.string(),
  points: z.array(z.object({ date: z.string(), close: z.number() })),
});

/**
 * A ticker's daily closes from `start` to `end` (ISO dates, inclusive), oldest
 * first, from `GET /market-data/closes`. Fixtures have no benchmark prices.
 */
export async function fetchBenchmarkCloses(
  ticker: string,
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<BenchmarkClose[]> {
  if (env.useFixtures) return [];
  const data = await apiClient.get<unknown>('/market-data/closes', {
    params: { ticker, start, end },
    ...(signal ? { signal } : {}),
  });
  return closesResponseSchema.parse(data).points;
}

/** SPY's closes over the dashboard window; idle until the window is known. */
export function useBenchmarkCloses(start: string, end: string, enabled: boolean) {
  return useQuery({
    queryKey: ['backtests', 'benchmark-closes', SPY_TICKER, start, end] as const,
    queryFn: ({ signal }) => fetchBenchmarkCloses(SPY_TICKER, start, end, signal),
    enabled: enabled && Boolean(start && end),
    // Past closes do not change within a session.
    staleTime: 60 * 60 * 1000,
  });
}
