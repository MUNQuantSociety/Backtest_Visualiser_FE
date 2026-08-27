/** App-wide magic values. Anything referenced in more than one file lives here. */

export const APP_NAME = 'MQS Backtest Engine';

/** The two products this shell hosts. Used for nav section headings. */
export const PRODUCT_NAMES = {
    backtests: 'Backtest Visualiser',
    live: 'MQS Master',
} as const;

/**
 * How often live views refetch. The live engine ticks its OMS every 5s
 * (`oms_tick_seconds`), so polling faster than that only burns requests.
 */
export const LIVE_REFETCH_MS = 15_000;

/** Log tail length. The log view is a tail, not an archive — use search for history. */
export const LOG_TAIL_SIZE = 200;

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

/**
 * Log levels as MQSMaster's Python `logging` emits them, ordered by severity.
 * Index order is load-bearing: the log filter shows everything at or above the
 * selected level.
 */
export const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
