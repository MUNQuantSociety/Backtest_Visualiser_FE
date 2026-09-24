import { useQuery } from '@tanstack/react-query';

import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

import { fixtureIndicators } from './fixtures';
import {
  indicatorsResponseSchema,
  newsResponseSchema,
  newsStorySchema,
  type NewsArticle,
  type NewsStory,
  type TickerIndicators,
} from './types';

/**
 * Both endpoints are live and never fall back to fixtures on failure, in dev or
 * production: a failed request shows as an error, not as plausible fake RSI
 * values or headlines.
 *
 * News reads the scored-article table even in fixture mode (`VITE_USE_FIXTURES`),
 * and only per backtest run, by its tickers and dates. Indicators still
 * follow fixture mode, because their prices come from the same market data the
 * rest of a fixture session fakes.
 *
 * Sentiment is folded into the indicators payload rather than a separate
 * request: the dashboard always wants both for the same tickers, and one
 * round trip per ticker set is cheaper than two.
 */
const sortedKey = (tickers: readonly string[]) => [...tickers].sort().join(',');

export async function fetchIndicators(tickers: readonly string[]): Promise<TickerIndicators[]> {
  if (tickers.length === 0) return [];
  if (env.useFixtures) return fixtureIndicators(tickers);

  const data = await apiClient.get<unknown>('/indicators', {
    params: { tickers: sortedKey(tickers), window: '7d' },
  });
  return indicatorsResponseSchema.parse(data).items;
}

/** A backtest run's news: its tickers and its own date window (ISO dates, inclusive). */
export interface RunNewsWindow {
  tickers: readonly string[];
  start: string;
  end: string;
}

/**
 * The scored articles published during one run, newest first.
 *
 * The article table is a fixed historical dataset, not a live feed, so news is
 * only ever asked for by a run's window; there is no "latest news".
 */
export async function fetchRunNews(window: RunNewsWindow, limit: number): Promise<NewsArticle[]> {
  const data = await apiClient.get<unknown>('/news', {
    params: { tickers: sortedKey(window.tickers), start: window.start, end: window.end, limit },
  });
  return newsResponseSchema.parse(data).items;
}

export const marketKeys = {
  all: ['market'] as const,
  indicators: (tickers: readonly string[]) =>
    [...marketKeys.all, 'indicators', sortedKey(tickers)] as const,
  runNews: (window: RunNewsWindow, limit: number) =>
    [
      ...marketKeys.all,
      'news',
      sortedKey(window.tickers),
      window.start,
      window.end,
      limit,
    ] as const,
} as const;

export function useIndicators(tickers: readonly string[]) {
  return useQuery({
    queryKey: marketKeys.indicators(tickers),
    queryFn: () => fetchIndicators(tickers),
    enabled: tickers.length > 0,
    // Computed at the close; nothing changes between polls during a session.
    staleTime: 15 * 60 * 1000,
  });
}

/** One story's title and real summary paragraph, for its card. */
export async function fetchNewsStory(id: string): Promise<NewsStory> {
  const data = await apiClient.get<unknown>(`/news/${encodeURIComponent(id)}/story`);
  return newsStorySchema.parse(data);
}

/** Loads a story when its card opens; `id` is null while no card is open. */
export function useNewsStory(id: string | null) {
  return useQuery({
    queryKey: [...marketKeys.all, 'story', id] as const,
    queryFn: () => fetchNewsStory(id ?? ''),
    enabled: id !== null,
    // A published story does not change; the backend remembers the page too.
    staleTime: Infinity,
    retry: false,
  });
}

export function useRunNews(window: RunNewsWindow, limit = 10) {
  return useQuery({
    queryKey: marketKeys.runNews(window, limit),
    queryFn: () => fetchRunNews(window, limit),
    enabled: window.tickers.length > 0 && Boolean(window.start && window.end),
    // A past window's articles do not change.
    staleTime: Infinity,
  });
}
