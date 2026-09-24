import { describe, expect, it } from 'vitest';

import { dashboardNewsWindow } from './dashboard-news-window';

const runs = [
  { startDate: '2025-09-11', endDate: '2026-09-11' },
  { startDate: '2023-01-03', endDate: '2026-06-30' },
];

describe('dashboardNewsWindow', () => {
  it('ends on the latest run end date', () => {
    expect(dashboardNewsWindow(runs, '1y')?.end).toBe('2026-09-11');
  });

  it('reaches back one year for the 1Y period', () => {
    expect(dashboardNewsWindow(runs, '1y')).toEqual({ start: '2025-09-11', end: '2026-09-11' });
  });

  it('never starts before the earliest run began', () => {
    expect(dashboardNewsWindow(runs, '5y')).toEqual({ start: '2023-01-03', end: '2026-09-11' });
  });

  it('spans every run for the max period', () => {
    expect(dashboardNewsWindow(runs, 'max')).toEqual({ start: '2023-01-03', end: '2026-09-11' });
  });

  it('moves a leap day back to February 28', () => {
    const leap = [{ startDate: '2020-01-02', endDate: '2024-02-29' }];

    expect(dashboardNewsWindow(leap, '1y')?.start).toBe('2023-02-28');
  });

  it('has no window without runs', () => {
    expect(dashboardNewsWindow([], '1y')).toBeUndefined();
  });

  it('has no window when runs carry no dates', () => {
    expect(dashboardNewsWindow([{ startDate: '', endDate: '' }], '1y')).toBeUndefined();
  });
});
