import type { DashboardPeriod } from '@/lib/ui-store';

import type { BacktestSummary } from './types';

const PERIOD_YEARS: Record<Exclude<DashboardPeriod, 'max'>, number> = {
  '1y': 1,
  '2y': 2,
  '5y': 5,
};

/** An ISO date `years` before `iso`, on the same calendar day (Feb 29 → Feb 28). */
function yearsBefore(iso: string, years: number): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const shifted = new Date(Date.UTC(year - years, month - 1, day));
  if (shifted.getUTCMonth() !== month - 1) shifted.setUTCDate(0);
  return shifted.toISOString().slice(0, 10);
}

/**
 * The dates the dashboard's news covers: the same backtest window its charts use.
 *
 * News is not a live feed, so the dashboard shows articles from the period its
 * runs cover, not "the latest". The window ends on the runs' latest end date
 * (`dashboardEndDate`) and reaches back by the chosen period, never before the
 * earliest run began; `max` spans every run. Undefined when no run has dates.
 */
export function dashboardNewsWindow(
  runs: readonly Pick<BacktestSummary, 'startDate' | 'endDate'>[],
  period: DashboardPeriod,
): { start: string; end: string } | undefined {
  const ends = runs.map((run) => run.endDate).filter(Boolean);
  const starts = runs.map((run) => run.startDate).filter(Boolean);
  if (ends.length === 0 || starts.length === 0) return undefined;
  const end = [...ends].sort().at(-1) ?? '';
  const earliest = [...starts].sort()[0] ?? end;
  if (period === 'max') return { start: earliest, end };
  const lookback = yearsBefore(end, PERIOD_YEARS[period]);
  return { start: lookback > earliest ? lookback : earliest, end };
}
