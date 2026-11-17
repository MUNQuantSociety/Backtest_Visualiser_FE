import { beforeEach, describe, expect, it } from 'vitest';

import {
  dateToLogical,
  fibPrices,
  loadDrawings,
  loadMagnet,
  logicalToDate,
  moveDrawing,
  rayEnd,
  saveDrawings,
  saveMagnet,
  snapToCandle,
} from './chart-drawings-model';

// Mon 2 Mar to Fri 6 Mar 2026, then Mon 9 Mar.
const DATES = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09'];

describe('fibPrices', () => {
  it('puts 0 at the end point and 1 at the start', () => {
    const levels = fibPrices(100, 200);
    expect(levels[0]).toEqual({ level: 0, price: 200 });
    expect(levels.at(-1)).toEqual({ level: 1, price: 100 });
    expect(levels.find((level) => level.level === 0.5)?.price).toBe(150);
    expect(levels.find((level) => level.level === 0.618)?.price).toBeCloseTo(138.2);
  });
});

describe('rayEnd', () => {
  it('extends a rising ray until it leaves the plot', () => {
    expect(rayEnd(0, 100, 10, 90, 200, 400)).toEqual({ x: 100, y: 0 });
  });

  it('stops where the ray leaves the top first', () => {
    expect(rayEnd(0, 100, 10, 50, 200, 400)).toEqual({ x: 20, y: 0 });
  });

  it('is never shorter than its own segment', () => {
    expect(rayEnd(0, 0, 300, 0, 200, 400)).toEqual({ x: 300, y: 0 });
  });

  it('returns the point for a ray of no length', () => {
    expect(rayEnd(5, 5, 5, 5, 200, 400)).toEqual({ x: 5, y: 5 });
  });
});

describe('dateToLogical and logicalToDate', () => {
  it('finds a session by its date', () => {
    expect(dateToLogical(DATES, '2026-03-04')).toBe(2);
    expect(logicalToDate(DATES, 2.4)).toBe('2026-03-04');
  });

  it('places a weekend on the next session', () => {
    expect(dateToLogical(DATES, '2026-03-07')).toBe(5);
  });

  it('places dates past either end by the calendar, five sessions a week', () => {
    expect(dateToLogical(DATES, '2026-03-16')).toBe(10);
    expect(dateToLogical(DATES, '2026-02-23')).toBe(-5);
    expect(logicalToDate(DATES, 10)).toBe('2026-03-16');
    expect(logicalToDate(DATES, -5)).toBe('2026-02-23');
  });

  it('counts weekdays across weekends and years either side', () => {
    // Fri 6 Mar plus one session is Mon 9 Mar; the last session here is Mon 9 Mar.
    expect(logicalToDate(DATES, 6)).toBe('2026-03-10');
    expect(logicalToDate(DATES, 9)).toBe('2026-03-13');
    expect(logicalToDate(DATES, 10)).toBe('2026-03-16');
    expect(dateToLogical(DATES, '2026-03-14')).toBe(9);
    expect(logicalToDate(DATES, -1)).toBe('2026-02-27');
    expect(dateToLogical(DATES, '2026-02-28')).toBe(0);
    for (const date of ['2021-06-15', '2024-02-29', '2027-01-04', '2026-02-27']) {
      const logical = dateToLogical(DATES, date);
      expect(logical === null ? null : logicalToDate(DATES, logical)).toBe(date);
    }
  });

  it('has nothing to place without sessions', () => {
    expect(dateToLogical([], '2026-03-04')).toBeNull();
    expect(logicalToDate([], 0)).toBeNull();
  });
});

describe('drawing storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps drawings per key', () => {
    const drawing = {
      id: 'a',
      tool: 'horizontal' as const,
      points: [{ date: '2026-03-02', price: 101.5 }],
    };
    saveDrawings('AAPL', [drawing]);
    expect(loadDrawings('AAPL')).toEqual([drawing]);
    expect(loadDrawings('MSFT')).toEqual([]);
    saveDrawings('AAPL', []);
    expect(localStorage.getItem('chart-drawings:AAPL')).toBeNull();
  });

  it('ignores stored data it cannot read', () => {
    localStorage.setItem('chart-drawings:AAPL', '{not json');
    expect(loadDrawings('AAPL')).toEqual([]);
    localStorage.setItem('chart-drawings:AAPL', JSON.stringify([{ id: 1 }]));
    expect(loadDrawings('AAPL')).toEqual([]);
  });
});

const CANDLES = DATES.map((date, index) => ({
  date,
  open: 100 + index,
  high: 110 + index,
  low: 90 + index,
  close: 105 + index,
}));

describe('snapToCandle', () => {
  it("moves a point onto the session's nearest open, high, low or close", () => {
    expect(snapToCandle(CANDLES, DATES, { date: '2026-03-02', price: 108 })).toEqual({
      date: '2026-03-02',
      price: 110,
    });
    expect(snapToCandle(CANDLES, DATES, { date: '2026-03-04', price: 50 })).toEqual({
      date: '2026-03-04',
      price: 92,
    });
  });

  it('leaves a point with no session where it is', () => {
    const future = { date: '2026-03-20', price: 108 };
    expect(snapToCandle(CANDLES, DATES, future)).toBe(future);
  });
});

describe('moveDrawing', () => {
  const trend = {
    id: 'a',
    tool: 'trend' as const,
    points: [
      { date: '2026-03-02', price: 100 },
      { date: '2026-03-04', price: 120 },
    ],
  };

  it('shifts every point by whole sessions and a price change', () => {
    expect(moveDrawing(trend, DATES, 2, 5).points).toEqual([
      { date: '2026-03-04', price: 105 },
      { date: '2026-03-06', price: 125 },
    ]);
  });

  it('can move a drawing past the last session', () => {
    expect(moveDrawing(trend, DATES, 5, 0).points[1]?.date).toBe('2026-03-11');
  });

  it('keeps a note and its text', () => {
    const note = {
      id: 'n',
      tool: 'text' as const,
      points: [{ date: '2026-03-02', price: 1 }],
      text: 'hi',
    };
    expect(moveDrawing(note, DATES, 1, 0)).toEqual({
      ...note,
      points: [{ date: '2026-03-03', price: 1 }],
    });
  });
});

describe('magnet storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('remembers the magnet, off by default', () => {
    expect(loadMagnet()).toBe(false);
    saveMagnet(true);
    expect(loadMagnet()).toBe(true);
    saveMagnet(false);
    expect(loadMagnet()).toBe(false);
  });

  it('keeps a text note', () => {
    const note = {
      id: 'n',
      tool: 'text' as const,
      points: [{ date: '2026-03-02', price: 1 }],
      text: 'hi',
    };
    saveDrawings('AAPL', [note]);
    expect(loadDrawings('AAPL')).toEqual([note]);
  });
});
