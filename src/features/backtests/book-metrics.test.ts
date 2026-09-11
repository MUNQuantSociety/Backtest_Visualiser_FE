import { describe, expect, it } from 'vitest';

import { formatNumber } from '@/utils/format';

import { alphaRows, summariseBook } from './book';

describe('flat backtest dashboard metrics', () => {
  it('displays unavailable Sharpe for both the book and strategy alpha row', () => {
    const equityCurve = Array.from({ length: 253 }, (_, index) => ({
      date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
      equity: 100_000,
    }));
    const strategies = [
      { id: 'strategy-1', name: 'Flat', shortName: 'Flat', universe: ['AAPL'], colorIndex: 0 },
    ];
    const runs = new Map([['strategy-1', { id: 'run-1', symbol: 'AAPL', equityCurve }]]);
    const rows = alphaRows(strategies, runs, 'max');
    const summary = summariseBook(equityCurve, [], rows, 0, strategies, []);

    expect(summary.sharpe).toBeNaN();
    expect(rows[0]!.sharpe).toBeNaN();
    expect(formatNumber(summary.sharpe)).toBe('—');
    expect(formatNumber(rows[0]!.sharpe)).toBe('—');
    expect(rows[0]!.sparkline.every((value) => value === null)).toBe(true);
    expect(summary.maxDrawdown).toBe(0);
  });

  it('keeps valid numeric displays unchanged', () => {
    expect(formatNumber(0)).toBe('0.00');
    expect(formatNumber(1.234)).toBe('1.23');
    expect(formatNumber(-1.234)).toBe('-1.23');
  });
});
