import { describe, expect, it } from 'vitest';

import {
  averageLoss,
  averageWin,
  cagr,
  correlation,
  histogram,
  maxDrawdown,
  payoffRatio,
  profitFactor,
  sharpeRatio,
  stdDev,
  toReturns,
  winRate,
} from './metrics';

describe('toReturns', () => {
  it('converts an equity curve to period returns', () => {
    const returns = toReturns([100, 110, 99]);
    expect(returns).toHaveLength(2);
    // Never compare floats exactly — 110/100-1 is 0.10000000000000009.
    expect(returns[0]).toBeCloseTo(0.1, 10);
    expect(returns[1]).toBeCloseTo(-0.1, 10);
  });

  it('returns an empty array for a curve too short to have a return', () => {
    expect(toReturns([100])).toEqual([]);
    expect(toReturns([])).toEqual([]);
  });

  it('skips periods that would divide by zero', () => {
    expect(toReturns([0, 100])).toEqual([]);
  });
});

describe('stdDev', () => {
  it('uses the sample (n-1) denominator', () => {
    // Population sd of [2,4,4,4,5,5,7,9] is 2; the sample sd is larger.
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.1381, 4);
  });

  it('is zero when there is not enough data', () => {
    expect(stdDev([5])).toBe(0);
  });
});

describe('sharpeRatio', () => {
  it('is zero when volatility is zero', () => {
    expect(sharpeRatio([0.01, 0.01, 0.01])).toBe(0);
  });

  it('is positive for a series that outperforms the risk-free rate', () => {
    expect(sharpeRatio([0.01, 0.02, 0.015, 0.005])).toBeGreaterThan(0);
  });
});

describe('maxDrawdown', () => {
  it('measures the worst peak-to-trough decline', () => {
    expect(maxDrawdown([100, 120, 90, 130])).toBeCloseTo(-0.25, 10);
  });

  it('is zero for a monotonically rising curve', () => {
    expect(maxDrawdown([100, 105, 110])).toBe(0);
  });
});

describe('cagr', () => {
  it('annualises growth over the number of periods', () => {
    // Doubling over exactly one year of trading days.
    const equity = Array.from({ length: 253 }, (_, i) => 100 * 2 ** (i / 252));
    expect(cagr(equity)).toBeCloseTo(1, 6);
  });
});

describe('winRate / profitFactor', () => {
  it('computes the share of winning trades', () => {
    expect(winRate([10, -5, 20, -2])).toBe(0.5);
  });

  it('divides gross profit by gross loss', () => {
    expect(profitFactor([10, -5, 20, -5])).toBe(3);
  });

  it('is Infinity when nothing lost money', () => {
    expect(profitFactor([10, 20])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('histogram', () => {
  it('never puts winners and losers in the same bin', () => {
    const bins = histogram([-10, -5, -1, 1, 5, 10], 4);
    // Every bin must sit wholly on one side of zero, or its colour is a lie.
    for (const bin of bins) {
      expect(bin.from >= 0 || bin.to <= 0).toBe(true);
    }
  });

  it('counts every non-zero value exactly once', () => {
    const values = [-10, -5, -1, 1, 5, 10, 10];
    const total = histogram(values, 5).reduce((sum, bin) => sum + bin.count, 0);
    expect(total).toBe(values.length);
  });

  it('includes the maximum value rather than dropping it off the top edge', () => {
    const bins = histogram([1, 10], 3);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(2);
  });

  it('excludes break-even trades from the counts', () => {
    expect(histogram([0, 0, 0]).length).toBe(0);
    expect(histogram([-1, 0, 1], 2).reduce((sum, bin) => sum + bin.count, 0)).toBe(2);
  });

  it('returns only one side when every trade went the same way', () => {
    const bins = histogram([1, 2, 3], 3);
    expect(bins.every((bin) => bin.from >= 0)).toBe(true);
  });

  it('is empty for no values', () => {
    expect(histogram([])).toEqual([]);
  });
});

describe('averageWin / averageLoss / payoffRatio', () => {
  it('averages each side independently', () => {
    expect(averageWin([10, 20, -5, -15])).toBe(15);
    expect(averageLoss([10, 20, -5, -15])).toBe(-10);
  });

  it('ignores break-even trades on both sides', () => {
    expect(averageWin([10, 0, 20])).toBe(15);
    expect(averageLoss([-10, 0, -20])).toBe(-15);
  });

  it('divides average win by the magnitude of average loss', () => {
    expect(payoffRatio([10, 20, -5, -15])).toBe(1.5);
  });

  it('separates payoff ratio from profit factor', () => {
    // One big winner against three small losers: the payoff ratio is excellent
    // while the profit factor is barely above 1. A tearsheet showing only one
    // of these would flatter the strategy.
    const pnls = [90, -20, -20, -20];
    expect(payoffRatio(pnls)).toBeCloseTo(4.5, 10);
    expect(profitFactor(pnls)).toBeCloseTo(1.5, 10);
  });

  it('is Infinity when nothing lost money, and 0 with no trades', () => {
    expect(payoffRatio([10, 20])).toBe(Number.POSITIVE_INFINITY);
    expect(payoffRatio([])).toBe(0);
  });
});

describe('correlation', () => {
  it('is 1 for a series against itself and -1 against its negation', () => {
    const xs = [1, 2, 4, 3, 5];
    expect(correlation(xs, xs)).toBeCloseTo(1, 10);
    expect(
      correlation(
        xs,
        xs.map((x) => -x),
      ),
    ).toBeCloseTo(-1, 10);
  });

  it('is 0 when either side is flat rather than NaN', () => {
    expect(correlation([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it('uses only the overlapping length', () => {
    expect(correlation([1, 2, 3, 100], [1, 2, 3])).toBeCloseTo(1, 10);
  });
});
