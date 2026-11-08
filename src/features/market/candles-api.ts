import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

const candleSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

const candlesResponseSchema = z.object({
  ticker: z.string(),
  candles: z.array(candleSchema),
});

export type Candle = z.infer<typeof candleSchema>;

/** The chart's range buttons, newest session back. */
export const CANDLE_RANGES = ['1M', '3M', '6M', '1Y', '5Y'] as const;
export type CandleRange = (typeof CANDLE_RANGES)[number];

const RANGE_MONTHS: Record<CandleRange, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '5Y': 60 };

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The `start`/`end` the backend wants for a range ending on `today`. */
export function candleWindow(range: CandleRange, today: Date = new Date()) {
  const start = new Date(today);
  start.setUTCMonth(start.getUTCMonth() - RANGE_MONTHS[range]);
  return { start: isoDay(start), end: isoDay(today) };
}

/**
 * A ticker's daily OHLCV candles, oldest first, from `GET /market-data/candles`.
 *
 * Read from FMP by the backend, so any listed symbol works, not only the ones
 * a backtest has used. Fixture sessions have no provider and get no candles.
 */
export async function fetchCandles(
  ticker: string,
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<Candle[]> {
  if (env.useFixtures) return [];
  const data = await apiClient.get<unknown>('/market-data/candles', {
    params: { ticker, start, end },
    ...(signal ? { signal } : {}),
  });
  return candlesResponseSchema.parse(data).candles;
}

/** Idle until a ticker is chosen; the previous range stays up while the next loads. */
export function useCandles(ticker: string, range: CandleRange) {
  const { start, end } = candleWindow(range);
  return useQuery({
    queryKey: ['market-data', 'candles', ticker, start, end] as const,
    queryFn: ({ signal }) => fetchCandles(ticker, start, end, signal),
    enabled: ticker.length > 0,
    // The backend caches for 15 minutes; asking sooner would only hit that.
    staleTime: 15 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}
