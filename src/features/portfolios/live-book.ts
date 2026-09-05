import type { TickerIndicators } from '@/features/market';
import { sharpeRatio, toReturns } from '@/utils/metrics';

import type { EquitySamplePoint, Execution, PortfolioDetail, PortfolioSummary } from './types';

/**
 * The Live Trading page's numbers, as plain data.
 *
 * Everything here is derived from what the sleeves already report, rolled up
 * to the master book: the page never asks the server for a total it could get
 * wrong relative to the parts beneath it.
 */

export const LIVE_PERIODS = ['1W', '1M', 'YTD', '2Y'] as const;
export type LivePeriod = (typeof LIVE_PERIODS)[number];

export function isLivePeriod(value: string): value is LivePeriod {
  return (LIVE_PERIODS as readonly string[]).includes(value);
}

/** Calendar days of history a period needs. */
export function periodDays(period: LivePeriod, now: Date = new Date()): number {
  switch (period) {
    case '1W':
      return 7;
    case '1M':
      return 31;
    case 'YTD': {
      const jan1 = Date.UTC(now.getUTCFullYear(), 0, 1);
      return Math.max(7, Math.ceil((now.getTime() - jan1) / 86_400_000));
    }
    case '2Y':
      return 730;
  }
}

const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Return from the last close at or before `fromDate` to the latest close.
 * Falls back to the first point when the series starts after `fromDate`.
 */
export function returnSince(points: readonly EquitySamplePoint[], fromDate: string): number {
  if (points.length < 2) return 0;
  let base = points[0];
  for (const point of points) {
    if (point.date <= fromDate) base = point;
    else break;
  }
  const last = points[points.length - 1];
  if (!base || !last || base.equity === 0) return 0;
  return last.equity / base.equity - 1;
}

/** Month to date: from the last close of the previous month. */
export function mtdReturn(points: readonly EquitySamplePoint[], now: Date = new Date()): number {
  return returnSince(points, isoOf(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));
}

/** Year to date: from the last close of the previous year. */
export function ytdReturn(points: readonly EquitySamplePoint[], now: Date = new Date()): number {
  return returnSince(points, isoOf(Date.UTC(now.getUTCFullYear() - 1, 11, 31)));
}

/** Where the book sits against its running peak, and when that peak was. */
export function currentDrawdown(points: readonly EquitySamplePoint[]): {
  drawdown: number;
  peakDate: string | null;
} {
  let peak = -Infinity;
  let peakDate: string | null = null;
  for (const point of points) {
    if (point.equity > peak) {
      peak = point.equity;
      peakDate = point.date;
    }
  }
  const last = points[points.length - 1];
  if (!last || peak <= 0) return { drawdown: 0, peakDate: null };
  return { drawdown: last.equity / peak - 1, peakDate };
}

/** Annualised Sharpe over the trailing `sessions` closes. */
export function trailingSharpe(points: readonly EquitySamplePoint[], sessions = 60): number {
  const equity = points.slice(-(sessions + 1)).map((point) => point.equity);
  if (equity.length < 3) return 0;
  return sharpeRatio(toReturns(equity));
}

export interface SleeveRow {
  id: string;
  name: string;
  strategyClass: string;
  state: PortfolioSummary['state'];
  /** Capital share assigned by the portfolio manager. */
  weight: number;
  /** Gross notional as a ratio of the sleeve's NAV. */
  gross: number;
  nav: number;
  day: number;
  mtd: number;
  sharpe60: number;
  /** The last 60 closes, for the sparkline. */
  spark: number[];
}

export function sleeveRows(
  summaries: readonly PortfolioSummary[],
  equities: ReadonlyMap<string, readonly EquitySamplePoint[]>,
  details: ReadonlyMap<string, PortfolioDetail>,
): SleeveRow[] {
  return summaries.map((summary) => {
    const points = equities.get(summary.id) ?? [];
    const detail = details.get(summary.id);
    const grossNotional = detail
      ? detail.positions.reduce((sum, position) => sum + Math.abs(position.marketValue), 0)
      : summary.totalValue - summary.cash;
    return {
      id: summary.id,
      name: summary.name,
      strategyClass: summary.strategyClass,
      state: summary.state,
      weight: summary.allocationWeight,
      gross: summary.totalValue === 0 ? 0 : grossNotional / summary.totalValue,
      nav: summary.totalValue,
      day: summary.dayPnl,
      mtd: mtdReturn(points),
      sharpe60: trailingSharpe(points),
      spark: points.slice(-60).map((point) => point.equity),
    };
  });
}

export type Side = 'long' | 'short';

export interface BookPosition {
  ticker: string;
  side: Side;
  quantity: number;
  avgPrice: number;
  lastPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  /** Share of the master book's NAV, signed by side. */
  weight: number;
  sector: string;
  sleeve: string;
  sleeveId: string;
}

/** Every position across the sleeves, largest |weight| first. */
export function bookPositions(
  details: readonly PortfolioDetail[],
  tickerSectors: Readonly<Record<string, string>>,
): BookPosition[] {
  const nav = details.reduce((sum, detail) => sum + detail.totalValue, 0);
  return details
    .flatMap((detail) =>
      detail.positions.map((position): BookPosition => {
        const side: Side = position.quantity < 0 ? 'short' : 'long';
        const signed = side === 'short' ? -Math.abs(position.marketValue) : position.marketValue;
        return {
          ticker: position.ticker,
          side,
          quantity: Math.abs(position.quantity),
          avgPrice: position.avgPrice,
          lastPrice: position.lastPrice,
          marketValue: position.marketValue,
          unrealizedPnl: position.unrealizedPnl,
          weight: nav === 0 ? 0 : signed / nav,
          sector: tickerSectors[position.ticker] ?? '—',
          sleeve: detail.name,
          sleeveId: detail.id,
        };
      }),
    )
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

export interface FillRow {
  id: string;
  time: string;
  ticker: string;
  side: Execution['side'];
  quantity: number;
  price: number;
  sleeve: string;
  sleeveId: string;
  reason: string | null;
}

/** Today's fills across the sleeves, newest first. */
export function fillsToday(
  batches: readonly { sleeve: PortfolioSummary; items: readonly Execution[] }[],
  now: Date = new Date(),
): FillRow[] {
  const today = now.toISOString().slice(0, 10);
  return batches
    .flatMap(({ sleeve, items }) =>
      items
        .filter((execution) => execution.executedAt.slice(0, 10) === today)
        .map((execution): FillRow => ({
          id: execution.id,
          time: execution.executedAt,
          ticker: execution.ticker,
          side: execution.side,
          quantity: execution.quantity,
          price: execution.price,
          sleeve: sleeve.name,
          sleeveId: sleeve.id,
          reason: execution.reason ?? execution.algo,
        })),
    )
    .sort((a, b) => b.time.localeCompare(a.time));
}

export interface HeldRow {
  ticker: string;
  side: Side;
  /** Net weight across sleeves, signed by side. */
  weight: number;
  rsi14: number;
  sentiment7d: number;
}

/**
 * Indicator rows for the names the book holds.
 *
 * Sorted so the worst news comes first: a negative score on a long, or a
 * positive one on a short. Either is the position sentiment argues against.
 */
export function heldRows(
  indicators: readonly TickerIndicators[],
  positions: readonly BookPosition[],
): HeldRow[] {
  const weights = new Map<string, number>();
  for (const position of positions) {
    weights.set(position.ticker, (weights.get(position.ticker) ?? 0) + position.weight);
  }
  const against = (row: HeldRow) => (row.side === 'long' ? row.sentiment7d : -row.sentiment7d);
  return indicators
    .flatMap((indicator): HeldRow[] => {
      const weight = weights.get(indicator.ticker);
      if (weight === undefined) return [];
      return [
        {
          ticker: indicator.ticker,
          side: weight < 0 ? 'short' : 'long',
          weight,
          rsi14: indicator.rsi14,
          sentiment7d: indicator.sentiment7d,
        },
      ];
    })
    .sort((a, b) => against(a) - against(b));
}

/** The book's score: each name's 7-day sentiment weighted by |weight|. */
export function bookSentiment(rows: readonly HeldRow[]): number {
  const total = rows.reduce((sum, row) => sum + Math.abs(row.weight), 0);
  if (total === 0) return 0;
  return rows.reduce((sum, row) => sum + row.sentiment7d * Math.abs(row.weight), 0) / total;
}
