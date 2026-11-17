import { z } from 'zod';

/**
 * The geometry and storage behind `ChartDrawings`, kept apart from the
 * component so it can be tested without a chart.
 */

export type DrawingTool =
  'trend' | 'ray' | 'horizontal' | 'vertical' | 'rectangle' | 'fib' | 'text';

/** Longest text note, so a pasted essay cannot fill the chart or the storage. */
export const MAX_NOTE_LENGTH = 200;

/** A point on the chart in market terms, so a drawing stays put as the chart pans and zooms. */
export interface DrawingPoint {
  date: string;
  price: number;
}

export interface Drawing {
  id: string;
  tool: DrawingTool;
  points: DrawingPoint[];
  /** A text note's words. */
  text?: string | undefined;
}

/** The candle fields the magnet snaps to. */
export interface SnapCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * The magnet: `point` moved onto the nearest open, high, low or close of the
 * session at its date. A date with no session (past the last bar) is left as is.
 */
export function snapToCandle(
  candles: readonly SnapCandle[],
  dates: readonly string[],
  point: DrawingPoint,
): DrawingPoint {
  const logical = dateToLogical(dates, point.date);
  const candle = logical === null ? undefined : candles[logical];
  if (!candle || candle.date !== point.date) return point;
  const prices = [candle.open, candle.high, candle.low, candle.close];
  const nearest = prices.reduce((best, price) =>
    Math.abs(price - point.price) < Math.abs(best - point.price) ? price : best,
  );
  return { date: point.date, price: nearest };
}

/**
 * `drawing` shifted by `sessions` bars and `priceChange`, as a drag moves it.
 * Always applied to the drawing as it was when the drag began, so rounding to
 * whole sessions never accumulates.
 */
export function moveDrawing(
  drawing: Drawing,
  dates: readonly string[],
  sessions: number,
  priceChange: number,
): Drawing {
  return {
    ...drawing,
    points: drawing.points.map((point) => {
      const logical = dateToLogical(dates, point.date);
      const date = logical === null ? null : logicalToDate(dates, logical + sessions);
      return { date: date ?? point.date, price: point.price + priceChange };
    }),
  };
}

/** The retracement levels TradingView draws by default. */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

/** Each level's price for a retracement drawn from `start` to `end`: 0 at the end, 1 at the start. */
export function fibPrices(start: number, end: number) {
  return FIB_LEVELS.map((level) => ({ level, price: end + (start - end) * level }));
}

/**
 * Where a ray from (x1, y1) through (x2, y2) leaves a `width` by `height`
 * plot. Never short of the second point, so a ray is at least its segment.
 */
export function rayEnd(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { x: x2, y: y2 };
  const toEdge = (from: number, delta: number, size: number) =>
    delta > 0 ? (size - from) / delta : delta < 0 ? -from / delta : Number.POSITIVE_INFINITY;
  const t = Math.max(1, Math.min(toEdge(x1, dx, width), toEdge(y1, dy, height)));
  return { x: x1 + dx * t, y: y1 + dy * t };
}

const DAY_MS = 24 * 60 * 60 * 1000;

const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const fromDayNumber = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
/**
 * Weekdays from a fixed Monday up to and including `day`. Day 0 (1 January
 * 1970) was a Thursday, three days after a Monday, hence the offset.
 */
function weekdaysThrough(day: number): number {
  const fromMonday = day + 3;
  const weeks = Math.floor(fromMonday / 7);
  return weeks * 5 + Math.min(fromMonday - weeks * 7 + 1, 5);
}

/** The weekday that is the `count`th counted by `weekdaysThrough`. */
function nthWeekday(count: number): number {
  const index = count - 1;
  const weeks = Math.floor(index / 5);
  return weeks * 7 + (index - weeks * 5) - 3;
}

/** Weekdays after `from` up to `to`, or minus those from `to` up to `from`. */
function weekdaysBetween(from: number, to: number): number {
  return to >= from
    ? weekdaysThrough(to) - weekdaysThrough(from)
    : weekdaysThrough(to - 1) - weekdaysThrough(from - 1);
}

/** The weekday `sessions` weekdays after (or before, when negative) `from`. */
function addWeekdays(from: number, sessions: number): number {
  if (sessions === 0) return from;
  return sessions > 0
    ? nthWeekday(weekdaysThrough(from) + sessions)
    : nthWeekday(weekdaysThrough(from - 1) + sessions + 1);
}

/**
 * The bar position of `date` among `dates` (sorted, one per session). A date
 * outside them, from a longer range or to the right of the last bar, is
 * placed by counting weekdays, which is a session each but for holidays.
 */
export function dateToLogical(dates: readonly string[], date: string): number | null {
  const first = dates[0];
  const last = dates.at(-1);
  if (first === undefined || last === undefined) return null;
  if (date < first) return weekdaysBetween(dayNumber(first), dayNumber(date));
  if (date > last) return dates.length - 1 + weekdaysBetween(dayNumber(last), dayNumber(date));
  let low = 0;
  let high = dates.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((dates[middle] ?? '') < date) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The inverse of `dateToLogical`: the session at `logical`, or a weekday past either end. */
export function logicalToDate(dates: readonly string[], logical: number): string | null {
  const first = dates[0];
  const last = dates.at(-1);
  if (first === undefined || last === undefined) return null;
  const index = Math.round(logical);
  if (index < 0) return fromDayNumber(addWeekdays(dayNumber(first), index));
  if (index > dates.length - 1) {
    return fromDayNumber(addWeekdays(dayNumber(last), index - (dates.length - 1)));
  }
  return dates[index] ?? null;
}

const storedSchema = z
  .array(
    z.object({
      id: z.string(),
      tool: z.enum(['trend', 'ray', 'horizontal', 'vertical', 'rectangle', 'fib', 'text']),
      points: z
        .array(z.object({ date: z.string(), price: z.number() }))
        .min(1)
        .max(2),
      text: z.string().max(MAX_NOTE_LENGTH).optional(),
    }),
  )
  .catch([]);

const storageName = (key: string) => `chart-drawings:${key}`;

/** This browser's drawings for `key`; none when storage is empty, blocked or unreadable. */
export function loadDrawings(key: string): Drawing[] {
  try {
    const raw = localStorage.getItem(storageName(key));
    return raw ? storedSchema.parse(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveDrawings(key: string, drawings: readonly Drawing[]): void {
  try {
    if (drawings.length === 0) localStorage.removeItem(storageName(key));
    else localStorage.setItem(storageName(key), JSON.stringify(drawings));
  } catch {
    // Private windows and full storage: the drawings still last the session.
  }
}

const MAGNET_STORAGE = 'chart-drawings-magnet';

/** Whether this browser last left the magnet on. */
export function loadMagnet(): boolean {
  try {
    return localStorage.getItem(MAGNET_STORAGE) === 'on';
  } catch {
    return false;
  }
}

export function saveMagnet(on: boolean): void {
  try {
    if (on) localStorage.setItem(MAGNET_STORAGE, 'on');
    else localStorage.removeItem(MAGNET_STORAGE);
  } catch {
    // Storage blocked: the magnet still works for this visit.
  }
}
