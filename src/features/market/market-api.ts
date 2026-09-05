import { useQuery } from '@tanstack/react-query';

import { env } from '@/config/env';
import { ApiError, apiClient } from '@/lib/api-client';
import { createLogger } from '@/lib/logger';

import { fixtureIndicators, fixtureNews } from './fixtures';
import {
  indicatorsResponseSchema,
  newsResponseSchema,
  type NewsArticle,
  type NewsScope,
  type TickerIndicators,
} from './types';

const log = createLogger('market');

/**
 * `GET /indicators` and `GET /news` do not exist on the backend yet. The panels
 * that need them were built ahead of the endpoints, so in dev a 404 — the
 * endpoint is missing, not broken — is served from fixtures as well as the
 * usual "nothing listening" cases. Every such panel carries a DemoBadge;
 * production never falls back and shows the error instead.
 *
 * Sentiment is folded into the indicators payload rather than a separate
 * request: the dashboard always wants both for the same tickers, and one
 * round trip per ticker set is cheaper than two.
 */
const FALLBACK_STATUSES = new Set([0, 404, 502, 503, 504]);

function canFallBack(error: unknown): boolean {
  return env.isDev && error instanceof ApiError && FALLBACK_STATUSES.has(error.status);
}

const sortedKey = (tickers: readonly string[]) => [...tickers].sort().join(',');

export async function fetchIndicators(tickers: readonly string[]): Promise<TickerIndicators[]> {
  if (tickers.length === 0) return [];
  if (env.useFixtures) return fixtureIndicators(tickers);

  try {
    const data = await apiClient.get<unknown>('/indicators', {
      params: { tickers: sortedKey(tickers), window: '7d' },
    });
    return indicatorsResponseSchema.parse(data).items;
  } catch (error) {
    if (!canFallBack(error)) throw error;
    log.warn('indicators endpoint unavailable, serving fixtures', { tickers: tickers.length });
    return fixtureIndicators(tickers);
  }
}

export async function fetchNews(
  tickers: readonly string[],
  scope: NewsScope,
  limit: number,
): Promise<NewsArticle[]> {
  if (env.useFixtures) return fixtureNews(tickers, limit);

  try {
    const data = await apiClient.get<unknown>('/news', {
      params: { ...(scope === 'universe' ? { tickers: sortedKey(tickers) } : {}), limit },
    });
    return newsResponseSchema.parse(data).items;
  } catch (error) {
    if (!canFallBack(error)) throw error;
    log.warn('news endpoint unavailable, serving fixtures', { scope, limit });
    return fixtureNews(tickers, limit);
  }
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
    staleTime: 5 * 60 * 1000,
  });
}
