import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { recordedFillCount } from './trade-report';
import { TradesTable } from './trades-table';
import { backtestDetailSchema, type Trade } from './types';

const openLot: Trade = {
  id: 'run:1',
  symbol: 'AAPL',
  side: 'long',
  quantity: 3.125,
  entryDate: '2026-01-02',
  entryPrice: 100.25,
  exitDate: null,
  exitPrice: null,
  pnl: 0,
  returnPct: 0,
  fees: 0.02,
};

function report(trades: Trade[], fillCount: number) {
  return backtestDetailSchema.parse({
    id: 'run',
    name: 'Recorded run',
    strategyId: 'strategy',
    strategyName: 'Strategy',
    symbol: 'AAPL',
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
    reportMetadata: { execution: { fillCount, message: null } },
  });
}

function count(label: string) {
  return screen.getByText(label).nextElementSibling;
}

describe('trade ledger', () => {
  it('contains long ledgers in a keyboard-scrollable region with sticky headings', () => {
    const lots = Array.from({ length: 100 }, (_, index) => ({ ...openLot, id: `run:${index}` }));
    render(<TradesTable detail={report(lots, 100)} />);
    const region = screen.getByRole('region', { name: 'Trade ledger rows' });
    expect(region).toHaveClass('report-table-scroll');
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getAllByRole('row')).toHaveLength(101);
    expect(
      within(region).getByRole('columnheader', { name: 'Ticker' }).closest('thead'),
    ).toHaveClass('sticky', 'top-0', 'bg-card');
    expect(region).not.toContainElement(screen.getByText('Recorded fills'));
  });

  it('shows an entry-only open lot without inventing an exit or realized P&L', () => {
    render(<TradesTable detail={report([openLot], 1)} />);
    const row = within(screen.getByRole('row', { name: /AAPL Long Open/ }));
    expect(row.getByText('2026-01-02')).toBeInTheDocument();
    expect(row.getByText('3.125')).toBeInTheDocument();
    expect(row.getByText('$100.25')).toBeInTheDocument();
    expect(row.getAllByText('—')).toHaveLength(3);
    expect(count('Recorded fills')).toHaveTextContent('1');
    expect(count('Open trade lots')).toHaveTextContent('1');
    expect(count('Closed trades')).toHaveTextContent('0');
  });

  it('keeps both halves of a partial close and distinguishes fills, open lots, and closed lots', () => {
    const closed: Trade = {
      ...openLot,
      id: 'run:0',
      quantity: 50,
      exitDate: '2026-01-09',
      exitPrice: 110.25,
      pnl: 500,
      returnPct: 0.09975,
      fees: 0.5,
    };
    render(<TradesTable detail={report([closed, { ...openLot, quantity: 50 }], 2)} />);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    const closedRow = within(screen.getByRole('row', { name: /AAPL Long Closed/ }));
    expect(closedRow.getByText('2026-01-09')).toBeInTheDocument();
    expect(closedRow.getByText('$110.25')).toBeInTheDocument();
    expect(closedRow.getByText('+$500.00')).toBeInTheDocument();
    expect(closedRow.getByText('$0.50')).toBeInTheDocument();
    expect(count('Recorded fills')).toHaveTextContent('2');
    expect(count('Trade lots')).toHaveTextContent('2');
    expect(count('Open trade lots')).toHaveTextContent('1');
    expect(count('Closed trades')).toHaveTextContent('1');
  });

  it('shows zero fills honestly and preserves the run-specific signal explanation', () => {
    const detail = report([], 0);
    detail.reportMetadata = {
      execution: { fillCount: 0, message: 'No ticker exceeded the entry threshold.' },
    };
    render(<TradesTable detail={detail} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('No ticker exceeded the entry threshold.')).toBeInTheDocument();
    expect(count('Recorded fills')).toHaveTextContent('0');
    expect(count('Trade lots')).toHaveTextContent('0');
  });

  it('does not infer a missing fill count from lots in older reports', () => {
    const detail = report([openLot], 1);
    delete detail.reportMetadata;
    render(<TradesTable detail={detail} />);
    expect(count('Recorded fills')).toHaveTextContent('—');
    expect(count('Trade lots')).toHaveTextContent('1');
  });
});

describe('recorded fill count', () => {
  it('prefers the explicit execution count, including zero, over the legacy count', () => {
    expect(recordedFillCount({ execution: { fillCount: 0, message: null }, fill_count: 8 })).toBe(
      0,
    );
    expect(recordedFillCount({ fill_count: 3 })).toBe(3);
  });

  it.each([undefined, null, '3', -1, 0.5, NaN, Infinity])(
    'rejects invalid legacy count %s',
    (fill_count) => {
      expect(recordedFillCount({ fill_count })).toBeNull();
    },
  );
});
