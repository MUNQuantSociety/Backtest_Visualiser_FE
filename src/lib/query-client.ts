import { QueryClient, type Mutation, type Query } from '@tanstack/react-query';

import { ApiError } from '@/lib/api-client';
import { createLogger } from '@/lib/logger';

const log = createLogger('query');

/** `["backtests","list",{...}]` -> `backtests/list` — enough to identify it. */
function describeKey(key: readonly unknown[]): string {
  return key
    .filter((part) => typeof part === 'string' || typeof part === 'number')
    .map(String)
    .join('/');
}

/**
 * Backtest results are immutable once computed, so defaults lean heavily on
 * caching: no refetch on focus, long stale time. Live/streaming data should
 * override `staleTime` at the individual query level instead of loosening this.
 */
export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // A full timeout already spent the request budget. Repeating it
          // twice kept sign-in loading for ~93 seconds during an outage.
          if (error instanceof ApiError && ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)) {
            return false;
          }
          const willRetry =
            error instanceof ApiError && !error.isRetryable ? false : failureCount < 2;
          return willRetry;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      },
      mutations: {
        retry: false,
      },
    },
  });
  const queryStarts = new Map<string, number>();

  /*
   * Cache subscriptions rather than per-hook callbacks: this covers every
   * query in the app, including ones added later, and it cannot be forgotten
   * at a call site. `fetchStatus: 'paused'` is logged explicitly because it is
   * the state that otherwise looks identical to a slow request — the UI sits on
   * a skeleton and nothing says why.
   */
  client.getQueryCache().subscribe((event) => {
    if (event.type === 'removed') queryStarts.delete(event.query.queryHash);
    if (event.type !== 'updated') return;

    const query = event.query as Query;
    const name = describeKey(query.queryKey);
    const context = {
      queryKey: query.queryKey,
      ms: queryStarts.has(query.queryHash)
        ? Math.round(performance.now() - queryStarts.get(query.queryHash)!)
        : undefined,
    };

    switch (event.action.type) {
      case 'fetch':
        queryStarts.set(query.queryHash, performance.now());
        log.info(`query started: ${name}`, {
          queryKey: query.queryKey,
          hasCachedData: query.state.data !== undefined,
        });
        break;
      case 'success':
        log.info(`query resolved: ${name}`, {
          ...context,
          manualCacheUpdate: Boolean(event.action.manual),
        });
        queryStarts.delete(query.queryHash);
        break;
      case 'error':
        log.error(`query failed: ${name}`, {
          ...context,
          attempts: query.state.fetchFailureCount,
          error: query.state.error,
        });
        queryStarts.delete(query.queryHash);
        break;
      case 'failed':
        log.warn(`query retry scheduled: ${name}`, {
          ...context,
          failedAttempts: event.action.failureCount,
          nextAttempt: event.action.failureCount + 1,
          error: event.action.error as unknown,
        });
        break;
      case 'invalidate':
        log.debug(`query invalidated: ${name}`, context);
        break;
      case 'continue':
        log.info(`query resumed: ${name}`, context);
        break;
      case 'pause':
        log.warn(`query paused: ${name}`, {
          ...context,
          reason: 'request held until reconnect or focus permits retry',
        });
        break;
      default:
        break;
    }
  });

  client.getMutationCache().subscribe((event) => {
    if (event.type !== 'updated') return;
    const mutation = event.mutation as Mutation;
    const context = {
      mutationId: mutation.mutationId,
      mutationKey: mutation.options.mutationKey,
      operation: mutation.options.mutationFn?.name,
      ms: mutation.state.submittedAt ? Date.now() - mutation.state.submittedAt : 0,
    };
    switch (event.action.type) {
      case 'pending':
        log.info('mutation started', context);
        break;
      case 'success':
        log.info('mutation succeeded', context);
        break;
      case 'error':
        log.error('mutation failed', { ...context, error: mutation.state.error });
        break;
      case 'failed':
        log.warn('mutation retry scheduled', {
          ...context,
          error: event.action.error as unknown,
          failedAttempts: event.action.failureCount,
        });
        break;
      case 'pause':
        log.warn('mutation paused', context);
        break;
      case 'continue':
        log.info('mutation resumed', context);
        break;
    }
  });

  return client;
}
