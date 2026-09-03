import { formatCompact, formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toReturns } from '@/utils/metrics';

import { regressOnBenchmark } from './book';
import type { BacktestDetail } from './types';

/**
 * The Compare page's numbers, as plain data.
 *
 * What changed between runs and what it bought: every row carries which
 * direction is better, so the page can colour A − B without a per-metric
 * special case in the JSX, and the parameter diff is computed once so the
 * chip summary, the parameters card and the breadcrumb all agree on which
 * key differs.
 */

/** Which direction wins the row. `neutral` rows never colour their delta. */
export type Better = 'high' | 'low' | 'neutral';

export interface CompareMetricRow {
  key: string;
  label: string;
  better: Better;
  /** One value per run, in the runs' order. */
  values: number[];
  format: (value: number) => string;
  /** For A − B: always signed, in the row's own units. */
  formatDelta: (delta: number) => string;
}

/** Share of sessions that closed up. */
export function positiveDays(detail: BacktestDetail): number {
  const returns = toReturns(detail.equityCurve.map((point) => point.equity));
  if (returns.length === 0) return 0;
  return returns.filter((value) => value > 0).length / returns.length;
}

export function compareMetricRows(runs: readonly BacktestDetail[]): CompareMetricRow[] {
  const regressions = runs.map((run) => regressOnBenchmark(run.equityCurve));
  const pct = (value: number) => formatSigned(value, (n) => formatPercent(n, 2));
  const num = (value: number) => formatNumber(value, 2);
  const dPct = (delta: number) => formatSigned(delta, (n) => formatPercent(n, 2));
  const dPct1 = (delta: number) => formatSigned(delta, (n) => formatPercent(n, 1));
  const dNum = (delta: number) => formatSigned(delta, (n) => formatNumber(n, 2));
  const dInt = (delta: number) => formatSigned(delta, (n) => formatNumber(n, 0));
  return [
    {
      key: 'totalReturn',
      label: 'Total return',
      better: 'high',
      values: runs.map((r) => r.metrics.totalReturn),
      format: pct,
      formatDelta: dPct,
    },
    {
      key: 'cagr',
      label: 'CAGR',
      better: 'high',
      values: runs.map((r) => r.metrics.cagr),
      format: pct,
      formatDelta: dPct,
    },
    {
      key: 'sharpe',
      label: 'Sharpe',
      better: 'high',
      values: runs.map((r) => r.metrics.sharpe),
      format: num,
      formatDelta: dNum,
    },
    {
      key: 'sortino',
      label: 'Sortino',
      better: 'high',
      values: runs.map((r) => r.metrics.sortino),
      format: num,
      formatDelta: dNum,
    },
    // Stored negative, so "closer to zero" is "higher" — no special case.
    {
      key: 'maxDrawdown',
      label: 'Max drawdown',
      better: 'high',
      values: runs.map((r) => r.metrics.maxDrawdown),
      format: (v) => formatPercent(v, 2),
      formatDelta: dPct,
    },
    {
      key: 'volatility',
      label: 'Volatility',
      better: 'low',
      values: runs.map((r) => r.metrics.volatility),
      format: (v) => formatPercent(v, 2),
      formatDelta: dPct,
    },
    {
      key: 'alpha',
      label: 'Alpha vs SPY',
      better: 'high',
      values: regressions.map((r) => r?.alpha ?? 0),
      format: pct,
      formatDelta: dPct,
    },
    {
      key: 'beta',
      label: 'Beta',
      better: 'neutral',
      values: regressions.map((r) => r?.beta ?? 0),
      format: num,
      formatDelta: dNum,
    },
    {
      key: 'positiveDays',
      label: 'Positive days',
      better: 'high',
      values: runs.map(positiveDays),
      format: (v) => formatPercent(v, 1),
      formatDelta: dPct1,
    },
    {
      key: 'trades',
      label: 'Trades',
      better: 'neutral',
      values: runs.map((r) => r.metrics.totalTrades),
      format: (v) => formatNumber(v, 0),
      formatDelta: dInt,
    },
  ];
}

/** Index of the winning value in a row, or null when it is a tie or neutral. */
export function winnerIndex(row: CompareMetricRow): number | null {
  if (row.better === 'neutral' || row.values.length < 2) return null;
  let best = 0;
  for (let i = 1; i < row.values.length; i += 1) {
    const current = row.values[i] ?? 0;
    const leader = row.values[best] ?? 0;
    if (row.better === 'high' ? current > leader : current < leader) best = i;
  }
  const leader = row.values[best] ?? 0;
  const tied = row.values.filter((value) => value === leader).length > 1;
  return tied ? null : best;
}

/** Whether A − B favours A, B, or neither, given the row's direction. */
export function deltaTone(row: CompareMetricRow): 'profit' | 'loss' | 'neutral' {
  if (row.better === 'neutral' || row.values.length < 2) return 'neutral';
  const delta = (row.values[0] ?? 0) - (row.values[1] ?? 0);
  if (delta === 0) return 'neutral';
  const aBetter = row.better === 'high' ? delta > 0 : delta < 0;
  return aBetter ? 'profit' : 'loss';
}

export interface ParameterRow {
  key: string;
  /** One rendered value per run, in the runs' order; "—" when absent. */
  values: string[];
  differs: boolean;
}

function renderParam(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'number') return formatNumber(value, Number.isInteger(value) ? 0 : 2);
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (Array.isArray(value)) return value.map((item: unknown) => renderParam(item)).join(' ');
  if (typeof value === 'object') return JSON.stringify(value);
  // Parameters come from JSON, so what is left is a string.
  return typeof value === 'string' ? value : '—';
}

/** Every parameter key across the runs, side by side, with the differing ones flagged. */
export function parameterRows(runs: readonly BacktestDetail[]): ParameterRow[] {
  const keys = [...new Set(runs.flatMap((run) => Object.keys(run.parameters)))].sort();
  return keys.map((key) => {
    const values = runs.map((run) => renderParam(run.parameters[key]));
    return { key, values, differs: new Set(values).size > 1 };
  });
}

/** Short parameter tags for a chip: `lb 20 · z 1.5 / 0.4`. */
function paramSummary(run: BacktestDetail): string {
  const p = run.parameters;
  const parts: string[] = [];
  if (typeof p['lookback'] === 'number') parts.push(`lb ${String(p['lookback'])}`);
  if (typeof p['entryZ'] === 'number' && typeof p['exitZ'] === 'number') {
    parts.push(`z ${String(p['entryZ'])} / ${String(p['exitZ'])}`);
  }
  return parts.join(' · ');
}

export interface ChipPart {
  text: string;
  /** The part carries a parameter that differs between the runs. */
  highlight: boolean;
}

/** Which parameter keys each short tag stands for, so the tag can be lit. */
const TAG_KEYS: Record<string, readonly string[]> = {
  lb: ['lookback'],
  z: ['entryZ', 'exitZ'],
};

/**
 * The mono one-liner under a run's name in its chip, as parts. A part is
 * highlighted when the parameter it shows is one that differs across the
 * comparison — the reader's eye goes straight to what changed.
 */
export function chipParts(run: BacktestDetail, differingKeys: readonly string[] = []): ChipPart[] {
  const p = run.parameters;
  const plain = (text: string): ChipPart => ({ text, highlight: false });
  const parts: ChipPart[] = [plain(`${run.startDate} → ${run.endDate}`), plain(run.timeframe)];
  for (const tag of paramSummary(run).split(' · ').filter(Boolean)) {
    const keys = TAG_KEYS[tag.split(' ')[0] ?? ''] ?? [];
    parts.push({ text: tag, highlight: keys.some((key) => differingKeys.includes(key)) });
  }
  parts.push(plain(`$${formatCompact(run.initialCapital)}`));
  if (typeof p['slippageBps'] === 'number') {
    parts.push({
      text: `${String(p['slippageBps'])} bps`,
      highlight: differingKeys.includes('slippageBps'),
    });
  }
  return parts;
}

/** The chip summary as one string. */
export function chipSummary(run: BacktestDetail): string {
  return chipParts(run)
    .map((part) => part.text)
    .join(' · ');
}

export interface CompareContext {
  sameStrategy: boolean;
  sameWindow: boolean;
  sameUniverse: boolean;
  /** Keys whose values differ across the runs. */
  differingKeys: string[];
  strategyName: string | null;
}

export function compareContext(runs: readonly BacktestDetail[]): CompareContext {
  const same = <T>(pick: (run: BacktestDetail) => T) => new Set(runs.map(pick)).size <= 1;
  return {
    sameStrategy: same((run) => run.strategyId),
    sameWindow: same((run) => `${run.startDate}/${run.endDate}`),
    sameUniverse: same((run) => run.symbol),
    differingKeys: parameterRows(runs)
      .filter((row) => row.differs)
      .map((row) => row.key),
    strategyName: runs[0]?.strategyName ?? null,
  };
}

/** The header's one-line explanation of what the comparison isolates. */
export function describeComparison(context: CompareContext, count: number): string {
  if (count < 2) return 'Pick two to four runs and every gap between them is explained below.';
  const { sameStrategy, sameWindow, sameUniverse, differingKeys } = context;
  if (sameStrategy && sameWindow && sameUniverse) {
    if (differingKeys.length === 1) {
      return 'Same strategy, same window, same universe. One parameter differs — so every gap below is the cost or benefit of that parameter.';
    }
    if (differingKeys.length === 0) {
      return 'Same strategy, window, universe and parameters: any gap below is noise in the engine, and worth knowing about.';
    }
    return `Same strategy, same window, same universe. ${String(differingKeys.length)} parameters differ.`;
  }
  const differences = [
    !sameStrategy && 'strategy',
    !sameWindow && 'window',
    !sameUniverse && 'universe',
  ].filter(Boolean);
  return `Runs differ in ${differences.join(' and ')}, so gaps below are not down to one parameter.`;
}
