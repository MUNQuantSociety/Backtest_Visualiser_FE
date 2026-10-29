import { describe, expect, it } from 'vitest';

import { futureValue, presentValue, type Calculation } from './finance';

/**
 * Expected values come from MQSMaster's own formula library
 * (`scripts/CFA/src/tvm.py` on its dev branch), run on the
 * same inputs, so this calculator and that one agree to the cent and beyond.
 */
function value(result: Calculation): number {
  if (!result.ok) throw new Error(result.problem);
  return result.value;
}

describe('futureValue', () => {
  it('compounds yearly, as TimeValueOfMoney.future_value does', () => {
    expect(value(futureValue(1000, 0.05, 10))).toBeCloseTo(1628.894626777442, 9);
  });

  it('allows a fraction of a year and a negative rate above -100%', () => {
    expect(value(futureValue(1000, 0.1, 0.5))).toBeCloseTo(1000 * 1.1 ** 0.5, 9);
    expect(value(futureValue(1000, -0.5, 1))).toBe(500);
  });
});

describe('presentValue', () => {
  it('discounts yearly, as TimeValueOfMoney.present_value does', () => {
    expect(value(presentValue(1000, 0.05, 10))).toBeCloseTo(613.9132535407591, 9);
  });
});

describe('inputs that have no answer', () => {
  it.each([
    ['an empty amount', futureValue(Number.NaN, 0.05, 10), 'Enter the amount invested today.'],
    ['a rate of -100%', presentValue(1000, -1, 10), 'The rate must be above -100%.'],
    ['an empty rate', futureValue(1000, Number.NaN, 10), 'Enter an interest rate.'],
    ['zero years', futureValue(1000, 0.05, 0), 'The number of years must be more than 0.'],
    ['an overflow', futureValue(1e300, 10, 1000), 'The result is too large to show.'],
  ])('says so for %s', (_case, result, problem) => {
    expect(result).toEqual({ ok: false, problem });
  });
});
