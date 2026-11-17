import { useMemo } from 'react';

import { activeBookStrategies, universeRows, useAllBacktests } from '@/features/backtests';
import { useStrategies } from '@/features/strategies';

import { useWatchlist } from './watchlist-store';

/**
 * The dashboard's watchlist, for pages other than the dashboard.
 *
 * The same two inputs the dashboard's watchlist card uses: the active
 * strategies' universe (via the shared `activeBookStrategies` and
 * `universeRows`) and this browser's watchlist edits. So a ticker added or
 * removed on the dashboard appears or disappears here too.
 */
export function useWatchlistUniverse() {
  const strategiesQuery = useStrategies();
  const runsQuery = useAllBacktests();
  const universeTickers = useMemo(
    () =>
      universeRows(
        activeBookStrategies(strategiesQuery.data ?? []),
        runsQuery.data?.items ?? [],
      ).map((row) => row.ticker),
    [strategiesQuery.data, runsQuery.data],
  );
  const watchlist = useWatchlist(universeTickers);
  // `useWatchlist` builds a new array on every render; keep one per content
  // so consumers can depend on it.
  const tickersKey = watchlist.tickers.join(',');
  const tickers = useMemo(() => (tickersKey ? tickersKey.split(',') : []), [tickersKey]);

  return {
    tickers,
    isEdited: watchlist.isEdited,
    isLoading: strategiesQuery.isPending,
    /** The strategy list failed, so only this browser's additions are known. */
    isUnavailable: strategiesQuery.isError && strategiesQuery.data === undefined,
  };
}
