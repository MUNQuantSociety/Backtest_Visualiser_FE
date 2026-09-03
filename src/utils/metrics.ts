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

export interface HistogramBin {
  /** Inclusive lower edge. */
  from: number;
  /** Exclusive upper edge, except for the final bin which includes its top. */
  to: number;
  count: number;
}

/**
 * Bins values for a distribution chart, with an edge forced exactly at zero.
 *
 * The zero edge is the whole point. Bin naively across the full range and the
 * central bin straddles zero, so it holds winners *and* losers and any colour
 * you give it is a lie. Splitting the range at zero and binning each side
 * independently means every bin is unambiguously one sign.
 *
 * `binsPerSide` is a target, not a guarantee — a set with no losers returns
 * only positive bins.
 */
export function histogram(values: readonly number[], binsPerSide = 12): HistogramBin[] {
  if (values.length === 0) return [];

  const negatives = values.filter((value) => value < 0);
  const positives = values.filter((value) => value > 0);

  const bins: HistogramBin[] = [];

  const push = (min: number, max: number, count: number) => {
    if (count <= 0) return;
    // A degenerate range (every value identical) would give a zero-width bin.
    const width = (max - min) / count || 1;
    for (let i = 0; i < count; i += 1) {
      bins.push({ from: min + width * i, to: min + width * (i + 1), count: 0 });
    }
  };

  if (negatives.length > 0) push(Math.min(...negatives), 0, binsPerSide);
  if (positives.length > 0) push(0, Math.max(...positives), binsPerSide);

  if (bins.length === 0) return [];

  for (const value of values) {
    // Break-even trades are neither wins nor losses; excluding them keeps the
    // bar heights consistent with the win/loss counts shown elsewhere.
    if (value === 0) continue;

    const index = bins.findIndex((bin) => value >= bin.from && value < bin.to);
    const target = index === -1 ? bins[bins.length - 1] : bins[index];
    if (target) target.count += 1;
  }

  return bins;
}

/** Mean of the winning trades. Zero when there were none. */
export function averageWin(pnls: readonly number[]): number {
  return mean(pnls.filter((pnl) => pnl > 0));
}

/** Mean of the losing trades, as a negative number. Zero when there were none. */
export function averageLoss(pnls: readonly number[]): number {
  return mean(pnls.filter((pnl) => pnl < 0));
}

/**
 * Average win over the magnitude of the average loss.
 *
 * Distinct from profit factor, which weights by how *many* trades fell on each
 * side. A strategy can have a payoff ratio well above 1 and still lose money if
 * it wins rarely enough — which is why a tearsheet shows both.
 */
export function payoffRatio(pnls: readonly number[]): number {
  const avgLoss = Math.abs(averageLoss(pnls));
  if (avgLoss === 0) return averageWin(pnls) > 0 ? Number.POSITIVE_INFINITY : 0;
  return averageWin(pnls) / avgLoss;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * APPEND THIS TO: src/utils/metrics.ts
 *
 * Nothing here is new maths — it is the derivations the nine new analytics
 * charts need, kept in metrics.ts with the rest so they can be unit-tested
 * without rendering. Follows the file's existing rules: pure functions, no React,
 * no imports from features, sample stdDev (n-1), 252 periods, 2% risk-free.
 *
 * `TRADING_DAYS_PER_YEAR` and `DEFAULT_RISK_FREE_RATE` are already imported at
 * the top of metrics.ts — no import changes required.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Sharpe over a trailing window. Positions before the window fills are `null`
 * rather than 0 — a Sharpe of zero is a real result and must not be faked.
 *
 * The headline Sharpe is one number for a whole run, which cannot tell a
 * steadily good strategy from one that earned everything in a single quarter.
 */
export function rollingSharpe(
  returns: readonly number[],
  window = 63,
  periodsPerYear = TRADING_DAYS_PER_YEAR,
): (number | null)[] {
  return returns.map((_, index) =>
    index < window - 1
      ? null
      : sharpeRatio(
          returns.slice(index - window + 1, index + 1),
          DEFAULT_RISK_FREE_RATE,
          periodsPerYear,
        ),
  );
}

/** Annualised volatility over a trailing window. Leading positions are `null`. */
export function rollingVolatility(
  returns: readonly number[],
  window = 63,
  periodsPerYear = TRADING_DAYS_PER_YEAR,
): (number | null)[] {
  return returns.map((_, index) =>
    index < window - 1
      ? null
      : stdDev(returns.slice(index - window + 1, index + 1)) * Math.sqrt(periodsPerYear),
  );
}

export interface MonthlyReturnRow {
  year: string;
  /** Twelve entries, Jan–Dec. `null` where the run had no data that month. */
  months: (number | null)[];
  /** Year-to-date, compounded from the months present. */
  ytd: number;
}

/**
 * Calendar-month returns compounded from an equity curve.
 *
 * Compounded, not summed: a month is the product of its daily factors. Summing
 * daily returns overstates a volatile month, and the error grows with vol —
 * exactly the months a reader is scrutinising.
 *
 * Structurally typed so utils/ stays free of feature imports; pass
 * `detail.equityCurve` directly.
 */
export function monthlyReturns(
  points: readonly { date: string; equity: number }[],
): MonthlyReturnRow[] {
  if (points.length < 2) return [];

  const factorByMonth = new Map<string, number>();
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    if (!previous || !current || previous.equity === 0) continue;
    const key = current.date.slice(0, 7);
    factorByMonth.set(key, (factorByMonth.get(key) ?? 1) * (current.equity / previous.equity));
  }

  const rows = new Map<string, MonthlyReturnRow>();
  for (const [key, factor] of factorByMonth) {
    const year = key.slice(0, 4);
    const monthIndex = Number(key.slice(5, 7)) - 1;
    const row = rows.get(year) ?? { year, months: Array.from({ length: 12 }, () => null), ytd: 0 };
    row.months[monthIndex] = factor - 1;
    rows.set(year, row);
  }

  return [...rows.values()].map((row) => ({
    ...row,
    // Explicit type argument: `months` is `(number | null)[]`, so without it
    // TypeScript infers a nullable accumulator from the element type and
    // ignores the numeric seed.
    ytd:
      row.months.reduce<number>((acc, value) => (value === null ? acc : acc * (1 + value)), 1) - 1,
  }));
}

export interface Regression {
  /** Intercept, in the same period units as the inputs. Annualise for display. */
  alpha: number;
  beta: number;
  /** Coefficient of determination, in [0, 1]. */
  r2: number;
}

/**
 * Ordinary least squares of `ys` on `xs`.
 *
 * Beta near 1 with a high R² means an equity curve is the benchmark wearing a
 * different name, however good the Sharpe looks — which no scalar on the
 * tearsheet reveals.
 */
export function ols(xs: readonly number[], ys: readonly number[]): Regression {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { alpha: 0, beta: 0, r2: 0 };

  const xSlice = xs.slice(0, n);
  const ySlice = ys.slice(0, n);
  const mx = mean(xSlice);
  const my = mean(ySlice);

  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xSlice[i] ?? 0) - mx;
    const dy = (ySlice[i] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }

  const beta = sxx === 0 ? 0 : sxy / sxx;
  return {
    beta,
    alpha: my - beta * mx,
    r2: sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy),
  };
}

/** Linear-interpolated quantile. `quantile(returns, 0.05)` is the 95% VaR. */
export function quantile(values: readonly number[], p: number): number {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;

  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const lowValue = sorted[low] ?? 0;
  if (low === high) return lowValue;
  return lowValue + ((sorted[high] ?? lowValue) - lowValue) * (position - low);
}

/** Normal probability density — the overlay on the return distribution. */
export function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma === 0) return 0;
  return Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
}

export interface DrawdownEpisode {
  /** Negative ratio at the trough. */
  depth: number;
  peakDate: string;
  valleyDate: string;
  /** Null while the episode has not made a new high. */
  recoveryDate: string | null;
  /** Peak → recovery, in bars. Peak → last bar when still underwater. */
  lengthBars: number;
  /** Trough → new high, in bars. Null while underwater. */
  recoveryBars: number | null;
  ongoing: boolean;
}

/**
 * Distinct peak-to-trough-to-recovery episodes, deepest first.
 *
 * `maxDrawdown()` collapses this to one number and hides what actually decides
 * whether a strategy is holdable: how long the hole lasted. Two runs with an
 * identical −18% can be a three-week dip and a nine-month grind.
 *
 * An episode that never recovers is flagged `ongoing` with a null recovery —
 * unknown, not zero.
 */
export function drawdownEpisodes(
  points: readonly { date: string; equity: number }[],
  limit = 5,
): DrawdownEpisode[] {
  if (points.length < 2) return [];

  interface Open {
    peakIndex: number;
    valleyIndex: number;
    recoveryIndex: number | null;
    depth: number;
  }

  const episodes: Open[] = [];
  let peakIndex = 0;
  let peak = points[0]?.equity ?? 0;
  let valleyIndex: number | null = null;
  let valley = Number.POSITIVE_INFINITY;

  for (let i = 1; i < points.length; i += 1) {
    const value = points[i]?.equity ?? 0;

    if (value >= peak) {
      if (valleyIndex !== null) {
        episodes.push({
          peakIndex,
          valleyIndex,
          recoveryIndex: i,
          depth: peak === 0 ? 0 : valley / peak - 1,
        });
        valleyIndex = null;
        valley = Number.POSITIVE_INFINITY;
      }
      peak = value;
      peakIndex = i;
    } else if (value < valley) {
      valley = value;
      valleyIndex = i;
    }
  }

  if (valleyIndex !== null) {
    episodes.push({
      peakIndex,
      valleyIndex,
      recoveryIndex: null,
      depth: peak === 0 ? 0 : valley / peak - 1,
    });
  }

  return episodes
    .sort((a, b) => a.depth - b.depth)
    .slice(0, limit)
    .map((episode) => ({
      depth: episode.depth,
      peakDate: points[episode.peakIndex]?.date ?? '',
      valleyDate: points[episode.valleyIndex]?.date ?? '',
      recoveryDate:
        episode.recoveryIndex === null ? null : (points[episode.recoveryIndex]?.date ?? null),
      lengthBars: (episode.recoveryIndex ?? points.length - 1) - episode.peakIndex,
      recoveryBars:
        episode.recoveryIndex === null ? null : episode.recoveryIndex - episode.valleyIndex,
      ongoing: episode.recoveryIndex === null,
    }));
}

/** Bars a trade was open. Null while the position is still open. */
export function holdingBars(entryDate: string, exitDate: string | null): number | null {
  if (exitDate === null) return null;
  const entry = new Date(entryDate).getTime();
  const exit = new Date(exitDate).getTime();
  if (Number.isNaN(entry) || Number.isNaN(exit)) return null;
  return Math.max(0, Math.round((exit - entry) / 86_400_000));
}

/**
 * Pearson correlation of two equal-length series, in [-1, 1].
 *
 * Returns 0 when either side has no variance: a flat series is not correlated
 * with anything, and reporting NaN would poison every average built on it.
 */
export function correlation(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;

  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}
