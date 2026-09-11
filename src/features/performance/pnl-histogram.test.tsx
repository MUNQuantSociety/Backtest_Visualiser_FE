import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Trade } from '@/features/backtests';

import { PnlHistogram } from './pnl-histogram';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ data }: { data: { count: number }[] }) => (
    <div data-testid="histogram-count">{data.reduce((total, bin) => total + bin.count, 0)}</div>
  ),
  Bar: () => null,
  Cell: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const trade: Trade = {
  id: 'open',
  symbol: 'AAPL',
  side: 'long',
  quantity: 1,
  entryDate: '2026-01-01',
  entryPrice: 100,
  exitDate: null,
  exitPrice: null,
  pnl: 0,
  returnPct: 0,
  fees: 0,
};

describe('closed-trade P&L histogram', () => {
  it('excludes open lots by status, even if an older payload assigns them P&L', () => {
    render(
      <PnlHistogram
        trades={[
          { ...trade, pnl: 25 },
          { ...trade, id: 'closed', exitDate: '2026-01-02', exitPrice: 110, pnl: 10 },
        ]}
      />,
    );
    expect(screen.getByTestId('histogram-count')).toHaveTextContent('1');
  });

  it('says there are no closed trades for an entry-only report', () => {
    render(<PnlHistogram trades={[trade]} />);
    expect(screen.getByText('No closed trades to plot.')).toBeInTheDocument();
  });

  it('identifies closed break-even trades instead of claiming none exist', () => {
    render(<PnlHistogram trades={[{ ...trade, exitDate: '2026-01-02', exitPrice: 100 }]} />);
    expect(screen.getByText(/All closed trades broke even/)).toBeInTheDocument();
    expect(screen.queryByText('No closed trades to plot.')).not.toBeInTheDocument();
  });
});
