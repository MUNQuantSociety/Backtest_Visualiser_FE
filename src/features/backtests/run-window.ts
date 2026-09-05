import type { CoverageResponse, TickerCoverage } from './types';

/**
 * Pure helpers behind the run dialog's window section: date presets, the
 * coverage bar's geometry, and the footer's size estimate. No React, so the
 * clamping and the arithmetic can be asserted without rendering the form.
 */

export type WindowPreset = '1y' | '2y' | '5y' | 'max' | '2022';

export const WINDOW_PRESETS: readonly { value: WindowPreset; label: string }[] = [
  { value: '1y', label: '1Y' },
  { value: '2y', label: '2Y' },
  { value: '5y', label: '5Y' },
  { value: 'max', label: 'Max' },
  { value: '2022', label: '2022' },
];

export function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function clamp(day: string, start: string, end: string): string {
  if (day < start) return start;
  if (day > end) return end;
  return day;
}

/**
 * The window a preset means, clamped to coverage. A preset that would reach
 * before the data starts is floored there rather than refused: "as much as
 * you have" is what someone pressing 5Y on a two-year dataset wants.
 */
export function presetWindow(
  preset: WindowPreset,
  coverage: { start: string; end: string },
): { startDate: string; endDate: string } {
  const { start, end } = coverage;
  if (preset === 'max') return { startDate: start, endDate: end };
  if (preset === '2022') {
    return { startDate: clamp('2022-01-01', start, end), endDate: clamp('2022-12-31', start, end) };
  }
  const years = preset === '1y' ? 1 : preset === '2y' ? 2 : 5;
  const from = new Date(`${end}T00:00:00Z`);
  from.setUTCFullYear(from.getUTCFullYear() - years);
  return { startDate: clamp(isoDay(from), start, end), endDate: end };
}

/** The preset a window currently matches, if any, so the control can show it. */
export function matchingPreset(
  window: { startDate: string; endDate: string },
  coverage: { start: string; end: string },
): WindowPreset | null {
  for (const { value } of WINDOW_PRESETS) {
    const candidate = presetWindow(value, coverage);
    if (candidate.startDate === window.startDate && candidate.endDate === window.endDate) {
      return value;
    }
  }
  return null;
}

const DAY_MS = 86_400_000;

function daysBetween(start: string, end: string): number {
  return Math.max(
    0,
    Math.round(
      (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / DAY_MS,
    ),
  );
}

/** Trading sessions in a window, at the usual 252-per-365 ratio. */
export function sessionsIn(startDate: string, endDate: string): number {
  return Math.round((daysBetween(startDate, endDate) * 252) / 365);
}

export interface CoverageSegment {
  /** Fractions of the full coverage span, 0–1. */
  from: number;
  to: number;
  kind: 'selected' | 'gap';
  /** For gaps: which ticker has no bars there. */
  ticker?: string | undefined;
}

/**
 * Geometry for the coverage bar: the selected window, and any stretch where
 * a ticker in the universe has no bars. Expressed as fractions so the bar can
 * be any width.
 */
export function coverageSegments(
  coverage: CoverageResponse,
  window: { startDate: string; endDate: string } | null,
): CoverageSegment[] {
  const { start, end } = coverage;
  if (!start || !end || start >= end) return [];
  const span = daysBetween(start, end);
  const at = (day: string) => Math.min(1, Math.max(0, daysBetween(start, day) / span));

  const segments: CoverageSegment[] = [];
  for (const ticker of coverage.tickers) {
    if (ticker.firstBar && ticker.firstBar > start) {
      segments.push({ from: 0, to: at(ticker.firstBar), kind: 'gap', ticker: ticker.ticker });
    }
    if (ticker.lastBar && ticker.lastBar < end) {
      segments.push({ from: at(ticker.lastBar), to: 1, kind: 'gap', ticker: ticker.ticker });
    }
  }
  if (window && window.startDate < window.endDate) {
    segments.push({ from: at(window.startDate), to: at(window.endDate), kind: 'selected' });
  }
  return segments;
}

/** Tick labels for the bar: the start and end years, plus whole years between. */
export function coverageYearTicks(coverage: { start: string; end: string }): {
  label: string;
  at: number;
}[] {
  const { start, end } = coverage;
  const span = daysBetween(start, end);
  if (span <= 0) return [];
  const ticks = [{ label: start.slice(0, 7), at: 0 }];
  const firstYear = Number(start.slice(0, 4)) + 1;
  const lastYear = Number(end.slice(0, 4));
  for (let year = firstYear; year <= lastYear; year += 1) {
    const day = `${String(year)}-01-01`;
    if (day < end) ticks.push({ label: String(year), at: daysBetween(start, day) / span });
  }
  ticks.push({ label: end.slice(0, 7), at: 1 });
  return ticks;
}

export type CoverageDot = 'full' | 'partial' | 'missing' | 'unknown';

/** How well a ticker is covered over the chosen window. */
export function tickerCoverageState(
  ticker: string,
  coverage: CoverageResponse | undefined,
  window: { startDate: string; endDate: string } | null,
): CoverageDot {
  if (!coverage) return 'unknown';
  if (coverage.missing.includes(ticker)) return 'missing';
  const row: TickerCoverage | undefined = coverage.tickers.find((t) => t.ticker === ticker);
  if (!row) return 'unknown';
  if (!row.firstBar || !row.lastBar) return 'missing';
  if (!window) return 'full';
  return row.firstBar <= window.startDate && row.lastBar >= window.endDate ? 'full' : 'partial';
}

/** The ticker whose bars start latest, when that is after coverage start. */
export function latestFirstBar(
  coverage: CoverageResponse | undefined,
): { ticker: string; firstBar: string } | null {
  if (!coverage?.start) return null;
  let latest: { ticker: string; firstBar: string } | null = null;
  for (const row of coverage.tickers) {
    if (
      row.firstBar &&
      row.firstBar > coverage.start &&
      (!latest || row.firstBar > latest.firstBar)
    ) {
      latest = { ticker: row.ticker, firstBar: row.firstBar };
    }
  }
  return latest;
}
