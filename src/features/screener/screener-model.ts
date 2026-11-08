/**
 * Pure helpers for the Stock Screener: grouping, selection, chart windows.
 * No React and no fetching, so each rule is tested on its own.
 */

import type { Candle } from '@/features/market';

import type { Quote, QuoteKind } from './types';

/** The chart's period buttons. */
export const SCREENER_PERIODS = ['7D', '30D', '90D', '1Y'] as const;
export type ScreenerPeriod = (typeof SCREENER_PERIODS)[number];

const PERIOD_DAYS: Record<ScreenerPeriod, number> = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 };

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The `start`/`end` (calendar days, inclusive) a period covers, ending on `today`. */
export function periodWindow(period: ScreenerPeriod, today: Date = new Date()) {
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - PERIOD_DAYS[period]);
  return { start: isoDay(start), end: isoDay(today) };
}

const KIND_ORDER: readonly QuoteKind[] = ['stock', 'etf', 'index', 'crypto'];
export const KIND_LABELS: Record<QuoteKind, string> = {
  stock: 'Stocks',
  etf: 'ETFs',
  index: 'Indices',
  crypto: 'Crypto',
};

export interface QuoteGroup {
  kind: QuoteKind;
  label: string;
  quotes: Quote[];
}

/**
 * Quotes split into Stocks, ETFs, Indices and Crypto, in that order, each
 * keeping the watchlist's own order. Empty groups are left out.
 */
export function groupQuotes(quotes: readonly Quote[]): QuoteGroup[] {
  return KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    quotes: quotes.filter((quote) => quote.kind === kind),
  })).filter((group) => group.quotes.length > 0);
}

/** Tickers top to bottom as the table shows them, for arrow-key moves. */
export function displayOrder(groups: readonly QuoteGroup[]): string[] {
  return groups.flatMap((group) => group.quotes.map((quote) => quote.ticker));
}

/** The ticker to show: the one asked for if it is listed, else the first row. */
export function resolveSelection(order: readonly string[], wanted: string | null): string | null {
  if (wanted && order.includes(wanted)) return wanted;
  return order[0] ?? null;
}

/** The ticker one row up (`-1`) or down (`1`), stopping at either end. */
export function stepSelection(
  order: readonly string[],
  current: string | null,
  step: -1 | 1,
): string | null {
  if (order.length === 0) return null;
  const index = current === null ? -1 : order.indexOf(current);
  if (index === -1) return order[0] ?? null;
  return order[Math.min(order.length - 1, Math.max(0, index + step))] ?? null;
}

/**
 * Change over the charted period as a ratio, first close to last.
 * Null when there are fewer than two sessions or the first close is zero.
 */
export function periodChange(candles: readonly Candle[]): number | null {
  const first = candles[0];
  const last = candles.at(-1);
  if (!first || !last || candles.length < 2 || first.close === 0) return null;
  return last.close / first.close - 1;
}
