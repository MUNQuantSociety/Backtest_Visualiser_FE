import { describe, expect, it } from 'vitest';

import {
  annuityPresentValue,
  futureValue,
  netPresentValue,
  parseCashFlows,
  presentValue,
  type Calculation,
} from './finance';

/**
 * Expected values come from MQSMaster's own formula library
 * (`scripts/CFA/src/tvm.py` and `cashflows.py` on its dev branch), run on the
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

describe('netPresentValue', () => {
  it('discounts the first cash flow a year out, as npv_with_initial_outlay does', () => {
    expect(value(netPresentValue(1000, 0.1, [400, 500, 600]))).toBeCloseTo(227.64838467317782, 9);
    expect(value(netPresentValue(1000, 0.1, [300, 400, 500]))).toBeCloseTo(-21.0368144252443, 9);
  });

  it('accepts a year that costs money', () => {
    expect(value(netPresentValue(0, 0, [100, -50]))).toBe(50);
  });
});

describe('annuityPresentValue', () => {
  it('compounds with each payment, as present_value_annuity does', () => {
    expect(value(annuityPresentValue(500, 0.06, 5, 12))).toBeCloseTo(25862.780375565486, 6);
    expect(value(annuityPresentValue(1000, 0.08, 3, 1))).toBeCloseTo(2577.0969872478804, 9);
  });

  it('is the plain sum of the payments at 0%, where the formula would divide by zero', () => {
    expect(value(annuityPresentValue(500, 0, 5, 12))).toBe(30000);
  });
});

describe('inputs that have no answer', () => {
  it.each([
    ['an empty amount', futureValue(Number.NaN, 0.05, 10), 'Enter the amount invested today.'],
    ['a rate of -100%', presentValue(1000, -1, 10), 'The rate must be above -100%.'],
    ['an empty rate', futureValue(1000, Number.NaN, 10), 'Enter an interest rate.'],
    ['zero years', futureValue(1000, 0.05, 0), 'The number of years must be more than 0.'],
    ['no cash flows', netPresentValue(1000, 0.1, []), 'Enter at least one cash flow.'],
    [
      'a word for a cash flow',
      netPresentValue(1000, 0.1, [1, Number.NaN]),
      'Every cash flow must be a number.',
    ],
    [
      'a negative investment',
      netPresentValue(-5, 0.1, [1]),
      'Enter the initial investment as a positive amount.',
    ],
    ['no frequency', annuityPresentValue(500, 0.06, 5, 0), 'Choose how often the payment is made.'],
    ['an overflow', futureValue(1e300, 10, 1000), 'The result is too large to show.'],
  ])('says so for %s', (_case, result, problem) => {
    expect(result).toEqual({ ok: false, problem });
  });
});

describe('parseCashFlows', () => {
  it('reads commas, spaces, semicolons and new lines, and a leading $', () => {
    expect(parseCashFlows('400, 500;600\n$700  -50')).toEqual([400, 500, 600, 700, -50]);
    expect(parseCashFlows(' , ')).toEqual([]);
  });

  it('leaves something unreadable as NaN for the NPV to report', () => {
    expect(parseCashFlows('100, abc')).toEqual([100, Number.NaN]);
  });
});
