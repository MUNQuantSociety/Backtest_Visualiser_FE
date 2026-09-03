import { describe, expect, it } from 'vitest';

import {
  coverageSegments,
  coverageYearTicks,
  latestFirstBar,
  matchingPreset,
  presetWindow,
  sessionsIn,
  tickerCoverageState,
} from './run-window';

const COVERAGE = { start: '2019-03-14', end: '2025-07-18' };

describe('presetWindow', () => {
  it('measures a year back from the end of coverage', () => {
    expect(presetWindow('1y', COVERAGE)).toEqual({
      startDate: '2024-07-18',
      endDate: '2025-07-18',
    });
  });

  it('floors a preset that reaches before the data at the start of coverage', () => {
    // Five years back from 2025-07-18 is 2020-07-18 — inside coverage — but
    // from a short dataset it is not, and the answer is "as much as you have".
    expect(presetWindow('5y', { start: '2023-01-03', end: '2025-07-18' })).toEqual({
      startDate: '2023-01-03',
      endDate: '2025-07-18',
    });
  });

  it('clamps the calendar-year preset to coverage', () => {
    expect(presetWindow('2022', COVERAGE)).toEqual({
      startDate: '2022-01-01',
      endDate: '2022-12-31',
    });
    expect(presetWindow('2022', { start: '2022-06-01', end: '2025-07-18' })).toEqual({
      startDate: '2022-06-01',
      endDate: '2022-12-31',
    });
  });

  it('round-trips through matchingPreset', () => {
    expect(matchingPreset(presetWindow('2y', COVERAGE), COVERAGE)).toBe('2y');
    expect(matchingPreset({ startDate: '2021-02-03', endDate: '2025-07-18' }, COVERAGE)).toBeNull();
  });
});

describe('sessionsIn', () => {
  it('converts calendar days to trading sessions at 252 per year', () => {
    expect(sessionsIn('2024-07-18', '2025-07-18')).toBe(252);
    expect(sessionsIn('2025-07-18', '2025-07-18')).toBe(0);
  });
});

describe('coverageSegments', () => {
  const coverage = {
    tickers: [
      { ticker: 'AAPL', firstBar: '2019-03-14', lastBar: '2025-07-18' },
      { ticker: 'NVDA', firstBar: '2021-01-01', lastBar: '2025-07-18' },
    ],
    start: '2019-03-14',
    end: '2025-07-18',
    missing: [],
  };

  it('hatches the stretch where a ticker has no bars, and paints the window', () => {
    const segments = coverageSegments(coverage, { startDate: '2023-01-03', endDate: '2025-07-18' });
    const gap = segments.find((s) => s.kind === 'gap');
    const selected = segments.find((s) => s.kind === 'selected');
    expect(gap?.ticker).toBe('NVDA');
    expect(gap?.from).toBe(0);
    expect(gap?.to).toBeGreaterThan(0.25);
    expect(selected?.to).toBe(1);
    expect(selected?.from).toBeGreaterThan(gap?.to ?? 0);
  });

  it('is empty without a coverage span', () => {
    expect(coverageSegments({ ...coverage, start: null, end: null }, null)).toEqual([]);
  });
});

describe('coverageYearTicks', () => {
  it('labels both ends and each whole year between', () => {
    const labels = coverageYearTicks({ start: '2023-01-03', end: '2025-07-18' }).map(
      (t) => t.label,
    );
    expect(labels).toEqual(['2023-01', '2024', '2025', '2025-07']);
  });
});

describe('tickerCoverageState / latestFirstBar', () => {
  const coverage = {
    tickers: [
      { ticker: 'AAPL', firstBar: '2019-03-14', lastBar: '2025-07-18' },
      { ticker: 'NVDA', firstBar: '2021-01-01', lastBar: '2025-07-18' },
    ],
    start: '2019-03-14',
    end: '2025-07-18',
    missing: ['NOPE'],
  };
  const window = { startDate: '2020-01-01', endDate: '2025-07-18' };

  it('grades each ticker against the chosen window', () => {
    expect(tickerCoverageState('AAPL', coverage, window)).toBe('full');
    expect(tickerCoverageState('NVDA', coverage, window)).toBe('partial');
    expect(tickerCoverageState('NOPE', coverage, window)).toBe('missing');
    expect(tickerCoverageState('TSLA', coverage, window)).toBe('unknown');
    expect(tickerCoverageState('AAPL', undefined, window)).toBe('unknown');
  });

  it('names the ticker that clamps the window', () => {
    expect(latestFirstBar(coverage)).toEqual({ ticker: 'NVDA', firstBar: '2021-01-01' });
    expect(latestFirstBar({ ...coverage, tickers: [coverage.tickers[0]!] })).toBeNull();
  });
});
