import { describe, expect, it } from 'vitest';

import {
  displayOrder,
  groupQuotes,
  periodChange,
  periodWindow,
  resolveSelection,
  stepSelection,
} from './screener-model';
import type { Quote, QuoteKind } from './types';

function quote(ticker: string, kind: QuoteKind = 'stock'): Quote {
  return {
    ticker,
    name: null,
    exchange: null,
    kind,
    price: 100,
    change: null,
    changeRatio: null,
    open: null,
    previousClose: null,
    dayHigh: null,
    dayLow: null,
    yearHigh: null,
    yearLow: null,
    volume: null,
    marketCap: null,
    average50: null,
    average200: null,
    asOf: null,
  };
}

function candle(close: number) {
  return { date: '2026-10-01', open: close, high: close, low: close, close, volume: 1 };
}

describe('periodWindow', () => {
  it('counts calendar days back from today, both ends inclusive', () => {
    const today = new Date(Date.UTC(2026, 9, 25));
    expect(periodWindow('7D', today)).toEqual({ start: '2026-10-18', end: '2026-10-25' });
    expect(periodWindow('30D', today)).toEqual({ start: '2026-09-25', end: '2026-10-25' });
    expect(periodWindow('90D', today)).toEqual({ start: '2026-07-27', end: '2026-10-25' });
    expect(periodWindow('1Y', today)).toEqual({ start: '2025-10-25', end: '2026-10-25' });
  });
});

describe('groupQuotes', () => {
  it('orders Stocks, ETFs, Indices, Crypto and keeps the watchlist order inside each', () => {
    const groups = groupQuotes([
      quote('SPY', 'etf'),
      quote('NVDA'),
      quote('BTCUSD', 'crypto'),
      quote('^VIX', 'index'),
      quote('AAPL'),
      quote('QQQ', 'etf'),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['Stocks', 'ETFs', 'Indices', 'Crypto']);
    expect(groups.map((group) => group.quotes.map((row) => row.ticker))).toEqual([
      ['NVDA', 'AAPL'],
      ['SPY', 'QQQ'],
      ['^VIX'],
      ['BTCUSD'],
    ]);
    expect(displayOrder(groups)).toEqual(['NVDA', 'AAPL', 'SPY', 'QQQ', '^VIX', 'BTCUSD']);
  });

  it('leaves out a group with nothing in it', () => {
    expect(groupQuotes([quote('AAPL')]).map((group) => group.kind)).toEqual(['stock']);
    expect(groupQuotes([])).toEqual([]);
  });
});

describe('selection', () => {
  const order = ['NVDA', 'AAPL', 'SPY'];

  it('keeps a listed ticker and otherwise falls back to the first row', () => {
    expect(resolveSelection(order, 'AAPL')).toBe('AAPL');
    expect(resolveSelection(order, 'TSLA')).toBe('NVDA');
    expect(resolveSelection(order, null)).toBe('NVDA');
    expect(resolveSelection([], 'AAPL')).toBeNull();
  });

  it('moves one row and stops at either end', () => {
    expect(stepSelection(order, 'NVDA', 1)).toBe('AAPL');
    expect(stepSelection(order, 'AAPL', -1)).toBe('NVDA');
    expect(stepSelection(order, 'SPY', 1)).toBe('SPY');
    expect(stepSelection(order, 'NVDA', -1)).toBe('NVDA');
    expect(stepSelection(order, null, 1)).toBe('NVDA');
    expect(stepSelection([], 'NVDA', 1)).toBeNull();
  });
});

describe('periodChange', () => {
  it('is the first close to the last as a ratio', () => {
    expect(periodChange([candle(100), candle(90), candle(110)])).toBeCloseTo(0.1);
  });

  it('is null without two sessions or with a zero base', () => {
    expect(periodChange([candle(100)])).toBeNull();
    expect(periodChange([])).toBeNull();
    expect(periodChange([candle(0), candle(5)])).toBeNull();
  });
});
