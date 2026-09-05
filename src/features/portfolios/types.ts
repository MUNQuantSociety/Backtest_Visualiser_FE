import { z } from 'zod';

/**
 * The API contract for MQS Master's live portfolios.
 *
 * Two naming conventions live side by side here, deliberately. The transport
 * envelope is camelCase like every other endpoint; the `config` object keeps
 * MQSMaster's own `SCREAMING_SNAKE` keys verbatim, because `BasePortfolio`
 * reads `TICKERS` and `LOOKBACK_DAYS` by name. Renaming them in transit would
 * need a bidirectional mapping table on both sides, and that table would drift
 * the first time someone adds a config key.
 */

/** OMS block — gated per portfolio by `OMS.enabled` in `config.json`. */
export const omsConfigSchema = z.object({
  enabled: z.boolean(),
  default_algo: z.enum(['TWAP', 'VWAP', 'MARKET']),
  duration_minutes: z.number().int().positive(),
  twap_num_slices: z.number().int().positive(),
  vwap_bucket_minutes: z.number().int().positive(),
  vwap_lookback_days: z.number().int().positive(),
  min_order_notional: z.number().nonnegative(),
  fallback_to_market: z.boolean(),
});
export type OmsConfig = z.infer<typeof omsConfigSchema>;

/**
 * Mirrors `src/portfolios/portfolio_<n>/config.json`.
 *
 * `passthrough` is load-bearing: portfolios 4-8 carry extra blocks
 * (`RBP_CONFIG`, `PORTFOLIO_6_CONFIG`, `asset_groups`, …) that no shared schema
 * can enumerate. Stripping them would make the config viewer silently lie about
 * what the engine is running.
 */
export const portfolioConfigSchema = z
  .object({
    PORTFOLIO_ID: z.string(),
    TICKERS: z.array(z.string()),
    INTERVAL: z.number().int().nonnegative(),
    LOOKBACK_DAYS: z.number().int().nonnegative(),
    EXCH: z.string().optional(),
    WEIGHTS: z.record(z.string(), z.number()),
    DATA_FEEDS: z.array(z.string()),
    OMS: omsConfigSchema.optional(),
  })
  .passthrough();
export type PortfolioConfig = z.infer<typeof portfolioConfigSchema>;

/** Whether the live engine's thread for this portfolio is alive. */
export const engineStateSchema = z.enum(['running', 'stopped', 'error', 'halted']);
export type EngineState = z.infer<typeof engineStateSchema>;

export const positionSchema = z.object({
  ticker: z.string(),
  quantity: z.number(),
  avgPrice: z.number(),
  lastPrice: z.number(),
  marketValue: z.number(),
  unrealizedPnl: z.number(),
  /** Share of the portfolio's total value, as a ratio in [0, 1]. */
  weight: z.number(),
});
export type Position = z.infer<typeof positionSchema>;

/**
 * A fill from `trade_execution_logs`. Distinct from the backtests feature's
 * `Trade`, which is a round trip with an entry and an exit — this is one leg,
 * because the live system logs fills as they happen and has no idea yet
 * whether a position will ever be closed.
 */
export const executionSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number(),
  price: z.number(),
  notional: z.number(),
  executedAt: z.string(),
  /** Absent when the trade bypassed the OMS. */
  algo: z.enum(['TWAP', 'VWAP', 'MARKET']).nullable().default(null),
  parentOrderId: z.string().nullable().default(null),
  /** Why the engine traded — `signal`, `rebalance`, `stop` — when it says. */
  reason: z.string().nullable().default(null),
});
export type Execution = z.infer<typeof executionSchema>;

/**
 * Structurally compatible with the backtests feature's `EquityPoint`, which is
 * what lets `EquityCurveChart` and `DrawdownChart` render a live curve without
 * a second charting integration. That compatibility is asserted at the page
 * boundary rather than by importing the schema, so neither feature owns the
 * other's contract.
 */
export const equitySamplePointSchema = z.object({
  date: z.string(),
  equity: z.number(),
});
export type EquitySamplePoint = z.infer<typeof equitySamplePointSchema>;

/**
 * Per-component notional over time — cash plus one entry per ticker.
 *
 * Stored column-wise (parallel arrays keyed by ticker) rather than as a row of
 * objects per timestamp. At minute resolution over a year that is ~98k points
 * per series, and the row-of-objects shape would repeat every key 98k times.
 *
 * `downsampled` follows the same contract as `equitySeriesSchema`: the server
 * decides the resolution and the UI says so rather than implying full fidelity.
 */
export const compositionSeriesSchema = z
  .object({
    timestamps: z.array(z.string()),
    cash: z.array(z.number()),
    /** Ticker -> notional at each timestamp. Same length as `timestamps`. */
    holdings: z.record(z.string(), z.array(z.number())),
    downsampled: z.boolean().default(false),
  })
  .refine(
    (value) =>
      value.cash.length === value.timestamps.length &&
      Object.values(value.holdings).every((series) => series.length === value.timestamps.length),
    'Every series must be the same length as `timestamps`.',
  );
export type CompositionSeries = z.infer<typeof compositionSeriesSchema>;

/** Row shape for the portfolio list — lighter than the detail payload. */
export const portfolioSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The `OnData` class, e.g. "VolMomentum". */
  strategyClass: z.string(),
  state: engineStateSchema,
  tickers: z.array(z.string()),
  /** Capital share assigned by `portfolio_manager_config.json`. */
  allocationWeight: z.number(),
  totalValue: z.number(),
  cash: z.number(),
  dayPnl: z.number(),
  totalPnl: z.number(),
  /** Total P&L as a ratio of deployed capital. */
  totalReturn: z.number(),
  lastTickAt: z.string().nullable(),
});
export type PortfolioSummary = z.infer<typeof portfolioSummarySchema>;

export const portfolioDetailSchema = portfolioSummarySchema.extend({
  config: portfolioConfigSchema,
  positions: z.array(positionSchema),
  startedAt: z.string(),
  startingCapital: z.number(),
  /** Consecutive failures before the engine's circuit breaker trips. */
  consecutiveFailures: z.number().int().nonnegative().default(0),
});
export type PortfolioDetail = z.infer<typeof portfolioDetailSchema>;

export const portfolioListResponseSchema = z.object({
  items: z.array(portfolioSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export const equitySeriesSchema = z.object({
  points: z.array(equitySamplePointSchema),
  /** True when the server downsampled; the UI says so rather than implying full fidelity. */
  downsampled: z.boolean().default(false),
});
export type EquitySeries = z.infer<typeof equitySeriesSchema>;

export const executionListResponseSchema = z.object({
  items: z.array(executionSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

/**
 * Pairwise return correlations. `matrix[i][j]` corresponds to
 * `tickers[i]` against `tickers[j]`; the server returns the full square rather
 * than a triangle so the client never has to mirror indices.
 */
export const correlationMatrixSchema = z.object({
  tickers: z.array(z.string()),
  matrix: z.array(z.array(z.number())),
  lookbackDays: z.number().int().positive(),
});
export type CorrelationMatrix = z.infer<typeof correlationMatrixSchema>;

/**
 * Master-book NAV over time, with the same capital held passively in SPY.
 * Structurally an `EquityPoint`, so the backtest equity chart draws it.
 */
export const masterEquityPointSchema = z.object({
  date: z.string(),
  equity: z.number(),
  benchmark: z.number().nullable().default(null),
});
export type MasterEquityPoint = z.infer<typeof masterEquityPointSchema>;

export const masterEquitySchema = z.object({
  points: z.array(masterEquityPointSchema),
  downsampled: z.boolean().default(false),
});
export type MasterEquity = z.infer<typeof masterEquitySchema>;

/** One sector's exposure as a share of NAV, and what it did this month. */
export const sectorExposureSchema = z.object({
  sector: z.string(),
  /** Long and short notional as ratios of NAV; both non-negative. */
  long: z.number().nonnegative(),
  short: z.number().nonnegative(),
  /** `long - short`, as a ratio of NAV. */
  net: z.number(),
  /** What the sector added or cost this month, in basis points of NAV. */
  mtdAttributionBps: z.number(),
});
export type SectorExposure = z.infer<typeof sectorExposureSchema>;

/**
 * `GET /live/attribution` — sector exposure and month-to-date attribution.
 * Not built yet; the fixture is the contract the backend is being asked to meet.
 */
export const attributionReportSchema = z.object({
  asOf: z.string(),
  sectors: z.array(sectorExposureSchema),
  /** Ticker → sector, so positions can be grouped without a second lookup. */
  tickerSectors: z.record(z.string(), z.string()),
});
export type AttributionReport = z.infer<typeof attributionReportSchema>;

/** `GET /live/risk` — the book's risk report. Ratios of NAV unless stated. */
export const riskReportSchema = z.object({
  asOf: z.string(),
  /** One-day value at risk, as a positive share of NAV. */
  var95: z.number().nonnegative(),
  var99: z.number().nonnegative(),
  expectedShortfall95: z.number().nonnegative(),
  grossExposure: z.number().nonnegative(),
  netExposure: z.number(),
  leverage: z.number().nonnegative(),
  betaToSpy: z.number(),
  /** Largest single-name weight. */
  maxNameWeight: z.number().nonnegative(),
  lookbackDays: z.number().int().positive(),
});
export type RiskReport = z.infer<typeof riskReportSchema>;

/** Query parameters accepted by the execution log endpoint. */
export interface ExecutionFilters {
  page?: number;
  pageSize?: number;
  ticker?: string;
}
