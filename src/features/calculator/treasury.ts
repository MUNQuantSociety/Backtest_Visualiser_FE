import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

const treasuryRatesSchema = z.object({
  date: z.string(),
  yields: z.array(z.object({ term: z.string(), years: z.number(), ratePercent: z.number() })),
});

export type TreasuryRates = z.infer<typeof treasuryRatesSchema>;
export type TreasuryYield = TreasuryRates['yields'][number];

/** The latest US Treasury yield curve, from FMP through `GET /market-data/treasury-rates`. */
export async function fetchTreasuryRates(signal?: AbortSignal): Promise<TreasuryRates> {
  const data = await apiClient.get<unknown>('/market-data/treasury-rates', {
    ...(signal ? { signal } : {}),
  });
  return treasuryRatesSchema.parse(data);
}

/** Fetched once a session; the curve changes once a day. Off in fixture mode. */
export function useTreasuryRates() {
  return useQuery({
    queryKey: ['market-data', 'treasury-rates'] as const,
    queryFn: ({ signal }) => fetchTreasuryRates(signal),
    enabled: !env.useFixtures,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

/**
 * The maturity closest to `years`, the usual risk-free rate for a horizon
 * that long: 10 years gets the 10-year yield, 4 years the 5-year. Ties go to
 * the shorter one. Null when there is no curve or no usable horizon.
 */
export function closestTreasury(
  yields: readonly TreasuryYield[],
  years: number,
): TreasuryYield | null {
  if (yields.length === 0 || !Number.isFinite(years) || years <= 0) return null;
  return yields.reduce((best, candidate) =>
    Math.abs(candidate.years - years) < Math.abs(best.years - years) ? candidate : best,
  );
}

/** `10Y` -> `10-year`, `3M` -> `3-month`. */
export function describeTerm(term: string): string {
  const match = /^(\d+)([MY])$/.exec(term);
  if (!match) return term;
  return `${match[1] ?? ''}-${match[2] === 'M' ? 'month' : 'year'}`;
}
