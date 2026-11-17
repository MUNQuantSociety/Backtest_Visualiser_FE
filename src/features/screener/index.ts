/** Public surface of the stock screener feature. */

export { DetailsPanel } from './components/details-panel';
export { TrendChart } from './components/trend-chart';
export { WatchlistTable } from './components/watchlist-table';
export {
  fetchQuotes,
  QUOTES_BATCH_SIZE,
  QUOTES_REFRESH_MS,
  screenerKeys,
  usePeriodCandles,
  useQuotes,
} from './screener-api';
export {
  displayOrder,
  groupQuotes,
  periodChange,
  periodWindow,
  resolveSelection,
  SCREENER_PERIODS,
  stepSelection,
  type QuoteGroup,
  type ScreenerPeriod,
} from './screener-model';
export type { Quote, QuoteKind, QuotesResponse } from './types';
