import { describe, expect, it } from 'vitest';

import { renderWithProviders, screen, within } from '@/test/test-utils';

import { TickerPnlTable } from './ticker-pnl-table';
import { backtestDetailSchema, type Trade } from './types';

let nextId = 0;
function trade(overrides: Partial<Trade>): Trade {
  nextId += 1;
  return {
    id: `run:${String(nextId)}`,
    symbol: 'AAPL',
    side: 'long',
    quantity: 10,
    entryDate: '2026-01-02',
    entryPrice: 100,
    exitDate: '2026-01-10',
    exitPrice: 110,
    pnl: 100,
    returnPct: 0.1,
    fees: 1,
    ...overrides,
  };
}

function report(trades: Trade[]) {
  return backtestDetailSchema.parse({
    id: 'run',
    name: 'Recorded run',
    strategyId: 'strategy',
    strategyName: 'Strategy',
    symbol: 'MULTI',
    timeframe: '1d',
    status: 'completed',
    startDate: '2026-01-01',
    endDate: '2026-01-30',
    createdAt: '2026-01-31T00:00:00Z',
    initialCapital: 100_000,
    finalEquity: 100_000,
    totalReturn: 0,
    sharpe: 0,
    maxDrawdown: 0,
    metrics: {
      totalReturn: 0,
      cagr: 0,
      sharpe: 0,
      sortino: 0,
      maxDrawdown: 0,
      volatility: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
    },
    equityCurve: [],
    trades,
  });
}

function rowCells(name: string) {
  const header = screen.getByRole('rowheader', { name });
  return within(header.closest('tr')!)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

describe('TickerPnlTable', () => {
  it('lists one row per ticker, best net P&L first', () => {
    renderWithProviders(
      <TickerPnlTable
        detail={report([
          trade({ symbol: 'MSFT', pnl: -40, fees: 2 }),
          trade({ symbol: 'AAPL', pnl: 100, fees: 1 }),
        ])}
      />,
    );

    const tickers = screen
      .getAllByRole('rowheader')
      .map((header) => header.textContent)
      .filter((name) => name !== 'Total');
    expect(tickers).toEqual(['AAPL', 'MSFT']);
  });

  it('shows net, realized, fees, trade counts and win rate for a ticker', () => {
    renderWithProviders(
      <TickerPnlTable
        detail={report([
          trade({ pnl: 100, fees: 1 }),
          trade({ pnl: -40, fees: 2 }),
          trade({ exitDate: null, exitPrice: null, pnl: 0, fees: 3 }),
        ])}
      />,
    );

    expect(rowCells('AAPL')).toEqual(['+$54.00', '+$60.00', '$6.00', '2', '50%', '1']);
  });

  it('totals every ticker in the footer', () => {
    renderWithProviders(
      <TickerPnlTable
        detail={report([
          trade({ symbol: 'AAPL', pnl: 100, fees: 1 }),
          trade({ symbol: 'MSFT', pnl: -40, fees: 2 }),
        ])}
      />,
    );

    expect(rowCells('Total')).toEqual(['+$57.00', '+$60.00', '$3.00', '2', '50%', '0']);
  });

  it('links each ticker to its ticker page', () => {
    renderWithProviders(<TickerPnlTable detail={report([trade({ symbol: 'BRK.B' })])} />);

    expect(screen.getByRole('link', { name: 'BRK.B' })).toHaveAttribute('href', '/tickers/BRK.B');
  });

  it('shows a dash for win rate when a ticker has only open lots', () => {
    renderWithProviders(
      <TickerPnlTable detail={report([trade({ exitDate: null, exitPrice: null, pnl: 0 })])} />,
    );

    expect(rowCells('AAPL')[4]).toBe('—');
  });

  it('says so when the run has no trades', () => {
    renderWithProviders(<TickerPnlTable detail={report([])} />);

    expect(screen.getByText('No trades to break down.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says so when the report is unavailable', () => {
    renderWithProviders(<TickerPnlTable detail={undefined} />);

    expect(screen.getByText('Trade records unavailable.')).toBeInTheDocument();
  });
});
