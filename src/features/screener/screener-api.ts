import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { env } from '@/config/env';
import { fetchCandles } from '@/features/market';
import { apiClient } from '@/lib/api-client';

import { periodWindow, type ScreenerPeriod } from './screener-model';
import { quotesResponseSchema, type QuotesResponse } from './types';

/** The backend answers at most this many tickers per request. */
export const QUOTES_BATCH_SIZE = 50;
/** How often the screener asks for fresh prices, like the terminal app. */
export const QUOTES_REFRESH_MS = 2 * 60 * 1000;

export const screenerKeys = {
  quotes: (tickers: readonly string[]) => ['market-data', 'quotes', ...tickers] as const,
};

/**
 * Latest quotes for `tickers` from `GET /market-data/quotes`, in their order.
 * Long watchlists are split into batches the backend accepts, then merged.
 */
export async function fetchQuotes(
  tickers: readonly string[],
  signal?: AbortSignal,
): Promise<QuotesResponse> {
  const batches: string[][] = [];
  for (let start = 0; start < tickers.length; start += QUOTES_BATCH_SIZE) {
    batches.push(tickers.slice(start, start + QUOTES_BATCH_SIZE));
  }
  const answers = await Promise.all(
    batches.map(async (batch) => {
      const data = await apiClient.get<unknown>('/market-data/quotes', {
        params: { tickers: batch.join(',') },
        ...(signal ? { signal } : {}),
      });
      return quotesResponseSchema.parse(data);
    }),
  );
  return {
    quotes: answers.flatMap((answer) => answer.quotes),
    missing: answers.flatMap((answer) => answer.missing),
  };
}

/**
 * Quotes for the watchlist, refreshed every two minutes. The previous answer
 * stays on screen while a refresh or a changed watchlist loads. Fixture
 * sessions have no provider, so they ask for nothing.
 */
export function useQuotes(tickers: readonly string[]) {
  return useQuery({
    queryKey: screenerKeys.quotes(tickers),
    queryFn: ({ signal }) => fetchQuotes(tickers, signal),
    enabled: tickers.length > 0 && !env.useFixtures,
    staleTime: 60 * 1000,
    refetchInterval: QUOTES_REFRESH_MS,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/**
 * Daily candles for the selected ticker over a period. Same cache key shape as
 * the Build chart's candles, so a window both pages ask for is fetched once.
 * The previous chart stays up while another period of the same ticker loads,
 * never while a different ticker does.
 */
export function usePeriodCandles(ticker: string, period: ScreenerPeriod) {
  const { start, end } = periodWindow(period);
  return useQuery({
    queryKey: ['market-data', 'candles', ticker, start, end] as const,
    queryFn: ({ signal }) => fetchCandles(ticker, start, end, signal),
    enabled: ticker.length > 0 && !env.useFixtures,
    // The backend caches candles for 15 minutes.
    staleTime: 15 * 60 * 1000,
    retry: false,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === ticker ? previous : undefined,
  });
}
