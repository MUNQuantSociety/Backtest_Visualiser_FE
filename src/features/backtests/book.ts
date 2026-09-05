import type { DashboardPeriod } from '@/lib/ui-store';
import {
  correlation,
  maxDrawdown,
  ols,
  rollingSharpe,
  sharpeRatio,
  toReturns,
} from '@/utils/metrics';

import type { BacktestDetail, BacktestSummary, EquityPoint } from './types';

/**
 * The "book": every active strategy's best run, held equal-weight, against the
 * benchmark. Pure functions over already-fetched payloads — no React, no
 * fetching — so the dashboard's numbers can be asserted without rendering.
 *
 * "Best" is highest Sharpe among completed runs, not highest return: return
 * alone rewards the run that took the most risk.
 */

export interface BookStrategy {
  id: string;
  name: string;
  /** Short engine class name, used where a full name will not fit. */
  shortName: string;
  universe: readonly string[];
  /** Position in the series palette, stable across every panel. */
  colorIndex: number;
}

/** Highest-Sharpe completed run for each strategy that has one. */
export function bestRunByStrategy(runs: readonly BacktestSummary[]): Map<string, BacktestSummary> {
  const best = new Map<string, BacktestSummary>();
  for (const run of runs) {
    if (run.status !== 'completed') continue;
    const current = best.get(run.strategyId);
    if (!current || run.sharpe > current.sharpe) best.set(run.strategyId, run);
  }
  return best;
}

const YEARS: Record<DashboardPeriod, number | null> = { '1y': 1, '2y': 2, '5y': 5, max: null };

/** The tail of a curve covering the period, measured back from its last point. */
export function sliceToPeriod(
  points: readonly EquityPoint[],
  period: DashboardPeriod,
): readonly EquityPoint[] {
  const years = YEARS[period];
  const last = points[points.length - 1];
  if (years === null || !last) return points;
  const cutoff = new Date(`${last.date}T00:00:00Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  const from = cutoff.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= from);
}

interface Aligned {
  dates: string[];
  /** Per-series equity on exactly the shared dates, in input order. */
  columns: number[][];
}

/**
 * Restricts several curves to the dates they all have. Runs over different
 * windows or timeframes cannot be averaged point-by-point otherwise, and a
 * gap in one series would silently shift every date after it.
 */
export function alignByDate(curves: readonly (readonly EquityPoint[])[]): Aligned {
  if (curves.length === 0) return { dates: [], columns: [] };
  const maps = curves.map((curve) => new Map(curve.map((point) => [point.date, point.equity])));
  const dates = [...(maps[0]?.keys() ?? [])].filter((date) => maps.every((map) => map.has(date)));
  return {
    dates,
    columns: maps.map((map) => dates.map((date) => map.get(date) ?? 0)),
  };
}

/** Rebases a column to 100 at its first value. */
function rebase(values: readonly number[]): number[] {
  const base = values[0];
  if (base === undefined || base === 0) return [];
  return values.map((value) => (value / base) * 100);
}

/** Equal-weight, daily-rebalanced index of the given curves, based at 100. */
export function bookCurve(curves: readonly (readonly EquityPoint[])[]): EquityPoint[] {
  const { dates, columns } = alignByDate(curves);
  if (dates.length === 0) return [];
  const rebasedColumns = columns.map(rebase).filter((column) => column.length > 0);
  if (rebasedColumns.length === 0) return [];
  return dates.map((date, i) => ({
    date,
    equity:
      rebasedColumns.reduce((sum, column) => sum + (column[i] ?? 0), 0) / rebasedColumns.length,
  }));
}

/**
 * The benchmark held over the same dates. Prefers a run that actually traded
 * SPY; otherwise every run's own benchmark, equal-weighted, and the caller
 * should label it "Benchmark" rather than "SPY".
 */
export function benchmarkCurve(details: readonly BacktestDetail[]): {
  title: string;
  points: EquityPoint[];
} {
  const spy = details.find((detail) => detail.symbol === 'SPY');
  const source = spy ? [spy] : details;
  const curves = source.map((detail) =>
    detail.equityCurve.flatMap((point) =>
      typeof point.benchmark === 'number' ? [{ date: point.date, equity: point.benchmark }] : [],
    ),
  );
  return { title: spy ? 'SPY' : 'Benchmark', points: bookCurve(curves) };
}

export interface AlphaRow {
  strategy: BookStrategy;
  run: BacktestDetail;
  /** Annualised, as a ratio. */
  alpha: number;
  beta: number;
  sharpe: number;
  maxDrawdown: number;
  /** Rolling 63-day Sharpe over roughly the last year of the run. */
  sparkline: (number | null)[];
}

const TRADING_YEAR = 252;

/** Alpha and beta of a run's daily returns against its benchmark's. */
export function regressOnBenchmark(
  points: readonly EquityPoint[],
): { alpha: number; beta: number } | null {
  const paired = points.filter((point) => typeof point.benchmark === 'number');
  if (paired.length < 3) return null;
  const strategy = toReturns(paired.map((point) => point.equity));
  const benchmark = toReturns(paired.map((point) => point.benchmark ?? 0));
  const { alpha, beta } = ols(benchmark, strategy);
  return { alpha: alpha * TRADING_YEAR, beta };
}

export function alphaRows(
  strategies: readonly BookStrategy[],
  runs: ReadonlyMap<string, BacktestDetail>,
  period: DashboardPeriod,
): AlphaRow[] {
  const rows: AlphaRow[] = [];
  for (const strategy of strategies) {
    const run = runs.get(strategy.id);
    if (!run) continue;
    const window = sliceToPeriod(run.equityCurve, period);
    const equity = window.map((point) => point.equity);
    const returns = toReturns(equity);
    const regression = regressOnBenchmark(window);
    rows.push({
      strategy,
      run,
      alpha: regression?.alpha ?? 0,
      beta: regression?.beta ?? 0,
      sharpe: sharpeRatio(returns),
      maxDrawdown: maxDrawdown(equity),
      sparkline: rollingSharpe(returns.slice(-TRADING_YEAR)),
    });
  }
  return rows;
}

/** Pairwise correlation of daily returns, in the strategies' order. */
export function returnCorrelation(
  strategies: readonly BookStrategy[],
  runs: ReadonlyMap<string, BacktestDetail>,
  period: DashboardPeriod,
): { labels: string[]; matrix: number[][]; averagePairwise: number } {
  const present = strategies.filter((strategy) => runs.has(strategy.id));
  const curves = present.map((strategy) =>
    sliceToPeriod(runs.get(strategy.id)?.equityCurve ?? [], period),
  );
  const { columns } = alignByDate(curves);
  const returns = columns.map(toReturns);

  const matrix = returns.map((a) => returns.map((b) => correlation(a, b)));
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < matrix.length; i += 1) {
    for (let j = i + 1; j < matrix.length; j += 1) {
      sum += matrix[i]?.[j] ?? 0;
      pairs += 1;
    }
  }
  return {
    labels: present.map((strategy) => strategy.shortName),
    matrix,
    averagePairwise: pairs === 0 ? 0 : sum / pairs,
  };
}

export interface UniverseRow {
  ticker: string;
  /** Strategies trading it, by palette index — segments of the stacked bar. */
  strategyIndexes: number[];
  /** Earliest window start among runs on the ticker, or null if never run. */
  coverageStart: string | null;
}

export function universeRows(
  strategies: readonly BookStrategy[],
  runs: readonly BacktestSummary[],
): UniverseRow[] {
  const byTicker = new Map<string, number[]>();
  for (const strategy of strategies) {
    for (const ticker of strategy.universe) {
      const list = byTicker.get(ticker) ?? [];
      list.push(strategy.colorIndex);
      byTicker.set(ticker, list);
    }
  }
  const earliest = new Map<string, string>();
  for (const run of runs) {
    const current = earliest.get(run.symbol);
    if (!current || run.startDate < current) earliest.set(run.symbol, run.startDate);
  }
  return [...byTicker.entries()]
    .map(([ticker, strategyIndexes]) => ({
      ticker,
      strategyIndexes,
      coverageStart: earliest.get(ticker) ?? null,
    }))
    .sort(
      (a, b) =>
        b.strategyIndexes.length - a.strategyIndexes.length || a.ticker.localeCompare(b.ticker),
    );
}

export interface BookSummary {
  sharpe: number;
  alpha: number;
  beta: number;
  maxDrawdown: number;
  /** Deepest single-run drawdown, for the "vs worst single" hint. */
  worstSingleDrawdown: number;
  averagePairwise: number;
  dataThrough: string | null;
  coverageTickers: number;
  runsLast30d: number;
}

export function summariseBook(
  book: readonly EquityPoint[],
  benchmark: readonly EquityPoint[],
  rows: readonly AlphaRow[],
  averagePairwise: number,
  strategies: readonly BookStrategy[],
  runs: readonly BacktestSummary[],
  now = new Date(),
): BookSummary {
  const equity = book.map((point) => point.equity);
  const { columns } = alignByDate([book, benchmark]);
  const bookReturns = toReturns(columns[0] ?? []);
  const benchReturns = toReturns(columns[1] ?? []);
  const regression = bookReturns.length > 2 ? ols(benchReturns, bookReturns) : null;

  const dataThrough = runs.reduce<string | null>(
    (latest, run) => (latest === null || run.endDate > latest ? run.endDate : latest),
    null,
  );
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const since = cutoff.toISOString();

  return {
    sharpe: sharpeRatio(toReturns(equity)),
    alpha: (regression?.alpha ?? 0) * TRADING_YEAR,
    beta: regression?.beta ?? 0,
    maxDrawdown: maxDrawdown(equity),
    worstSingleDrawdown: rows.reduce((worst, row) => Math.min(worst, row.maxDrawdown), 0),
    averagePairwise,
    dataThrough,
    coverageTickers: new Set(strategies.flatMap((strategy) => strategy.universe)).size,
    runsLast30d: runs.filter((run) => run.createdAt >= since).length,
  };
}
