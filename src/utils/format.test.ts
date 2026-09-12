import { describe, expect, it } from 'vitest';

import { formatNumber } from './format';

describe('formatNumber', () => {
  it('keeps ordinary metrics and requested precision readable', () => {
    expect(formatNumber(1234.5)).toBe('1,234.50');
    expect(formatNumber(-0.1234, 3)).toBe('-0.123');
    expect(formatNumber(12, 0)).toBe('12');
  });

  it('bounds extreme labels without losing their sign or magnitude', () => {
    expect(formatNumber(-30_925_827_418_115_776)).toBe('-3.09E16');
    expect(formatNumber(Number.MAX_VALUE)).toBe('1.8E308');
    expect(formatNumber(-Number.MAX_VALUE)).toBe('-1.8E308');
  });

  it('preserves unavailable and infinite metric displays', () => {
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('∞');
    expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe('-∞');
  });
});
