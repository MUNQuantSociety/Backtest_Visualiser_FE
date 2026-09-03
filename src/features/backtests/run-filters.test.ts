import { describe, expect, it } from 'vitest';

import { monthSpan, viewRuns } from './run-filters';
import type { BacktestSummary } from './types';

function run(overrides: Partial<BacktestSummary>): BacktestSummary {
  return {
    id: 'r',
    name: 'Run',
    strategyId: 's',
    strategyName: 'S',
    symbol: 'SPY',
    timeframe: '1d',
    status: 'completed',
    startDate: '2023-01-03',
    endDate: '2023-12-18',
    createdAt: '2024-01-01T00:00:00Z',
    initialCapital: 1,
    finalEquity: 1,
    totalReturn: 0,
    sharpe: 0,
    maxDrawdown: 0,
    ...overrides,
  };
}

const RUNS = [
  run({
    id: 'a',
    name: 'Alpha',
    createdAt: '2024-01-03T00:00:00Z',
    sharpe: 1.2,
    totalReturn: 0.1,
    maxDrawdown: -0.2,
  }),
  run({
    id: 'b',
    name: 'Bravo',
    createdAt: '2024-01-01T00:00:00Z',
    sharpe: 1.8,
    totalReturn: 0.3,
    maxDrawdown: -0.05,
    status: 'running',
  }),
  run({
    id: 'c',
    name: 'Charlie',
    createdAt: '2024-01-02T00:00:00Z',
    sharpe: 0.4,
    totalReturn: -0.1,
    maxDrawdown: -0.4,
    symbol: 'QQQ',
  }),
];

const base = { status: 'any', search: '', sort: 'newest', pageSize: 25 } as const;

describe('viewRuns', () => {
  it('orders newest first by default', () => {
    expect(viewRuns(RUNS, base).rows.map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by Sharpe and return descending, and drawdown shallowest first', () => {
    expect(viewRuns(RUNS, { ...base, sort: 'sharpe' }).rows.map((r) => r.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(viewRuns(RUNS, { ...base, sort: 'return' }).rows.map((r) => r.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(viewRuns(RUNS, { ...base, sort: 'maxDrawdown' }).rows.map((r) => r.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('filters by status and by name or symbol, reporting the matched total', () => {
    expect(viewRuns(RUNS, { ...base, status: 'running' }).rows.map((r) => r.id)).toEqual(['b']);
    const view = viewRuns(RUNS, { ...base, search: 'qqq' });
    expect(view.rows.map((r) => r.id)).toEqual(['c']);
    expect(view.total).toBe(1);
  });

  it('pages without losing the total, and never mutates its input', () => {
    const view = viewRuns(RUNS, { ...base, sort: 'sharpe', pageSize: 25 });
    expect(view.total).toBe(3);
    expect(RUNS.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('monthSpan', () => {
  it('reduces a window to month precision', () => {
    expect(monthSpan('2023-01-03', '2024-12-31')).toBe('2023-01 → 2024-12');
  });
});
