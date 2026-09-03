import { describe, expect, it } from 'vitest';

import type { TickerIndicators } from '@/features/market';

import {
  bookSentiment,
  currentDrawdown,
  fillsToday,
  heldRows,
  mtdReturn,
  periodDays,
  returnSince,
  type BookPosition,
} from './live-book';
import type { Execution, PortfolioSummary } from './types';

const series = [
  { date: '2026-08-28', equity: 100 },
  { date: '2026-08-31', equity: 110 },
  { date: '2026-09-01', equity: 99 },
  { date: '2026-09-02', equity: 121 },
];

describe('periodDays', () => {
  it('counts calendar days since the turn of the year for YTD', () => {
    expect(periodDays('YTD', new Date('2026-03-01T12:00:00Z'))).toBe(60);
  });

  it('never asks for less than a week', () => {
    expect(periodDays('YTD', new Date('2026-01-02T00:00:00Z'))).toBe(7);
  });
});

describe('returnSince / mtdReturn', () => {
  it('measures from the last close at or before the date', () => {
    // Base is the 31 Aug close, not the 1 Sep one.
    expect(returnSince(series, '2026-08-31')).toBeCloseTo(0.1, 10);
  });

  it('falls back to the first point when the series starts later', () => {
    expect(returnSince(series, '2026-08-01')).toBeCloseTo(0.21, 10);
  });

  it('takes month to date from the previous month-end close', () => {
    expect(mtdReturn(series, new Date('2026-09-02T20:00:00Z'))).toBeCloseTo(0.1, 10);
  });
});

describe('currentDrawdown', () => {
  it('reports where the last close sits against the running peak', () => {
    const { drawdown, peakDate } = currentDrawdown(series.slice(0, 3));
    expect(drawdown).toBeCloseTo(-0.1, 10);
    expect(peakDate).toBe('2026-08-31');
  });
});

describe('fillsToday', () => {
  const sleeve = { id: '1', name: 'Vol' } as PortfolioSummary;
  const fill = (id: string, executedAt: string): Execution => ({
    id,
    ticker: 'AAPL',
    side: 'BUY',
    quantity: 1,
    price: 1,
    notional: 1,
    executedAt,
    algo: 'TWAP',
    parentOrderId: null,
    reason: null,
  });

  it('keeps only today, newest first, and falls back to the algo as the reason', () => {
    const now = new Date('2026-09-03T18:00:00Z');
    const rows = fillsToday(
      [
        {
          sleeve,
          items: [
            fill('old', '2026-09-02T15:00:00Z'),
            fill('a', '2026-09-03T14:00:00Z'),
            fill('b', '2026-09-03T15:30:00Z'),
          ],
        },
      ],
      now,
    );
    expect(rows.map((row) => row.id)).toEqual(['b', 'a']);
    expect(rows[0]?.reason).toBe('TWAP');
  });
});

describe('heldRows / bookSentiment', () => {
  const indicator = (ticker: string, sentiment7d: number): TickerIndicators => ({
    ticker,
    last: 100,
    rsi14: 50,
    macdHistogram: 0,
    smaRegime: 'above',
    momentum20d: 0,
    sentiment7d,
    sentimentDelta7d: 0,
    asOf: '2026-09-02',
  });
  const position = (ticker: string, weight: number): BookPosition => ({
    ticker,
    side: weight < 0 ? 'short' : 'long',
    quantity: 1,
    avgPrice: 1,
    lastPrice: 1,
    marketValue: 1,
    unrealizedPnl: 0,
    weight,
    sector: 'Technology',
    sleeve: 'Vol',
    sleeveId: '1',
  });

  it('puts the position sentiment argues against first', () => {
    const rows = heldRows(
      [
        indicator('AAPL', 0.4),
        indicator('MSFT', -0.5),
        indicator('XOM', 0.6),
        indicator('ZZZ', -1),
      ],
      [position('AAPL', 0.2), position('MSFT', 0.1), position('XOM', -0.1)],
    );
    // A short with positive news is as much of a worry as a long with negative news.
    expect(rows.map((row) => row.ticker)).toEqual(['XOM', 'MSFT', 'AAPL']);
  });

  it('weights the book score by |weight|', () => {
    const rows = heldRows(
      [indicator('AAPL', 1), indicator('XOM', -1)],
      [position('AAPL', 0.3), position('XOM', -0.1)],
    );
    expect(bookSentiment(rows)).toBeCloseTo(0.5, 10);
  });
});
