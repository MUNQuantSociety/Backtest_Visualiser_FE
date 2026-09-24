import { useQuery } from '@tanstack/react-query';

import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

import { fixtureIndicators } from './fixtures';
import {
  indicatorsResponseSchema,
  newsResponseSchema,
  type NewsArticle,
  type NewsScope,
  type TickerIndicators,
} from './types';

/**
 * Both endpoints are live and never fall back to fixtures on failure, in dev or
 * production: a failed request shows as an error, not as plausible fake RSI
 * values or headlines.
 *
 * News reads the scored-article table even in fixture mode (`VITE_USE_FIXTURES`):
 * it is real data with no fixture stand-in worth showing. Indicators still
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

export async function fetchNews(
  tickers: readonly string[],
  scope: NewsScope,
  limit: number,
): Promise<NewsArticle[]> {
  const data = await apiClient.get<unknown>('/news', {
    params: { ...(scope === 'universe' ? { tickers: sortedKey(tickers) } : {}), limit },
  });
  return newsResponseSchema.parse(data).items;
}

export const marketKeys = {
  all: ['market'] as const,
  indicators: (tickers: readonly string[]) =>
    [...marketKeys.all, 'indicators', sortedKey(tickers)] as const,
  news: (tickers: readonly string[], scope: NewsScope, limit: number) =>
    [...marketKeys.all, 'news', scope, limit, sortedKey(tickers)] as const,
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

export function useNews(tickers: readonly string[], scope: NewsScope, limit = 8) {
  return useQuery({
    queryKey: marketKeys.news(tickers, scope, limit),
    queryFn: () => fetchNews(tickers, scope, limit),
    enabled: scope === 'all' || tickers.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
