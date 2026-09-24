import type { Trade } from './types';

/**
 * Profit and loss per ticker, built from a run's trade lots.
 *
 * Follows the ledger's own accounting: `pnl` is realised and excludes fees, and
 * an open lot has no realised P&L yet. So realised P&L counts closed lots only,
 * while fees count every lot — an open position has already paid to enter.
 * Net P&L is realised minus fees, what the ticker actually added to the run.
 */
export interface TickerPnlRow {
  ticker: string;
  realisedPnl: number;
  fees: number;
  netPnl: number;
  closedTrades: number;
  /** Closed trades with positive P&L. */
  wins: number;
  /** Share of closed trades with positive P&L; null when none closed. */
  winRate: number | null;
  openLots: number;
}

export type TickerPnlTotal = Omit<TickerPnlRow, 'ticker'>;

interface Tally {
  realisedPnl: number;
  fees: number;
  closedTrades: number;
  wins: number;
  openLots: number;
}

function emptyTally(): Tally {
  return { realisedPnl: 0, fees: 0, closedTrades: 0, wins: 0, openLots: 0 };
}

function finish(tally: Tally): TickerPnlTotal {
  return {
    realisedPnl: tally.realisedPnl,
    fees: tally.fees,
    netPnl: tally.realisedPnl - tally.fees,
    closedTrades: tally.closedTrades,
    wins: tally.wins,
    winRate: tally.closedTrades === 0 ? null : tally.wins / tally.closedTrades,
    openLots: tally.openLots,
  };
}

/** One row per ticker traded, best net P&L first; ties by ticker. */
export function tickerPnlRows(trades: readonly Trade[]): TickerPnlRow[] {
  const byTicker = new Map<string, Tally>();
  for (const trade of trades) {
    const tally = byTicker.get(trade.symbol) ?? emptyTally();
    tally.fees += trade.fees;
    if (trade.exitDate === null) {
      tally.openLots += 1;
    } else {
      tally.realisedPnl += trade.pnl;
      tally.closedTrades += 1;
      if (trade.pnl > 0) tally.wins += 1;
    }
    byTicker.set(trade.symbol, tally);
  }
  return [...byTicker.entries()]
    .map(([ticker, tally]) => ({ ticker, ...finish(tally) }))
    .sort((a, b) => b.netPnl - a.netPnl || a.ticker.localeCompare(b.ticker));
}

/** The whole run across every ticker, for the table's total row. */
export function tickerPnlTotal(rows: readonly TickerPnlRow[]): TickerPnlTotal {
  const total = emptyTally();
  for (const row of rows) {
    total.realisedPnl += row.realisedPnl;
    total.fees += row.fees;
    total.closedTrades += row.closedTrades;
    total.wins += row.wins;
    total.openLots += row.openLots;
  }
  return finish(total);
}
