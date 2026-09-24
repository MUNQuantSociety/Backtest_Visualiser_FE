import { describe, expect, it } from 'vitest';

import { mergeRunRows } from './pending-runs';
import type { BacktestSummary } from './types';

function row(id: string, status: BacktestSummary['status']): BacktestSummary {
  return {
    id,
    name: id,
    strategyId: 'strategy-1',
    strategyName: 'Momentum',
    symbol: 'AAPL',
    timeframe: '1d',
    status,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    createdAt: '2026-01-01T00:00:00Z',
    initialCapital: 100_000,
    finalEquity: 100_000,
    totalReturn: 0,
    sharpe: 0,
    maxDrawdown: 0,
  };
}

describe('mergeRunRows', () => {
  it('puts runs the server does not list yet ahead of the listed ones', () => {
    const merged = mergeRunRows([row('saved', 'completed')], [row('new', 'running')]);

    expect(merged.map((run) => run.id)).toEqual(['new', 'saved']);
  });

  it('shows the saved row when both sides hold the same run', () => {
    const saved = row('run-1', 'completed');

    const merged = mergeRunRows([saved], [row('run-1', 'running')]);

    expect(merged).toEqual([saved]);
  });

  it('returns the server rows unchanged when nothing is pending', () => {
    const server = [row('a', 'completed'), row('b', 'completed')];

    expect(mergeRunRows(server, [])).toEqual(server);
  });

  it('returns only the pending rows when the server lists nothing', () => {
    const pending = [row('new', 'queued')];

    expect(mergeRunRows([], pending)).toEqual(pending);
  });
});
