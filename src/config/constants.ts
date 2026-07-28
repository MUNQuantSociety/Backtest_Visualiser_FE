/** App-wide magic values. Anything referenced in more than one file lives here. */

export const APP_NAME = 'Backtest Visualiser';

/** Trading days per year — the standard annualisation factor for daily returns. */
export const TRADING_DAYS_PER_YEAR = 252;

/** Assumed risk-free rate used by Sharpe when the API does not supply one. */
export const DEFAULT_RISK_FREE_RATE = 0.02;

export const DEFAULT_PAGE_SIZE = 25;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Candle intervals the UI offers. Keep in sync with the backend's accepted values. */
export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/** localStorage keys, namespaced so they never collide with other apps on the origin. */
export const STORAGE_KEYS = {
  theme: 'bv:theme',
  sidebarCollapsed: 'bv:sidebar-collapsed',
  comparisonSet: 'bv:comparison-set',
} as const;
