import { describe, expect, it } from 'vitest';

import { closestTreasury, describeTerm } from './treasury';

const YIELDS = [
  { term: '3M', years: 0.25, ratePercent: 4.18 },
  { term: '1Y', years: 1, ratePercent: 4.47 },
  { term: '5Y', years: 5, ratePercent: 4.85 },
  { term: '10Y', years: 10, ratePercent: 5.05 },
  { term: '30Y', years: 30, ratePercent: 5.37 },
];

describe('closestTreasury', () => {
  it('picks the maturity nearest the horizon', () => {
    expect(closestTreasury(YIELDS, 10)?.term).toBe('10Y');
    expect(closestTreasury(YIELDS, 4)?.term).toBe('5Y');
    expect(closestTreasury(YIELDS, 0.5)?.term).toBe('3M');
    expect(closestTreasury(YIELDS, 50)?.term).toBe('30Y');
  });

  it('breaks a tie toward the shorter maturity', () => {
    expect(closestTreasury(YIELDS, 7.5)?.term).toBe('5Y');
  });

  it('has nothing to offer without a curve or a horizon', () => {
    expect(closestTreasury([], 10)).toBeNull();
    expect(closestTreasury(YIELDS, Number.NaN)).toBeNull();
    expect(closestTreasury(YIELDS, 0)).toBeNull();
  });
});

it('describes a term in words', () => {
  expect(describeTerm('10Y')).toBe('10-year');
  expect(describeTerm('3M')).toBe('3-month');
  expect(describeTerm('odd')).toBe('odd');
});
