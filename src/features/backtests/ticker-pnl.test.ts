import { describe, expect, it } from 'vitest';

import { tickerPnlRows, tickerPnlTotal } from './ticker-pnl';
import type { Trade } from './types';

let nextId = 0;
function trade(overrides: Partial<Trade>): Trade {
  nextId += 1;
  return {
    id: `t${String(nextId)}`,
    symbol: 'AAPL',
    side: 'long',
    entryDate: '2025-01-02',
    exitDate: '2025-01-10',
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    pnl: 100,
    returnPct: 0.1,
    fees: 1,
    ...overrides,
  };
}

describe('tickerPnlRows', () => {
  it('is empty for a run with no trades', () => {
    expect(tickerPnlRows([])).toEqual([]);
  });

  it('sums realised P&L and fees per ticker, and nets fees off', () => {
    const [row] = tickerPnlRows([trade({ pnl: 100, fees: 1 }), trade({ pnl: -40, fees: 2 })]);

    expect(row).toMatchObject({ ticker: 'AAPL', realisedPnl: 60, fees: 3, netPnl: 57 });
  });

  it('counts closed trades and the share that made money', () => {
    const [row] = tickerPnlRows([
      trade({ pnl: 100 }),
      trade({ pnl: -40 }),
      trade({ pnl: 5 }),
      trade({ pnl: 0 }),
    ]);

    expect(row).toMatchObject({ closedTrades: 4, winRate: 0.5 });
  });

  it('counts an open lot’s fees but not its unrealised P&L', () => {
    const [row] = tickerPnlRows([
      trade({ pnl: 100, fees: 1 }),
      trade({ exitDate: null, exitPrice: null, pnl: 999, fees: 2 }),
    ]);

    expect(row).toMatchObject({ realisedPnl: 100, fees: 3, netPnl: 97, openLots: 1 });
  });

  it('gives no win rate to a ticker with only open lots', () => {
    const [row] = tickerPnlRows([trade({ exitDate: null, exitPrice: null, pnl: 0 })]);

    expect(row).toMatchObject({ closedTrades: 0, winRate: null, openLots: 1 });
  });

  it('orders tickers by net P&L, best first, then by ticker', () => {
    const rows = tickerPnlRows([
      trade({ symbol: 'MSFT', pnl: -50, fees: 0 }),
      trade({ symbol: 'NVDA', pnl: 200, fees: 0 }),
      trade({ symbol: 'AMZN', pnl: 0, fees: 0 }),
      trade({ symbol: 'AAPL', pnl: 0, fees: 0 }),
    ]);

    expect(rows.map((row) => row.ticker)).toEqual(['NVDA', 'AAPL', 'AMZN', 'MSFT']);
  });
});

describe('tickerPnlTotal', () => {
  it('adds up every ticker, with a win rate over all closed trades', () => {
    const rows = tickerPnlRows([
      trade({ symbol: 'AAPL', pnl: 100, fees: 1 }),
      trade({ symbol: 'MSFT', pnl: -40, fees: 2 }),
      trade({ symbol: 'MSFT', exitDate: null, exitPrice: null, pnl: 0, fees: 3 }),
    ]);

    expect(tickerPnlTotal(rows)).toEqual({
      realisedPnl: 60,
      fees: 6,
      netPnl: 54,
      closedTrades: 2,
      wins: 1,
      winRate: 0.5,
      openLots: 1,
    });
  });

  it('has no win rate when nothing closed', () => {
    expect(tickerPnlTotal([]).winRate).toBeNull();
  });
});
