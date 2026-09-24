import { bookCurve } from './book';
import type { BacktestDetail, EquityPoint } from './types';

/**
 * The dashboard's top-runs comparison: which runs to show, and what to measure
 * them against. Pure functions over already-fetched payloads, like `book.ts`.
 *
 * Two benchmarks. `spy` is SPY's own daily closes, the market everyone quotes.
 * `buyHold` is each run's own buy-and-hold of the tickers it traded, which the
 * backend already records beside every equity point: it asks whether trading
 * beat simply holding the same universe.
 */

export type BenchmarkMode = 'spy' | 'buyHold';

/** One SPY session close, as `GET /market-data/closes` returns it. */
export interface BenchmarkClose {
  date: string;
  close: number;
}

type ComparedRun = Pick<BacktestDetail, 'id' | 'name' | 'symbol' | 'equityCurve'>;

/** Last value over first, minus one; null without two points or a zero start. */
function totalReturn(points: readonly EquityPoint[]): number | null {
  const first = points[0]?.equity;
  const last = points.at(-1)?.equity;
  if (points.length < 2 || first === undefined || last === undefined || first === 0) return null;
  return last / first - 1;
}

/**
 * A null run: its value never moved over the window, which means it never
 * traded (or never filled). It has nothing to compare, so it earns no place.
 */
function isNullRun(points: readonly EquityPoint[]): boolean {
  const first = points[0]?.equity;
  return points.every((point) => point.equity === first);
}

/**
 * The `count` runs with the highest total return over their (already windowed)
 * curves, best first. Null runs, whose value never moved, are left out. Ties
 * go by id so the set never reshuffles between renders.
 */
export function topRunsByReturn<T extends Pick<BacktestDetail, 'id' | 'equityCurve'>>(
  runs: readonly T[],
  count: number,
): T[] {
  return runs
    .flatMap((run) => {
      if (isNullRun(run.equityCurve)) return [];
      const value = totalReturn(run.equityCurve);
      return value === null ? [] : [{ run, value }];
    })
    .sort((a, b) => b.value - a.value || a.run.id.localeCompare(b.run.id))
    .slice(0, Math.max(0, count))
    .map((entry) => entry.run);
}

/**
 * The curve with its benchmark swapped for SPY's close on each date, so the
 * existing alpha and beta maths regress against SPY. A date SPY has no close
 * for carries no benchmark and drops out of the regression.
 */
export function withBenchmarkCloses(
  points: readonly EquityPoint[],
  closes: readonly BenchmarkClose[],
): EquityPoint[] {
  const byDate = new Map(closes.map((close) => [close.date, close.close]));
  return points.map(({ date, equity }) => {
    const close = byDate.get(date);
    return close === undefined ? { date, equity } : { date, equity, benchmark: close };
  });
}

/** SPY's closes from `from` to `to` (inclusive) as a curve the chart can rebase. */
export function closesCurve(
  closes: readonly BenchmarkClose[],
  from: string,
  to: string,
): EquityPoint[] {
  return closes
    .filter((close) => close.date >= from && close.date <= to)
    .map((close) => ({ date: close.date, equity: close.close }));
}

/**
 * The runs' own buy-and-hold curves, each rebased to 100 and held equal-weight
 * on the dates they share. Unlike `benchmarkCurve` it never swaps in a run
 * that traded SPY: this option is always the runs' own universes.
 */
export function buyHoldCurve(runs: readonly Pick<BacktestDetail, 'equityCurve'>[]): EquityPoint[] {
  const curves = runs
    .map((run) =>
      run.equityCurve.flatMap((point) =>
        typeof point.benchmark === 'number' ? [{ date: point.date, equity: point.benchmark }] : [],
      ),
    )
    .filter((curve) => curve.length > 0);
  return curves.length > 0 ? bookCurve(curves) : [];
}

/** One run's standing at the pointer's date, for the chart's info card. */
export interface RunValueAt {
  id: string;
  name: string;
  /** The run's own date actually read: the last point on or before the pointer. */
  date: string | null;
  /** Portfolio value in account currency; null before the run started. */
  value: number | null;
  /** Return from the run's first point in the window. */
  returnSinceStart: number | null;
  /** The benchmark's return over the same span; null when it has no price. */
  benchmarkReturn: number | null;
  /** `returnSinceStart` minus `benchmarkReturn`. */
  lead: number | null;
}

/** The last element whose date is on or before `date`, in date order. */
function atOrBefore<T extends { date: string }>(items: readonly T[], date: string): T | undefined {
  let found: T | undefined;
  for (const item of items) {
    if (item.date > date) break;
    found = item;
  }
  return found;
}

function benchmarkReturnFor(
  points: readonly EquityPoint[],
  point: EquityPoint,
  mode: BenchmarkMode,
  closes: readonly BenchmarkClose[],
): number | null {
  const first = points[0];
  if (!first) return null;
  if (mode === 'spy') {
    const start = atOrBefore(closes, first.date)?.close;
    const now = atOrBefore(closes, point.date)?.close;
    return start && now !== undefined ? now / start - 1 : null;
  }
  const start = points.find((candidate) => typeof candidate.benchmark === 'number')?.benchmark;
  const now = point.benchmark;
  return typeof start === 'number' && start !== 0 && typeof now === 'number'
    ? now / start - 1
    : null;
}

/** Each run's value, return and lead over the benchmark at `date`, in input order. */
export function valuesAt(
  date: string,
  runs: readonly ComparedRun[],
  mode: BenchmarkMode,
  closes: readonly BenchmarkClose[],
): RunValueAt[] {
  return runs.map((run) => {
    const points = run.equityCurve;
    const point = atOrBefore(points, date);
    const start = points[0]?.equity;
    if (!point || start === undefined || start === 0) {
      return {
        id: run.id,
        name: run.name,
        date: null,
        value: null,
        returnSinceStart: null,
        benchmarkReturn: null,
        lead: null,
      };
    }
    const returnSinceStart = point.equity / start - 1;
    const benchmarkReturn = benchmarkReturnFor(points, point, mode, closes);
    return {
      id: run.id,
      name: run.name,
      date: point.date,
      value: point.equity,
      returnSinceStart,
      benchmarkReturn,
      lead: benchmarkReturn === null ? null : returnSinceStart - benchmarkReturn,
    };
  });
}
