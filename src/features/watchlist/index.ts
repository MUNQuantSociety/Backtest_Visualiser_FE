/** Public surface of the watchlist feature. */

export { WatchlistCard } from './components/watchlist-card';
export { perplexityFinanceUrl } from './external-links';
export {
  normaliseTicker,
  resolveWatchlist,
  useIsWatched,
  useWatchlist,
  useWatchlistStore,
  WATCHLIST_STORAGE_KEY,
} from './watchlist-store';
