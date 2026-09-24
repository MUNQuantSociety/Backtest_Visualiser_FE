import { describe, expect, it } from 'vitest';

import { runUniverse } from './run-universe';

describe('runUniverse', () => {
  it('returns the recorded universe', () => {
    expect(runUniverse({ parameters: { universe: ['AAPL', 'MSFT'] }, symbol: 'MULTI' })).toEqual([
      'AAPL',
      'MSFT',
    ]);
  });

  it('normalises recorded tickers', () => {
    expect(runUniverse({ parameters: { universe: [' aapl '] }, symbol: 'MULTI' })).toEqual([
      'AAPL',
    ]);
  });

  it('skips entries that are not tickers', () => {
    expect(
      runUniverse({ parameters: { universe: ['AAPL', 7, '', null] }, symbol: 'MULTI' }),
    ).toEqual(['AAPL']);
  });

  it('falls back to the symbol of a single-ticker run', () => {
    expect(runUniverse({ parameters: {}, symbol: 'nvda' })).toEqual(['NVDA']);
  });

  it('knows no tickers for a multi-ticker run without a recorded universe', () => {
    expect(runUniverse({ parameters: { universe: [] }, symbol: 'MULTI' })).toEqual([]);
  });
});
