import type { EquityPoint, Trade } from '@/features/backtests';
import { mean, normalPdf, ols, quantile, stdDev } from '@/utils/metrics';

function periodReturn(previous: number | null | undefined, current: number | null | undefined) {
  if (previous == null || current == null || previous === 0) return null;
  const value = current / previous - 1;
  return Number.isFinite(value) ? value : null;
}

/** Keep the date and missing intervals; never bridge a missing benchmark close. */
export function datedReturns(data: readonly EquityPoint[]) {
  return data.slice(1).map((point, index) => ({
    date: point.date,
    strategy: periodReturn(data[index]?.equity, point.equity),
    benchmark: periodReturn(data[index]?.benchmark, point.benchmark),
  }));
}

export function dailyPnl(data: readonly EquityPoint[], initialCapital?: number) {
  const baseline = initialCapital ?? data[0]?.equity;
  if (baseline === undefined) return [];
  return data.slice(initialCapital === undefined ? 1 : 0).map((point, index) => {
    const sourceIndex = index + (initialCapital === undefined ? 1 : 0);
    return {
      date: point.date,
      change: point.equity - (data[sourceIndex - 1]?.equity ?? baseline),
      cumulative: point.equity - baseline,
    };
  });
}

/** Raw-return OLS; only pairs describing the same observed interval qualify. */
export function benchmarkRegression(data: readonly EquityPoint[]) {
  const points = datedReturns(data).filter(
    (point): point is { date: string; strategy: number; benchmark: number } =>
      point.strategy !== null && point.benchmark !== null,
  );
  if (points.length < 8) return null;
  const xs = points.map((point) => point.benchmark);
  const ys = points.map((point) => point.strategy);
  if (stdDev(xs) === 0) return null;
  const fit = ols(xs, ys);
  // Constant strategy returns have no variance for R² to explain.
  if (stdDev(ys) === 0) fit.r2 = Number.NaN;
  return {
    points,
    fit,
    fitLine: [Math.min(...xs), Math.max(...xs)].map((benchmark) => ({
      benchmark,
      strategy: fit.alpha + fit.beta * benchmark,
    })),
  };
}

export function returnDistribution(data: readonly EquityPoint[], bins = 41) {
  const returns = datedReturns(data).flatMap((point) =>
    point.strategy === null ? [] : [point.strategy],
  );
  if (returns.length < 8) return null;
  const mu = mean(returns);
  const sigma = stdDev(returns);
  // Flat equity is real data: use a small visible range instead of zero-width bins.
  const span = Math.max(0.001, ...returns.map((value) => Math.abs(value) * 1.05));
  const count = Math.max(1, Math.floor(bins));
  const step = (span * 2) / count;
  const buckets = Array.from({ length: count }, (_, index) => {
    const midpoint = -span + (index + 0.5) * step;
    return {
      from: -span + index * step,
      to: -span + (index + 1) * step,
      midpoint,
      count: 0,
      fit: sigma === 0 ? null : normalPdf(midpoint, mu, sigma) * returns.length * step,
    };
  });
  for (const value of returns) {
    const bucket = buckets[Math.min(count - 1, Math.max(0, Math.floor((value + span) / step)))];
    if (bucket) bucket.count += 1;
  }
  return { buckets, mu, var95: quantile(returns, 0.05), hasNormalFit: sigma > 0 };
}

/** One marker per observed day and action, including exits and short covers. */
export function tradeMarkers(data: readonly EquityPoint[], trades: readonly Trade[]) {
  const days = new Set(data.map((point) => point.date));
  const groups = new Map<string, { date: string; action: 'Buy' | 'Sell'; count: number }>();
  const add = (timestamp: string, action: 'Buy' | 'Sell') => {
    const date = timestamp.slice(0, 10);
    if (!days.has(date)) return;
    const key = `${date}:${action}`;
    const group = groups.get(key) ?? { date, action, count: 0 };
    group.count += 1;
    groups.set(key, group);
  };
  for (const trade of trades) {
    add(trade.entryDate, trade.side === 'long' ? 'Buy' : 'Sell');
    if (trade.exitDate !== null) add(trade.exitDate, trade.side === 'long' ? 'Sell' : 'Buy');
  }
  return [...groups.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.action.localeCompare(b.action),
  );
}

/** Sample actual event dates, per action, when the visible interval is dense. */
export function sampleTradeMarkers(events: ReturnType<typeof tradeMarkers>, maxPerAction: number) {
  const capacity = Math.max(1, Math.floor(maxPerAction));
  return (['Buy', 'Sell'] as const)
    .flatMap((action) => {
      const matching = events.filter((event) => event.action === action);
      const stride = Math.max(1, Math.ceil(matching.length / capacity));
      return matching.filter((_, index) => index % stride === 0);
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.action.localeCompare(b.action));
}
