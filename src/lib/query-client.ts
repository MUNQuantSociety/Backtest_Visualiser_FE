import { QueryClient, type Query } from '@tanstack/react-query';

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
          const willRetry =
            error instanceof ApiError && !error.isRetryable ? false : failureCount < 2;
          log.debug(willRetry ? 'retrying' : 'giving up', {
            attempt: failureCount + 1,
            error: error.message,
          });
          return willRetry;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      },
      mutations: {
        retry: false,
      },
    },
  });

  /*
   * Cache subscriptions rather than per-hook callbacks: this covers every
   * query in the app, including ones added later, and it cannot be forgotten
   * at a call site. `fetchStatus: 'paused'` is logged explicitly because it is
   * the state that otherwise looks identical to a slow request — the UI sits on
   * a skeleton and nothing says why.
   */
  client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return;

    const query = event.query as Query;
    const name = describeKey(query.queryKey);

    switch (event.action.type) {
      case 'fetch':
        log.debug(`fetching ${name}`);
        break;
      case 'success':
        log.info(`resolved ${name}`);
        break;
      case 'error':
        log.error(`failed ${name}`, { error: query.state.error?.message });
        break;
      case 'pause':
        log.warn(`paused ${name}`, { reason: 'offline — request held until reconnect' });
        break;
      default:
        break;
    }
  });

  client.getMutationCache().subscribe((event) => {
    if (event.type !== 'updated') return;
    const status = event.mutation.state.status;
    if (status === 'success') {
      log.info('mutation succeeded');
    } else if (status === 'error') {
      // Mutation errors are typed `unknown` by default, so narrow rather than
      // assuming an Error and reading `.message` off `any`.
      const error: unknown = event.mutation.state.error;
      log.error('mutation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return client;
}
