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
});
export type BacktestDetail = z.infer<typeof backtestDetailSchema>;

export const backtestListResponseSchema = z.object({
  items: z.array(backtestSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

/** Query parameters accepted by the list endpoint. */
export interface BacktestFilters {
  search?: string;
  status?: BacktestStatus;
  strategyId?: string;
  page?: number;
  pageSize?: number;
}
