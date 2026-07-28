import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api-client';

/**
 * Backtest results are immutable once computed, so defaults lean heavily on
 * caching: no refetch on focus, long stale time. Live/streaming data should
 * override `staleTime` at the individual query level instead of loosening this.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && !error.isRetryable) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      },
      mutations: {
        retry: false,
      },
    },
  });
}
