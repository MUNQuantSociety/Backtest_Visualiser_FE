import { DEFAULT_RISK_FREE_RATE, TRADING_DAYS_PER_YEAR } from '@/config/constants';

/**
 * Performance statistics derived on the client.
 *
 * Prefer metrics computed by the backtest engine when the API returns them —
 * these exist for ad-hoc slicing (e.g. recomputing over a zoomed date range)
 * where a round trip would be wasteful.
 */

/** Period-over-period simple returns from an equity curve. */
export function toReturns(equity: readonly number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i += 1) {
    const previous = equity[i - 1];
    const current = equity[i];
    if (previous === undefined || current === undefined || previous === 0) continue;
    returns.push(current / previous - 1);
  }
  return returns;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Sample standard deviation (n-1), which is the convention for return series. */
export function stdDev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Annualised excess return over volatility. Returns 0 when vol is 0. */
export function sharpeRatio(
  returns: readonly number[],
  riskFreeRate = DEFAULT_RISK_FREE_RATE,
  periodsPerYear = TRADING_DAYS_PER_YEAR,
): number {
  if (returns.length < 2) return 0;
  const periodRiskFree = riskFreeRate / periodsPerYear;
  const excess = returns.map((r) => r - periodRiskFree);
  const volatility = stdDev(excess);
  if (volatility === 0) return 0;
  return (mean(excess) / volatility) * Math.sqrt(periodsPerYear);
}

/** Like Sharpe but penalises only downside deviation. */
export function sortinoRatio(
  returns: readonly number[],
  riskFreeRate = DEFAULT_RISK_FREE_RATE,
  periodsPerYear = TRADING_DAYS_PER_YEAR,
): number {
  if (returns.length < 2) return 0;
  const periodRiskFree = riskFreeRate / periodsPerYear;
  const excess = returns.map((r) => r - periodRiskFree);
  const downside = excess.filter((r) => r < 0);
  if (downside.length === 0) return 0;
  const downsideDeviation = Math.sqrt(mean(downside.map((r) => r ** 2)));
  if (downsideDeviation === 0) return 0;
  return (mean(excess) / downsideDeviation) * Math.sqrt(periodsPerYear);
}

export interface DrawdownPoint {
  index: number;
  /** Negative ratio, e.g. -0.15 for a 15% drawdown. */
  drawdown: number;
}

/** Drawdown at every point, measured against the running peak. */
export function drawdownSeries(equity: readonly number[]): DrawdownPoint[] {
  let peak = Number.NEGATIVE_INFINITY;
  return equity.map((value, index) => {
    peak = Math.max(peak, value);
    return { index, drawdown: peak === 0 ? 0 : value / peak - 1 };
  });
}

/** Largest peak-to-trough decline, as a negative ratio. */
export function maxDrawdown(equity: readonly number[]): number {
  const series = drawdownSeries(equity);
  return series.reduce((worst, point) => Math.min(worst, point.drawdown), 0);
}

/** Compound annual growth rate. */
export function cagr(equity: readonly number[], periodsPerYear = TRADING_DAYS_PER_YEAR): number {
  const start = equity[0];
  const end = equity[equity.length - 1];
  if (start === undefined || end === undefined || start <= 0 || equity.length < 2) return 0;
  const years = (equity.length - 1) / periodsPerYear;
  if (years <= 0) return 0;
  return (end / start) ** (1 / years) - 1;
}

/** Annualised return divided by the magnitude of max drawdown. */
export function calmarRatio(
  equity: readonly number[],
  periodsPerYear = TRADING_DAYS_PER_YEAR,
): number {
  const maxDd = Math.abs(maxDrawdown(equity));
  if (maxDd === 0) return 0;
  return cagr(equity, periodsPerYear) / maxDd;
}

/** Share of trades that were profitable, as a ratio in [0, 1]. */
export function winRate(pnls: readonly number[]): number {
  if (pnls.length === 0) return 0;
  return pnls.filter((pnl) => pnl > 0).length / pnls.length;
}

/** Gross profit over gross loss. Infinity when there are no losing trades. */
export function profitFactor(pnls: readonly number[]): number {
  const grossProfit = pnls.filter((p) => p > 0).reduce((sum, p) => sum + p, 0);
  const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((sum, p) => sum + p, 0));
  if (grossLoss === 0) return grossProfit > 0 ? Number.POSITIVE_INFINITY : 0;
  return grossProfit / grossLoss;
}
