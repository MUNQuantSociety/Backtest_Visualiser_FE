import { describe, expect, it } from 'vitest';

import { equalWeightPercents, parseWeightPercents, weightTotalPercent } from './run-weights';

describe('equalWeightPercents', () => {
  it('is empty for an empty universe', () => {
    expect(equalWeightPercents([])).toEqual({});
  });

  it('gives a lone ticker the whole book', () => {
    expect(equalWeightPercents(['AAPL'])).toEqual({ AAPL: '100' });
  });

  it('splits evenly when it divides cleanly', () => {
    expect(equalWeightPercents(['AAPL', 'MSFT', 'NVDA', 'TSLA'])).toEqual({
      AAPL: '25',
      MSFT: '25',
      NVDA: '25',
      TSLA: '25',
    });
  });

  it('puts the rounding remainder on the last ticker so the split adds up to 100', () => {
    const split = equalWeightPercents(['AAPL', 'MSFT', 'NVDA']);

    expect(split).toEqual({ AAPL: '33.33', MSFT: '33.33', NVDA: '33.34' });
    expect(weightTotalPercent(split, ['AAPL', 'MSFT', 'NVDA'])).toBeCloseTo(100, 10);
  });
});

describe('weightTotalPercent', () => {
  it('adds only the universe’s tickers, counting blanks as zero', () => {
    expect(weightTotalPercent({ AAPL: '40', MSFT: '', OLD: '50' }, ['AAPL', 'MSFT'])).toBe(40);
  });

  it('is NaN when a value is not a number', () => {
    expect(weightTotalPercent({ AAPL: 'abc' }, ['AAPL'])).toBeNaN();
  });
});

describe('parseWeightPercents', () => {
  it('turns percentages into fractions, in universe order', () => {
    expect(parseWeightPercents({ MSFT: '30', AAPL: '60' }, ['AAPL', 'MSFT'])).toEqual({
      ok: true,
      weights: { AAPL: 0.6, MSFT: 0.3 },
    });
  });

  it('accepts exactly 100%', () => {
    const result = parseWeightPercents({ AAPL: '33.33', MSFT: '33.33', NVDA: '33.34' }, [
      'AAPL',
      'MSFT',
      'NVDA',
    ]);

    expect(result.ok).toBe(true);
  });

  it('treats a blank or missing ticker as 0%', () => {
    expect(parseWeightPercents({ AAPL: '50', MSFT: '' }, ['AAPL', 'MSFT', 'NVDA'])).toEqual({
      ok: true,
      weights: { AAPL: 0.5, MSFT: 0, NVDA: 0 },
    });
  });

  it('ignores tickers no longer in the universe', () => {
    expect(parseWeightPercents({ AAPL: '50', GONE: '80' }, ['AAPL'])).toEqual({
      ok: true,
      weights: { AAPL: 0.5 },
    });
  });

  it('refuses more than 100% in total', () => {
    expect(parseWeightPercents({ AAPL: '60', MSFT: '50' }, ['AAPL', 'MSFT'])).toEqual({
      ok: false,
      message: 'Weights add up to 110%; they can add up to 100% at most.',
    });
  });

  it('refuses nothing allocated', () => {
    expect(parseWeightPercents({ AAPL: '0', MSFT: '' }, ['AAPL', 'MSFT'])).toEqual({
      ok: false,
      message: 'Give at least one ticker a weight above 0%.',
    });
  });

  it.each([
    ['-5', 'AAPL weight must be between 0% and 100%.'],
    ['101', 'AAPL weight must be between 0% and 100%.'],
    ['abc', 'AAPL weight must be a number.'],
  ])('refuses %j for a ticker', (value, message) => {
    expect(parseWeightPercents({ AAPL: value }, ['AAPL'])).toEqual({ ok: false, message });
  });
});
