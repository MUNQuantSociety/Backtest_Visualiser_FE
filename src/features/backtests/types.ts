import { z } from 'zod';

/**
 * The API contract for backtests, expressed as Zod schemas.
 *
 * Types are *inferred* from the schemas rather than declared separately, so
 * the runtime check and the compile-time type can never drift apart. Every
 * response is parsed at the `api/` boundary — a backend field rename then
 * surfaces as one clear validation error instead of `undefined` deep in a chart.
 */

export const backtestStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);
export type BacktestStatus = z.infer<typeof backtestStatusSchema>;

export const equityPointSchema = z.object({
  /** ISO-8601 date, e.g. "2024-03-01". */
  date: z.string(),
  equity: z.number(),
  /** Optional benchmark equity for the same date. */
  benchmark: z.number().nullable().optional(),
});
export type EquityPoint = z.infer<typeof equityPointSchema>;

export const tradeSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: z.enum(['long', 'short']),
  entryDate: z.string(),
  exitDate: z.string().nullable(),
  entryPrice: z.number(),
  exitPrice: z.number().nullable(),
  quantity: z.number(),
  /** Realised profit and loss in account currency. */
  pnl: z.number(),
  /** Return on the trade as a ratio, e.g. 0.043 for +4.3%. */
  returnPct: z.number(),
  fees: z.number().default(0),
});
export type Trade = z.infer<typeof tradeSchema>;

export const performanceMetricsSchema = z.object({
  totalReturn: z.number(),
  cagr: z.number(),
  sharpe: z.number(),
  sortino: z.number(),
  maxDrawdown: z.number(),
  volatility: z.number(),
  winRate: z.number(),
  profitFactor: z.number(),
  totalTrades: z.number().int(),
});
export type PerformanceMetrics = z.infer<typeof performanceMetricsSchema>;

/** Row shape for the list view — deliberately lighter than the detail payload. */
export const backtestSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  strategyId: z.string(),
  strategyName: z.string(),
  symbol: z.string(),
  timeframe: z.string(),
  status: backtestStatusSchema,
  startDate: z.string(),
  endDate: z.string(),
  createdAt: z.string(),
  initialCapital: z.number(),
  finalEquity: z.number(),
  totalReturn: z.number(),
  sharpe: z.number(),
  maxDrawdown: z.number(),
});
export type BacktestSummary = z.infer<typeof backtestSummarySchema>;

export const backtestDetailSchema = backtestSummarySchema.extend({
  metrics: performanceMetricsSchema,
  equityCurve: z.array(equityPointSchema),
  trades: z.array(tradeSchema),
  parameters: z.record(z.string(), z.unknown()).default({}),

  /*
   * How a run that is not finished reports on itself. The backend has always
   * sent both; nothing read them, so a queued run looked frozen and a failed
   * one gave no reason. Optional with defaults because the demo dataset holds
   * only completed runs and does not carry either key.
   */
  progressPct: z.number().min(0).max(100).nullable().default(null),
  errorMessage: z.string().nullable().default(null),
});
export type BacktestDetail = z.infer<typeof backtestDetailSchema>;

export const backtestListResponseSchema = z.object({
  items: z.array(backtestSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

/** The statuses a run can still move on from. */
export const IN_FLIGHT_STATUSES: readonly BacktestStatus[] = ['queued', 'running'];

export function isInFlight(status: BacktestStatus): boolean {
  return IN_FLIGHT_STATUSES.includes(status);
}

/**
 * What launching a run needs.
 *
 * `mode` and `params` are accepted by the endpoint and deliberately not sent by
 * the form: event mode is the dependable path, and the one parameter an upload
 * advertises has a sane default. Both are here so adding a control later is a
 * form change and not a contract change.
 */
export const backtestRunRequestSchema = z.object({
  name: z.string().trim().min(1, 'Give the run a name.').max(120),
  strategyKey: z.string().min(1, 'Pick a strategy.'),
  startDate: z.string().min(1, 'Pick a start date.'),
  endDate: z.string().min(1, 'Pick an end date.'),
  initialCapital: z.number().positive('Starting capital must be above zero.'),
  mode: z.enum(['event', 'fast']).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type BacktestRunRequest = z.infer<typeof backtestRunRequestSchema>;

/**
 * How far the market data actually goes.
 *
 * Lives in this feature because the run form is its only caller. Coverage ends
 * weeks behind the calendar, so a date picker that defaults to "last 30 days"
 * produces an empty window and a run that fails for a reason the author did not
 * cause. `start` and `end` are the window safe for the whole universe, and are
 * null when some ticker in it has no bars at all.
 */
export const tickerCoverageSchema = z.object({
  ticker: z.string(),
  firstBar: z.string().nullable().default(null),
  lastBar: z.string().nullable().default(null),
});
export type TickerCoverage = z.infer<typeof tickerCoverageSchema>;

export const coverageResponseSchema = z.object({
  tickers: z.array(tickerCoverageSchema).default([]),
  start: z.string().nullable().default(null),
  end: z.string().nullable().default(null),
  missing: z.array(z.string()).default([]),
});
export type CoverageResponse = z.infer<typeof coverageResponseSchema>;

/** Query parameters accepted by the list endpoint. */
export interface BacktestFilters {
  search?: string;
  status?: BacktestStatus;
  strategyId?: string;
  page?: number;
  pageSize?: number;
}
